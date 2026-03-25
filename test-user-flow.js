/**
 * Complete User Flow Test
 * Tests the entire user journey: signup → login → interview setup → interview → results
 * 
 * Run with: node test-user-flow.js
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
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

// Test state
let state = {
  user: {
    email: `testuser_${Date.now()}@example.com`,
    password: 'SecurePass123!',
    name: 'Test User'
  },
  tokens: {
    accessToken: null,
    refreshToken: null
  },
  sessionId: null,
  questions: [],
  currentQuestionIndex: 0
};

/**
 * Helper to log steps
 */
function logStep(step, message, success = true) {
  const icon = success ? '✓' : '✗';
  const color = success ? colors.green : colors.red;
  console.log(`${color}${icon} Step ${step}: ${message}${colors.reset}`);
}

/**
 * Helper to log info
 */
function logInfo(message) {
  console.log(`${colors.cyan}ℹ ${message}${colors.reset}`);
}

/**
 * Helper to log error
 */
function logError(message, error) {
  console.log(`${colors.red}✗ ${message}${colors.reset}`);
  if (error) {
    console.log(`${colors.yellow}  Error: ${JSON.stringify(error)}${colors.reset}`);
  }
}

/**
 * Helper to make API requests
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
 * Step 1: User Signup
 */
async function step1_Signup() {
  console.log(`\n${colors.magenta}═══ STEP 1: USER SIGNUP ═══${colors.reset}`);
  
  const result = await apiRequest('POST', '/auth/signup', state.user);
  
  if (result.success && result.data.accessToken) {
    state.tokens.accessToken = result.data.accessToken;
    state.tokens.refreshToken = result.data.refreshToken;
    logStep(1, `User registered successfully: ${state.user.email}`, true);
    logInfo(`Access token received: ${state.tokens.accessToken.substring(0, 20)}...`);
    return true;
  } else {
    logError('Signup failed', result.error);
    return false;
  }
}

/**
 * Step 2: User Login
 */
async function step2_Login() {
  console.log(`\n${colors.magenta}═══ STEP 2: USER LOGIN ═══${colors.reset}`);
  
  const result = await apiRequest('POST', '/auth/login', {
    email: state.user.email,
    password: state.user.password
  });
  
  if (result.success && result.data.accessToken) {
    state.tokens.accessToken = result.data.accessToken;
    state.tokens.refreshToken = result.data.refreshToken;
    logStep(2, 'User logged in successfully', true);
    logInfo(`New access token: ${state.tokens.accessToken.substring(0, 20)}...`);
    return true;
  } else {
    logError('Login failed', result.error);
    return false;
  }
}

/**
 * Step 3: Interview Setup - Generate Questions
 */
async function step3_InterviewSetup() {
  console.log(`\n${colors.magenta}═══ STEP 3: INTERVIEW SETUP ═══${colors.reset}`);
  
  // Generate questions using Gemini
  const result = await apiRequest('POST', '/api/gemini/generate-questions', {
    role: 'Software Engineer',
    mode: 'general',
    difficulty: 'medium',
    count: 5
  }, {
    'Authorization': `Bearer ${state.tokens.accessToken}`
  });
  
  if (result.success && result.data.questions) {
    state.questions = result.data.questions;
    logStep(3, `Generated ${state.questions.length} interview questions`, true);
    state.questions.forEach((q, i) => {
      logInfo(`Q${i + 1}: ${q.text.substring(0, 60)}...`);
    });
    return true;
  } else {
    logError('Question generation failed', result.error);
    return false;
  }
}

/**
 * Step 4: Start Interview Session
 */
async function step4_StartSession() {
  console.log(`\n${colors.magenta}═══ STEP 4: START INTERVIEW SESSION ═══${colors.reset}`);
  
  const result = await apiRequest('POST', '/api/sessions/start', {
    jobRole: 'Software Engineer',
    mode: 'general',
    mentorModeEnabled: false
  }, {
    'Authorization': `Bearer ${state.tokens.accessToken}`
  });
  
  if (result.success && result.data.sessionId) {
    state.sessionId = result.data.sessionId;
    logStep(4, `Interview session started: ${state.sessionId}`, true);
    logInfo(`Session status: ${result.data.status}`);
    return true;
  } else {
    logError('Session start failed', result.error);
    return false;
  }
}

