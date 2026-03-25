import { Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthRequest } from './AuthController';
import { geminiService } from '../services/geminiService';
import { QuestionGenerationParams, AnswerEvaluationParams } from '../types/gemini.types';

/**
 * GeminiController - Handles Gemini AI API endpoints
 */
export class GeminiController {
  /**
   * Generate interview questions
   * POST /api/gemini/generate-questions
   */
  async generateQuestions(req: AuthRequest, res: Response): Promise<void> {
    try {
      console.log('📥 Received generate-questions request');
      
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('❌ Validation errors:', errors.array());
        res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { role, resume, jobDescription, difficulty, count } = req.body;

      console.log('📊 Request parameters:', {
        role,
        hasResume: !!resume,
        hasJobDescription: !!jobDescription,
        jdLength: jobDescription?.length || 0,
        difficulty: difficulty || 'medium',
        count: count || 5
      });

      // Additional validation
      if (!role || role.trim().length === 0) {
        console.error('❌ Role is empty');
        res.status(400).json({
          status: 'error',
          message: 'Job role is required'
        });
        return;
      }

      if (jobDescription && jobDescription.trim().length < 50) {
        console.error('❌ Job description too short');
        res.status(400).json({
          status: 'error',
          message: 'Job description must be at least 50 characters'
        });
        return;
      }

      // Build parameters
      const params: QuestionGenerationParams = {
        role: role.trim(),
        resume,
        jobDescription: jobDescription?.trim(),
        difficulty: difficulty || 'medium',
        count: count || 5
      };

      console.log('📤 Calling geminiService.generateQuestions...');

      // Generate questions
      const questions = await geminiService.generateQuestions(params);

      console.log(`✅ Generated ${questions.length} questions`);

      if (questions.length === 0) {
        console.error('❌ No questions generated');
        res.status(500).json({
          status: 'error',
          message: 'Failed to generate questions. Please check your inputs and try again.'
        });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: {
          questions,
          count: questions.length
        }
      });
    } catch (error) {
      console.error('❌ Generate questions error:', error);
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      
      res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to generate questions'
      });
    }
  }

  /**
   * Generate company-specific interview questions
   * POST /api/gemini/company-questions
   */
  async generateCompanyQuestions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ status: 'error', message: 'Validation failed', errors: errors.array() });
        return;
      }

      const { company, role, interviewerType, conversationHistory, count } = req.body;

      if (!company || !role || !interviewerType) {
        res.status(400).json({ status: 'error', message: 'company, role, and interviewerType are required' });
        return;
      }

      const questions = await geminiService.generateCompanyQuestions({
        company: String(company),
        role: String(role),
        interviewerType: interviewerType as 'tech' | 'hiring' | 'hr',
        conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
        count: typeof count === 'number' ? count : 2,
      });

      res.status(200).json({ status: 'success', data: { questions } });
    } catch (error) {
      console.error('Company questions error:', error);
      res.status(500).json({ status: 'error', message: 'Failed to generate company questions' });
    }
  }

  /**
   * Evaluate candidate's answer
   * POST /api/gemini/evaluate-answer
   */
  async evaluateAnswer(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { question, answer, conversationHistory } = req.body;

      // Build parameters
      const params: AnswerEvaluationParams = {
        question,
        answer,
        conversationHistory: conversationHistory || []
      };

      // Evaluate answer
      const evaluation = await geminiService.evaluateAnswer(params);

      res.status(200).json({
        status: 'success',
        data: {
          evaluation
        }
      });
    } catch (error) {
      console.error('Evaluate answer error:', error);
      res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to evaluate answer'
      });
    }
  }
}

/**
 * Validation rules for generate questions endpoint
 */
export const generateQuestionsValidation = [
  body('role')
    .trim()
    .notEmpty()
    .withMessage('Job role is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Role must be between 2 and 100 characters'),
  
  body('resume')
    .optional()
    .isString()
    .withMessage('Resume must be a string')
    .isLength({ max: 10000 })
    .withMessage('Resume text is too long (max 10000 characters)'),
  
  body('jobDescription')
    .optional()
    .isString()
    .withMessage('Job description must be a string')
    .isLength({ max: 5000 })
    .withMessage('Job description is too long (max 5000 characters)'),
  
  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Difficulty must be easy, medium, or hard'),
  
  body('count')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Count must be between 1 and 10')
];

/**
 * Validation rules for evaluate answer endpoint
 */
export const evaluateAnswerValidation = [
  body('question')
    .notEmpty()
    .withMessage('Question is required')
    .isObject()
    .withMessage('Question must be an object'),
  
  body('question.id')
    .notEmpty()
    .withMessage('Question ID is required'),
  
  body('question.text')
    .notEmpty()
    .withMessage('Question text is required'),
  
  body('answer')
    .trim()
    .notEmpty()
    .withMessage('Answer is required')
    .isLength({ min: 10, max: 5000 })
    .withMessage('Answer must be between 10 and 5000 characters'),
  
  body('conversationHistory')
    .optional()
    .isArray()
    .withMessage('Conversation history must be an array')
];

// Export controller instance
export const geminiController = new GeminiController();
export default geminiController;
