const { db } = require('../config/database');

console.log('🔄 Running database schema migration...\n');

db.serialize(() => {
  // Migrate users table
  db.all("PRAGMA table_info(users)", (err, columns) => {
    if (err) {
      console.error('❌ Error checking users table:', err);
      return;
    }

    const hasQuota = columns.some(col => col.name === 'storage_quota_bytes');
    const hasUsed = columns.some(col => col.name === 'storage_used_bytes');

    if (!hasQuota) {
      db.run(`ALTER TABLE users ADD COLUMN storage_quota_bytes INTEGER DEFAULT 10737418240`, (err) => {
        if (!err) console.log('✅ Added users.storage_quota_bytes');
      });
    }

    if (!hasUsed) {
      db.run(`ALTER TABLE users ADD COLUMN storage_used_bytes INTEGER DEFAULT 0`, (err) => {
        if (!err) console.log('✅ Added users.storage_used_bytes');
      });
    }
  });

  // Migrate files table
  db.all("PRAGMA table_info(files)", (err, columns) => {
    if (err) {
      console.error('❌ Error checking files table:', err);
      return;
    }

    const hasShared = columns.some(col => col.name === 'is_shared');
    const hasEncryptedName = columns.some(col => col.name === 'encrypted_filename');
    const hasFileSalt = columns.some(col => col.name === 'file_salt');

    if (!hasShared) {
      db.run(`ALTER TABLE files ADD COLUMN is_shared INTEGER DEFAULT 0`, (err) => {
        if (!err) console.log('✅ Added files.is_shared');
      });
    }

    if (!hasEncryptedName) {
      db.run(`ALTER TABLE files ADD COLUMN encrypted_filename TEXT`, (err) => {
        if (!err) console.log('✅ Added files.encrypted_filename');
      });
    }

    if (!hasFileSalt) {
      db.run(`ALTER TABLE files ADD COLUMN file_salt TEXT`, (err) => {
        if (!err) console.log('✅ Added files.file_salt');
      });
    }
  });

  // Check for encryption_keys table
  db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='encryption_keys'", (err, rows) => {
    if (rows.length === 0) {
      console.log('⚠️ encryption_keys table missing - should have been created by initializeDatabase');
    } else {
      console.log('✅ encryption_keys table exists');
    }
  });

  // Check for file_access_log table
  db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='file_access_log'", (err, rows) => {
    if (rows.length === 0) {
      console.log('⚠️ file_access_log table missing - should have been created by initializeDatabase');
    } else {
      console.log('✅ file_access_log table exists');
    }
  });

  // Add encrypted_filename index if not exists
  db.run("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_files_encrypted_name'", (err) => {
    if (err) {
      db.run(`CREATE INDEX IF NOT EXISTS idx_files_encrypted_name ON files(encrypted_filename)`);
      console.log('✅ Added idx_files_encrypted_name index');
    }
  });

  setTimeout(() => {
    console.log('\n🎉 Database schema migration completed!\n');
  }, 500);
});
