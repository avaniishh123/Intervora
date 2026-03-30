/**
 * Test the new API key directly without dotenv
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testNewKey() {
  // Use the key from environment
  const newApiKey = process.env.GEMINI_API_KEY || '';
  if (!newApiKey) {
    console.error('❌ GEMINI_API_KEY not set in environment. Set it in backend/.env');
    process.exit(1);
  }
  
  console.log('🔍 Testing New API Key Directly');
  console.log('===============================');
  console.log('Key:', newApiKey);
  console.log('Length:', newApiKey.length);
  console.log('');

  try {
    const genAI = new GoogleGenerativeAI(newApiKey);
    const model = genAI.getGenerativeModel({ model: 'models/gemini-flash-latest' });
    
    console.log('Sending test request...');
    const result = await model.generateContent('Say "New API key works!" in JSON format');
    const response = result.response;
    const text = response.text();
    
    console.log('✅ NEW API Key is working!');
    console.log('Response:', text);
  } catch (error) {
    console.error('❌ NEW API Key test failed:');
    console.error('Error:', error.message);
  }
}

testNewKey();