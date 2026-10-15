const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../database/cloudevault.db');

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Connected to SQLite database');

    // Enable WAL mode for better concurrency
    db.run('PRAGMA journal_mode = WAL;');

    // Enable foreign key constraints
    db.run('PRAGMA foreign_keys = ON;');

    // Set busy timeout (30 seconds)
    db.run('PRAGMA busy_timeout = 30000;');
  }
});

// Initialize database tables
function initializeDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT,
        role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
        google_id TEXT UNIQUE,
        account_status TEXT DEFAULT 'active' CHECK(account_status IN ('active', 'suspended', 'terminated')),
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until INTEGER,
        mfa_enabled INTEGER DEFAULT 0,
        mfa_secret TEXT,
        webauthn_credentials TEXT,
        storage_quota_bytes INTEGER DEFAULT 10737418240,
        storage_used_bytes INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        last_login INTEGER,
        last_login_ip TEXT
      )
    `, (err) => {
      if (err) console.error('❌ Error creating users table:', err.message);
      else {
        console.log('✅ Users table ready');

        // Create indexes
        db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
        db.run('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
        db.run('CREATE INDEX IF NOT EXISTS idx_users_status ON users(account_status)');

        // Seed admin account after table is created
        const { seedAdmin } = require('./seedAdmin');
        seedAdmin();
      }
    });

    // Encryption keys table (per-user encryption keys)
    db.run(`
      CREATE TABLE IF NOT EXISTS encryption_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        salt TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        derived_key_version INTEGER DEFAULT 1,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        last_rotated_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) console.error('❌ Error creating encryption_keys table:', err.message);
      else {
        console.log('✅ Encryption keys table ready');
        db.run('CREATE INDEX IF NOT EXISTS idx_enc_keys_user ON encryption_keys(user_id)');
      }
    });

    // File access log table
    db.run(`
      CREATE TABLE IF NOT EXISTS file_access_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        success INTEGER DEFAULT 1,
        details TEXT,
        timestamp INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) console.error('❌ Error creating file_access_log table:', err.message);
      else {
        console.log('✅ File access log table ready');
        db.run('CREATE INDEX IF NOT EXISTS idx_file_access_file ON file_access_log(file_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_file_access_user ON file_access_log(user_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_file_access_time ON file_access_log(timestamp DESC)');
      }
    });

    // Security events table
    db.run(`
      CREATE TABLE IF NOT EXISTS security_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        event_type TEXT NOT NULL,
        event_status TEXT CHECK(event_status IN ('success', 'failure')),
        ip_address TEXT,
        user_agent TEXT,
        details TEXT,
        timestamp INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) console.error('❌ Error creating security_events table:', err.message);
      else {
        console.log('✅ Security events table ready');

        // Create indexes
        db.run('CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type)');
        db.run('CREATE INDEX IF NOT EXISTS idx_security_events_status ON security_events(event_status)');
        db.run('CREATE INDEX IF NOT EXISTS idx_security_events_time ON security_events(timestamp DESC)');
      }
    });

    // Files table
    db.run(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        original_filename TEXT NOT NULL,
        stored_filename TEXT NOT NULL UNIQUE,
        encrypted_filename TEXT,
        file_type TEXT,
        mime_type TEXT,
        file_size INTEGER NOT NULL,
        file_category TEXT,
        sha256_hash TEXT,
        file_salt TEXT,
        storage_path TEXT NOT NULL,
        is_shared INTEGER DEFAULT 0,
        upload_timestamp INTEGER DEFAULT (strftime('%s', 'now')),
        last_accessed INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) console.error('❌ Error creating files table:', err.message);
      else {
        console.log('✅ Files table ready');

        // Create indexes
        db.run('CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_files_category ON files(file_category)');
        db.run('CREATE INDEX IF NOT EXISTS idx_files_hash ON files(sha256_hash)');
        db.run('CREATE INDEX IF NOT EXISTS idx_files_upload_time ON files(upload_timestamp DESC)');
      }
    });

    // Share links table (for secure file sharing)
    db.run(`
      CREATE TABLE IF NOT EXISTS share_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        share_token TEXT UNIQUE NOT NULL,
        created_by INTEGER NOT NULL,
        expires_at INTEGER,
        max_downloads INTEGER,
        download_count INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) console.error('❌ Error creating share_links table:', err.message);
      else {
        console.log('✅ Share links table ready');

        // Create indexes
        db.run('CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(share_token)');
        db.run('CREATE INDEX IF NOT EXISTS idx_share_links_file ON share_links(file_id)');
        db.run('CREATE INDEX IF NOT EXISTS idx_share_links_expires ON share_links(expires_at)');
      }
    });
  });
}

// Helper function to run queries with promises
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Transaction helper
function runTransaction(queries) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      const executeQuery = (index) => {
        if (index >= queries.length) {
          db.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
          });
          return;
        }

        const { sql, params } = queries[index];
        db.run(sql, params, (err) => {
          if (err) {
            db.run('ROLLBACK');
            reject(err);
          } else {
            executeQuery(index + 1);
          }
        });
      };

      executeQuery(0);
    });
  });
}

// Database health check
function checkDatabaseHealth() {
  return new Promise((resolve, reject) => {
    db.get('PRAGMA integrity_check', (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

module.exports = {
  db,
  initializeDatabase,
  runQuery,
  getQuery,
  allQuery,
  runTransaction,
  checkDatabaseHealth
};
