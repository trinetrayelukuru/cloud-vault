const express = require('express');
const router = express.Router();
const User = require('../models/User');
const SecurityEvent = require('../models/SecurityEvent');
const LocalStorage = require('../storage/LocalStorage');
const { generateToken, authenticate, requireAdmin } = require('../middleware/auth');
const { allQuery, getQuery } = require('../config/database');
const vaultStorage = new LocalStorage();

const getClientIp = (req) => {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
};

// Admin Login Endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'];

    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password.' });
    }

    const user = await User.findByEmail(email);

    // If user does not exist or is NOT an admin, reject
    if (!user || user.role !== 'admin') {
      await SecurityEvent.log({
        eventType: 'ADMIN_LOGIN_UNAUTHORIZED',
        status: 'failure',
        ipAddress,
        userAgent,
        details: `Unauthorized admin login attempt for email: ${email}`
      });
      return res.status(401).json({ error: 'Invalid admin credentials or insufficient privileges.' });
    }

    // Check account lockout
    const isLocked = await User.isAccountLocked(user.id);
    if (isLocked) {
      const lockMinutes = Math.ceil((user.locked_until - Math.floor(Date.now() / 1000)) / 60);
      await SecurityEvent.log({
        userId: user.id,
        eventType: 'ADMIN_LOGIN_BLOCKED_LOCKED',
        status: 'failure',
        ipAddress,
        userAgent,
        details: `Admin login attempt on locked account (${lockMinutes} min remaining)`
      });
      return res.status(423).json({
        error: `Admin account is temporarily locked due to multiple failed login attempts. Please try again in ${lockMinutes} minutes.`
      });
    }

    // Verify password
    const isPasswordValid = await User.verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      const isNowLocked = await User.incrementFailedAttempts(user.id);
      await SecurityEvent.log({
        userId: user.id,
        eventType: isNowLocked ? 'ADMIN_ACCOUNT_LOCKED' : 'ADMIN_LOGIN_FAILED',
        status: 'failure',
        ipAddress,
        userAgent,
        details: isNowLocked
          ? 'Admin account locked after 3 failed attempts'
          : `Failed admin password attempt (${user.failed_login_attempts + 1}/3)`
      });

      if (isNowLocked) {
        return res.status(423).json({
          error: 'Admin account locked due to 3 failed attempts. Please try again in 15 minutes.'
        });
      }

      return res.status(401).json({
        error: 'Invalid admin credentials.',
        attemptsRemaining: 3 - (user.failed_login_attempts + 1)
      });
    }

    // Success
    await User.updateLastLogin(user.id, ipAddress);

    await SecurityEvent.log({
      userId: user.id,
      eventType: 'ADMIN_LOGIN_SUCCESS',
      status: 'success',
      ipAddress,
      userAgent,
      details: 'Vault Admin logged in successfully'
    });

    const token = generateToken(user.id, user.role);

    res.json({
      message: 'Admin authentication successful!',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        mfaEnabled: !!user.mfa_enabled
      }
    });

  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Admin authentication failed.' });
  }
});

// Admin System Overview (Protected)
router.get('/overview', authenticate, requireAdmin, async (req, res) => {
  try {
    const totalUsersRow = await getQuery('SELECT COUNT(*) as count FROM users WHERE role = "user"');
    const activeUsersRow = await getQuery('SELECT COUNT(*) as count FROM users WHERE role = "user" AND account_status = "active"');
    const suspendedUsersRow = await getQuery('SELECT COUNT(*) as count FROM users WHERE role = "user" AND account_status = "suspended"');
    const totalFilesRow = await getQuery('SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as totalBytes FROM files');
    const securityAlertsRow = await getQuery('SELECT COUNT(*) as count FROM security_events WHERE event_status = "failure"');

    const recentEvents = await SecurityEvent.getAll(8);

    res.json({
      metrics: {
        totalUsers: totalUsersRow?.count || 0,
        activeUsers: activeUsersRow?.count || 0,
        suspendedUsers: suspendedUsersRow?.count || 0,
        totalFiles: totalFilesRow?.count || 0,
        totalStorageBytes: totalFilesRow?.totalBytes || 0,
        securityAlerts: securityAlertsRow?.count || 0
      },
      recentEvents
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ error: 'Failed to load admin overview metrics.' });
  }
});

// Admin User List (Metadata Only - ZERO KNOWLEDGE)
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await User.getAll();
    res.json({ users });
  } catch (err) {
    console.error('Admin get users error:', err);
    res.status(500).json({ error: 'Failed to fetch users list.' });
  }
});

