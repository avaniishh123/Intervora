import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import HybridController from '../controllers/HybridController';

const router = Router();

router.use(authMiddleware);

router.post('/sessions', HybridController.createSession.bind(HybridController));
router.get('/sessions/:sessionId', HybridController.getSession.bind(HybridController));
router.post('/contest', HybridController.createContest.bind(HybridController));
router.get('/contest/:contestId/leaderboard', HybridController.getLeaderboard.bind(HybridController));

export default router;
