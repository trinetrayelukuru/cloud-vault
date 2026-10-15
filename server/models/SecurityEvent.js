const { runQuery, allQuery } = require('../config/database');

class SecurityEvent {
  // Log a security event
  static async log({ userId = null, eventType, status, ipAddress, userAgent, details = null }) {
    const sql = `
      INSERT INTO security_events (user_id, event_type, event_status, ip_address, user_agent, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    try {
      await runQuery(sql, [userId, eventType, status, ipAddress, userAgent, details]);
    } catch (err) {
      console.error('Failed to log security event:', err.message);
    }
  }

  // Get recent events for a user
  static async getByUserId(userId, limit = 20) {
    const sql = `
      SELECT id, event_type, event_status, ip_address, details, timestamp
      FROM security_events
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `;
    return await allQuery(sql, [userId, limit]);
  }

  // Get all events (for admin)
  static async getAll(limit = 50) {
    const sql = `
      SELECT se.id, se.event_type, se.event_status, se.ip_address,
             se.details, se.timestamp, u.email as user_email, u.name as user_name
      FROM security_events se
      LEFT JOIN users u ON se.user_id = u.id
      ORDER BY se.timestamp DESC
      LIMIT ?
    `;
    return await allQuery(sql, [limit]);
  }

  // Get failed login events (for admin monitoring)
  static async getFailedLogins(limit = 20) {
    const sql = `
      SELECT se.id, se.ip_address, se.details, se.timestamp,
             u.email as user_email, u.name as user_name
      FROM security_events se
      LEFT JOIN users u ON se.user_id = u.id
      WHERE se.event_type = 'LOGIN_FAILED'
      ORDER BY se.timestamp DESC
      LIMIT ?
    `;
    return await allQuery(sql, [limit]);
  }

  // Get file access logs (for admin audit)
  static async getFileAccessLogs(limit = 100) {
    const sql = `
      SELECT fal.id, fal.file_id, f.original_filename, fal.user_id,
             fal.action, fal.success, fal.details, fal.timestamp,
             u.email as user_email, u.name as user_name
      FROM file_access_log fal
      LEFT JOIN files f ON fal.file_id = f.id
      LEFT JOIN users u ON fal.user_id = u.id
      ORDER BY fal.timestamp DESC
      LIMIT ?
    `;
    return await allQuery(sql, [limit]);
  }

  // Get file access logs for a specific file
  static async getFileAccessLogsByFileId(fileId, limit = 50) {
    const sql = `
      SELECT fal.id, fal.file_id, fal.user_id,
             fal.action, fal.success, fal.details, fal.timestamp,
             u.email as user_email, u.name as user_name
      FROM file_access_log fal
      LEFT JOIN users u ON fal.user_id = u.id
      WHERE fal.file_id = ?
      ORDER BY fal.timestamp DESC
      LIMIT ?
    `;
    return await allQuery(sql, [fileId, limit]);
  }
}

module.exports = SecurityEvent;
