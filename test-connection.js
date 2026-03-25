/**
 * Connection Verification Script
 * Verifies that frontend and backend are properly connected
 * 
 * Run with: node test-connection.js
 */

const axios = require('axios');
const { io } = require('socket.io-client');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

let results = {
  passed: 0,
  failed: 0,
  warnings: 0
};

function log(message, type = 'info') {
  const colorMap = {
    info: colors.cyan,
    success: colors.green,
    error: colors.red,
    warning: colors.yellow
  };
  const color = colorMap[type] || colors.reset;
  console.log(`${color}${message}${colors.reset}`);
}

function logResult(name, passed, message = '') {
  const status = passed ? `${colors.green}✓ PASS${colors.reset}` : `${colors.red}✗ FAIL${colors.reset}`;
  console.log(`${status} ${name}`);
  if (message) {
    console.log(`  ${colors.yellow}${message}${colors.reset}`);
  }
  
  if (passed) {
    results.passed++;
  } else {
    results.failed++;
  }
}

function logWarning(name, message) {
  console.log(`${colors.yellow}⚠ WARNING${colors.reset} ${name}`);
  if (message) {
    console.log(`  ${colors.yellow}${message}${colors.reset}`);
  }
  results.warnings++;
}

/**
 * Test 1: Backend Health Check
 */
async function testBackendHealth() {
  log('\n═══ Test 1: Backend Health Check ═══', 'info');
  
  try {
    const response = await axios.get(`${API_URL}/health`, { timeout: 5000 });
    
    if (response.status === 200 && response.data.status === 'ok') {
      logResult('Backend health endpoint', true, `Status: ${response.data.status}`);
      return true;
    } else {
      logResult('Backend health endpoint', false, `Unexpected response: ${JSON.stringify(response.data)}`);
      return false;
    }
  } catch (error) {
    logResult('Backend health endpoint', false, `Error: ${error.message}`);
    log(`  Make sure backend is running on ${API_URL}`, 'error');
    log(`  Run: cd backend && npm run dev`, 'error');
    return false;
  }
}

/**
 * Test 2: Backend API Endpoints
 */
