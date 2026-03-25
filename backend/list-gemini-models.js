/**
 * List available Gemini models
 */

require('dotenv').config({ path: './backend/.env' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found');
    process.exit(1);
  }

  console.log('🔍 Listing available Gemini models...\n');

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Try different model names
    const modelsToTry = [
      'gemini-pro',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.0-pro',
      'models/gemini-pro',
      'models/gemini-1.5-pro'
    ];

    for (const modelName of modelsToTry) {
      try {
        console.log(`Testing: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Say hello');
        const text = result.response.text();
        console.log(`✅ ${modelName} works!`);
        console.log(`   Response: ${text.substring(0, 50)}...\n`);
      } catch (error) {
        console.log(`❌ ${modelName} failed: ${error.message.substring(0, 100)}\n`);
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

listModels();
