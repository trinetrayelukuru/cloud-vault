const { runQuery, getQuery, allQuery, runTransaction } = require('../config/database');
const bcrypt = require('bcryptjs');
const VaultCrypto = require('../utils/vaultCrypto');

class User {
  // Create a new user
  static async create({ email, name, password, role = 'user', googleId = null }) {
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    // Generate unique salt for this user's encryption key
    const encryptionSalt = VaultCrypto.generateSalt();

    // Derive the per-user encryption key
    const derivedKey = VaultCrypto.deriveUserKey(encryptionSalt);
    const keyHash = VaultCrypto.calculateHash(derivedKey);

    const sql = `
      INSERT INTO users (email, name, password_hash, role, google_id)
      VALUES (?, ?, ?, ?, ?)
    `;

    const result = await runQuery(sql, [email, name, passwordHash, role, googleId]);

    // Store the encryption key metadata for this user
    const insertKeySql = `
      INSERT INTO encryption_keys (user_id, salt, key_hash, derived_key_version, created_at)
      VALUES (?, ?, ?, 1, strftime('%s', 'now'))
    `;
    await runQuery(insertKeySql, [result.id, encryptionSalt, keyHash]);

    return result.id;
  }

  // Find user by email
  static async findByEmail(email) {
    const sql = 'SELECT * FROM users WHERE email = ?';
    return await getQuery(sql, [email]);
  }

  // Find user by ID
  static async findById(id) {
    const sql = 'SELECT * FROM users WHERE id = ?';
    return await getQuery(sql, [id]);
  }

  // Find user by Google ID
  static async findByGoogleId(googleId) {
    const sql = 'SELECT * FROM users WHERE google_id = ?';
    return await getQuery(sql, [googleId]);
  }

  // Verify password
  static async verifyPassword(plainPassword, passwordHash) {
    if (!passwordHash) return false;
    return await bcrypt.compare(plainPassword, passwordHash);
  }

  // Update password
  static async updatePassword(userId, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const sql = 'UPDATE users SET password_hash = ? WHERE id = ?';
    await runQuery(sql, [passwordHash, userId]);
  }

  // Update last login
  static async updateLastLogin(userId, ipAddress) {
    const sql = `
      UPDATE users
      SET last_login = strftime('%s', 'now'),
          last_login_ip = ?,
          failed_login_attempts = 0,
          locked_until = NULL
      WHERE id = ?
    `;
    await runQuery(sql, [ipAddress, userId]);
  }

  // Increment failed login attempts
  static async incrementFailedAttempts(userId) {
    const sql = `
      UPDATE users
      SET failed_login_attempts = failed_login_attempts + 1
      WHERE id = ?
    `;
    await runQuery(sql, [userId]);

    // Check if we need to lock the account (3 attempts)
    const user = await this.findById(userId);
    if (user.failed_login_attempts >= 3) {
      await this.lockAccount(userId, 15); // Lock for 15 minutes
      return true; // Account is now locked
    }
    return false;
  }

  // Lock account
  static async lockAccount(userId, minutes) {
    const lockUntil = Math.floor(Date.now() / 1000) + (minutes * 60);
    const sql = 'UPDATE users SET locked_until = ? WHERE id = ?';
    await runQuery(sql, [lockUntil, userId]);
  }

  // Check if account is locked
  static async isAccountLocked(userId) {
    const user = await this.findById(userId);
    if (!user || !user.locked_until) return false;

    const now = Math.floor(Date.now() / 1000);
    if (user.locked_until > now) {
      return true; // Still locked
    } else {
      // Lock expired, reset
      await this.unlockAccount(userId);
      return false;
    }
  }

  // Unlock account
  static async unlockAccount(userId) {
    const sql = `
      UPDATE users
      SET locked_until = NULL,
          failed_login_attempts = 0
      WHERE id = ?
    `;
    await runQuery(sql, [userId]);
  }

  // Update account status (suspend/terminate/active)
  static async updateAccountStatus(userId, status) {
    const sql = 'UPDATE users SET account_status = ? WHERE id = ?';
    await runQuery(sql, [status, userId]);
  }

