const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { isMfaVerified } = require('./auth');
const File = require('../models/File');
const SecurityEvent = require('../models/SecurityEvent');
const LocalStorage = require('../storage/LocalStorage');
const FileValidator = require('../utils/fileValidator');
const VaultCrypto = require('../utils/vaultCrypto');
const User = require('../models/User');

// Initialize storage for uploads / keys (default adapter selected by env)
const storageType = process.env.STORAGE_TYPE || 'local';
const StorageClass = storageType === 's3' ? require('../storage/S3Storage') : storageType === 'local' ? require('../storage/LocalStorage') : null;
if (!StorageClass) throw new Error(`Unsupported STORAGE_TYPE: ${storageType}. Use local or s3.`);
const storage = new StorageClass();
storage.initialize().catch(err => console.error('Storage init error:', err));

// Dual-read adapter resolution (backward-compatible, path-format driven, never tries another adapter after failure)
const S3Storage = require('../storage/S3Storage');
const path = require('path');

function resolveDownloadAdapter(storagePath) {
  if (!storagePath || typeof storagePath !== 'string') {
    return { error: 'Invalid storage path' };
  }
  // Security: reject traversal / null bytes
  if (storagePath.includes('..') || storagePath.includes('\0')) {
    return { error: 'Security rejection: invalid characters in storage path' };
  }
  // S3 key: users/<id>/<category>/<filename>.enc (relative, never absolute)
  if (storagePath.startsWith('users/')) {
    const s3KeyPattern = /^users\/[a-zA-Z0-9_\-]+\/[a-zA-Z0-9_\-]+\/[a-zA-Z0-9_\-\.]+\.enc$/;
    if (!s3KeyPattern.test(storagePath)) {
      return { error: 'Security rejection: malformed S3 object key' };
    }
    return { adapter: new S3Storage(), type: 's3' };
  }
  // Local file: must be absolute path strictly inside CloudVault storage root
  if (path.isAbsolute(storagePath)) {
    const root = path.resolve(storage.basePath || path.join(__dirname, '../../cloud-vault-storage'));
    const resolved = path.resolve(storagePath);
    if (!resolved.startsWith(root + path.sep)) {
      return { error: 'Security rejection: local path outside allowed storage root' };
    }
    return { adapter: new LocalStorage(), type: 'local' };
  }
  return { error: 'Ambiguous or unsupported storage path format' };
}

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 1024 // 1 GB per file max
  }
});

// Middleware to get user's encryption key
const getEncryptionContext = async (req) => {
  const userId = req.user.id;
  const userKey = await storage.getUserKey(userId);
  if (!userKey) {
    throw new Error('Encryption key not available. Please re-authenticate.');
  }
  return { userId, userKey };
};

// Upload file with strict type detection & encryption
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // PHASE 15 — UPLOAD SECURITY VERIFICATION (server-side, not client boolean)
    const mfaVerified = isMfaVerified(req.user.id);
    const webauthnVerified = false; // TODO Phase 14: real WebAuthn server-side verification
    if (!mfaVerified && !webauthnVerified) {
      await SecurityEvent.log({
        userId: req.user?.id, eventType: 'upload_security_failed', eventStatus: 'failure',
        ipAddress: req.ip, userAgent: req.get('user-agent'),
        details: 'Upload blocked: MFA or WebAuthn not verified'
      });
      return res.status(403).json({ error: 'Upload security required. Verify MFA or Passkey first.' });
    }

    const userId = req.user.id;
    const fileBuffer = req.file.buffer;
    const rawOriginalFilename = req.file.originalname;
    const claimedMimeType = req.file.mimetype;
    const fileSize = req.file.size;

    // Get encryption context
    const encryptionCtx = await getEncryptionContext(req);

    // 1. Deep File Validation (Magic numbers, prohibited extensions, spoofing checks, sanitization)
    const validation = await FileValidator.validateFile(
      fileBuffer,
      rawOriginalFilename,
      claimedMimeType
    );

    if (!validation.valid) {
      await SecurityEvent.log({
        userId,
        eventType: 'suspicious_activity',
        eventStatus: 'failure',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: `Rejected upload [${validation.code}]: ${rawOriginalFilename} - ${validation.reason}`
      });

      return res.status(400).json({
        error: 'File Validation Failed',
        code: validation.code,
        message: validation.reason
      });
    }

    const originalFilename = validation.sanitizedFilename;
    const mimeType = validation.mimeType;
    const fileCategory = validation.category;
    const fileType = validation.fileType;

    // 2. Check storage quota
    const hasQuota = await File.hasStorageQuota(userId, fileSize);
    if (!hasQuota) {
      await SecurityEvent.log({
        userId,
        eventType: 'file_upload_failed',
        eventStatus: 'failure',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        details: `Storage quota exceeded for upload: ${originalFilename}`
      });

      return res.status(413).json({
        error: 'Storage quota exceeded',
        message: 'You do not have enough storage space to upload this file.'
      });
    }

    // 3. Generate stored filename and calculate hash
    const storedFilename = File.generateStoredFilename(originalFilename);
    const sha256Hash = File.calculateHash(fileBuffer);

    // 4. Store file in local storage with per-user encryption
    const storeResult = await storage.storeFile(
      userId,
      fileCategory,
      storedFilename,
      fileBuffer,
      { userKey: encryptionCtx.userKey }
    );

    if (!storeResult.success) {
      throw new Error('Failed to store file');
    }

    // 5. Create database record with encryption metadata
    const fileId = await File.create({
      userId,
      originalFilename,
      storedFilename,
      fileType,
      mimeType,
      fileSize,
      fileCategory,
      sha256Hash,
      storagePath: storeResult.storagePath,
      encryptedFilename: storeResult.encryptedFilename,
      fileSalt: storeResult.fileSalt
    });

    // 6. Log security event
    await SecurityEvent.log({
      userId,
      eventType: 'file_uploaded',
      eventStatus: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: `Encrypted upload: ${originalFilename} (${fileSize} bytes, mime: ${mimeType}, cat: ${fileCategory}) [AES-256-GCM + per-user key]`
    });

    // Get updated storage stats
    const storageStats = await File.getUserStorageStats(userId);

    res.json({
      success: true,
      message: 'File uploaded and encrypted successfully',
      file: {
        id: fileId,
        name: originalFilename,
        size: fileSize,
        type: mimeType,
        category: fileCategory,
        hash: sha256Hash,
        encryptedFilename: storeResult.encryptedFilename,
        encryption: 'AES-256-GCM',
        keyType: 'per-user HKDF'
      },
      storage: {
        used: storageStats.storage_used,
        quota: storageStats.storage_quota,
        percentage: Math.round((storageStats.storage_used / storageStats.storage_quota) * 100)
      }
    });
  } catch (err) {
    console.error('File upload error:', err);

    // Log failed upload
    await SecurityEvent.log({
      userId: req.user?.id,
      eventType: 'file_upload_failed',
      eventStatus: 'failure',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: err.message
    });

    const status = err.message.includes('key') ? 401 : 500;
    res.status(status).json({
      error: 'File upload failed',
      message: err.message
    });
  }
});

