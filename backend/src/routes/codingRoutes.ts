import { Router } from 'express';
import { codingController } from '../controllers/CodingController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

/**
 * All coding routes require authentication
 */
router.use(authMiddleware);

/**
 * @route   GET /api/coding/roles
 * @desc    Get all available roles with coding challenges
 * @access  Private
 */
router.get('/roles', codingController.getAvailableRoles.bind(codingController));

/**
 * @route   GET /api/coding/challenges/:role
 * @desc    Get coding challenges for a specific role
 * @query   difficulty (optional) - Filter by difficulty (easy, medium, hard)
 * @query   limit (optional) - Limit number of results
 * @access  Private
 */
router.get('/challenges/:role', codingController.getChallengesByRole.bind(codingController));

/**
 * @route   GET /api/coding/challenges/id/:challengeId
 * @desc    Get a specific coding challenge by ID
 * @access  Private
 */
router.get('/challenges/id/:challengeId', codingController.getChallengeById.bind(codingController));

/**
 * @route   GET /api/coding/stats/:role
 * @desc    Get challenge statistics for a role
 * @access  Private
 */
router.get('/stats/:role', codingController.getChallengeStats.bind(codingController));

/**
 * @route   POST /api/coding/submit
 * @desc    Submit code for validation
 * @query   executeTests (optional) - Set to 'true' to run code execution
 * @body    { challengeId, code, language, sessionId (optional) }
 * @access  Private
 */
router.post('/submit', codingController.submitCode.bind(codingController));

/**
 * @route   POST /api/coding/execute
 * @desc    Execute code with test cases
 * @body    { challengeId, code, language }
 * @access  Private
 */
router.post('/execute', codingController.executeCode.bind(codingController));

export default router;
