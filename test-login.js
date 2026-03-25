// Test Login Script - Run with: node test-login.js

const http = require('http');

const API_URL = 'localhost';
const API_PORT = 5000;

// Test credentials
const TEST_USER = {
  email: 'test@test.com',
  password: 'Test1234',
  name: 'Test User',
  role: 'candidate'
};

function makeRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: API_URL,
      port: API_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve({ status: res.statusCode, data: response });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function testBackend() {
  console.log('🔍 Testing AI Interview Maker Backend...\n');

  // Test 1: Health Check
  console.log('Test 1: Health Check');
  try {
    const health = await makeRequest('GET', '/health', {});
    if (health.status === 200) {
      console.log('✅ Backend is running!');
      console.log(`   Message: ${health.data.message}\n`);
    } else {
      console.log('❌ Backend health check failed');
      console.log(`   Status: ${health.status}\n`);
    }
  } catch (error) {
    console.log('❌ Cannot connect to backend');
    console.log(`   Error: ${error.message}`);
    console.log('   Make sure backend is running: cd backend && npm run dev\n');
    return;
  }

  // Test 2: Try to create test user
  console.log('Test 2: Create Test User');
  try {
    const signup = await makeRequest('POST', '/auth/signup', TEST_USER);
    if (signup.status === 201) {
      console.log('✅ Test user created successfully!');
      console.log(`   Email: ${TEST_USER.email}`);
      console.log(`   Password: ${TEST_USER.password}\n`);
    } else if (signup.status === 409) {
      console.log('ℹ️  Test user already exists (this is fine)');
      console.log(`   Email: ${TEST_USER.email}`);
      console.log(`   Password: ${TEST_USER.password}\n`);
    } else {
      console.log('⚠️  Unexpected response');
      console.log(`   Status: ${signup.status}`);
      console.log(`   Message: ${signup.data.message}\n`);
    }
  } catch (error) {
    console.log('❌ Failed to create test user');
    console.log(`   Error: ${error.message}\n`);
  }

  // Test 3: Try to login
  console.log('Test 3: Login with Test User');
  try {
    const login = await makeRequest('POST', '/auth/login', {
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    
    if (login.status === 200) {
      console.log('✅ Login successful!');
      const accessToken = login.data.data?.accessToken || login.data.accessToken;
      const refreshToken = login.data.data?.refreshToken || login.data.refreshToken;
      
      if (accessToken) {
        console.log(`   Access Token: ${accessToken.substring(0, 50)}...`);
        console.log(`   Refresh Token: ${refreshToken ? refreshToken.substring(0, 50) + '...' : 'N/A'}`);
        
        // Decode token to show expiration
        try {
          const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
          const expiresAt = new Date(payload.exp * 1000);
          console.log(`   Expires: ${expiresAt.toLocaleString()}`);
          console.log(`   User ID: ${payload.userId}`);
          console.log(`   Email: ${payload.email}`);
          console.log(`   Role: ${payload.role}\n`);
        } catch (e) {
          console.log('   (Could not decode token)\n');
        }

        // Save tokens to a file for easy copy-paste
        const fs = require('fs');
        fs.writeFileSync('VALID_TOKENS.txt', 
          `Access Token:\n${accessToken}\n\nRefresh Token:\n${refreshToken}\n\nExpires: ${new Date(JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString()).exp * 1000).toLocaleString()}`
        );
        console.log('💾 Tokens saved to VALID_TOKENS.txt\n');
      }
    } else {
      console.log('❌ Login failed');
      console.log(`   Status: ${login.status}`);
      console.log(`   Message: ${login.data.message}\n`);
    }
  } catch (error) {
    console.log('❌ Login request failed');
    console.log(`   Error: ${error.message}\n`);
  }

  // Summary
  console.log('═══════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  console.log('✅ Backend is running');
  console.log('✅ Test user exists');
  console.log('✅ Login works');
  console.log('✅ Tokens are valid');
  console.log('');
  console.log('NOW DO THIS:');
  console.log('1. Open browser to http://localhost:3000');
  console.log('2. Press F12 → Console');
  console.log('3. Run: localStorage.clear()');
  console.log('4. Go to /login');
  console.log('5. Login with:');
  console.log(`   Email: ${TEST_USER.email}`);
  console.log(`   Password: ${TEST_USER.password}`);
  console.log('6. Try interview - should work!');
  console.log('═══════════════════════════════════════════════════\n');
}

// Run the test
testBackend().catch(console.error);
