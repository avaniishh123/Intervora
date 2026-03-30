import { Router, Request, Response, NextFunction } from 'express';
import { resumeController } from '../controllers/ResumeController';
import { authMiddleware } from '../middleware/authMiddleware';
import { upload, handleUploadError } from '../middleware/uploadMiddleware';

const router = Router();

/**
 * Resume routes
 * All routes require authentication
 */

/**
 * @route   POST /api/resume/upload
 * @desc    Upload resume file
 * @access  Private (authenticated users)
 */
router.post(
  '/upload',
  authMiddleware,
  upload.single('resume'),
  (err: any, req: Request, res: Response, next: NextFunction) => handleUploadError(err, req, res, next),
  (req: Request, res: Response) => resumeController.uploadResume(req, res)
);

/**
 * @route   POST /api/resume/analyze
 * @desc    Analyze uploaded resume with Gemini AI
 * @access  Private (authenticated users)
 * @body    { jobDescription?: string }
 */
router.post(
  '/analyze',
  authMiddleware,
  (req: Request, res: Response) => resumeController.analyzeResume(req, res)
);

/**
 * @route   GET /api/resume/:userId
 * @desc    Get user's resume information
 * @access  Private (authenticated users - own resume or admin)
 */
router.get(
  '/:userId',
  authMiddleware,
  (req: Request, res: Response) => resumeController.getResume(req, res)
);

/**
 * @route   DELETE /api/resume
 * @desc    Delete user's resume
 * @access  Private (authenticated users)
 */
router.delete(
  '/',
  authMiddleware,
  (req: Request, res: Response) => resumeController.deleteResume(req, res)
);

export default router;
