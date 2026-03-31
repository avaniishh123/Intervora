import { Router, Request, Response } from 'express';
import { 
  geminiController, 
  generateQuestionsValidation, 
  evaluateAnswerValidation 
} from '../controllers/GeminiController';
import { authMiddleware } from '../middleware/authMiddleware';
import { rateLimitMiddleware } from '../middleware/rateLimitMiddleware';
import { geminiService } from '../services/geminiService';

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

/**
 * @route   POST /api/gemini/generate-raw
 * @desc    Generate raw text from a prompt — used by AnalysisSimulation for inline evaluation
 * @access  Private
 */
router.post(
  '/generate-raw',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { prompt } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ status: 'error', message: 'prompt is required' });
        return;
      }
      const text = await geminiService.generateRawContent(prompt);
      res.status(200).json({ status: 'success', data: { text } });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message || 'Gemini generation failed' });
    }
  }
);

export default router;
