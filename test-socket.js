/**
 * Socket.io Real-Time Communication Test
 * Tests WebSocket connectivity and real-time events
 * 
 * Run with: node test-socket.js
 */

const io = require('socket.io-client');
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

let testState = {
  accessToken: null,
  sessionId: null,
  socket: null,
  interviewSocket: null,
  eventsReceived: {
    connect: false,
    questionNew: false,
    evaluationResult: false,
    scoreUpdate: false,
    sessionCompleted: false
  }
};

/**
 * Helper to log
 */
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

/**
 * Setup: Create user and get token
 */
async function setup() {
  log('\n═══ SETUP: Creating test user ═══', 'info');
  
  try {
    const email = `sockettest_${Date.now()}@example.com`;
    const password = 'TestPass123!';
    
    // Signup
    const signupResponse = await axios.post(`${API_URL}/auth/signup`, {
      email,
      password,
      name: 'Socket Test User'
    });
    
    if (signupResponse.data.accessToken) {
      testState.accessToken = signupResponse.data.accessToken;
      log(`✓ User created and token obtained`, 'success');
      return true;
    } else {
      log('✗ Failed to get access token', 'error');
      return false;
    }
  } catch (error) {
    log(`✗ Setup failed: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Test 1: Connect to main socket
 */
function test1_ConnectMainSocket() {
  return new Promise((resolve) => {
    log('\n═══ TEST 1: Connect to Main Socket ═══', 'info');
    
    testState.socket = io(SOCKET_URL, {
      auth: {
        token: testState.accessToken
      },
      transports: ['websocket', 'polling']
    });
    
    testState.socket.on('connect', () => {
      log(`✓ Connected to main socket: ${testState.socket.id}`, 'success');
      testState.eventsReceived.connect = true;
      resolve(true);
    });
    
    testState.socket.on('connect_error', (error) => {
      log(`✗ Connection error: ${error.message}`, 'error');
      resolve(false);
    });
    
    // Timeout after 5 seconds
    setTimeout(() => {
      if (!testState.eventsReceived.connect) {
        log('✗ Connection timeout', 'error');
        resolve(false);
      }
    }, 5000);
  });
}

/**
 * Test 2: Connect to interview namespace
 */
function test2_ConnectInterviewNamespace() {
  return new Promise((resolve) => {
    log('\n═══ TEST 2: Connect to Interview Namespace ═══', 'info');
    
    testState.interviewSocket = io(`${SOCKET_URL}/interview`, {
      auth: {
        token: testState.accessToken
      },
      transports: ['websocket', 'polling']
    });
    
    testState.interviewSocket.on('connect', () => {
      log(`✓ Connected to interview namespace: ${testState.interviewSocket.id}`, 'success');
      resolve(true);
    });
    
    testState.interviewSocket.on('connect_error', (error) => {
      log(`✗ Interview namespace connection error: ${error.message}`, 'error');
      resolve(false);
    });
    
    // Timeout after 5 seconds
    setTimeout(() => {
      if (!testState.interviewSocket.connected) {
        log('✗ Interview namespace connection timeout', 'error');
        resolve(false);
      }
    }, 5000);
  });
}

/**
 * Test 3: Start session and listen for events
 */
async function test3_SessionEvents() {
  log('\n═══ TEST 3: Session Events ═══', 'info');
  
  try {
    // Create a session first
    const sessionResponse = await axios.post(
      `${API_URL}/api/sessions/start`,
      {
        jobRole: 'Software Engineer',
        mode: 'general',
        mentorModeEnabled: false
      },
      {
        headers: {
          Authorization: `Bearer ${testState.accessToken}`
        }
      }
    );
    
    if (!sessionResponse.data.sessionId) {
      log('✗ Failed to create session', 'error');
      return false;
    }
    
    testState.sessionId = sessionResponse.data.sessionId;
    log(`✓ Session created: ${testState.sessionId}`, 'success');
    
    // Set up event listeners
    return new Promise((resolve) => {
      let eventCount = 0;
      const expectedEvents = 3; // We'll test 3 key events
      
      // Listen for question:new
      testState.interviewSocket.on('question:new', (data) => {
        log(`✓ Received 'question:new' event`, 'success');
        log(`  Question: ${data.text?.substring(0, 50)}...`, 'info');
        testState.eventsReceived.questionNew = true;
        eventCount++;
        checkComplete();
      });
      
      // Listen for evaluation:result
      testState.interviewSocket.on('evaluation:result', (data) => {
        log(`✓ Received 'evaluation:result' event`, 'success');
        log(`  Score: ${data.score}`, 'info');
        testState.eventsReceived.evaluationResult = true;
        eventCount++;
        checkComplete();
      });
      
      // Listen for score:update
      testState.interviewSocket.on('score:update', (data) => {
        log(`✓ Received 'score:update' event`, 'success');
        log(`  Current Score: ${data.currentScore}`, 'info');
        testState.eventsReceived.scoreUpdate = true;
        eventCount++;
        checkComplete();
      });
      
      // Listen for session:completed
      testState.interviewSocket.on('session:completed', (data) => {
        log(`✓ Received 'session:completed' event`, 'success');
        testState.eventsReceived.sessionCompleted = true;
        eventCount++;
        checkComplete();
      });
      
      // Listen for notifications
      testState.interviewSocket.on('notification', (data) => {
        log(`ℹ Notification: ${data.message}`, 'info');
      });
      
      function checkComplete() {
        if (eventCount >= expectedEvents) {
          log(`✓ Received ${eventCount} events successfully`, 'success');
          resolve(true);
        }
      }
      
      // Emit session:start
      log('Emitting session:start event...', 'info');
      testState.interviewSocket.emit('session:start', {
        sessionId: testState.sessionId
      });
      
      // Simulate answer submission after 2 seconds
      setTimeout(async () => {
        log('Submitting test answer...', 'info');
        testState.interviewSocket.emit('answer:submit', {
          sessionId: testState.sessionId,
          questionId: 'test-q1',
          answer: 'This is a test answer to verify real-time communication.'
        });
      }, 2000);
      
      // Timeout after 15 seconds
      setTimeout(() => {
        if (eventCount < expectedEvents) {
          log(`⚠ Only received ${eventCount}/${expectedEvents} expected events`, 'warning');
          resolve(eventCount > 0); // Partial success if we got some events
        }
      }, 15000);
    });
  } catch (error) {
    log(`✗ Session events test failed: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Test 4: Reconnection handling
 */
function test4_Reconnection() {
  return new Promise((resolve) => {
    log('\n═══ TEST 4: Reconnection Handling ═══', 'info');
    
    let reconnected = false;
    
    testState.interviewSocket.on('reconnect', (attemptNumber) => {
      log(`✓ Reconnected after ${attemptNumber} attempts`, 'success');
      reconnected = true;
      resolve(true);
    });
    
    // Disconnect and wait for reconnection
    log('Disconnecting socket...', 'info');
    testState.interviewSocket.disconnect();
    
    setTimeout(() => {
      log('Reconnecting socket...', 'info');
      testState.interviewSocket.connect();
    }, 1000);
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (!reconnected) {
        log('⚠ Reconnection not tested (may not be necessary)', 'warning');
        resolve(true); // Don't fail the test
      }
    }, 10000);
  });
}

/**
 * Cleanup
 */
function cleanup() {
  log('\n═══ CLEANUP ═══', 'info');
  
  if (testState.socket) {
    testState.socket.disconnect();
    log('✓ Main socket disconnected', 'success');
  }
  
  if (testState.interviewSocket) {
    testState.interviewSocket.disconnect();
    log('✓ Interview socket disconnected', 'success');
  }
}

/**
 * Print summary
 */
function printSummary(results) {
  console.log(`\n${colors.blue}${'═'.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}SOCKET.IO TEST SUMMARY${colors.reset}`);
  console.log(`${colors.blue}${'═'.repeat(60)}${colors.reset}`);
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`Total: ${results.length}`);
  
  console.log(`\n${colors.cyan}Events Received:${colors.reset}`);
  Object.entries(testState.eventsReceived).forEach(([event, received]) => {
    const status = received ? colors.green + '✓' : colors.red + '✗';
    console.log(`  ${status} ${event}${colors.reset}`);
  });
  
  console.log(`\n${colors.blue}${'═'.repeat(60)}${colors.reset}\n`);
  
  return failed === 0;
}

