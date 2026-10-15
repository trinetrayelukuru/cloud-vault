const { runQuery, getQuery, allQuery, runTransaction } = require('../config/database');
const crypto = require('crypto');
const path = require('path');
const VaultCrypto = require('../utils/vaultCrypto');
const LocalStorage = require('../storage/LocalStorage');

class File {
  // Create a new file record
  static async create({
    userId,
    originalFilename,
    storedFilename,
    fileType,
    mimeType,
    fileSize,
    fileCategory,
    sha256Hash,
    storagePath,
    encryptedFilename,
    fileSalt
  }) {
    const sql = `
      INSERT INTO files (
        user_id, original_filename, stored_filename, encrypted_filename,
        file_type, mime_type, file_size, file_category, sha256_hash,
        storage_path, file_salt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await runQuery(sql, [
      userId,
      originalFilename,
      storedFilename,
      encryptedFilename,
      fileType,
      mimeType,
      fileSize,
      fileCategory,
      sha256Hash,
      storagePath,
      fileSalt
    ]);

    // Update user's storage usage
    await this.updateUserStorageUsage(userId);

    return result.id;
  }

  // Find file by ID
  static async findById(fileId) {
    const sql = 'SELECT * FROM files WHERE id = ?';
    return await getQuery(sql, [fileId]);
  }

  // Find files by user
  static async findByUserId(userId, limit = 50, offset = 0) {
    const sql = `
      SELECT * FROM files
      WHERE user_id = ?
      ORDER BY upload_timestamp DESC
      LIMIT ? OFFSET ?
    `;
    return await allQuery(sql, [userId, limit, offset]);
  }

  // Search files by name
  static async searchByName(userId, searchTerm) {
    const sql = `
      SELECT * FROM files
      WHERE user_id = ? AND original_filename LIKE ?
      ORDER BY upload_timestamp DESC
      LIMIT 50
    `;
    return await allQuery(sql, [userId, `%${searchTerm}%`]);
  }

  // Get files by category
  static async findByCategory(userId, category) {
    const sql = `
      SELECT * FROM files
      WHERE user_id = ? AND file_category = ?
      ORDER BY upload_timestamp DESC
    `;
    return await allQuery(sql, [userId, category]);
  }

  // Update last accessed time
  static async updateLastAccessed(fileId) {
    const sql = `
      UPDATE files
      SET last_accessed = strftime('%s', 'now')
      WHERE id = ?
    `;
    await runQuery(sql, [fileId]);
  }

  // Delete file record
  static async delete(fileId) {
    const file = await this.findById(fileId);
    if (!file) return false;

    const sql = 'DELETE FROM files WHERE id = ?';
    await runQuery(sql, [fileId]);

    // Update user's storage usage
    await this.updateUserStorageUsage(file.user_id);

    return true;
  }

  // Update user's storage usage
  static async updateUserStorageUsage(userId) {
    const sql = `
      UPDATE users
      SET storage_used_bytes = (
        SELECT COALESCE(SUM(file_size), 0)
        FROM files
        WHERE user_id = ?
      )
      WHERE id = ?
    `;
    await runQuery(sql, [userId, userId]);
  }

  // Get user's storage stats
  static async getUserStorageStats(userId) {
    const sql = `
      SELECT
        COUNT(*) as total_files,
        COALESCE(SUM(file_size), 0) as storage_used,
        (SELECT storage_quota_bytes FROM users WHERE id = ?) as storage_quota
      FROM files
      WHERE user_id = ?
    `;
    return await getQuery(sql, [userId, userId]);
  }

  // Get file count by category for user
  static async getFileCountByCategory(userId) {
    const sql = `
      SELECT
        file_category,
        COUNT(*) as count,
        SUM(file_size) as total_size
      FROM files
      WHERE user_id = ?
      GROUP BY file_category
    `;
    return await allQuery(sql, [userId]);
  }

  // Check if user has enough storage quota
  static async hasStorageQuota(userId, fileSizeBytes) {
    const stats = await this.getUserStorageStats(userId);
    return (stats.storage_used + fileSizeBytes) <= stats.storage_quota;
  }

  // Generate unique stored filename
  static generateStoredFilename(originalFilename) {
    const ext = path.extname(originalFilename);
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(8).toString('hex');
    return `${timestamp}-${randomBytes}${ext}`;
  }

  // Calculate SHA-256 hash from file buffer
  static calculateHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  // Verify file integrity
  static async verifyIntegrity(fileId, actualHash) {
    const file = await this.findById(fileId);
    if (!file) return { valid: false, reason: 'File not found' };

    if (file.sha256_hash !== actualHash) {
      return {
        valid: false,
        reason: 'Hash mismatch',
        expected: file.sha256_hash,
        actual: actualHash
      };
    }

    return { valid: true };
  }

  // Verify file integrity at storage level (cryptographic verification)
  static async verifyAtRest(fileId, userId) {
    const file = await this.findById(fileId);
    if (!file) return { valid: false, reason: 'File not found' };
    if (file.user_id !== userId) return { valid: false, reason: 'Access denied' };

    const storage = new LocalStorage();
    const result = await storage.verifyFileIntegrity(file.storage_path, {
      userId,
      expectedSha256: file.sha256_hash
    });

    // Log the integrity check
    const { runQuery } = require('../config/database');
    await runQuery(
      `INSERT INTO file_access_log (file_id, user_id, action, success, details) VALUES (?, ?, 'INTEGRITY_CHECK', ?, ?)`,
      [fileId, userId, result.valid ? 1 : 0, result.valid ? 'Integrity verified' : result.reason]
    );

    return result;
  }

  // Get all files (admin only - metadata)
  static async getAllFilesMetadata(limit = 100) {
    const sql = `
      SELECT
        f.id,
        f.original_filename,
        f.encrypted_filename,
        f.file_type,
        f.mime_type,
        f.file_size,
        f.file_category,
        f.upload_timestamp,
        u.email as owner_email,
        u.name as owner_name
      FROM files f
      JOIN users u ON f.user_id = u.id
      ORDER BY f.upload_timestamp DESC
      LIMIT ?
    `;
    return await allQuery(sql, [limit]);
  }

  // Get total storage usage across all users
  static async getTotalStorageUsage() {
    const sql = `
      SELECT
        COUNT(*) as total_files,
        COALESCE(SUM(file_size), 0) as total_storage_bytes
      FROM files
    `;
    return await getQuery(sql);
  }
}

module.exports = File;
