const crypto = require('crypto');
const path = require('path');

// Cloud Vault Binary Envelope Constants
const ENVELOPE_MAGIC = Buffer.from('CVLT', 'utf-8'); // 4 bytes Magic Header
const ENVELOPE_VERSION = 0x01;                       // 1 byte Version (v1)
const ALGO_AES_256_GCM = 0x01;                       // 1 byte Algorithm Identifier
const IV_LENGTH = 12;                                // 12 bytes recommended for AES-GCM (96 bits)
const AUTH_TAG_LENGTH = 16;                          // 16 bytes authentication tag (128 bits)
const HEADER_LENGTH = ENVELOPE_MAGIC.length + 2 + IV_LENGTH + AUTH_TAG_LENGTH; // 4 + 1 + 1 + 12 + 16 = 34 bytes
const SALT_LENGTH = 16;                              // 16 bytes for HKDF salt
const FILENAME_SALT_LENGTH = 16;                     // 16 bytes for filename encryption salt

class VaultCrypto {
  /**
   * Retrieve the master 256-bit encryption key
   */
  static getMasterKey() {
    const rawKey = process.env.VAULT_ENCRYPTION_KEY;
    if (!rawKey) {
      console.warn('⚠️ VAULT_ENCRYPTION_KEY not set in env. Using derived development fallback key.');
      return crypto.createHash('sha256').update('cloudevault_default_dev_secret_key_2026').digest();
    }

    if (rawKey.length === 64) {
      // 64 hex characters = 32 bytes
      return Buffer.from(rawKey, 'hex');
    }

    // Otherwise derive 32-byte key via SHA-256
    return crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Generate a random salt for HKDF key derivation
   */
  static generateSalt() {
    return crypto.randomBytes(SALT_LENGTH).toString('hex');
  }

  /**
   * Derive a unique per-user encryption key using HKDF.
   * The master key wraps the per-user key — even if a per-user key is
   * compromised, the master key and all other users' keys remain safe.
   *
   * @param {string} salt - Hex-encoded salt for this user
   * @param {string} info - Context string for HKDF
   * @returns {Buffer} 32-byte derived key
   */
  static deriveUserKey(salt, info = 'cloudevault-user-key') {
    const masterKey = this.getMasterKey();
    const saltBuffer = Buffer.from(salt, 'hex');
    const result = crypto.hkdfSync('sha256', masterKey, saltBuffer, Buffer.from(info), 32);
    // Convert ArrayBuffer to Buffer for Node.js compatibility
    return Buffer.from(result);
  }

  /**
   * Check if a key derivation result is valid
   */
  static isValidKey(key) {
    return Buffer.isBuffer(key) && key.length === 32;
  }

  /**
   * Derive a file-specific key from the user's key for layered encryption.
   * Each file gets a unique key derived from user key + file salt.
   *
   * @param {Buffer} userKey - The user's derived key (32 bytes)
   * @param {string} fileSalt - Hex-encoded salt for this file
   * @returns {Buffer} 32-byte file-specific key
   */
  static deriveFileKey(userKey, fileSalt) {
    const saltBuffer = Buffer.from(fileSalt, 'hex');
    return crypto.hkdfSync('sha256', userKey, saltBuffer, Buffer.from('cloudevault-file-key'), 32);
  }

  /**
   * Encrypt a filename so it cannot be read on disk.
   * Uses AES-256-GCM with a filename-specific key derived from user key.
   *
   * @param {string} filename - Original filename
   * @param {Buffer} userKey - User's derived key
   * @returns {string} Hex-encoded encrypted filename + salt
   */
  static encryptFilename(filename, userKey) {
    const salt = crypto.randomBytes(FILENAME_SALT_LENGTH);
    const fileKey = this.deriveFileKey(userKey, salt.toString('hex'));
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv('aes-256-gcm', fileKey, iv);
    const aad = Buffer.from('cloudevault-filename');
    cipher.setAAD(aad);

    const encrypted = Buffer.concat([
      cipher.update(filename, 'utf-8'),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();

    // Format: salt(16) + iv(12) + tag(16) + ciphertext
    const result = Buffer.concat([salt, iv, authTag, encrypted]);
    return result.toString('hex');
  }

  /**
   * Decrypt a filename that was encrypted with encryptFilename.
   *
   * @param {string} encryptedHex - Hex-encoded encrypted filename data
   * @param {Buffer} userKey - User's derived key
   * @returns {string} Decrypted original filename
   */
  static decryptFilename(encryptedHex, userKey) {
    const buffer = Buffer.from(encryptedHex, 'hex');

    if (buffer.length < SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Invalid encrypted filename format.');
    }

    let offset = 0;
    const salt = buffer.subarray(offset, offset + SALT_LENGTH);
    offset += SALT_LENGTH;
    const iv = buffer.subarray(offset, offset + IV_LENGTH);
    offset += IV_LENGTH;
    const authTag = buffer.subarray(offset, offset + AUTH_TAG_LENGTH);
    offset += AUTH_TAG_LENGTH;
    const ciphertext = buffer.subarray(offset);

    const fileKey = this.deriveFileKey(userKey, salt.toString('hex'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', fileKey, iv);
    const aad = Buffer.from('cloudevault-filename');
    decipher.setAAD(aad);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);

    return plaintext.toString('utf-8');
  }

  /**
   * Encrypt a file buffer using AES-256-GCM and package into a Cloud Vault envelope.
   * Per-user encryption key is used if provided; falls back to master key.
   *
   * Envelope format:
   * [MAGIC (4B)] [VERSION (1B)] [ALGO (1B)] [USER_SALT (16B)] [IV (12B)] [AUTH_TAG (16B)] [CIPHERTEXT (N bytes)]
   * Total Header Overhead: 49 bytes (with user salt)
   *
   * @param {Buffer} plaintextBuffer
   * @param {Object} options
   * @returns {Buffer} Encrypted envelope buffer
   */
  static encrypt(plaintextBuffer, options = {}) {
    if (!Buffer.isBuffer(plaintextBuffer)) {
      plaintextBuffer = Buffer.from(plaintextBuffer);
    }

    const userKey = options.userKey || null;
    let key;
    let envelopeSalt = null;

    if (userKey) {
      // Use per-user derived key
      key = userKey;
      envelopeSalt = crypto.randomBytes(SALT_LENGTH);
      key = crypto.hkdfSync('sha256', userKey, envelopeSalt, Buffer.from('cloudevault-file-key'), 32);
    } else {
      // Fallback to master key
      key = this.getMasterKey();
    }

    const iv = crypto.randomBytes(IV_LENGTH);

    // Create AES-256-GCM cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    // Additional Authenticated Data (AAD): Authenticates the magic header and version
    let aad = Buffer.concat([
      ENVELOPE_MAGIC,
      Buffer.from([ENVELOPE_VERSION, ALGO_AES_256_GCM])
    ]);
    if (envelopeSalt) {
      aad = Buffer.concat([aad, envelopeSalt]);
    }
    cipher.setAAD(aad);

    // Encrypt payload
    const ciphertext = Buffer.concat([
      cipher.update(plaintextBuffer),
      cipher.final()
    ]);

    // Extract 128-bit authentication tag
    const authTag = cipher.getAuthTag();

    // Build the binary envelope
    let envelope;
    if (envelopeSalt) {
      // With user-specific salt
      envelope = Buffer.concat([
        ENVELOPE_MAGIC,                        // 4 bytes
        Buffer.from([ENVELOPE_VERSION, ALGO_AES_256_GCM]), // 2 bytes
        envelopeSalt,                          // 16 bytes
        iv,                                    // 12 bytes
        authTag,                               // 16 bytes
        ciphertext                             // N bytes
      ]);
    } else {
      // Legacy: without user-specific salt
      envelope = Buffer.concat([
        aad,         // 6 bytes (CVLT + 0x01 + 0x01)
        iv,          // 12 bytes
        authTag,     // 16 bytes
        ciphertext   // Encrypted file data
      ]);
    }

    return envelope;
  }

  /**
   * Decrypt a Cloud Vault envelope buffer back to plaintext.
   * Supports both legacy (without user salt) and new (with user salt) format.
   *
   * @param {Buffer} envelopeBuffer
   * @param {Object} options
   * @returns {Buffer} Decrypted plaintext buffer
   */
  static decrypt(envelopeBuffer, options = {}) {
    if (!Buffer.isBuffer(envelopeBuffer)) {
      envelopeBuffer = Buffer.from(envelopeBuffer);
    }

    if (envelopeBuffer.length < HEADER_LENGTH) {
      throw new Error('Invalid envelope: Buffer too small to contain Cloud Vault encryption header.');
    }

    // 1. Verify Magic Header
    const magic = envelopeBuffer.subarray(0, 4);
    if (!magic.equals(ENVELOPE_MAGIC)) {
      throw new Error('Invalid envelope: Magic header mismatch. File is not a valid encrypted Cloud Vault file.');
    }

    // 2. Read version & algorithm
    const version = envelopeBuffer[4];
    const algo = envelopeBuffer[5];

    if (version !== ENVELOPE_VERSION) {
      throw new Error(`Unsupported encryption envelope version: ${version}`);
    }

    if (algo !== ALGO_AES_256_GCM) {
      throw new Error(`Unsupported encryption algorithm identifier: ${algo}`);
    }

    let offset = 6;
    let userKey = options.userKey || null;

    // Check if new format with user salt (offset 6-21 = 16 bytes)
    // If file is longer than the legacy minimum AND we have a userKey, try new format
    const fileSize = envelopeBuffer.length;

    if (userKey && fileSize > HEADER_LENGTH + 16) {
      // Try new format: magic(4) + version(1) + algo(1) + salt(16) + iv(12) + tag(16) + ciphertext
      const envelopeSalt = envelopeBuffer.subarray(offset, offset + SALT_LENGTH);
      offset += SALT_LENGTH;

      const derivedKey = Buffer.from(crypto.hkdfSync('sha256', userKey, envelopeSalt, Buffer.from('cloudevault-file-key'), 32));
      const iv = envelopeBuffer.subarray(offset, offset + IV_LENGTH);
      offset += IV_LENGTH;

      const authTag = envelopeBuffer.subarray(offset, offset + AUTH_TAG_LENGTH);
      offset += AUTH_TAG_LENGTH;

      const ciphertext = envelopeBuffer.subarray(offset);

      const aad = Buffer.concat([
        ENVELOPE_MAGIC,
        Buffer.from([ENVELOPE_VERSION, ALGO_AES_256_GCM]),
        envelopeSalt
      ]);

      const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
      decipher.setAAD(aad);
      decipher.setAuthTag(authTag);

      try {
        return Buffer.concat([
          decipher.update(ciphertext),
          decipher.final()
        ]);
      } catch (err) {
        throw new Error(`Decryption or integrity verification failed (Auth Tag Mismatch / Tampered File): ${err.message}`);
      }
    }

    // Legacy format fallback (no user salt)
    const iv = envelopeBuffer.subarray(offset, offset + IV_LENGTH);
    offset += IV_LENGTH;

    const authTag = envelopeBuffer.subarray(offset, offset + AUTH_TAG_LENGTH);
    offset += AUTH_TAG_LENGTH;

    const ciphertext = envelopeBuffer.subarray(offset);

    if (!userKey) {
      userKey = this.getMasterKey();
    }

    const key = options.key || userKey;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);

    const aad = envelopeBuffer.subarray(0, 6);
    decipher.setAAD(aad);
    decipher.setAuthTag(authTag);

    try {
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);
      return plaintext;
    } catch (err) {
      throw new Error(`Decryption or integrity verification failed (Auth Tag Mismatch / Tampered File): ${err.message}`);
    }
  }

  /**
   * Check if a buffer is a Cloud Vault encrypted envelope
   */
  static isEncrypted(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < HEADER_LENGTH) {
      return false;
    }
    return buffer.subarray(0, 4).equals(ENVELOPE_MAGIC);
  }

  /**
   * Calculate SHA-256 hash
   */
  static calculateHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }
}

module.exports = VaultCrypto;