/**
 * Step 5: Answer Questions
 */
async function step5_AnswerQuestions() {
  console.log(`\n${colors.magenta}═══ STEP 5: ANSWER QUESTIONS ═══${colors.reset}`);
  
  const sampleAnswers = [
    'I have extensive experience with JavaScript and TypeScript. I have built multiple full-stack applications using React, Node.js, and Express. My approach focuses on writing clean, maintainable code with proper testing.',
    'When facing a challenging bug, I follow a systematic approach: reproduce the issue, isolate the problem, use debugging tools, check logs, and test potential solutions. I also document the issue and solution for future reference.',
    'I prioritize tasks based on business impact and urgency. I use agile methodologies and break down large tasks into smaller, manageable pieces. Regular communication with stakeholders ensures alignment.',
    'In my previous role, I led a team to migrate a legacy system to a modern architecture. We reduced load times by 60% and improved user satisfaction. I coordinated with cross-functional teams and managed the project timeline.',
    'I stay updated through technical blogs, conferences, online courses, and contributing to open-source projects. I believe in continuous learning and regularly experiment with new technologies in side projects.'
  ];
  
  let successCount = 0;
  
  for (let i = 0; i < Math.min(state.questions.length, sampleAnswers.length); i++) {
    const question = state.questions[i];
    const answer = sampleAnswers[i];
    
    logInfo(`Answering question ${i + 1}/${state.questions.length}`);
    
    const result = await apiRequest('POST', `/api/sessions/${state.sessionId}/submit-answer`, {
      questionId: question.id || `q${i + 1}`,
      answer: answer
    }, {
      'Authorization': `Bearer ${state.tokens.accessToken}`
    });
    
    if (result.success) {
      successCount++;
      logInfo(`  ✓ Answer ${i + 1} submitted successfully`);
      if (result.data.evaluation) {
        logInfo(`  Score: ${result.data.evaluation.score || 'N/A'}`);
      }
    } else {
      logError(`  ✗ Answer ${i + 1} submission failed`, result.error);
    }
    
    // Small delay between answers
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  logStep(5, `Answered ${successCount}/${state.questions.length} questions`, successCount > 0);
  return successCount > 0;
}

/**
 * Step 6: Complete Interview
 */
async function step6_CompleteInterview() {
  console.log(`\n${colors.magenta}═══ STEP 6: COMPLETE INTERVIEW ═══${colors.reset}`);
  
  const result = await apiRequest('POST', `/api/sessions/${state.sessionId}/complete`, {}, {
    'Authorization': `Bearer ${state.tokens.accessToken}`
  });
  
  if (result.success) {
    logStep(6, 'Interview completed successfully', true);
    
    if (result.data.performanceReport) {
      const report = result.data.performanceReport;
      logInfo(`Overall Score: ${report.overallScore || 'N/A'}`);
      
      if (report.categoryScores) {
        logInfo(`Category Scores:`);
        Object.entries(report.categoryScores).forEach(([category, score]) => {
          logInfo(`  - ${category}: ${score}`);
        });
      }
      
      if (report.strengths && report.strengths.length > 0) {
        logInfo(`Strengths: ${report.strengths.join(', ')}`);
      }
      
      if (report.weaknesses && report.weaknesses.length > 0) {
        logInfo(`Areas for Improvement: ${report.weaknesses.join(', ')}`);
      }
    }
    
    return true;
  } else {
    logError('Interview completion failed', result.error);
    return false;
  }
}

/**
 * Step 7: View Results
 */
async function step7_ViewResults() {
  console.log(`\n${colors.magenta}═══ STEP 7: VIEW RESULTS ═══${colors.reset}`);
  
  // Get session details
  const sessionResult = await apiRequest('GET', `/api/sessions/${state.sessionId}`, null, {
    'Authorization': `Bearer ${state.tokens.accessToken}`
  });
  
  if (sessionResult.success) {
    logStep(7, 'Retrieved session results', true);
    logInfo(`Session Status: ${sessionResult.data.status}`);
    logInfo(`Questions Answered: ${sessionResult.data.questions?.length || 0}`);
  } else {
    logError('Failed to retrieve session', sessionResult.error);
  }
  
  // Get user session history
  const historyResult = await apiRequest('GET', '/api/sessions/user/me', null, {
    'Authorization': `Bearer ${state.tokens.accessToken}`
  });
  
  if (historyResult.success) {
    logInfo(`Total Sessions: ${historyResult.data.sessions?.length || 0}`);
    return true;
  } else {
    logError('Failed to retrieve session history', historyResult.error);
    return false;
  }
}

/**
 * Step 8: Check Leaderboard
 */
async function step8_CheckLeaderboard() {
  console.log(`\n${colors.magenta}═══ STEP 8: CHECK LEADERBOARD ═══${colors.reset}`);
  
  const result = await apiRequest('GET', '/api/leaderboard', null, {
    'Authorization': `Bearer ${state.tokens.accessToken}`
  });
  
  if (result.success) {
    logStep(8, 'Retrieved leaderboard', true);
    logInfo(`Leaderboard Entries: ${result.data.leaderboard?.length || 0}`);
    
    if (result.data.userRank) {
      logInfo(`Your Rank: ${result.data.userRank.rank || 'N/A'}`);
      logInfo(`Your Score: ${result.data.userRank.averageScore || 'N/A'}`);
    }
    
    return true;
  } else {
    logError('Failed to retrieve leaderboard', result.error);
    return false;
  }
}

/**
 * Main test flow
 */
async function runCompleteUserFlow() {
  console.log(`${colors.blue}${'═'.repeat(70)}${colors.reset}`);
  console.log(`${colors.blue}AI Interview Maker - Complete User Flow Test${colors.reset}`);
  console.log(`${colors.blue}API URL: ${API_URL}${colors.reset}`);
  console.log(`${colors.blue}${'═'.repeat(70)}${colors.reset}`);
  
  try {
    // Run complete flow
    const step1 = await step1_Signup();
    if (!step1) throw new Error('Signup failed');
    
    const step2 = await step2_Login();
    if (!step2) throw new Error('Login failed');
    
    const step3 = await step3_InterviewSetup();
    if (!step3) throw new Error('Interview setup failed');
    
    const step4 = await step4_StartSession();
    if (!step4) throw new Error('Session start failed');
    
    const step5 = await step5_AnswerQuestions();
    if (!step5) throw new Error('Answering questions failed');
    
    const step6 = await step6_CompleteInterview();
    if (!step6) throw new Error('Interview completion failed');
    
    const step7 = await step7_ViewResults();
    if (!step7) throw new Error('Viewing results failed');
    
    const step8 = await step8_CheckLeaderboard();
    if (!step8) throw new Error('Checking leaderboard failed');
    
    // Success!
    console.log(`\n${colors.green}${'═'.repeat(70)}${colors.reset}`);
    console.log(`${colors.green}✓ COMPLETE USER FLOW TEST PASSED${colors.reset}`);
    console.log(`${colors.green}All steps completed successfully!${colors.reset}`);
    console.log(`${colors.green}${'═'.repeat(70)}${colors.reset}\n`);
    
    process.exit(0);
  } catch (error) {
    console.log(`\n${colors.red}${'═'.repeat(70)}${colors.reset}`);
    console.log(`${colors.red}✗ COMPLETE USER FLOW TEST FAILED${colors.reset}`);
    console.log(`${colors.red}Error: ${error.message}${colors.reset}`);
    console.log(`${colors.red}${'═'.repeat(70)}${colors.reset}\n`);
    
    process.exit(1);
  }
}

// Run the complete user flow
runCompleteUserFlow();
