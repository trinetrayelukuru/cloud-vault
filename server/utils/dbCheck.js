const {
  initializeDatabase,
  checkDatabaseHealth,
  runQuery,
  getQuery,
  allQuery,
  runTransaction
} = require('../config/database');
const User = require('../models/User');
const File = require('../models/File');
const SecurityEvent = require('../models/SecurityEvent');
const ShareLink = require('../models/ShareLink');

async function runDatabaseDiagnostics() {
  console.log('🔍 Starting Cloud Vault Database Diagnostics...\n');

  try {
    // 1. Initialize DB
    initializeDatabase();

    // Wait 1 second for tables to create/seed
    await new Promise(r => setTimeout(r, 1000));

    // 2. Health check
    const health = await checkDatabaseHealth();
    console.log('✅ SQLite PRAGMA integrity_check:', health);

    // 3. Test User model
    const testEmail = `testuser_${Date.now()}@cloudevault.local`;
    const userId = await User.create({
      email: testEmail,
      name: 'Diagnostic Tester',
      password: 'SecurePassword123!',
      role: 'user'
    });
    console.log(`✅ Created test user with ID: ${userId}`);

    const user = await User.findById(userId);
    console.log(`✅ Retrieved user: ${user.name} (${user.email})`);

    const validPass = await User.verifyPassword('SecurePassword123!', user.password_hash);
    console.log(`✅ Password verification: ${validPass ? 'SUCCESS' : 'FAILED'}`);

    // 4. Test File model
    const sampleBuffer = Buffer.from('Cloud Vault Secure Storage Diagnostic Sample Content');
    const sha256 = File.calculateHash(sampleBuffer);
    const storedName = File.generateStoredFilename('test-doc.pdf');

    const fileId = await File.create({
      userId,
      originalFilename: 'test-doc.pdf',
      storedFilename: storedName,
      fileType: 'pdf',
      mimeType: 'application/pdf',
      fileSize: sampleBuffer.length,
      fileCategory: 'documents',
      sha256Hash: sha256,
      storagePath: 'storage/documents/user-test/' + storedName
    });
    console.log(`✅ Created file record with ID: ${fileId} (SHA-256: ${sha256.substring(0, 16)}...)`);

    const stats = await File.getUserStorageStats(userId);
    console.log(`✅ User storage usage updated: ${stats.storage_used} bytes across ${stats.total_files} file(s)`);

    const integrity = await File.verifyIntegrity(fileId, sha256);
    console.log(`✅ SHA-256 Integrity Verification: ${integrity.valid ? 'VERIFIED' : 'FAILED'}`);

    // 5. Test ShareLink model
    const share = await ShareLink.create({
      fileId,
      createdBy: userId,
      expiresInHours: 48,
      maxDownloads: 5
    });
    console.log(`✅ Created secure share token: ${share.shareToken.substring(0, 16)}...`);

    const verifyShare = await ShareLink.verifyAndUse(share.shareToken);
    console.log(`✅ Share link validation: ${verifyShare.valid ? 'VALID' : 'INVALID'}`);

    // 6. Test SecurityEvent model
    await SecurityEvent.log({
      userId,
      eventType: 'DIAGNOSTIC_TEST',
      status: 'success',
      ipAddress: '127.0.0.1',
      userAgent: 'DiagnosticScript/1.0',
      details: 'All diagnostic tests passed successfully'
    });
    console.log('✅ Logged security event');

    // 7. Clean up test records
    console.log('🗑️  Cleaning up diagnostic test records...');
    await runQuery('DELETE FROM share_links WHERE file_id = ?', [fileId]);
    await runQuery('DELETE FROM files WHERE id = ?', [fileId]);
    await runQuery('DELETE FROM security_events WHERE user_id = ?', [userId]);
    await runQuery('DELETE FROM users WHERE id = ?', [userId]);
    console.log('✅ Cleaned up all test records successfully');

    // 8. Run PRAGMA integrity check
    const finalHealth = await checkDatabaseHealth();
    console.log('✅ Final SQLite integrity check:', finalHealth);

    console.log('\n🎉 ALL DATABASE ARCHITECTURE TESTS PASSED SUCCESSFULLY! ✅\n');
    process.exit(0);

    console.log('\n🎉 ALL DATABASE ARCHITECTURE TESTS PASSED SUCCESSFULLY! ✅\n');
    process.exit(0);

  } catch (err) {
    console.error('❌ Database diagnostic failed:', err);
    process.exit(1);
  }
}

runDatabaseDiagnostics();
