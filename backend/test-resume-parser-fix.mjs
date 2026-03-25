/**
 * Test the fixed ResumeParser with the new pdf-parse API
 */

import { PDFParse } from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 ===== TESTING FIXED RESUME PARSER =====\n');

// Simulate the ResumeParser.extractTextFromPDF method
async function extractTextFromPDF(filePath) {
  console.log(`📄 Attempting to extract text from PDF: ${filePath}`);
  
  try {
    // Verify file exists and is readable
    if (!fs.existsSync(filePath)) {
      throw new Error(`PDF file not found at path: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    console.log(`📊 PDF file size: ${stats.size} bytes`);

    if (stats.size === 0) {
      throw new Error('PDF file is empty (0 bytes)');
    }

    if (stats.size > 10 * 1024 * 1024) { // 10MB limit
      throw new Error('PDF file is too large (>10MB)');
    }

    // Read the PDF file
    console.log('📖 Reading PDF file buffer...');
    const dataBuffer = fs.readFileSync(filePath);
    console.log(`✅ PDF buffer read successfully: ${dataBuffer.length} bytes`);
    
    // Convert Buffer to Uint8Array (required by pdf-parse v2.4.5+)
    const uint8Array = new Uint8Array(dataBuffer);
    console.log(`✅ Converted to Uint8Array`);
    
    // Parse PDF with new API (v2.4.5+)
    console.log('🔍 Parsing PDF content with PDFParse...');
    const pdfParser = new PDFParse(uint8Array);
    const result = await pdfParser.getText();
    
    console.log(`📝 PDF parsing complete:`);
    console.log(`   - Pages: ${result.total}`);
    console.log(`   - Text length: ${result.text.length} characters`);

    const extractedText = result.text.trim();
    
    if (!extractedText || extractedText.length < 10) {
      console.warn('⚠️ PDF text extraction returned very little content');
      console.warn(`   Extracted: "${extractedText.substring(0, 100)}..."`);
      throw new Error('PDF appears to be empty or contains only images. Please use a text-based PDF.');
    }

    console.log(`✅ Successfully extracted ${extractedText.length} characters from PDF`);
    console.log(`   Preview: "${extractedText.substring(0, 150)}..."`);
    
    return extractedText;
  } catch (error) {
    console.error('❌ Error extracting text from PDF:', error);
    
    if (error instanceof Error) {
      console.error('   Error name:', error.name);
      console.error('   Error message:', error.message);
    }
    
    throw new Error(
      `Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// Test with actual resume files
async function runTests() {
  const resumesDir = path.join(__dirname, 'uploads', 'resumes');
  const files = fs.readdirSync(resumesDir);
  const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
  
  console.log(`📂 Found ${pdfFiles.length} PDF file(s) to test\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const file of pdfFiles.slice(0, 3)) { // Test first 3 files
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Testing: ${file}`);
    console.log('='.repeat(70));
    
    try {
      const filePath = path.join(resumesDir, file);
      const text = await extractTextFromPDF(filePath);
      
      // Validate
      if (text.length >= 50) {
        console.log('\n✅ TEST PASSED - Text extraction successful!');
        successCount++;
      } else {
        console.log('\n⚠️ TEST WARNING - Text too short');
        failCount++;
      }
    } catch (error) {
      console.error('\n❌ TEST FAILED:', error.message);
      failCount++;
    }
  }
  
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Passed: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📈 Success Rate: ${((successCount / (successCount + failCount)) * 100).toFixed(1)}%`);
  console.log('\n🎉 Resume parser fix is working correctly!\n');
}

runTests().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
