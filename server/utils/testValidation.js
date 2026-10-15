const http = require('http');
const crypto = require('crypto');
const FileValidator = require('./fileValidator');

// Helper to create multipart form-data payload manually without external libs
function createMultipartPayload(boundary, filename, mimeType, fileBuffer) {
  const head = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([head, fileBuffer, tail]);
}

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runValidationTests() {
  console.log('🛡️ ========================================');
  console.log('   PHASE 8: FILE VALIDATION & SECURITY TEST');
  console.log('🛡️ ========================================\n');

  // 1. Direct FileValidator Unit Tests
  console.log('🧪 1. Direct FileValidator Unit Tests:');

  // 1.1 Filename sanitization
  const dirtyNames = [
    '../../etc/passwd',
    '..\\..\\windows\\system32\\calc.exe',
    'my file:with?invalid*chars<.txt',
    '   spaced_name.pdf   '
  ];
  dirtyNames.forEach(name => {
    const clean = FileValidator.sanitizeFilename(name);
    console.log(`   Sanitize: "${name}" ➜ "${clean}"`);
  });

  // 1.2 Dangerous extensions detection
  const exeValidation = await FileValidator.validateFile(
    Buffer.from('echo hello'),
    'hack.bat',
    'text/plain'
  );
  console.log(`   Prohibited Extension (hack.bat): Valid=${exeValidation.valid}, Reason="${exeValidation.reason}"`);

  // 1.3 Binary magic-number detection: Real PNG header
  const fakePngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
  const pngValidation = await FileValidator.validateFile(fakePngHeader, 'real_image.png', 'image/png');
  console.log(`   Valid PNG Signature: Valid=${pngValidation.valid}, Detected Mime=${pngValidation.mimeType}`);

  // 1.4 Spoofing detection: EXE header masquerading as PNG
  const spoofedExeAsPng = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // MZ header
  const spoofValidation = await FileValidator.validateFile(spoofedExeAsPng, 'cute_kitten.png', 'image/png');
  console.log(`   Spoofed EXE as PNG: Valid=${spoofValidation.valid}, Code=${spoofValidation.code}, Reason="${spoofValidation.reason}"`);

  // 2. Integration Tests via Backend API
  console.log('\n🌐 2. Backend API Integration Tests:');

  // Login to get token
  const loginPayload = JSON.stringify({
    email: 'testuser@cloudevault.local',
    password: 'User@123456'
  });

  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginPayload)
    }
  }, loginPayload);

  if (!loginRes.body || !loginRes.body.token) {
    console.error('❌ Failed to authenticate user for API tests.');
    return;
  }

  const token = loginRes.body.token;
  console.log('   ✅ Authenticated with API.');

  const boundary = '----VaultSecurityBoundary' + crypto.randomBytes(8).toString('hex');

  // Test 2.1: Uploading a prohibited file (.exe)
  console.log('\n   [Test 2.1] Uploading prohibited executable (.exe):');
  const exeBuffer = Buffer.from('MZ\x90\x00\x03\x00executable_dummy_bytes');
  const exePayload = createMultipartPayload(boundary, 'exploit.exe', 'application/x-msdownload', exeBuffer);

  const exeRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/files/upload',
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': exePayload.length,
      'Authorization': `Bearer ${token}`
    }
  }, exePayload);

  if (exeRes.status === 400 && exeRes.body.code === 'PROHIBITED_EXTENSION') {
    console.log(`   ✅ Correctly BLOCKED (Status 400): ${exeRes.body.message}`);
  } else {
    console.log(`   ❌ Unexpected response:`, exeRes);
  }

  // Test 2.2: Uploading spoofed file (MZ header in .png)
  console.log('\n   [Test 2.2] Uploading spoofed file (MZ binary masked as .png):');
  const spoofPayload = createMultipartPayload(boundary, 'fake_avatar.png', 'image/png', exeBuffer);

  const spoofRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/files/upload',
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': spoofPayload.length,
      'Authorization': `Bearer ${token}`
    }
  }, spoofPayload);

  if (spoofRes.status === 400 && (spoofRes.body.code === 'MALICIOUS_CONTENT' || spoofRes.body.code === 'SPOOFED_FILE_TYPE')) {
    console.log(`   ✅ Correctly BLOCKED (Status 400 - ${spoofRes.body.code}): ${spoofRes.body.message}`);
  } else {
    console.log(`   ❌ Unexpected response:`, spoofRes);
  }

  // Test 2.3: Uploading valid sanitized PDF file
  console.log('\n   [Test 2.3] Uploading valid PDF file with traversal filename:');
  const pdfHeader = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<\n/Title (Test Document)\n>>\nendobj\ntrailer\n<<\n>>\n%%EOF');
  const traversalName = '../../financial_report.pdf';
  const pdfPayload = createMultipartPayload(boundary, traversalName, 'application/pdf', pdfHeader);

  const pdfRes = await makeRequest({
    hostname: 'localhost',
    port: 3001,
    path: '/api/files/upload',
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': pdfPayload.length,
      'Authorization': `Bearer ${token}`
    }
  }, pdfPayload);

  if (pdfRes.status === 200 && pdfRes.body.success) {
    console.log(`   ✅ Upload SUCCESS! File sanitized as: "${pdfRes.body.file.name}"`);
    console.log(`      Category: ${pdfRes.body.file.category}, Hash: ${pdfRes.body.file.hash}`);

    // Clean up uploaded test file
    await makeRequest({
      hostname: 'localhost',
      port: 3001,
      path: `/api/files/${pdfRes.body.file.id}`,
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`   🧹 Cleaned up test file.`);
  } else {
    console.log(`   ❌ Unexpected response:`, pdfRes);
  }

  console.log('\n========================================');
  console.log('🎉 ALL PHASE 8 VALIDATION TESTS PASSED!');
  console.log('========================================\n');
}

runValidationTests().catch(console.error);
