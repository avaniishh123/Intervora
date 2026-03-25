import { Router } from 'express';
import { leaderboardController } from '../controllers/LeaderboardController';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/authMiddleware';

const router = Router();

/**
 * Leaderboard Routes
 * Base path: /api/leaderboard
 */

// Get global leaderboard or filtered by role (optional auth - shows user rank if authenticated)
router.get(
  '/',
  optionalAuthMiddleware,
  leaderboardController.getLeaderboard.bind(leaderboardController)
);

// Get current user's rank (requires auth)
router.get(
  '/me',
  authMiddleware,
  leaderboardController.getMyRank.bind(leaderboardController)
);

// Get available job roles
router.get(
  '/roles',
  leaderboardController.getAvailableRoles.bind(leaderboardController)
);

// Get public profile for any user (for leaderboard name click)
router.get(
  '/user/:userId',
  optionalAuthMiddleware,
  leaderboardController.getUserPublicProfile.bind(leaderboardController)
);

// Sync leaderboard usernames (fixes stale anonymized names)
router.post(
  '/sync-usernames',
  authMiddleware,
  leaderboardController.syncUsernames.bind(leaderboardController)
);

export default router;
