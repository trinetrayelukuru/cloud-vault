const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const File = require('../models/File');
const SecurityEvent = require('../models/SecurityEvent');
const User = require('../models/User');

// Get user dashboard overview
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get storage stats
    const storageStats = await File.getUserStorageStats(userId);

    // Get recent files (last 5)
    const recentFiles = await File.findByUserId(userId, 5, 0);

    // Get file count by category
    const categoryBreakdown = await File.getFileCountByCategory(userId);

    // Get recent security events (last 5)
    const recentEvents = await SecurityEvent.getByUserId(userId, 5);

    // Get user profile
    const user = await User.findById(userId);

    res.json({
      storage: {
        used: storageStats.storage_used || 0,
        quota: storageStats.storage_quota || 10737418240, // 10 GB default
        totalFiles: storageStats.total_files || 0,
        percentage: storageStats.storage_quota > 0
          ? Math.round((storageStats.storage_used / storageStats.storage_quota) * 100)
          : 0
      },
      recentFiles: recentFiles.map(f => ({
        id: f.id,
        name: f.original_filename,
        type: f.file_type,
        category: f.file_category,
        size: f.file_size,
        uploadedAt: f.upload_timestamp,
        isShared: !!f.is_shared
      })),
      categoryBreakdown: categoryBreakdown.map(c => ({
        category: c.file_category,
        count: c.count,
        totalSize: c.total_size
      })),
      recentActivity: recentEvents.map(e => ({
        id: e.id,
        type: e.event_type,
        status: e.event_status,
        details: e.details,
        timestamp: e.timestamp
      })),
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mfaEnabled: !!user.mfa_enabled,
        webauthnEnabled: !!user.webauthn_credentials,
        accountStatus: user.account_status,
        createdAt: user.created_at,
        lastLogin: user.last_login
      }
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// Get user profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mfaEnabled: !!user.mfa_enabled,
      webauthnEnabled: !!user.webauthn_credentials,
      accountStatus: user.account_status,
      storageQuota: user.storage_quota_bytes,
      storageUsed: user.storage_used_bytes,
      createdAt: user.created_at,
      lastLogin: user.last_login
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    await User.findById(req.user.id); // Verify user exists

    // Update name (email cannot be changed for security)
    const sql = 'UPDATE users SET name = ? WHERE id = ?';
    const { runQuery } = require('../config/database');
    await runQuery(sql, [name.trim(), req.user.id]);

    res.json({ message: 'Profile updated successfully', name: name.trim() });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
