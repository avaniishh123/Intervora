/**
 * Test new API key directly
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testNewApiKey() {
  console.log('🔍 Testing New API Key Directly...\n');

  // Use the new API key directly (not from environment)
  const newApiKey = 'AIzaSyBOxOeVmIZD4_112tfqyREdRUbG2slvxFI';
  
  console.log('🔑 New API Key (masked): ***' + newApiKey.slice(-4));
  console.log('🤖 Model: models/gemini-flash-latest');

  try {
    console.log('\n📡 Testing API Connection...');
    const genAI = new GoogleGenerativeAI(newApiKey);
    const model = genAI.getGenerativeModel({ model: 'models/gemini-flash-latest' });

    const result = await model.generateContent('Say "Hello" in one word');
    const response = result.response;
    const text = response.text();

    console.log('✅ API Connection successful');
    console.log('📝 Test Response: ' + text.trim());
    console.log('\n🎉 New API key is working correctly!');
    console.log('📋 Next step: Update .env file and restart backend');

  } catch (error) {
    console.error('❌ API Test failed:', error.message);
    if (error.message.includes('API key expired')) {
      console.error('🔧 The provided API key appears to be expired or invalid');
    } else if (error.message.includes('quota')) {
      console.error('🔧 API quota exceeded - key is valid but rate limited');
    } else {
      console.error('🔧 Please check the API key and try again');
    }
  }
}

testNewApiKey().catch(console.error);