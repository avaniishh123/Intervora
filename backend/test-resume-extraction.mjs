/**
 * Test script to diagnose resume text extraction issues
 * This will test the PDF parsing functionality with actual resume files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfParseModule from 'pdf-parse/node';

const pdfParse = pdfParseModule.default || pdfParseModule;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 ===== RESUME EXTRACTION DIAGNOSTIC TEST =====\n');

// Find resume files in uploads directory
const resumesDir = path.join(__dirname, 'uploads', 'resumes');
console.log(`📁 Checking resumes directory: ${resumesDir}`);

if (!fs.existsSync(resumesDir)) {
  console.error('❌ Resumes directory does not exist!');
  console.log('   Creating directory...');
  fs.mkdirSync(resumesDir, { recursive: true });
  console.log('✅ Directory created');
  console.log('\n⚠️  No resume files to test. Please upload a resume first.');
  process.exit(0);
}

const files = fs.readdirSync(resumesDir);
console.log(`📊 Found ${files.length} file(s) in resumes directory\n`);

if (files.length === 0) {
  console.log('⚠️  No resume files to test. Please upload a resume first.');
  process.exit(0);
}

// Test each resume file
async function testResumeExtraction(filename) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 Testing: ${filename}`);
  console.log('='.repeat(60));
  
  const filePath = path.join(resumesDir, filename);
  
  try {
    // Check file exists
    if (!fs.existsSync(filePath)) {
      console.error('❌ File not found!');
      return;
    }
    console.log('✅ File exists');
    
    // Get file stats
    const stats = fs.statSync(filePath);
    console.log(`📊 File size: ${stats.size} bytes (${(stats.size / 1024).toFixed(2)} KB)`);
    console.log(`📅 Modified: ${stats.mtime}`);
    
    // Check file extension
    const ext = path.extname(filename).toLowerCase();
    console.log(`📎 Extension: ${ext}`);
    
    if (ext !== '.pdf') {
      console.log('⚠️  Skipping non-PDF file (this test only handles PDFs)');
      return;
    }
    
    // Read file buffer
    console.log('\n📖 Reading file buffer...');
    const dataBuffer = fs.readFileSync(filePath);
    console.log(`✅ Buffer read: ${dataBuffer.length} bytes`);
    
    // Check if buffer is valid
    if (dataBuffer.length === 0) {
      console.error('❌ Buffer is empty!');
      return;
    }
    
    // Check PDF header
    const header = dataBuffer.slice(0, 5).toString();
    console.log(`📋 File header: "${header}"`);
    
    if (!header.startsWith('%PDF')) {
      console.error('❌ Invalid PDF header! File may be corrupted.');
      return;
    }
    console.log('✅ Valid PDF header detected');
    
    // Parse PDF
    console.log('\n🔍 Parsing PDF content...');
    const startTime = Date.now();
    
    const data = await pdfParse(dataBuffer, {
      max: 0, // Parse all pages
      version: 'default'
    });
    
    const parseTime = Date.now() - startTime;
    console.log(`✅ PDF parsed successfully in ${parseTime}ms`);
    
    // Display PDF info
    console.log('\n📊 PDF Information:');
    console.log(`   Pages: ${data.numpages}`);
    console.log(`   Text length: ${data.text.length} characters`);
    console.log(`   Info:`, JSON.stringify(data.info, null, 2));
    
    // Display extracted text preview
    console.log('\n📝 Extracted Text Preview (first 500 characters):');
    console.log('-'.repeat(60));
    console.log(data.text.substring(0, 500));
    console.log('-'.repeat(60));
    
    // Validate text
    const minLength = 50;
    if (data.text.trim().length < minLength) {
      console.error(`\n❌ VALIDATION FAILED: Text too short (${data.text.length} < ${minLength})`);
      console.error('   This PDF may contain only images or be corrupted.');
    } else {
      console.log(`\n✅ VALIDATION PASSED: Text length sufficient (${data.text.length} characters)`);
    }
    
    // Check for common resume keywords
    const keywords = ['experience', 'education', 'skills', 'work', 'project', 'university', 'college', 'developer', 'engineer'];
    const foundKeywords = keywords.filter(keyword => 
      data.text.toLowerCase().includes(keyword)
    );
    
    console.log(`\n🔍 Resume Keywords Found (${foundKeywords.length}/${keywords.length}):`);
    console.log(`   ${foundKeywords.join(', ') || 'None'}`);
    
    if (foundKeywords.length === 0) {
      console.warn('⚠️  No common resume keywords found. This may not be a resume.');
    }
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ ERROR during extraction:');
    console.error('   Name:', error.name);
    console.error('   Message:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
  }
}

// Run tests
async function runAllTests() {
  const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
  
  console.log(`\n🎯 Testing ${pdfFiles.length} PDF file(s)...\n`);
  
  for (const file of pdfFiles) {
    await testResumeExtraction(file);
  }
  
  console.log('\n\n🏁 ===== ALL TESTS COMPLETED =====\n');
}

runAllTests().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