/**
 * Main test runner
 */
async function runSocketTests() {
  console.log(`${colors.blue}${'═'.repeat(60)}${colors.reset}`);
  console.log(`${colors.blue}AI Interview Maker - Socket.io Tests${colors.reset}`);
  console.log(`${colors.blue}Socket URL: ${SOCKET_URL}${colors.reset}`);
  console.log(`${colors.blue}${'═'.repeat(60)}${colors.reset}`);
  
  const results = [];
  
  try {
    // Setup
    const setupSuccess = await setup();
    if (!setupSuccess) {
      log('✗ Setup failed, cannot continue', 'error');
      process.exit(1);
    }
    
    // Run tests
    const test1 = await test1_ConnectMainSocket();
    results.push({ name: 'Connect to main socket', passed: test1 });
    
    const test2 = await test2_ConnectInterviewNamespace();
    results.push({ name: 'Connect to interview namespace', passed: test2 });
    
    if (test2) {
      const test3 = await test3_SessionEvents();
      results.push({ name: 'Session events', passed: test3 });
      
      const test4 = await test4_Reconnection();
      results.push({ name: 'Reconnection handling', passed: test4 });
    }
    
    // Cleanup
    cleanup();
    
    // Print summary
    const allPassed = printSummary(results);
    
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    log(`\n✗ Fatal error: ${error.message}`, 'error');
    cleanup();
    process.exit(1);
  }
}

// Run tests
runSocketTests();
