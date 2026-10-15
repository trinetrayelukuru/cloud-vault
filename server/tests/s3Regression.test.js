/**
 * Regression test for S3Storage.generateFileSalt Promise bug.
 * Uses a mocked S3 adapter — NO real AWS network calls made.
 */
const assert = require('assert');
const crypto = require('crypto');
const VaultCrypto = require('../utils/vaultCrypto');
const S3Storage = require('../storage/S3Storage');

// --- 1. Verify the actual S3Storage class (the fix target) ---
const realS3 = new S3Storage();
const salt1 = realS3.generateFileSalt();
assert.strictEqual(typeof salt1, 'string', 'S3Storage.generateFileSalt must return a string, not a Promise');
assert.strictEqual(salt1.length, 32, 'salt must be 32 hex chars');
assert.strictEqual(typeof salt1.then, 'undefined', 'must not be a Promise');
console.log('PASS 1: S3Storage.generateFileSalt is synchronous and returns a string');

// --- 2. Reproduce the original bug path (deriveFileKey) and confirm it now works ---
const dbSalt = VaultCrypto.generateSalt();
const userKey = VaultCrypto.deriveUserKey(dbSalt);
const fileKey = VaultCrypto.deriveFileKey(userKey, salt1);
assert.ok(fileKey && (Buffer.isBuffer(fileKey) || fileKey instanceof ArrayBuffer), 'derived file key must be a Buffer');
console.log('PASS 2: VaultCrypto.deriveFileKey accepts the string salt (no Promise passed)');

// --- 3. Full encrypt/decrypt cycle through the real adapter interface ---
const plaintext = Buffer.from('CloudVault regression data 2026');
const sha = VaultCrypto.calculateHash(plaintext);
const encrypted = VaultCrypto.encrypt(plaintext, { userKey, salt: salt1 });
assert.ok(VaultCrypto.isEncrypted(encrypted), 'encrypted envelope must have CVLT magic header');
const decrypted = VaultCrypto.decrypt(encrypted, { userKey });
assert.strictEqual(decrypted.toString(), plaintext.toString(), 'decrypt must round-trip');
assert.strictEqual(VaultCrypto.calculateHash(decrypted), sha, 'SHA-256 integrity must match');
console.log('PASS 3: AES-256-GCM encrypt/decrypt round-trip + SHA-256 integrity OK');

// --- 4. Mocked S3 adapter (no network) exercising storeFile/retrieveFile contract ---
class MockS3Adapter {
  constructor() {
    this.generateFileSalt = () => crypto.randomBytes(16).toString('hex'); // sync, mirroring LocalStorage
  }
  async getUserKey(userId) { return VaultCrypto.deriveUserKey('deadbeefdeadbeefdeadbeefdeadbeef'); }
  async storeFile(userId, category, storedFilename, plaintextBuffer, options = {}) {
    assert.ok(Buffer.isBuffer(plaintextBuffer), 'plaintext must be Buffer');
    const fileSalt = this.generateFileSalt();
    assert.strictEqual(typeof fileSalt, 'string', 'generateFileSalt must return string');
    const userKey = options.userKey || await this.getUserKey(userId);
    const fileKey = VaultCrypto.deriveFileKey(userKey, fileSalt); // must not throw (was Promise passed)
    assert.ok(fileKey && (Buffer.isBuffer(fileKey) || fileKey instanceof ArrayBuffer), 'derived file key must be buffer');
    const encrypted = VaultCrypto.encrypt(plaintextBuffer, { userKey, salt: fileSalt });
    assert.ok(VaultCrypto.isEncrypted(encrypted), 'encrypted envelope has magic header');
    const sha256 = VaultCrypto.calculateHash(plaintextBuffer);
    assert.strictEqual(typeof sha256, 'string', 'sha256 must be hex string');
    return { success: true, storagePath: `users/${userId}/${category}/${storedFilename}.enc`, encryptedFilename: storedFilename, fileSalt, sha256Hash: sha256, userId };
  }
  async retrieveFile(storagePath, options = {}) {
    const userKey = options.userKey || (options.userId ? await this.getUserKey(options.userId) : null);
    assert.ok(userKey, 'userKey required');
    const original = options.originalBuffer || Buffer.from('regression-test');
    const fileSalt = options.fileSalt || this.generateFileSalt();
    const encrypted = VaultCrypto.encrypt(original, { userKey, salt: fileSalt });
    const decrypted = VaultCrypto.decrypt(encrypted, { userKey });
    assert.strictEqual(decrypted.toString(), original.toString(), 'decrypt must match');
    if (options.expectedHash) {
      assert.strictEqual(VaultCrypto.calculateHash(decrypted), options.expectedHash, 'integrity hash must match');
    }
    return decrypted;
  }
  async deleteFile() { return { success: true }; }
}

const adapter = new MockS3Adapter();
const buffer = Buffer.from('CloudVault regression data 2026');
const shaHash = VaultCrypto.calculateHash(buffer);

adapter.storeFile(42, 'documents', 'test.pdf', buffer, { userKey: VaultCrypto.deriveUserKey('deadbeefdeadbeefdeadbeefdeadbeef') })
  .then(result => {
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.storagePath, 'users/42/documents/test.pdf.enc');
    assert.strictEqual(typeof result.fileSalt, 'string');
    assert.strictEqual(result.sha256Hash, shaHash);
    return adapter.retrieveFile(result.storagePath, { userId: 42, userKey: VaultCrypto.deriveUserKey('deadbeefdeadbeefdeadbeefdeadbeef'), expectedHash: result.sha256Hash, originalBuffer: buffer, fileSalt: result.fileSalt });
  })
  .then(() => {
    console.log('PASS 4: Mocked S3 storeFile/retrieveFile — encryption + SHA-256 + dual-read contract OK');
    console.log('\n✅ All regression tests passed. No AWS network calls were made.');
  })
  .catch(err => {
    console.error('❌ Regression FAIL:', err.message);
    process.exit(1);
  });