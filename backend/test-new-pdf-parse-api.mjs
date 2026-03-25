import { PDFParse } from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing new pdf-parse API (v2.4.5)\n');

// Find a test PDF
const resumesDir = path.join(__dirname, 'uploads', 'resumes');
const files = fs.readdirSync(resumesDir);
const testFile = files.find(f => f.endsWith('.pdf'));

if (!testFile) {
  console.log('❌ No PDF files found to test');
  process.exit(1);
}

const filePath = path.join(resumesDir, testFile);
console.log(`📄 Testing with: ${testFile}\n`);

try {
  // Read the PDF buffer
  const dataBuffer = fs.readFileSync(filePath);
  console.log(`✅ Read ${dataBuffer.length} bytes\n`);
  
  // Convert Buffer to Uint8Array (required by new pdf-parse API)
  const uint8Array = new Uint8Array(dataBuffer);
  console.log(`✅ Converted to Uint8Array\n`);
  
  // Try using PDFParse class
  console.log('🔍 Attempting to parse with PDFParse class...\n');
  
  const pdfParse = new PDFParse(uint8Array);
  console.log('✅ PDFParse instance created');
  console.log('   Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(pdfParse)));
  
  // Try to extract text
  console.log('\n📝 Attempting to extract text...');
  const result = await pdfParse.getText();
  
  console.log('\n📊 Result type:', typeof result);
  console.log('📊 Result:', result);
  
  if (typeof result === 'string') {
    console.log(`\n✅ SUCCESS! Extracted ${result.length} characters`);
    console.log('\n📄 Text preview (first 500 chars):');
    console.log('-'.repeat(60));
    console.log(result.substring(0, 500));
    console.log('-'.repeat(60));
  } else if (result && typeof result === 'object') {
    console.log('\n📊 Result is an object with keys:', Object.keys(result));
    if (result.text) {
      console.log(`\n✅ SUCCESS! Extracted ${result.text.length} characters`);
      console.log('\n📄 Text preview (first 500 chars):');
      console.log('-'.repeat(60));
      console.log(result.text.substring(0, 500));
      console.log('-'.repeat(60));
    }
  } else {
    console.log('\n❌ Unexpected result type');
  }
  
} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.error('Stack:', error.stack);
}
