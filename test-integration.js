/**
 * Integration Test Script
 * Tests complete user flows and API connectivity
 * 
 * Run with: node test-integration.js
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// Test data
let testUser = {
  email: `test_${Date.now()}@example.com`,
  password: 'TestPassword123!',
  name: 'Test User'
};

let authTokens = {
  accessToken: null,
  refreshToken: null
};

let sessionId = null;

/**
 * Helper function to log test results
 */
function logTest(name, passed, message = '') {
  const status = passed ? `${colors.green}✓ PASS${colors.reset}` : `${colors.red}✗ FAIL${colors.reset}`;
  console.log(`${status} ${name}`);
  if (message) {
    console.log(`  ${colors.yellow}${message}${colors.reset}`);
  }
  
  testResults.tests.push({ name, passed, message });
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

/**
 * Helper function to make API requests
 */
async function apiRequest(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${API_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

/**
 * Test 1: Health Check
 */
async function testHealthCheck() {
  console.log(`\n${colors.cyan}=== Test 1: Health Check ===${colors.reset}`);
  
  const result = await apiRequest('GET', '/health');
  logTest(
    'Health endpoint responds',
    result.success && result.status === 200,
    result.success ? `Status: ${result.data.status}` : `Error: ${result.error}`
  );
}

/**
 * Test 2: User Signup
 */
async function testSignup() {
  console.log(`\n${colors.cyan}=== Test 2: User Signup ===${colors.reset}`);
  
  const result = await apiRequest('POST', '/auth/signup', testUser);
  
  logTest(
    'User signup successful',
    result.success && result.status === 201,
    result.success ? `User created: ${testUser.email}` : `Error: ${JSON.stringify(result.error)}`
  );
  
  if (result.success && result.data.accessToken) {
    authTokens.accessToken = result.data.accessToken;
    authTokens.refreshToken = result.data.refreshToken;
    logTest('Tokens received on signup', true, 'Access and refresh tokens obtained');
  } else {
    logTest('Tokens received on signup', false, 'No tokens in response');
  }
}

/**
 * Test 3: User Login
 */
async function testLogin() {
  console.log(`\n${colors.cyan}=== Test 3: User Login ===${colors.reset}`);
  
  const result = await apiRequest('POST', '/auth/login', {
    email: testUser.email,
    password: testUser.password
  });
  
  logTest(
    'User login successful',
    result.success && result.status === 200,
    result.success ? 'Login successful' : `Error: ${JSON.stringify(result.error)}`
  );
  
  if (result.success && result.data.accessToken) {
    authTokens.accessToken = result.data.accessToken;
    authTokens.refreshToken = result.data.refreshToken;
    logTest('Tokens received on login', true, 'Access and refresh tokens obtained');
  } else {
    logTest('Tokens received on login', false, 'No tokens in response');
  }
}

/**
 * Test 4: Get User Profile
 */
async function testGetProfile() {
  console.log(`\n${colors.cyan}=== Test 4: Get User Profile ===${colors.reset}`);
  
  const result = await apiRequest('GET', '/auth/profile', null, {
    'Authorization': `Bearer ${authTokens.accessToken}`
  });
  
  logTest(
    'Get user profile',
    result.success && result.status === 200,
    result.success ? `Profile retrieved for: ${result.data.email}` : `Error: ${JSON.stringify(result.error)}`
  );
}

/**
 * Test 5: Token Refresh
 */
async function testTokenRefresh() {
  console.log(`\n${colors.cyan}=== Test 5: Token Refresh ===${colors.reset}`);
  
  const result = await apiRequest('POST', '/auth/refresh', {
    refreshToken: authTokens.refreshToken
  });
  
  logTest(
    'Token refresh successful',
    result.success && result.status === 200,
    result.success ? 'New access token obtained' : `Error: ${JSON.stringify(result.error)}`
  );
  
  if (result.success && result.data.accessToken) {
    authTokens.accessToken = result.data.accessToken;
  }
}

/**
 * Test 6: Start Interview Session
 */
async function testStartSession() {
  console.log(`\n${colors.cyan}=== Test 6: Start Interview Session ===${colors.reset}`);
  
  const result = await apiRequest('POST', '/api/sessions/start', {
    jobRole: 'Software Engineer',
    mode: 'general',
    mentorModeEnabled: false
  }, {
    'Authorization': `Bearer ${authTokens.accessToken}`
  });
  
  logTest(
    'Start interview session',
    result.success && result.status === 201,
    result.success ? `Session created: ${result.data.sessionId}` : `Error: ${JSON.stringify(result.error)}`
  );
  
  if (result.success && result.data.sessionId) {
    sessionId = result.data.sessionId;
  }
}

/**
 * Test 7: Submit Answer
 */
async function testSubmitAnswer() {
  console.log(`\n${colors.cyan}=== Test 7: Submit Answer ===${colors.reset}`);
  
  if (!sessionId) {
    logTest('Submit answer', false, 'No session ID available');
    return;
  }
  
  const result = await apiRequest('POST', `/api/sessions/${sessionId}/submit-answer`, {
    questionId: 'test-question-1',
    answer: 'This is a test answer demonstrating my problem-solving skills and technical knowledge.'
  }, {
    'Authorization': `Bearer ${authTokens.accessToken}`
  });
  
  logTest(
    'Submit answer to session',
    result.success && (result.status === 200 || result.status === 201),
    result.success ? 'Answer submitted successfully' : `Error: ${JSON.stringify(result.error)}`
  );
}

/**
 * Test 8: Get Session Details
 */
async function testGetSession() {
  console.log(`\n${colors.cyan}=== Test 8: Get Session Details ===${colors.reset}`);
  
  if (!sessionId) {
    logTest('Get session details', false, 'No session ID available');
    return;
  }
  
  const result = await apiRequest('GET', `/api/sessions/${sessionId}`, null, {
    'Authorization': `Bearer ${authTokens.accessToken}`
  });
  
  logTest(
    'Get session details',
    result.success && result.status === 200,
    result.success ? `Session status: ${result.data.status}` : `Error: ${JSON.stringify(result.error)}`
  );
}

/**
 * Test 9: Complete Session
 */
async function testCompleteSession() {
  console.log(`\n${colors.cyan}=== Test 9: Complete Session ===${colors.reset}`);
  
  if (!sessionId) {
    logTest('Complete session', false, 'No session ID available');
    return;
  }
  
  const result = await apiRequest('POST', `/api/sessions/${sessionId}/complete`, {}, {
    'Authorization': `Bearer ${authTokens.accessToken}`
  });
  
  logTest(
    'Complete interview session',
    result.success && result.status === 200,
    result.success ? 'Session completed with performance report' : `Error: ${JSON.stringify(result.error)}`
  );
}

/**
 * Test 10: Get User Sessions
 */
async function testGetUserSessions() {
  console.log(`\n${colors.cyan}=== Test 10: Get User Sessions ===${colors.reset}`);
  
  const result = await apiRequest('GET', '/api/sessions/user/me', null, {
    'Authorization': `Bearer ${authTokens.accessToken}`
  });
  
  logTest(
    'Get user session history',
    result.success && result.status === 200,
    result.success ? `Found ${result.data.sessions?.length || 0} sessions` : `Error: ${JSON.stringify(result.error)}`
  );
}

/**
 * Test 11: Get Coding Challenges
 */
async function testGetCodingChallenges() {
  console.log(`\n${colors.cyan}=== Test 11: Get Coding Challenges ===${colors.reset}`);
  
  const result = await apiRequest('GET', '/api/coding/challenges/Software%20Engineer', null, {
    'Authorization': `Bearer ${authTokens.accessToken}`
  });
  
  logTest(
    'Get coding challenges',
    result.success && result.status === 200,
    result.success ? `Found ${result.data.challenges?.length || 0} challenges` : `Error: ${JSON.stringify(result.error)}`
  );
}

/**
 * Test 12: Get Leaderboard
 */
async function testGetLeaderboard() {
  console.log(`\n${colors.cyan}=== Test 12: Get Leaderboard ===${colors.reset}`);
  
  const result = await apiRequest('GET', '/api/leaderboard', null, {
    'Authorization': `Bearer ${authTokens.accessToken}`
  });
  
  logTest(
    'Get leaderboard',
    result.success && result.status === 200,
    result.success ? `Leaderboard retrieved with ${result.data.leaderboard?.length || 0} entries` : `Error: ${JSON.stringify(result.error)}`
  );
}

/**
 * Test 13: Gemini Question Generation
 */
async function testGeminiQuestions() {
  console.log(`\n${colors.cyan}=== Test 13: Gemini Question Generation ===${colors.reset}`);
  
  const result = await apiRequest('POST', '/api/gemini/generate-questions', {
    role: 'Software Engineer',
    mode: 'general',
    difficulty: 'medium',
    count: 3
  }, {
    'Authorization': `Bearer ${authTokens.accessToken}`
  });
  
  logTest(
    'Generate questions with Gemini',
    result.success && result.status === 200,
    result.success ? `Generated ${result.data.questions?.length || 0} questions` : `Error: ${JSON.stringify(result.error)}`
  );
}

/**
 * Test 14: Error Handling - Invalid Token
 */
async function testInvalidToken() {
  console.log(`\n${colors.cyan}=== Test 14: Error Handling - Invalid Token ===${colors.reset}`);
  
  const result = await apiRequest('GET', '/auth/profile', null, {
    'Authorization': 'Bearer invalid_token_12345'
  });
  
  logTest(
    'Invalid token rejected',
    !result.success && result.status === 401,
    result.success ? 'ERROR: Invalid token was accepted!' : 'Invalid token properly rejected'
  );
}

/**
 * Test 15: Error Handling - Missing Auth
 */
async function testMissingAuth() {
  console.log(`\n${colors.cyan}=== Test 15: Error Handling - Missing Auth ===${colors.reset}`);
  
  const result = await apiRequest('GET', '/auth/profile');
  
  logTest(
    'Missing auth rejected',
    !result.success && result.status === 401,
    result.success ? 'ERROR: Request without auth was accepted!' : 'Missing auth properly rejected'
  );
}

/**
 * Print Summary
 */
function printSummary() {
  console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}TEST SUMMARY${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.green}Passed: ${testResults.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${testResults.failed}${colors.reset}`);
  console.log(`Total: ${testResults.passed + testResults.failed}`);
  
  if (testResults.failed > 0) {
    console.log(`\n${colors.red}Failed Tests:${colors.reset}`);
    testResults.tests
      .filter(t => !t.passed)
      .forEach(t => console.log(`  - ${t.name}: ${t.message}`));
  }
  
  console.log(`\n${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

/**
 * Main test runner
 */
async function runTests() {
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}AI Interview Maker - Integration Tests${colors.reset}`);
  console.log(`${colors.blue}API URL: ${API_URL}${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(60)}${colors.reset}`);
  
  try {
    // Run tests in sequence
    await testHealthCheck();
    await testSignup();
    await testLogin();
    await testGetProfile();
    await testTokenRefresh();
    await testStartSession();
    await testSubmitAnswer();
    await testGetSession();
    await testCompleteSession();
    await testGetUserSessions();
    await testGetCodingChallenges();
    await testGetLeaderboard();
    await testGeminiQuestions();
    await testInvalidToken();
    await testMissingAuth();
    
    // Print summary
    printSummary();
  } catch (error) {
    console.error(`\n${colors.red}Fatal error during test execution:${colors.reset}`, error);
    process.exit(1);
  }
}

// Run tests
runTests();
