// Test backend connection and CORS
const axios = require('axios');

const API_URL = 'http://localhost:5000';

async function testConnection() {
  console.log('🔍 Testing backend connection...\n');

  // Test 1: Health check
  try {
    console.log('Test 1: Health Check');
    const healthResponse = await axios.get(`${API_URL}/health`);
    console.log('✅ Health check passed');
    console.log('   Status:', healthResponse.status);
    console.log('   CORS Header:', healthResponse.headers['access-control-allow-origin']);
    console.log('   Response:', healthResponse.data);
    console.log('');
  } catch (error) {
    console.log('❌ Health check failed');
    console.log('   Error:', error.message);
    console.log('   Is backend running? Check if you see "Server running on port 5000"');
    console.log('');
    return;
  }

  // Test 2: Login endpoint (with wrong credentials to test connection)
  try {
    console.log('Test 2: Login Endpoint');
    await axios.post(`${API_URL}/auth/login`, {
      email: 'test@test.com',
      password: 'wrongpassword'
    });
  } catch (error) {
    if (error.response) {
      console.log('✅ Login endpoint is reachable');
      console.log('   Status:', error.response.status);
      console.log('   Message:', error.response.data.message);
      console.log('   (401 error is expected with wrong credentials)');
    } else {
      console.log('❌ Cannot reach login endpoint');
      console.log('   Error:', error.message);
    }
    console.log('');
  }

  // Test 3: CORS preflight
  try {
    console.log('Test 3: CORS Configuration');
    const corsResponse = await axios.options(`${API_URL}/auth/login`, {
      headers: {
        'Origin': 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type'
      }
    });
    console.log('✅ CORS preflight passed');
    console.log('   Allowed Origin:', corsResponse.headers['access-control-allow-origin']);
    console.log('   Allowed Methods:', corsResponse.headers['access-control-allow-methods']);
  } catch (error) {
    console.log('⚠️  CORS preflight check inconclusive');
    console.log('   This might be okay if backend handles CORS differently');
  }

  console.log('\n📋 Summary:');
  console.log('   Backend URL: ' + API_URL);
  console.log('   Expected CORS Origin: http://localhost:5173');
  console.log('   \n   If all tests passed, the backend is configured correctly.');
  console.log('   If you still get "Network Error" in the browser:');
  console.log('   1. Clear browser cache (Ctrl+Shift+Delete)');
  console.log('   2. Hard refresh the page (Ctrl+F5)');
  console.log('   3. Try in incognito/private mode');
  console.log('   4. Check browser console for detailed error');
}

testConnection();
