const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

const API_URL = 'http://localhost:3001';

async function testFileUpload() {
  try {
    console.log('🧪 Starting File Upload Test...\n');

    // Step 1: Login user
    console.log('1️⃣ Logging in user...');
    const loginRes = await axios.post(`${API_URL}/api/auth/login`, {
      email: 'testuser@cloudevault.local',
      password: 'User@123456'
    });

    const token = loginRes.data.token;
    console.log('✅ User logged in successfully');
    console.log(`   User ID: ${loginRes.data.user.id}`);
    console.log(`   Token: ${token.substring(0, 20)}...\n`);

    // Step 2: Create a test file
    console.log('2️⃣ Creating a test file...');
    const testFilePath = path.join(__dirname, 'test-file.txt');
    fs.writeFileSync(testFilePath, 'Hello, Cloud Vault! This is a secure test file with some content.');
    console.log('✅ Test file created\n');

    // Step 3: Upload file
    console.log('3️⃣ Uploading file...');
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath));

    const uploadRes = await axios.post(`${API_URL}/api/files/upload`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ File uploaded successfully!');
    console.log('   File ID:', uploadRes.data.file.id);
    console.log('   File Name:', uploadRes.data.file.name);
    console.log('   Category:', uploadRes.data.file.category);
    console.log('   SHA-256 Hash:', uploadRes.data.file.hash);
    console.log('   Storage Used:', uploadRes.data.storage.used, 'bytes\n');

    // Step 4: List files
    console.log('4️⃣ Listing user files...');
    const listRes = await axios.get(`${API_URL}/api/files/list`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`✅ Found ${listRes.data.files.length} files:`);
    listRes.data.files.forEach(f => {
      console.log(`   - ${f.name} (${f.size} bytes, ${f.category})`);
    });
    console.log();

    // Step 5: Clean up test file
    fs.unlinkSync(testFilePath);
    console.log('🧹 Cleaned up temporary test file\n');

    console.log('🎉 Phase 7 File Upload test completed successfully!');
  } catch (err) {
    console.error('❌ Test failed:', err.response?.data || err.message);
  }
}

testFileUpload();
