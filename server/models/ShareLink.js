const { runQuery, getQuery, allQuery } = require('../config/database');
const crypto = require('crypto');

class ShareLink {
  // Create a new share link
  static async create({ fileId, createdBy, expiresInHours = 24, maxDownloads = null }) {
    const shareToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = expiresInHours ? Math.floor(Date.now() / 1000) + (expiresInHours * 3600) : null;

    const sql = `
      INSERT INTO share_links (file_id, share_token, created_by, expires_at, max_downloads)
      VALUES (?, ?, ?, ?, ?)
    `;

    const result = await runQuery(sql, [fileId, shareToken, createdBy, expiresAt, maxDownloads]);

    // Update file shared status
    await runQuery('UPDATE files SET is_shared = 1 WHERE id = ?', [fileId]);

    return {
      id: result.id,
      shareToken,
      expiresAt,
      maxDownloads
    };
  }

  // Find share link by token
  static async findByToken(token) {
    const sql = `
      SELECT
        sl.*,
        f.original_filename,
        f.file_type,
        f.file_size,
        f.storage_path,
        f.mime_type,
        u.name as owner_name
      FROM share_links sl
      JOIN files f ON sl.file_id = f.id
      JOIN users u ON sl.created_by = u.id
      WHERE sl.share_token = ?
    `;
    return await getQuery(sql, [token]);
  }

  // Verify and use share link
  static async verifyAndUse(token) {
    const shareLink = await this.findByToken(token);

    if (!shareLink) {
      return { valid: false, reason: 'Invalid or expired share link' };
    }

    const now = Math.floor(Date.now() / 1000);

    // Check expiration
    if (shareLink.expires_at && shareLink.expires_at < now) {
      return { valid: false, reason: 'Share link has expired' };
    }

    // Check download limit
    if (shareLink.max_downloads && shareLink.download_count >= shareLink.max_downloads) {
      return { valid: false, reason: 'Download limit exceeded for this link' };
    }

    // Increment download count
    await runQuery(
      'UPDATE share_links SET download_count = download_count + 1 WHERE id = ?',
      [shareLink.id]
    );

    return { valid: true, shareLink };
  }

  // Revoke share link
  static async revoke(shareLinkId, userId) {
    const sql = 'DELETE FROM share_links WHERE id = ? AND created_by = ?';
    const result = await runQuery(sql, [shareLinkId, userId]);

    // Check if file has any remaining share links
    if (result.changes > 0) {
      const remaining = await getQuery(
        'SELECT COUNT(*) as count FROM share_links WHERE file_id = (SELECT file_id FROM share_links WHERE id = ?)',
        [shareLinkId]
      );
      if (remaining && remaining.count === 0) {
        await runQuery(
          'UPDATE files SET is_shared = 0 WHERE id = (SELECT file_id FROM share_links WHERE id = ?)',
          [shareLinkId]
        );
      }
    }

    return result.changes > 0;
  }

  // Get active share links for a file
  static async getByFileId(fileId) {
    const sql = `
      SELECT * FROM share_links
      WHERE file_id = ? AND (expires_at IS NULL OR expires_at > strftime('%s', 'now'))
      ORDER BY created_at DESC
    `;
    return await allQuery(sql, [fileId]);
  }
}

module.exports = ShareLink;
