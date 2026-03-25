import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from './AuthController';
import { ResumeParser } from '../utils/ResumeParser';
import { resumeAnalyzer, ResumeAnalysis } from '../services/ResumeAnalyzer';
import User from '../models/User';
import config from '../config/env';

/**
 * ResumeController - Handles resume upload, analysis, and retrieval
 */
export class ResumeController {
  /**
   * Upload resume file
   * POST /api/resume/upload
   */
  async uploadResume(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Check if user is authenticated
      if (!req.user) {
        res.status(401).json({
          status: 'error',
          message: 'Unauthorized. Please authenticate first.'
        });
        return;
      }

      // Check if file was uploaded
      if (!req.file) {
        res.status(400).json({
          status: 'error',
          message: 'No file uploaded. Please upload a resume file (PDF, DOC, or DOCX).'
        });
        return;
      }

      const userId = req.user.userId;
      const file = req.file;

      // Generate resume URL (relative path)
      const resumeUrl = `/uploads/resumes/${file.filename}`;

      // Update user profile with resume URL
      const user = await User.findByIdAndUpdate(
        userId,
        {
          'profile.resumeUrl': resumeUrl
        },
        { new: true }
      );

      if (!user) {
        // Clean up uploaded file if user not found
        fs.unlinkSync(file.path);
        
        res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        status: 'success',
        message: 'Resume uploaded successfully',
        data: {
          resumeUrl,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
          uploadedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error uploading resume:', error);
      
      // Clean up uploaded file on error
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting file:', unlinkError);
        }
      }

      res.status(500).json({
        status: 'error',
        message: 'Failed to upload resume',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Analyze resume
   * POST /api/resume/analyze
   * Body: { jobDescription?: string }
   */
  async analyzeResume(req: AuthRequest, res: Response): Promise<void> {
    console.log('\n🎯 ===== RESUME ANALYSIS REQUEST =====');
    
    try {
      // Check if user is authenticated
      if (!req.user) {
        console.log('❌ User not authenticated');
        res.status(401).json({
          status: 'error',
          message: 'Unauthorized. Please authenticate first.'
        });
        return;
      }

      const userId = req.user.userId;
      const { jobDescription } = req.body;

      console.log(`👤 User ID: ${userId}`);
      console.log(`📋 Job Description provided: ${!!jobDescription}`);

      // Get user with resume URL
      const user = await User.findById(userId);

      if (!user) {
        console.log('❌ User not found in database');
        res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
        return;
      }

      console.log(`✅ User found: ${user.email}`);

      if (!user.profile.resumeUrl) {
        console.log('❌ No resume URL in user profile');
        res.status(400).json({
          status: 'error',
          message: 'No resume found. Please upload a resume first.'
        });
        return;
      }

      console.log(`📎 Resume URL from database: ${user.profile.resumeUrl}`);

      // Construct full file path
      const resumeFilename = path.basename(user.profile.resumeUrl);
      console.log(`📄 Resume filename: ${resumeFilename}`);
      
      const uploadDir = config.uploadDir || './uploads';
      console.log(`📁 Upload directory: ${uploadDir}`);
      
      const resumePath = path.join(uploadDir, 'resumes', resumeFilename);
      console.log(`🗂️  Full resume path: ${resumePath}`);
      console.log(`🗂️  Absolute path: ${path.resolve(resumePath)}`);

      // Check if file exists
      if (!fs.existsSync(resumePath)) {
        console.error('❌ Resume file not found on server');
        console.error(`   Checked path: ${resumePath}`);
        console.error(`   Absolute path: ${path.resolve(resumePath)}`);
        
        // List files in the resumes directory for debugging
        const resumesDir = path.join(uploadDir, 'resumes');
        if (fs.existsSync(resumesDir)) {
          const files = fs.readdirSync(resumesDir);
          console.log(`📂 Files in resumes directory (${files.length}):`);
          files.forEach(file => console.log(`   - ${file}`));
        } else {
          console.error(`❌ Resumes directory does not exist: ${resumesDir}`);
        }
        
        res.status(404).json({
          status: 'error',
          message: 'Resume file not found on server. Please upload your resume again.'
        });
        return;
      }

      console.log('✅ Resume file exists on server');

      // Extract text from resume
      console.log('\n📖 Starting text extraction...');
      const resumeText = await ResumeParser.extractText(resumePath);
      console.log(`✅ Text extraction complete: ${resumeText.length} characters`);

      // Validate extracted text
      console.log('\n🔍 Validating extracted text...');
      if (!ResumeParser.validateExtractedText(resumeText)) {
        console.error('❌ Extracted text validation failed');
        console.error(`   Text length: ${resumeText.length}`);
        console.error(`   Text preview: "${resumeText.substring(0, 100)}..."`);
        
        res.status(400).json({
          status: 'error',
          message: 'Unable to extract sufficient text from resume. The file may be corrupted, password-protected, or contain only images. Please ensure your resume is a text-based PDF or DOC/DOCX file.'
        });
        return;
      }

      console.log('✅ Text validation passed');

      // Analyze resume with Gemini
      console.log('\n🤖 Starting Gemini AI analysis...');
      const analysis: ResumeAnalysis = await resumeAnalyzer.analyzeResume(
        resumeText,
        jobDescription
      );
      console.log('✅ Gemini analysis complete');
      console.log(`   Skills found: ${analysis.skills.length}`);
      console.log(`   Experience items: ${analysis.experience.length}`);
      console.log(`   Projects: ${analysis.projects.length}`);
      console.log(`   Education: ${analysis.education.length}`);

      // Store analysis in user profile (optional - can be stored separately)
      await User.findByIdAndUpdate(userId, {
        'profile.resumeAnalysis': analysis
      });
      console.log('✅ Analysis stored in user profile');

      console.log('\n✅ ===== RESUME ANALYSIS SUCCESSFUL =====\n');

      res.status(200).json({
        status: 'success',
        message: 'Resume analyzed successfully',
        data: {
          analysis,
          resumeUrl: user.profile.resumeUrl,
          analyzedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('\n❌ ===== RESUME ANALYSIS FAILED =====');
      console.error('Error analyzing resume:', error);
      
      // Detailed error logging
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }

      // Determine error type and provide appropriate response
      let errorMessage = 'Failed to analyze resume';
      let statusCode = 500;

      if (error instanceof Error) {
        // Text extraction errors
        if (error.message.includes('extract text') || error.message.includes('File not found')) {
          errorMessage = 'Unable to read resume file. Please ensure the file is not corrupted and try uploading again.';
          statusCode = 400;
        }
        // Gemini API errors
        else if (error.message.includes('Gemini API') || error.message.includes('API key')) {
          errorMessage = 'AI analysis service temporarily unavailable. Please try again in a moment.';
          statusCode = 503;
        }
        // Parsing errors
        else if (error.message.includes('parse') || error.message.includes('JSON')) {
          errorMessage = 'Analysis completed but response format was unexpected. Please try again.';
          statusCode = 500;
        }
        // Generic error with message
        else if (error.message) {
          errorMessage = `Analysis failed: ${error.message}`;
        }
      }
      
      console.error(`Response: ${statusCode} - ${errorMessage}\n`);
      
      res.status(statusCode).json({
        status: 'error',
        message: errorMessage,
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Please try uploading your resume again. If the problem persists, try a different file format (PDF recommended).'
      });
    }
  }

  /**
   * Get user's resume information
   * GET /api/resume/:userId
   */
  async getResume(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Check if user is authenticated
      if (!req.user) {
        res.status(401).json({
          status: 'error',
          message: 'Unauthorized. Please authenticate first.'
        });
        return;
      }

      const requestedUserId = req.params.userId;
      const currentUserId = req.user.userId;
      const currentUserRole = req.user.role;

      // Check authorization: users can only access their own resume unless they're admin
      if (requestedUserId !== currentUserId && currentUserRole !== 'admin') {
        res.status(403).json({
          status: 'error',
          message: 'Access denied. You can only access your own resume.'
        });
        return;
      }

      // Get user with resume information
      const user = await User.findById(requestedUserId);

      if (!user) {
        res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
        return;
      }

      if (!user.profile.resumeUrl) {
        res.status(404).json({
          status: 'error',
          message: 'No resume found for this user'
        });
        return;
      }

      // Return resume information
      res.status(200).json({
        status: 'success',
        data: {
          resumeUrl: user.profile.resumeUrl,
          resumeAnalysis: (user.profile as any).resumeAnalysis || null,
          uploadedAt: user.createdAt
        }
      });
    } catch (error) {
      console.error('Error retrieving resume:', error);
      
      res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve resume',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Delete user's resume
   * DELETE /api/resume
   */
  async deleteResume(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Check if user is authenticated
      if (!req.user) {
        res.status(401).json({
          status: 'error',
          message: 'Unauthorized. Please authenticate first.'
        });
        return;
      }

      const userId = req.user.userId;

      // Get user with resume URL
      const user = await User.findById(userId);

      if (!user) {
        res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
        return;
      }

      if (!user.profile.resumeUrl) {
        res.status(404).json({
          status: 'error',
          message: 'No resume found to delete'
        });
        return;
      }

      // Construct full file path
      const resumeFilename = path.basename(user.profile.resumeUrl);
      const resumePath = path.join(config.uploadDir, 'resumes', resumeFilename);

      // Delete file from filesystem
      if (fs.existsSync(resumePath)) {
        fs.unlinkSync(resumePath);
      }

      // Remove resume URL and analysis from user profile
      await User.findByIdAndUpdate(userId, {
        'profile.resumeUrl': undefined,
        'profile.resumeAnalysis': undefined
      });

      res.status(200).json({
        status: 'success',
        message: 'Resume deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting resume:', error);
      
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete resume',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Export singleton instance
export const resumeController = new ResumeController();
export default resumeController;