  // Get all users (for admin)
  static async getAll() {
    const sql = `
      SELECT id, email, name, role, account_status,
             storage_quota_bytes, storage_used_bytes,
             created_at, last_login, failed_login_attempts
      FROM users
      ORDER BY created_at DESC
    `;
    return await allQuery(sql);
  }

  // Update MFA settings
  static async updateMFA(userId, mfaSecret, enabled = true) {
    const sql = 'UPDATE users SET mfa_secret = ?, mfa_enabled = ? WHERE id = ?';
    await runQuery(sql, [mfaSecret, enabled ? 1 : 0, userId]);
  }

  // Update WebAuthn credentials
  static async updateWebAuthn(userId, credentialsJson) {
    const sql = 'UPDATE users SET webauthn_credentials = ? WHERE id = ?';
    await runQuery(sql, [credentialsJson, userId]);
  }

  // Update storage quota
  static async updateStorageQuota(userId, quotaBytes) {
    const sql = 'UPDATE users SET storage_quota_bytes = ? WHERE id = ?';
    await runQuery(sql, [quotaBytes, userId]);
  }

  // Get user's encryption key info
  static async getEncryptionKey(userId) {
    const sql = 'SELECT salt, key_hash, derived_key_version FROM encryption_keys WHERE user_id = ? ORDER BY created_at DESC LIMIT 1';
    return await getQuery(sql, [userId]);
  }

  // Store derived key temporarily (in-memory reference for session)
  static async storeDerivedKey(userId, derivedKey) {
    // Store in a secure in-memory map — NOT in database
    // This is held only during the active session
    if (!global._vaultDerivedKeys) global._vaultDerivedKeys = new Map();
    global._vaultDerivedKeys.set(userId, {
      key: derivedKey,
      storedAt: Date.now()
    });
  }

  // Retrieve derived key from session memory
  static async getDerivedKey(userId) {
    if (!global._vaultDerivedKeys) return null;
    const entry = global._vaultDerivedKeys.get(userId);
    if (!entry) return null;
    // Keys expire after 30 minutes of inactivity
    if (Date.now() - entry.storedAt > 30 * 60 * 1000) {
      global._vaultDerivedKeys.delete(userId);
      return null;
    }
    // Refresh timestamp on access
    entry.storedAt = Date.now();
    return entry.key;
  }

  // Clear derived key from session memory (logout/rotation)
  static async clearDerivedKey(userId) {
    if (global._vaultDerivedKeys) {
      global._vaultDerivedKeys.delete(userId);
    }
  }

  // Rotate encryption key for a user
  static async rotateEncryptionKey(userId) {
    const result = await runTransaction([
      {
        sql: 'SELECT salt FROM encryption_keys WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        params: [userId]
      },
      {
        sql: 'UPDATE encryption_keys SET last_rotated_at = strftime(\'%s\', \'now\') WHERE user_id = ? AND derived_key_version = (SELECT MAX(derived_key_version) FROM encryption_keys WHERE user_id = ?)',
        params: [userId, userId]
      }
    ]);

    // Generate new salt and derive new key
    const newSalt = VaultCrypto.generateSalt();
    const newDerivedKey = VaultCrypto.deriveUserKey(newSalt);
    const newKeyHash = VaultCrypto.calculateHash(newDerivedKey);

    const insertSql = `
      INSERT INTO encryption_keys (user_id, salt, key_hash, derived_key_version, created_at)
      VALUES (?, ?, ?, (SELECT COALESCE(MAX(derived_key_version), 0) + 1 FROM encryption_keys WHERE user_id = ?), strftime('%s', 'now'))
    `;
    await runQuery(insertSql, [userId, newSalt, newKeyHash, userId]);

    // Clear old derived key from memory
    await User.clearDerivedKey(userId);
    // Store new key
    await User.storeDerivedKey(userId, newDerivedKey);

    return { rotated: true, newVersion: result[0] ? (result[0].salt ? 0 : 1) : 1 };
  }
}

module.exports = User;
