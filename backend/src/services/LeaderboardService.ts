import Leaderboard, { ILeaderboard } from '../models/Leaderboard';
import User from '../models/User';
import Session from '../models/Session';

/**
 * LeaderboardService - Handles leaderboard calculations and updates
 */
export class LeaderboardService {
  /**
   * Update leaderboard entry for a user after session completion
   * This is called automatically when a session is completed
   */
  async updateLeaderboardEntry(userId: string): Promise<void> {
    try {
      // Get user data
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Only update leaderboard for candidates with completed sessions
      if (user.role !== 'candidate' || user.profile.totalSessions === 0) {
        return;
      }

      // Get user's most recent completed session to determine job role
      const recentSession = await Session.findOne({
        userId,
        status: 'completed'
      }).sort({ endTime: -1 });

      if (!recentSession) {
        return;
      }

      // Update or create leaderboard entry
      await Leaderboard.findOneAndUpdate(
        { userId },
        {
          userId,
          username: user.profile.name,
          jobRole: recentSession.jobRole,
          averageScore: user.profile.averageScore,
          totalSessions: user.profile.totalSessions,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );

      // Recalculate all ranks
      await this.recalculateRanks();
    } catch (error) {
      console.error('Error updating leaderboard entry:', error);
      throw error;
    }
  }

  /**
   * Recalculate ranks for all leaderboard entries
   * Rankings are based on average score (descending), with tie-breaking by total sessions (descending)
   */
  async recalculateRanks(): Promise<void> {
    try {
      // Get all leaderboard entries sorted by ranking criteria
      const entries = await Leaderboard.find()
        .sort({ averageScore: -1, totalSessions: -1 })
        .exec();

      // Update ranks
      const bulkOps = entries.map((entry, index) => ({
        updateOne: {
          filter: { _id: entry._id },
          update: { rank: index + 1 }
        }
      }));

      if (bulkOps.length > 0) {
        await Leaderboard.bulkWrite(bulkOps);
      }
    } catch (error) {
      console.error('Error recalculating ranks:', error);
      throw error;
    }
  }

  /**
   * Get top N candidates from leaderboard
   */
  async getTopCandidates(limit: number = 10, jobRole?: string): Promise<ILeaderboard[]> {
    try {
      const query: any = {};
      if (jobRole) {
        query.jobRole = jobRole;
      }

      const leaderboard = await Leaderboard.find(query)
        .sort({ rank: 1 })
        .limit(limit)
        .exec();

      return leaderboard;
    } catch (error) {
      console.error('Error getting top candidates:', error);
      throw error;
    }
  }

  /**
   * Get user's rank and percentile
   */
  async getUserRankInfo(userId: string): Promise<{
    rank: number;
    percentile: number;
    totalCandidates: number;
    entry: ILeaderboard | null;
  }> {
    try {
      const entry = await Leaderboard.findOne({ userId });
      
      if (!entry) {
        return {
          rank: 0,
          percentile: 0,
          totalCandidates: 0,
          entry: null
        };
      }

      const totalCandidates = await Leaderboard.countDocuments();
      const percentile = ((totalCandidates - entry.rank + 1) / totalCandidates) * 100;

      return {
        rank: entry.rank,
        percentile: Math.round(percentile * 100) / 100,
        totalCandidates,
        entry
      };
    } catch (error) {
      console.error('Error getting user rank info:', error);
      throw error;
    }
  }

  /**
   * Get leaderboard filtered by job role with user's position.
   * Role-specific session counts and average scores are computed directly
   * from the Session collection so they reflect only that role's data.
   */
  async getLeaderboardByRole(
    jobRole: string,
    userId?: string
  ): Promise<{
    topCandidates: any[];
    userRank: number | null;
    userPercentile: number | null;
    totalCandidates: number;
  }> {
    try {
      // Aggregate per-user stats for this role directly from completed sessions
      const roleStats: Array<{
        _id: string;
        username: string;
        averageScore: number;
        totalSessions: number;
      }> = await Session.aggregate([
        { $match: { jobRole, status: 'completed' } },
        {
          $group: {
            _id: '$userId',
            totalSessions: { $sum: 1 },
            averageScore: { $avg: '$performanceReport.overallScore' }
          }
        },
        { $sort: { averageScore: -1, totalSessions: -1 } }
      ]);

      if (roleStats.length === 0) {
        return { topCandidates: [], userRank: null, userPercentile: null, totalCandidates: 0 };
      }

      // Enrich with usernames from User collection
      const userIds = roleStats.map(s => s._id);
      const users = await User.find({ _id: { $in: userIds } }, 'profile.name').lean();
      const usernameMap: Record<string, string> = {};
      for (const u of users) {
        usernameMap[String(u._id)] = (u as any).profile?.name || 'Unknown';
      }

      // Build ranked entries
      const ranked = roleStats.map((s, index) => ({
        userId: String(s._id),
        username: usernameMap[String(s._id)] || 'Unknown',
        jobRole,
        averageScore: Math.round((s.averageScore || 0) * 10) / 10,
        totalSessions: s.totalSessions,
        rank: index + 1
      }));

      const topCandidates = ranked.slice(0, 10);
      const totalCandidates = ranked.length;

      let userRank: number | null = null;
      let userPercentile: number | null = null;

      if (userId) {
        const userEntry = ranked.find(e => e.userId === String(userId));
        if (userEntry) {
          userRank = userEntry.rank;
          userPercentile = Math.round(((totalCandidates - userRank + 1) / totalCandidates) * 100 * 100) / 100;
        }
      }

      return { topCandidates, userRank, userPercentile, totalCandidates };
    } catch (error) {
      console.error('Error getting leaderboard by role:', error);
      throw error;
    }
  }

  /**
   * Re-sync all leaderboard usernames from the User collection (fixes stale anonymized names)
   */
  async syncUsernames(): Promise<void> {
    try {
      const entries = await Leaderboard.find();
      for (const entry of entries) {
        const user = await User.findById(entry.userId);
        if (user && user.profile.name) {
          entry.username = user.profile.name;
          await entry.save();
        }
      }
    } catch (error) {
      console.error('Error syncing leaderboard usernames:', error);
      throw error;
    }
  }

  /**
   * Get public profile data for a user (for leaderboard profile panel)
   */
  async getUserPublicProfile(userId: string): Promise<{
    name: string;
    joinedAt: Date;
    totalSessions: number;
    averageScore: number;
    rank: number | null;
    jobRole: string | null;
    profilePhoto?: string;
  } | null> {
    try {
      const user = await User.findById(userId);
      if (!user) return null;

      const entry = await Leaderboard.findOne({ userId });

      return {
        name: user.profile.name,
        joinedAt: user.createdAt,
        totalSessions: user.profile.totalSessions,
        averageScore: user.profile.averageScore,
        rank: entry?.rank ?? null,
        jobRole: entry?.jobRole ?? null,
        profilePhoto: (user.profile as any).profilePhoto
      };
    } catch (error) {
      console.error('Error getting user public profile:', error);
      throw error;
    }
  }

  /**
   * Get all unique job roles from completed sessions (reflects all roles ever attempted)
   */
  async getAvailableRoles(): Promise<string[]> {
    try {
      // Query Session collection for all distinct roles from completed sessions
      // This ensures all historically attempted roles appear, not just the latest per user
      const roles = await Session.distinct('jobRole', { status: 'completed' });
      return (roles as string[]).filter(Boolean).sort();
    } catch (error) {
      console.error('Error getting available roles:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const leaderboardService = new LeaderboardService();
export default leaderboardService;
