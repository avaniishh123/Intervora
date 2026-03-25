import { Router, Request, Response } from 'express';
import { 
  geminiController, 
  generateQuestionsValidation, 
  evaluateAnswerValidation 
} from '../controllers/GeminiController';
import { authMiddleware } from '../middleware/authMiddleware';
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware';

const router = Router();

/**
 * @route   POST /api/gemini/generate-questions
 * @desc    Generate interview questions using Gemini AI
 * @access  Private (requires authentication)
 * @rateLimit 10 requests per minute per user
 */
router.post(
  '/generate-questions',
  authMiddleware,
  rateLimitMiddleware,
  generateQuestionsValidation,
  (req: Request, res: Response) => geminiController.generateQuestions(req, res)
);

/**
 * @route   POST /api/gemini/company-questions
 * @desc    Generate company-specific interview questions
 * @access  Private
 */
router.post(
  '/company-questions',
  authMiddleware,
  rateLimitMiddleware,
  (req: Request, res: Response) => geminiController.generateCompanyQuestions(req, res)
);

/**
 * @route   POST /api/gemini/evaluate-answer
 * @desc    Evaluate candidate's answer using Gemini AI
 * @access  Private (requires authentication)
 * @rateLimit 10 requests per minute per user
 */
router.post(
  '/evaluate-answer',
  authMiddleware,
  rateLimitMiddleware,
  evaluateAnswerValidation,
  (req: Request, res: Response) => geminiController.evaluateAnswer(req, res)
);

export default router;
