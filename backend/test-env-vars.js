/**
 * Test environment variables loading
 */

console.log('🔍 Testing Environment Variables Loading...\n');

// Load dotenv first
require('dotenv').config({ override: true });

console.log('Environment Variables Check:');
console.log('- GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ Present (***' + process.env.GEMINI_API_KEY.slice(-4) + ')' : '❌ Missing');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? '✅ Present (***' + process.env.JWT_SECRET.slice(-4) + ')' : '❌ Missing');
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? '✅ Present' : '❌ Missing');
console.log('- PORT:', process.env.PORT ? '✅ Present (' + process.env.PORT + ')' : '❌ Missing');

console.log('\nRaw Values:');
console.log('- JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 'undefined');
// NOTE: Never log the actual JWT_SECRET value — removed for security

// Test the config module
console.log('\n🔍 Testing config module...');
const { config, validateEnv } = require('./src/config/env.ts');
console.log('- config.jwtSecret:', config.jwtSecret ? '✅ Present (***' + config.jwtSecret.slice(-4) + ')' : '❌ Missing');
console.log('- config.geminiApiKey:', config.geminiApiKey ? '✅ Present (***' + config.geminiApiKey.slice(-4) + ')' : '❌ Missing');

console.log('\n🔍 Running validation...');
validateEnv();