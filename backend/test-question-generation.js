/**
 * Test Gemini Question Generation Fix
 * Verifies that no greeting questions are generated
 */

const { geminiService } = require('./dist/services/geminiService.js');

async function testQuestionGeneration() {
  console.log('🔍 Testing Gemini Question Generation Fix...\n');

  try {
    // Test parameters
    const params = {
      role: 'Software Engineer',
      difficulty: 'medium',
      count: 5,
      sessionId: 'test_session_' + Date.now()
    };

    console.log('📝 Generating questions with params:', params);
    console.log('🎯 Expected: 5 technical questions, NO greetings\n');

    // Generate questions
    const questions = await geminiService.generateQuestions(params);

    console.log('📊 RESULTS:');
    console.log('- Total questions generated:', questions.length);
    console.log('- Expected count:', params.count);
    console.log('- Match expected count:', questions.length === params.count ? '✅' : '❌');

    // Check each question
    console.log('\n📋 QUESTION ANALYSIS:');
    questions.forEach((q, index) => {
      const isGreeting = ['hello', 'welcome', 'how are you', 'introduction'].some(keyword => 
        q.text.toLowerCase().includes(keyword)
      );
      
      console.log(`${index + 1}. Category: ${q.category}`);
      console.log(`   Topic: ${q.topic}`);
      console.log(`   Text: ${q.text.substring(0, 80)}...`);
      console.log(`   Is Greeting: ${isGreeting ? '❌ FAILED' : '✅ PASSED'}`);
      console.log('');
    });

    // Overall validation
    const hasGreetings = questions.some(q => 
      ['hello', 'welcome', 'how are you', 'introduction'].some(keyword => 
        q.text.toLowerCase().includes(keyword)
      ) || q.category === 'greeting'
    );

    console.log('🎯 FINAL VALIDATION:');
    console.log('- No greeting questions:', hasGreetings ? '❌ FAILED' : '✅ PASSED');
    console.log('- All questions technical:', questions.every(q => q.category !== 'greeting') ? '✅ PASSED' : '❌ FAILED');
    console.log('- Correct count generated:', questions.length === params.count ? '✅ PASSED' : '❌ FAILED');

    if (!hasGreetings && questions.length === params.count) {
      console.log('\n🎉 SUCCESS: Question generation fix is working correctly!');
    } else {
      console.log('\n❌ FAILURE: Question generation still has issues');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testQuestionGeneration().catch(console.error);