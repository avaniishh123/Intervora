/**
 * Test environment loading
 */

require('dotenv').config({ override: true });

console.log('🔍 Testing Environment Loading...\n');

const apiKey = process.env.GEMINI_API_KEY;
console.log('Raw API Key from env:', apiKey);
console.log('API Key length:', apiKey ? apiKey.length : 'undefined');
console.log('API Key first 10 chars:', apiKey ? apiKey.substring(0, 10) : 'undefined');
console.log('API Key last 4 chars:', apiKey ? apiKey.slice(-4) : 'undefined');

// Check if it matches the expected new key
const expectedKey = 'AIzaSyBOxOeVmIZD4_112tfqyREdRUbG2slvxFI';
console.log('\nExpected key last 4 chars:', expectedKey.slice(-4));
console.log('Keys match:', apiKey === expectedKey);