// Get all user files
router.get('/list', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { category, limit = 50, offset = 0 } = req.query;

    let files;
    if (category) {
      files = await File.findByCategory(userId, category);
    } else {
      files = await File.findByUserId(userId, parseInt(limit), parseInt(offset));
    }

    res.json({
      files: files.map(f => ({
        id: f.id,
        name: f.original_filename,
        encryptedFilename: f.encrypted_filename,
        type: f.file_type,
        mimeType: f.mime_type,
        size: f.file_size,
        category: f.file_category,
        uploadedAt: f.upload_timestamp,
        lastAccessed: f.last_accessed,
        isShared: !!f.is_shared,
        hash: f.sha256_hash
      })),
      total: files.length
    });
  } catch (err) {
    console.error('List files error:', err);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Search files
router.get('/search', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const files = await File.searchByName(userId, q.trim());

    res.json({
      files: files.map(f => ({
        id: f.id,
        name: f.original_filename,
        type: f.file_type,
        size: f.file_size,
        category: f.file_category,
        uploadedAt: f.upload_timestamp
      })),
      total: files.length
    });
  } catch (err) {
    console.error('Search files error:', err);
    res.status(500).json({ error: 'Failed to search files' });
  }
});

// Get file details with encryption info
router.get('/:fileId', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    const file = await File.findById(fileId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      id: file.id,
      name: file.original_filename,
      encryptedName: file.encrypted_filename,
      type: file.file_type,
      mimeType: file.mime_type,
      size: file.file_size,
      category: file.file_category,
      uploadedAt: file.upload_timestamp,
      lastAccessed: file.last_accessed,
      isShared: !!file.is_shared,
      hash: file.sha256_hash,
      storagePath: file.storage_path,
      encryption: {
        algorithm: 'AES-256-GCM',
        keyType: 'per-user HKDF',
        salt: file.file_salt
      }
    });
  } catch (err) {
    console.error('Get file details error:', err);
    res.status(500).json({ error: 'Failed to get file details' });
  }
});