// Admin: File Access Audit Log
router.get('/audit/file-access', authenticate, requireAdmin, async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const logs = await SecurityEvent.getFileAccessLogs(parseInt(limit));
    res.json({ logs, total: logs.length });
  } catch (err) {
    console.error('Admin file access audit error:', err);
    res.status(500).json({ error: 'Failed to fetch file access logs.' });
  }
});

// Admin: Encryption Key Status
router.get('/audit/encryption-status', authenticate, requireAdmin, async (req, res) => {
  try {
    const { getQuery } = require('../config/database');

    // Count users with encryption keys
    const encryptionStats = await getQuery(`
      SELECT
        COUNT(DISTINCT ek.user_id) as users_with_keys,
        COUNT(ek.id) as total_key_records,
        MIN(ek.created_at) as earliest_key_date,
        MAX(ek.derived_key_version) as max_key_version
      FROM encryption_keys ek
    `);

    // Get storage encryption status
    const storageInfo = await vaultStorage.getStorageUsage();
    const totalEncryptedFiles = storageInfo.totalEncrypted || 0;

    res.json({
      encryption: {
        algorithm: 'AES-256-GCM',
        keyDerivation: 'HKDF-SHA256',
        filenameEncryption: 'AES-256-GCM',
        perUserKeys: true,
        cryptoShredding: true,
        storageEncryption: 'at-rest',
        ...encryptionStats
      },
      storage: {
        totalEncryptedFiles,
        basePath: vaultStorage.basePath
      }
    });
  } catch (err) {
    console.error('Admin encryption status error:', err);
    res.status(500).json({ error: 'Failed to fetch encryption status.' });
  }
});

// Admin: Verify all user files integrity
router.post('/audit/verify-all-files', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    const { allQuery } = require('../config/database');

    if (userId) {
      // Verify specific user's files
      const files = await allQuery(`SELECT * FROM files WHERE user_id = ?`, [userId]);
      const storage = new LocalStorage();
      const results = await storage.verifyAllUserFiles(userId, files);
      res.json({ userId, results });
    } else {
      // Verify all files across all users
      const allFiles = await allQuery(`SELECT * FROM files`);
      const storage = new LocalStorage();
      const results = [];
      for (const file of allFiles) {
        const result = await storage.verifyFileIntegrity(file.storage_path, {
          userId: file.user_id,
          expectedSha256: file.sha256_hash
        });
        results.push({ fileId: file.id, userId: file.user_id, fileName: file.original_filename, ...result });
      }
      res.json({ totalFiles: results.length, results });
    }
  } catch (err) {
    console.error('Admin verify files error:', err);
    res.status(500).json({ error: 'Failed to verify files.' });
  }
});

// Admin: Suspend User
router.post('/users/:userId/suspend', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (targetUser.role === 'admin') return res.status(403).json({ error: 'Cannot suspend admin accounts' });

    await User.updateAccountStatus(userId, 'suspended');
    await SecurityEvent.log({
      userId: req.user.id, eventType: 'ADMIN_SUSPEND_USER', eventStatus: 'success',
      ipAddress: req.ip, userAgent: req.get('user-agent'),
      details: `Admin suspended user ${targetUser.email}`
    });
    res.json({ message: `User ${targetUser.email} has been suspended` });
  } catch (err) {
    console.error('Admin suspend error:', err);
    res.status(500).json({ error: 'Failed to suspend user' });
  }
});

// Admin: Terminate User
router.post('/users/:userId/terminate', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    if (targetUser.role === 'admin') return res.status(403).json({ error: 'Cannot terminate admin accounts' });

    await User.updateAccountStatus(userId, 'terminated');
    await SecurityEvent.log({
      userId: req.user.id, eventType: 'ADMIN_TERMINATE_USER', eventStatus: 'success',
      ipAddress: req.ip, userAgent: req.get('user-agent'),
      details: `Admin terminated user ${targetUser.email}`
    });
    res.json({ message: `User ${targetUser.email} has been terminated` });
  } catch (err) {
    console.error('Admin terminate error:', err);
    res.status(500).json({ error: 'Failed to terminate user' });
  }
});

// Admin: Reactivate User
router.post('/users/:userId/reactivate', authenticate, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    await User.updateAccountStatus(userId, 'active');
    await User.unlockAccount(userId);
    await SecurityEvent.log({
      userId: req.user.id, eventType: 'ADMIN_REACTIVATE_USER', eventStatus: 'success',
      ipAddress: req.ip, userAgent: req.get('user-agent'),
      details: `Admin reactivated user ${targetUser.email}`
    });
    res.json({ message: `User ${targetUser.email} has been reactivated` });
  } catch (err) {
    console.error('Admin reactivate error:', err);
    res.status(500).json({ error: 'Failed to reactivate user' });
  }
});

module.exports = router;
