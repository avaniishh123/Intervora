import { Router } from 'express';
import { sessionController } from '../controllers/SessionController';
import { authMiddleware } from '../middleware/authMiddleware';
import { uploadRecording, handleUploadError } from '../middleware/uploadMiddleware';

const router = Router();

/**
 * All session routes require authentication
 */
router.use(authMiddleware);

/**
 * @route   POST /api/sessions/start
 * @desc    Start a new interview session
 * @access  Private (authenticated users)
 */
router.post('/start', (req, res, next) => sessionController.startSession(req, res, next));

/**
 * @route   POST /api/sessions/:id/submit-answer
 * @desc    Submit an answer for evaluation
 * @access  Private (session owner)
 */
router.post('/:id/submit-answer', (req, res, next) => sessionController.submitAnswer(req, res, next));

/**
 * @route   POST /api/sessions/:id/complete
 * @desc    Complete an interview session
 * @access  Private (session owner)
 */
router.post('/:id/complete', (req, res, next) => sessionController.completeSession(req, res, next));

/**
 * @route   GET /api/sessions/:id
 * @desc    Get a specific session by ID
 * @access  Private (session owner or admin)
 */
router.get('/:id', (req, res, next) => sessionController.getSession(req, res, next));

/**
 * @route   GET /api/sessions/user/:userId
 * @desc    Get all sessions for a user
 * @access  Private (user or admin)
 */
router.get('/user/:userId', (req, res, next) => sessionController.getUserSessions(req, res, next));

/**
 * @route   DELETE /api/sessions/:id/recording
 * @desc    Delete the recording file and clear its reference from MongoDB
 * @access  Private (session owner)
 */
router.delete('/:id/recording', (req, res, next) => sessionController.deleteRecording(req, res, next));

/**
 * @route   DELETE /api/sessions/:id
 * @desc    Permanently delete a session
 * @access  Private (session owner)
 */
router.delete('/:id', (req, res, next) => sessionController.deleteSession(req, res, next));

/**
 * @route   POST /api/sessions/:id/upload-recording
 * @desc    Upload session recording (multipart/form-data)
 * @access  Private (session owner)
 */
router.post(
  '/:id/upload-recording',
  uploadRecording.single('recording'),
  (err: any, req: any, res: any, next: any) => handleUploadError(err, req, res, next),
  (req: any, res: any, next: any) => sessionController.uploadRecording(req, res, next)
);

/**
 * @route   POST /api/sessions/:id/upload-transcript
 * @desc    Upload session transcript
 * @access  Private (session owner)
 */
router.post('/:id/upload-transcript', (req, res, next) => sessionController.uploadTranscript(req, res, next));

export default router;
