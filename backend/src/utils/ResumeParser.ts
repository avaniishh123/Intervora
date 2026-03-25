import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

/**
 * ResumeParser utility class for extracting text from resume files
 * Enhanced with detailed logging and fallback mechanisms
 */
export class ResumeParser {
  /**
   * Extract text from PDF file with enhanced error handling
   * @param filePath - Path to the PDF file
   * @returns Extracted text as string
   */
  static async extractTextFromPDF(filePath: string): Promise<string> {
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
        console.error('   Error stack:', error.stack);
      }
      
      throw new Error(
        `Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract text from DOC/DOCX file with enhanced error handling
   * @param filePath - Path to the DOC/DOCX file
   * @returns Extracted text as string
   */
  static async extractTextFromDOC(filePath: string): Promise<string> {
    console.log(`📄 Attempting to extract text from DOC/DOCX: ${filePath}`);
    
    try {
      // Verify file exists and is readable
      if (!fs.existsSync(filePath)) {
        throw new Error(`DOC/DOCX file not found at path: ${filePath}`);
      }

      const stats = fs.statSync(filePath);
      console.log(`📊 DOC/DOCX file size: ${stats.size} bytes`);

      if (stats.size === 0) {
        throw new Error('DOC/DOCX file is empty (0 bytes)');
      }

      // Read the DOC/DOCX file
      console.log('📖 Reading DOC/DOCX file...');
      const result = await mammoth.extractRawText({ path: filePath });
      
      console.log(`📝 DOC/DOCX extraction complete:`);
      console.log(`   - Text length: ${result.value.length} characters`);
      console.log(`   - Messages: ${result.messages.length}`);
      
      if (result.messages.length > 0) {
        console.log('   - Extraction messages:');
        result.messages.forEach(msg => {
          console.log(`     ${msg.type}: ${msg.message}`);
        });
      }

      const extractedText = result.value.trim();
      
      if (!extractedText || extractedText.length < 10) {
        console.warn('⚠️ DOC/DOCX text extraction returned very little content');
        throw new Error('DOC/DOCX appears to be empty or unreadable.');
      }

      console.log(`✅ Successfully extracted ${extractedText.length} characters from DOC/DOCX`);
      console.log(`   Preview: "${extractedText.substring(0, 150)}..."`);
      
      return extractedText;
    } catch (error) {
      console.error('❌ Error extracting text from DOC/DOCX:', error);
      
      if (error instanceof Error) {
        console.error('   Error name:', error.name);
        console.error('   Error message:', error.message);
      }
      
      throw new Error(
        `Failed to extract text from DOC/DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract text from resume file based on file extension
   * Enhanced with detailed logging and validation
   * @param filePath - Path to the resume file
   * @returns Extracted text as string
   */
  static async extractText(filePath: string): Promise<string> {
    console.log('\n🚀 Starting resume text extraction...');
    console.log(`📁 File path: ${filePath}`);
    
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        throw new Error(`File not found at path: ${filePath}`);
      }

      console.log('✅ File exists');

      // Get file stats
      const stats = fs.statSync(filePath);
      console.log(`📊 File stats:`);
      console.log(`   - Size: ${stats.size} bytes (${(stats.size / 1024).toFixed(2)} KB)`);
      console.log(`   - Created: ${stats.birthtime}`);
      console.log(`   - Modified: ${stats.mtime}`);

      // Get file extension
      const fileExtension = path.extname(filePath).toLowerCase();
      console.log(`📎 File extension: ${fileExtension}`);

      // Extract text based on file type
      let extractedText: string;
      
      switch (fileExtension) {
        case '.pdf':
          console.log('🔄 Processing as PDF file...');
          extractedText = await this.extractTextFromPDF(filePath);
          break;
        
        case '.doc':
        case '.docx':
          console.log('🔄 Processing as DOC/DOCX file...');
          extractedText = await this.extractTextFromDOC(filePath);
          break;
        
        default:
          console.error(`❌ Unsupported file format: ${fileExtension}`);
          throw new Error(
            `Unsupported file format: ${fileExtension}. Only PDF, DOC, and DOCX are supported.`
          );
      }

      // Final validation
      console.log('\n🔍 Validating extracted text...');
      console.log(`   - Length: ${extractedText.length} characters`);
      console.log(`   - First 200 chars: "${extractedText.substring(0, 200)}..."`);

      if (!this.validateExtractedText(extractedText)) {
        console.error('❌ Extracted text failed validation');
        throw new Error('Extracted text is too short or empty. Minimum 50 characters required.');
      }

      console.log('✅ Text extraction and validation successful!\n');
      return extractedText;
      
    } catch (error) {
      console.error('\n❌ Resume text extraction failed:');
      console.error('   Error:', error);
      
      // Re-throw with informative error message
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to extract text from resume file');
    }
  }

  /**
   * Validate extracted text
   * @param text - Extracted text
   * @returns True if text is valid, false otherwise
   */
  static validateExtractedText(text: string): boolean {
    // Check if text is not empty and has minimum length
    const minLength = 50; // Minimum 50 characters for a valid resume
    
    if (!text || text.trim().length < minLength) {
      console.warn(`⚠️ Text validation failed: length ${text?.length || 0} < ${minLength}`);
      return false;
    }

    console.log(`✅ Text validation passed: ${text.length} characters`);
    return true;
  }
}

export default ResumeParser;
