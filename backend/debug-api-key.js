/**
 * Debug script to test API key directly
 * Run with: node backend/debug-api-key.js
 */

// Load environment variables with override
require('dotenv').config({ override: true });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function debugApiKey() {
  console.log('🔍 API Key Debug Test');
  console.log('===================');
  
  // Check environment loading
  console.log('1. Environment Check:');
  console.log('   Working directory:', process.cwd());
  console.log('   .env file path: ./backend/.env');
  console.log('   Raw API key:', process.env.GEMINI_API_KEY);
  console.log('   Key length:', process.env.GEMINI_API_KEY?.length || 0);
  console.log('');

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ No API key found in environment');
    return;
  }

  // Test the key directly
  console.log('2. Direct API Test:');
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'models/gemini-flash-latest' });
    
    console.log('   Sending test request...');
    const result = await model.generateContent('Say "API key works!" in JSON format');
    const response = result.response;
    const text = response.text();
    
    console.log('✅ API Key is working!');
    console.log('   Response:', text);
  } catch (error) {
    console.error('❌ API Key test failed:');
    console.error('   Error:', error.message);
    
    if (error.message.includes('API_KEY_INVALID')) {
      console.error('   → The API key is invalid or expired');
    } else if (error.message.includes('quota')) {
      console.error('   → API quota exceeded');
    } else {
      console.error('   → Other error (network, model, etc.)');
    }
  }
}

debugApiKey();