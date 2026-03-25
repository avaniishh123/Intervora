import User from '../models/User';
import Session from '../models/Session';

/**
 * Analytics data interface
 */
export interface AnalyticsData {
  totalUsers: number;
  activeSessions: number;
  completedSessions: number;
  averagePlatformScore: number;
  roleDistribution: Record<string, number>;
}

/**
 * In-memory cache for analytics data
 */
interface CacheEntry {
  data: AnalyticsData;
  timestamp: number;
}

class AnalyticsService {
  private cache: CacheEntry | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    if (!this.cache) return false;
    const now = Date.now();
    return (now - this.cache.timestamp) < this.CACHE_TTL;
  }

  /**
   * Get total number of users
   */
  async getTotalUsers(): Promise<number> {
    try {
      const count = await User.countDocuments();
      return count;
    } catch (error) {
      console.error('Error getting total users:', error);
      throw new Error('Failed to get total users');
    }
  }

  /**
   * Get number of active (in-progress) sessions
   */
  async getActiveSessions(): Promise<number> {
    try {
      const count = await Session.countDocuments({ status: 'in-progress' });
      return count;
    } catch (error) {
      console.error('Error getting active sessions:', error);
      throw new Error('Failed to get active sessions');
    }
  }

  /**
   * Get number of completed sessions
   */
  async getCompletedSessions(): Promise<number> {
    try {
      const count = await Session.countDocuments({ status: 'completed' });
      return count;
    } catch (error) {
      console.error('Error getting completed sessions:', error);
      throw new Error('Failed to get completed sessions');
    }
  }

  /**
   * Get average platform score from all completed sessions
   */
  async getAveragePlatformScore(): Promise<number> {
    try {
      const result = await Session.aggregate([
        {
          $match: {
            status: 'completed',
            'performanceReport.overallScore': { $exists: true }
          }
        },
        {
          $group: {
            _id: null,
            averageScore: { $avg: '$performanceReport.overallScore' }
          }
        }
      ]);

      if (result.length === 0) {
        return 0;
      }

      return Math.round(result[0].averageScore * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      console.error('Error getting average platform score:', error);
      throw new Error('Failed to get average platform score');
    }
  }

  /**
   * Get distribution of sessions by job role
   */
  async getRoleDistribution(): Promise<Record<string, number>> {
    try {
      const result = await Session.aggregate([
        {
          $group: {
            _id: '$jobRole',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      const distribution: Record<string, number> = {};
      result.forEach((item) => {
        distribution[item._id] = item.count;
      });

      return distribution;
    } catch (error) {
      console.error('Error getting role distribution:', error);
      throw new Error('Failed to get role distribution');
    }
  }

  /**
   * Get all analytics data with caching
   */
  async getAllAnalytics(): Promise<AnalyticsData> {
    try {
      // Check if cache is valid
      if (this.isCacheValid() && this.cache) {
        console.log('📊 Returning cached analytics data');
        return this.cache.data;
      }

      console.log('📊 Computing fresh analytics data');

      // Fetch all analytics data in parallel for efficiency
      const [
        totalUsers,
        activeSessions,
        completedSessions,
        averagePlatformScore,
        roleDistribution
      ] = await Promise.all([
        this.getTotalUsers(),
        this.getActiveSessions(),
        this.getCompletedSessions(),
        this.getAveragePlatformScore(),
        this.getRoleDistribution()
      ]);

      const data: AnalyticsData = {
        totalUsers,
        activeSessions,
        completedSessions,
        averagePlatformScore,
        roleDistribution
      };

      // Update cache
      this.cache = {
        data,
        timestamp: Date.now()
      };

      return data;
    } catch (error) {
      console.error('Error getting all analytics:', error);
      throw new Error('Failed to get analytics data');
    }
  }

  /**
   * Clear the cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cache = null;
    console.log('📊 Analytics cache cleared');
  }
}

// Export singleton instance
export default new AnalyticsService();