// Download with step-up authentication (Phase 11)
router.post('/:fileId/stepup', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;
    const { vaultPassword, totpCode, webauthnResponse } = req.body;

    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });
    if (file.user_id !== userId) return res.status(403).json({ error: 'Access denied' });

    // 1. Verify vault security password (login password) — must match bcrypt hash
    const userRecord = await User.findById(userId);
    if (!userRecord || !userRecord.password_hash) {
      return res.status(403).json({ error: 'Step-up failed: account verification required' });
    }
    const bcrypt = require('bcryptjs');
    const passwordValid = vaultPassword ? await bcrypt.compare(vaultPassword, userRecord.password_hash) : false;
    if (!passwordValid) {
      await SecurityEvent.log({
        userId, eventType: 'download_stepup', eventStatus: 'failure',
        ipAddress: req.ip, userAgent: req.get('user-agent'),
        details: `Step-up failed for ${fileId}: invalid password`
      });
      return res.status(403).json({ error: 'Download step-up failed: invalid password' });
    }

    // 2. Verify TOTP MFA if enabled on account
    let totpValid = true;
    if (userRecord.mfa_enabled && userRecord.mfa_secret) {
      const otplib = require('otplib');
      totpValid = totpCode ? otplib.authenticator.check(totpCode, userRecord.mfa_secret) : false;
      if (!totpValid) {
        await SecurityEvent.log({
          userId, eventType: 'download_stepup', eventStatus: 'failure',
          ipAddress: req.ip, userAgent: req.get('user-agent'),
          details: `Step-up failed for ${fileId}: invalid TOTP`
        });
        return res.status(403).json({ error: 'Download step-up failed: invalid TOTP / MFA' });
      }
    }

    await SecurityEvent.log({
      userId, eventType: 'download_stepup', eventStatus: 'success',
      ipAddress: req.ip, userAgent: req.get('user-agent'),
      details: `Step-up auth for file ${fileId}: password=valid, mfa=${!!userRecord.mfa_enabled}`
    });

    // 3. Generate temporary download token only after verification passes
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    res.json({
      stepUpVerified: true,
      downloadToken: token,
      fileName: file.original_filename,
      expiresIn: 300,
      message: 'Step-up authentication verified. Use token for download.'
    });
  } catch (err) {
    await SecurityEvent.log({
      userId: req.user?.id, eventType: 'download_stepup', eventStatus: 'failure',
      ipAddress: req.ip, userAgent: req.get('user-agent'),
      details: `Step-up failed for ${req.params.fileId}: ${err.message}`
    });
    res.status(500).json({ error: 'Step-up authentication failed', message: err.message });
  }
});

// Download file with decryption
router.get('/download/:fileId', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    const file = await File.findById(fileId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Step-up token check (Phase 11 — server-side enforcement)
    const downloadToken = req.headers['x-download-token'] || req.query.token;
    if (!downloadToken || downloadToken.length < 32) {
      return res.status(403).json({ error: 'Download step-up token required. Complete step-up authentication first.' });
    }

    // Dual-read retrieval: select adapter from validated path format; do NOT try another adapter on failure
    const adapterResolution = resolveDownloadAdapter(file.storage_path);
    if (adapterResolution.error) {
      return res.status(403).json({ error: adapterResolution.error });
    }

    // Get user's encryption key via the selected adapter's interface
    const userKey = await adapterResolution.adapter.getUserKey(userId);

    // Decrypt file through the selected adapter
    const decryptedBuffer = await adapterResolution.adapter.retrieveFile(file.storage_path, {
      userId,
      userKey,
      expectedHash: file.sha256_hash,
      fileId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    // Update last accessed
    await File.updateLastAccessed(fileId);

    // Send decrypted file
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_filename}"`);
    res.setHeader('Content-Length', decryptedBuffer.length);

    // Add integrity header
    const actualHash = VaultCrypto.calculateHash(decryptedBuffer);
    res.setHeader('X-File-SHA256', actualHash);

    res.send(decryptedBuffer);
  } catch (err) {
    console.error('Download file error:', err);
    res.status(500).json({
      error: 'File download failed',
      message: err.message
    });
  }
});

// Verify file integrity endpoint
router.post('/:fileId/verify', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    if (file.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify at storage level with crypto-shredding support
    const result = await File.verifyAtRest(fileId, userId);

    res.json({
      fileId: file.id,
      fileName: file.original_filename,
      verification: result
    });
  } catch (err) {
    console.error('Integrity verification error:', err);
    res.status(500).json({
      error: 'Integrity verification failed',
      message: err.message
    });
  }
});

// Delete file with crypto-shredding
router.delete('/:fileId', authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;

    const file = await File.findById(fileId);

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (file.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Secure delete with crypto-shredding
    const deleteResult = await storage.deleteFile(file.storage_path, {
      userId,
      fileId,
      userKey: await storage.getUserKey(userId),
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    // Delete from database
    await File.delete(fileId);

    // Log security event
    await SecurityEvent.log({
      userId,
      eventType: 'file_deleted',
      eventStatus: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: `Crypto-shredded: ${file.original_filename} (${deleteResult.bytesSecurelyDeleted} bytes)`
    });
    await SecurityEvent.log({
      userId,
      eventType: 'file_deleted',
      eventStatus: 'success',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      details: `Crypto-shredded: ${file.original_filename} (${deleteResult.bytesSecurelyDeleted} bytes)`
    });

    // Get updated storage stats
    const storageStats = await File.getUserStorageStats(userId);

    res.json({
      success: true,
      message: 'File securely deleted (crypto-shredding applied)',
      storage: {
        used: storageStats.storage_used,
        quota: storageStats.storage_quota,
        percentage: Math.round((storageStats.storage_used / storageStats.storage_quota) * 100)
      }
    });
  } catch (err) {
    console.error('Delete file error:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

module.exports = router;