async function testBackendEndpoints() {
  log('\n═══ Test 2: Backend API Endpoints ═══', 'info');
  
  try {
    const response = await axios.get(`${API_URL}/api`, { timeout: 5000 });
    
    if (response.status === 200 && response.data.endpoints) {
      logResult('Backend API endpoints', true, `Found ${Object.keys(response.data.endpoints).length} endpoint groups`);
      
      // List available endpoints
      log('  Available endpoints:', 'info');
      Object.entries(response.data.endpoints).forEach(([key, path]) => {
        log(`    - ${key}: ${path}`, 'info');
      });
      
      return true;
    } else {
      logResult('Backend API endpoints', false, 'Unexpected response format');
      return false;
    }
  } catch (error) {
    logResult('Backend API endpoints', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * Test 3: Database Connection
 */
async function testDatabaseConnection() {
  log('\n═══ Test 3: Database Connection ═══', 'info');
  
  try {
    // Try to signup a test user - this will fail if database is not connected
    const testEmail = `dbtest_${Date.now()}@example.com`;
    const response = await axios.post(`${API_URL}/auth/signup`, {
      email: testEmail,
      password: 'TestPass123!',
      name: 'DB Test User'
    }, { timeout: 10000 });
    
    if (response.status === 201) {
      logResult('Database connection', true, 'Successfully created test user');
      return true;
    } else {
      logResult('Database connection', false, 'Unexpected response');
      return false;
    }
  } catch (error) {
    if (error.response?.status === 400 || error.response?.status === 409) {
      // User might already exist, but database is working
      logResult('Database connection', true, 'Database is responding');
      return true;
    } else {
      logResult('Database connection', false, `Error: ${error.message}`);
      log('  Make sure MongoDB is running', 'error');
      log('  Check DATABASE_URL in backend/.env', 'error');
      return false;
    }
  }
}

/**
 * Test 4: Socket.io Connection
 */
function testSocketConnection() {
  return new Promise((resolve) => {
    log('\n═══ Test 4: Socket.io Connection ═══', 'info');
    
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      timeout: 5000
    });
    
    let connected = false;
    
    socket.on('connect', () => {
      connected = true;
      logResult('Socket.io connection', true, `Connected: ${socket.id}`);
      socket.disconnect();
      resolve(true);
    });
    
    socket.on('connect_error', (error) => {
      if (!connected) {
        logResult('Socket.io connection', false, `Error: ${error.message}`);
        resolve(false);
      }
    });
    
    // Timeout after 5 seconds
    setTimeout(() => {
      if (!connected) {
        logResult('Socket.io connection', false, 'Connection timeout');
        socket.disconnect();
        resolve(false);
      }
    }, 5000);
  });
}

/**
 * Test 5: Frontend Accessibility
 */
async function testFrontendAccessibility() {
  log('\n═══ Test 5: Frontend Accessibility ═══', 'info');
  
  try {
    const response = await axios.get(FRONTEND_URL, { timeout: 5000 });
    
    if (response.status === 200) {
      logResult('Frontend accessibility', true, `Frontend is accessible at ${FRONTEND_URL}`);
      return true;
    } else {
      logResult('Frontend accessibility', false, `Unexpected status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logResult('Frontend accessibility', false, `Error: ${error.message}`);
    log(`  Make sure frontend is running on ${FRONTEND_URL}`, 'error');
    log(`  Run: cd frontend && npm run dev`, 'error');
    return false;
  }
}

/**
 * Test 6: CORS Configuration
 */
async function testCORS() {
  log('\n═══ Test 6: CORS Configuration ═══', 'info');
  
  try {
    const response = await axios.get(`${API_URL}/health`, {
      headers: {
        'Origin': FRONTEND_URL
      },
      timeout: 5000
    });
    
    const corsHeader = response.headers['access-control-allow-origin'];
    
    if (corsHeader) {
      logResult('CORS configuration', true, `CORS header present: ${corsHeader}`);
      
      if (corsHeader === FRONTEND_URL || corsHeader === '*') {
        log('  ✓ Frontend origin is allowed', 'success');
      } else {
        logWarning('CORS origin mismatch', `Expected ${FRONTEND_URL}, got ${corsHeader}`);
      }
      
      return true;
    } else {
      logWarning('CORS configuration', 'No CORS headers found - may cause issues');
      return true; // Don't fail, just warn
    }
  } catch (error) {
    logResult('CORS configuration', false, `Error: ${error.message}`);
    return false;
  }
}

/**
 * Test 7: Environment Variables
 */
function testEnvironmentVariables() {
  log('\n═══ Test 7: Environment Variables ═══', 'info');
  
  const requiredEnvVars = {
    'API_URL': API_URL,
    'SOCKET_URL': SOCKET_URL,
    'FRONTEND_URL': FRONTEND_URL
  };
  
  log('  Current configuration:', 'info');
  Object.entries(requiredEnvVars).forEach(([key, value]) => {
    log(`    ${key}: ${value}`, 'info');
  });
  
  // Check if using default values
  if (API_URL === 'http://localhost:3000') {
    log('  ℹ Using default API_URL (http://localhost:3000)', 'info');
  }
  
  if (SOCKET_URL === 'http://localhost:3000') {
    log('  ℹ Using default SOCKET_URL (http://localhost:3000)', 'info');
  }
  
  if (FRONTEND_URL === 'http://localhost:5173') {
    log('  ℹ Using default FRONTEND_URL (http://localhost:5173)', 'info');
  }
  
  logResult('Environment variables', true, 'Configuration loaded');
  return true;
}

/**
 * Print Summary
 */
function printSummary() {
  console.log(`\n${colors.blue}${'═'.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}CONNECTION VERIFICATION SUMMARY${colors.reset}`);
  console.log(`${colors.blue}${'═'.repeat(60)}${colors.reset}`);
  console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
  console.log(`${colors.yellow}Warnings: ${results.warnings}${colors.reset}`);
  console.log(`Total: ${results.passed + results.failed}`);
  
  if (results.failed === 0) {
    console.log(`\n${colors.green}✓ All connection tests passed!${colors.reset}`);
    console.log(`${colors.green}✓ Frontend and backend are properly connected${colors.reset}`);
    console.log(`\n${colors.cyan}Next steps:${colors.reset}`);
    console.log(`  1. Run integration tests: node test-integration.js`);
    console.log(`  2. Run user flow tests: node test-user-flow.js`);
    console.log(`  3. Run socket tests: node test-socket.js`);
  } else {
    console.log(`\n${colors.red}✗ Some connection tests failed${colors.reset}`);
    console.log(`${colors.yellow}Please fix the issues above before running integration tests${colors.reset}`);
  }
  
  console.log(`\n${colors.blue}${'═'.repeat(60)}${colors.reset}\n`);
  
  return results.failed === 0;
}

/**
 * Main test runner
 */
async function runConnectionTests() {
  console.log(`${colors.blue}${'═'.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}AI Interview Maker - Connection Verification${colors.reset}`);
  console.log(`${colors.blue}${'═'.repeat(60)}${colors.reset}`);
  
  try {
    // Run tests in sequence
    testEnvironmentVariables();
    
    const backendHealth = await testBackendHealth();
    if (!backendHealth) {
      log('\n⚠ Backend is not running. Skipping remaining tests.', 'warning');
      log('Please start the backend server and try again.', 'warning');
      printSummary();
      process.exit(1);
    }
    
    await testBackendEndpoints();
    await testDatabaseConnection();
    await testSocketConnection();
    await testFrontendAccessibility();
    await testCORS();
    
    // Print summary
    const allPassed = printSummary();
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error(`\n${colors.red}Fatal error during test execution:${colors.reset}`, error);
    process.exit(1);
  }
}

// Run tests
runConnectionTests();
