import { Request, Response, NextFunction } from 'express';
import { leaderboardService } from '../services/LeaderboardService';

/**
 * LeaderboardController - Handles leaderboard API endpoints
 */
export class LeaderboardController {
  /**
   * Get global leaderboard or filtered by job role
   * GET /api/leaderboard
   * Query params: role (optional), limit (optional, default 10)
   */
  async getLeaderboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { role, limit = '10' } = req.query;
      const userId = (req as any).user?.userId;

      const limitNum = Math.min(parseInt(limit as string) || 10, 100); // Max 100

      if (role && typeof role === 'string') {
        // Get role-filtered leaderboard with user's position
        const result = await leaderboardService.getLeaderboardByRole(role, userId);

        res.status(200).json({
          status: 'success',
          data: {
            leaderboard: result.topCandidates,
            userRank: result.userRank,
            userPercentile: result.userPercentile,
            totalCandidates: result.totalCandidates,
            filter: { role }
          }
        });
      } else {
        // Get global leaderboard
        const topCandidates = await leaderboardService.getTopCandidates(limitNum);

        // Get user's rank if authenticated
        let userRankInfo = null;
        if (userId) {
          userRankInfo = await leaderboardService.getUserRankInfo(userId);
        }

        res.status(200).json({
          status: 'success',
          data: {
            leaderboard: topCandidates,
            userRank: userRankInfo?.rank || null,
            userPercentile: userRankInfo?.percentile || null,
            totalCandidates: userRankInfo?.totalCandidates || 0
          }
        });
      }
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      next(error);
    }
  }

  /**
   * Get user's rank and position
   * GET /api/leaderboard/me
   */
  async getMyRank(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          status: 'error',
          message: 'User not authenticated'
        });
        return;
      }

      const rankInfo = await leaderboardService.getUserRankInfo(userId);

      if (!rankInfo.entry) {
        res.status(404).json({
          status: 'error',
          message: 'No leaderboard entry found. Complete at least one interview session to appear on the leaderboard.'
        });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: {
          rank: rankInfo.rank,
          percentile: rankInfo.percentile,
          totalCandidates: rankInfo.totalCandidates,
          averageScore: rankInfo.entry.averageScore,
          totalSessions: rankInfo.entry.totalSessions,
          jobRole: rankInfo.entry.jobRole
        }
      });
    } catch (error) {
      console.error('Error getting user rank:', error);
      next(error);
    }
  }

  /**
   * Get available job roles in leaderboard
   * GET /api/leaderboard/roles
   */
  async getAvailableRoles(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roles = await leaderboardService.getAvailableRoles();

      res.status(200).json({
        status: 'success',
        data: {
          roles
        }
      });
    } catch (error) {
      console.error('Error getting available roles:', error);
      next(error);
    }
  }
  /**
   * Get public profile for any user (for leaderboard name click)
   * GET /api/leaderboard/user/:userId
   */
  async getUserPublicProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;

      const profile = await leaderboardService.getUserPublicProfile(userId);

      if (!profile) {
        res.status(404).json({ status: 'error', message: 'User not found' });
        return;
      }

      res.status(200).json({ status: 'success', data: { profile } });
    } catch (error) {
      console.error('Error getting user public profile:', error);
      next(error);
    }
  }
  /**
   * Sync all leaderboard usernames to full real names (fixes stale anonymized entries)
   * POST /api/leaderboard/sync-usernames
   */
  async syncUsernames(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await leaderboardService.syncUsernames();
      res.status(200).json({ status: 'success', message: 'Leaderboard usernames synced' });
    } catch (error) {
      next(error);
    }
  }
}

// Export singleton instance
export const leaderboardController = new LeaderboardController();
export default leaderboardController;
