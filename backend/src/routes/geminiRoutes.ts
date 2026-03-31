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

/**
 * @route   POST /api/gemini/generate-mcq
 * @desc    Generate MCQ questions with full options for Contest Mode
 * @access  Private
 */
router.post(
  '/generate-mcq',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { role, count = 10, difficulty = 'mixed' } = req.body;
      if (!role || typeof role !== 'string') {
        res.status(400).json({ status: 'error', message: 'role is required' });
        return;
      }

      const difficultyInstruction = difficulty === 'mixed'
        ? 'Mix difficulties: approximately 30% easy, 40% medium, 30% hard.'
        : `All questions should be ${difficulty} difficulty.`;

      const prompt = `You are a technical interviewer generating multiple-choice questions for a ${role} role.

Generate exactly ${count} multiple-choice questions. ${difficultyInstruction}

CRITICAL REQUIREMENTS:
- Each question must test real, specific technical knowledge relevant to ${role}
- Each option (A, B, C, D) must be a complete, meaningful, distinct answer — NOT placeholder text
- Options must be plausible but only one should be correct
- The explanation must clearly explain why the correct answer is right

Return ONLY a valid JSON array with NO markdown, NO code fences, NO extra text:
[
  {
    "text": "<specific technical question about ${role}>",
    "options": {
      "A": "<first complete answer option>",
      "B": "<second complete answer option>",
      "C": "<third complete answer option>",
      "D": "<fourth complete answer option>"
    },
    "correct": "<A, B, C, or D>",
    "difficulty": "<easy, medium, or hard>",
    "explanation": "<why the correct answer is right>"
  }
]`;

      // Retry up to 3 times — Gemini can return malformed JSON on first attempt
      let questions: any[] | null = null;
      let lastRaw = '';
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const raw = await geminiService.generateRawContent(prompt);
          lastRaw = raw;
          const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
          const match = cleaned.match(/\[[\s\S]*\]/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed) && parsed.length > 0) {
              questions = parsed;
              break;
            }
          }
        } catch (parseErr) {
          if (attempt === 3) console.error('MCQ parse failed after 3 attempts. Last raw:', lastRaw.substring(0, 500));
        }
        if (attempt < 3) await new Promise(r => setTimeout(r, 800 * attempt));
      }

      if (!questions || questions.length === 0) {
        res.status(500).json({ status: 'error', message: 'Gemini returned an invalid MCQ response. Please try again.' });
        return;
      }
      res.status(200).json({ status: 'success', data: { questions } });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message || 'MCQ generation failed' });
    }
  }
);

export default router;
