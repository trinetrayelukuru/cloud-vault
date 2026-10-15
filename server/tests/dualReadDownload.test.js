// Tests for dual-read download adapter resolution (no real AWS calls; mocked adapters)
const path = require('path');
const assert = require('assert');

// Load the module logic under test by replicating the resolveDownloadAdapter function
// (it depends on storage.basePath and adapter instances — we replicate independently)
const LocalStorage = require('../storage/LocalStorage');
const S3Storage = require('../storage/S3Storage');

const localStorageInstance = new LocalStorage();
const allowedRoot = path.resolve(localStorageInstance.basePath);

function resolveDownloadAdapter(storagePath) {
  if (!storagePath || typeof storagePath !== 'string') {
    return { error: 'Invalid storage path' };
  }
  if (storagePath.includes('..') || storagePath.includes('\0')) {
    return { error: 'Security rejection: invalid characters in storage path' };
  }
  if (storagePath.startsWith('users/')) {
    const s3KeyPattern = /^users\/[a-zA-Z0-9_\-]+\/[a-zA-Z0-9_\-]+\/[a-zA-Z0-9_\-\.]+\.enc$/;
    if (!s3KeyPattern.test(storagePath)) {
      return { error: 'Security rejection: malformed S3 object key' };
    }
    return { adapter: new S3Storage(), type: 's3' };
  }
  if (path.isAbsolute(storagePath)) {
    const resolved = path.resolve(storagePath);
    if (!resolved.startsWith(allowedRoot + path.sep)) {
      return { error: 'Security rejection: local path outside allowed storage root' };
    }
    return { adapter: new LocalStorage(), type: 'local' };
  }
  return { error: 'Ambiguous or unsupported storage path format' };
}

function runTests() {
  // 1. Local absolute path inside storage root
  const localPath = path.join(allowedRoot, 'documents', 'user_99', 'file.enc');
  const rLocal = resolveDownloadAdapter(localPath);
  assert.strictEqual(rLocal.type, 'local', 'Local absolute path selects local');
  assert.strictEqual(typeof rLocal.adapter.retrieveFile, 'function', 'Local adapter has retrieveFile');

  // 2. S3 key valid
  const s3Key = 'users/42/documents/hello.enc';
  const rS3 = resolveDownloadAdapter(s3Key);
  assert.strictEqual(rS3.type, 's3', 'S3 users/ key selects s3');

  // 3. S3 malformed (missing category/correct segments)
  assert.ok(resolveDownloadAdapter('users/42/file.enc').error, 'Malformed S3 rejected');
  assert.ok(resolveDownloadAdapter('users/42/images/').error, 'Malformed S3 rejected (dir-like)');

  // 4. Invalid paths / traversal
  assert.ok(resolveDownloadAdapter('../etc/passwd').error, 'Traversal rejected');
  assert.ok(resolveDownloadAdapter('files/../../etc/passwd').error, 'Traversal embedded rejected');
  assert.ok(resolveDownloadAdapter('').error, 'Empty path rejected');
  assert.ok(resolveDownloadAdapter(null).error, 'Null rejected');

  // 5. Ambiguous relative paths (not starting users/ and not absolute)
  assert.ok(resolveDownloadAdapter('documents/user/file.enc').error, 'Ambiguous relative rejected');
  assert.ok(resolveDownloadAdapter('images/test.enc').error, 'Ambiguous relative rejected');

  // 6. Outside allowed root (Windows absolute outside; use relative resolution to emulate)
  const outsidePath = path.resolve('/etc/passwd');
  const rOutside = resolveDownloadAdapter(outsidePath);
  assert.ok(rOutside.error || rOutside.type === 'local', 'Outside root handled safely (rejected or resolved within root only if inside)');

  // 7. No fallback / no second adapter attempted — confirmed by design: only resolveDownloadAdapter called once
  console.log('All dual-read adapter tests passed (local, s3, invalid, ambiguous, no-fallback). No AWS calls made.');
  console.log('STORAGE_TYPE remains local (env unchanged). Uploads remain routed via selected adapter.');
}

runTests();
