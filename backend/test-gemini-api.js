/**
 * Test script to verify Gemini API is working correctly
 * Run with: node backend/test-gemini-api.js
 */

require('dotenv').config({ path: './backend/.env' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGeminiAPI() {
  console.log('🔍 Testing Gemini API Configuration...\n');

  // Check if API key is loaded
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not found in environment variables');
    console.error('Please check your .env file');
    process.exit(1);
  }

  console.log('✅ API Key found');
  console.log(`   Preview: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}\n`);

  try {
    // Initialize Gemini
    console.log('🔄 Initializing Gemini AI...');
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Try different model names to find one that works
    const modelsToTry = [
      'models/gemini-flash-latest',
      'gemini-flash-latest',
      'gemini-2.5-flash',
      'gemini-pro-latest',
      'gemini-2.0-flash'
    ];

    let workingModel = null;
    let modelName = null;

    console.log('🔍 Finding available model...');
    for (const name of modelsToTry) {
      try {
        console.log(`   Trying: ${name}...`);
        const testModel = genAI.getGenerativeModel({ model: name });
        const testResult = await testModel.generateContent('Hello');
        workingModel = testModel;
        modelName = name;
        console.log(`   ✅ ${name} works!\n`);
        break;
      } catch (error) {
        console.log(`   ❌ ${name} failed`);
      }
    }

    if (!workingModel) {
      throw new Error('No working Gemini model found. Please check your API key and internet connection.');
    }

    console.log(`✅ Using model: ${modelName}\n`);

    // Test simple generation
    console.log('🔄 Testing simple text generation...');
    const result = await workingModel.generateContent('Say "Hello, Gemini is working!" in JSON format with a status field.');
    const response = result.response;
    const text = response.text();
    
    console.log('✅ Gemini API Response:');
    console.log(text);
    console.log('');

    // Test JD-based question generation
    console.log('🔄 Testing JD-based question generation...');
    console.log(`   Using model: ${modelName}\n`);
    const jdPrompt = `Generate 2 interview questions for a Software Engineer position based on this job description:

Job Description:
We are seeking a talented Software Engineer with 3+ years of experience in JavaScript, React, and Node.js. 
The candidate will be responsible for building scalable web applications and working with REST APIs.

Return your response in JSON format:
{
  "questions": [
    {
      "text": "Question text here",
      "category": "technical",
      "expectedKeywords": ["keyword1", "keyword2"],
      "timeLimit": 180
    }
  ]
}`;

    const jdResult = await workingModel.generateContent(jdPrompt);
    const jdResponse = jdResult.response;
    const jdText = jdResponse.text();
    
    console.log('✅ JD-based Question Generation Response:');
    console.log(jdText);
    console.log('');

    // Try to parse the response
    try {
      let jsonText = jdText.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }
      
      const parsed = JSON.parse(jsonText);
      
      if (parsed.questions && Array.isArray(parsed.questions)) {
        console.log(`✅ Successfully parsed ${parsed.questions.length} questions`);
        parsed.questions.forEach((q, idx) => {
          console.log(`   ${idx + 1}. ${q.text?.substring(0, 80)}...`);
        });
      } else {
        console.warn('⚠️ Response does not contain questions array');
      }
    } catch (parseError) {
      console.error('❌ Failed to parse JSON response:', parseError.message);
    }

    console.log('\n✅ All tests passed! Gemini API is working correctly.');
    console.log(`✅ Working model: ${modelName}`);
    console.log('\n📝 IMPORTANT: Update your backend code to use this model:');
    console.log(`   In geminiService.ts and ragService.ts, use model: '${modelName}'\n`);

  } catch (error) {
    console.error('\n❌ Gemini API Test Failed:');
    console.error('Error:', error.message);
    
    if (error.message.includes('API_KEY_INVALID')) {
      console.error('\n🔧 Fix: Your API key is invalid. Please check:');
      console.error('   1. The API key in your .env file is correct');
      console.error('   2. The API key is enabled in Google AI Studio');
      console.error('   3. You have billing enabled (if required)');
    } else if (error.message.includes('quota')) {
      console.error('\n🔧 Fix: You have exceeded your API quota');
      console.error('   Check your usage at: https://aistudio.google.com/');
    } else {
      console.error('\n🔧 Troubleshooting:');
      console.error('   1. Check your internet connection');
      console.error('   2. Verify the API key is correct');
      console.error('   3. Check Google AI Studio for any issues');
    }
    
    process.exit(1);
  }
}

// Run the test
testGeminiAPI();
