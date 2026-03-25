import { Response } from 'express';
import { AuthRequest } from './AuthController';
import AnalyticsService from '../services/AnalyticsService';
import ExportService from '../services/ExportService';
import User from '../models/User';
import Session from '../models/Session';

/**
 * Admin Controller
 * Handles admin-specific operations including dashboard, user management, and session viewing
 */
class AdminController {
  /**
   * Get admin dashboard statistics
   * GET /api/admin/dashboard
   */
  async getDashboard(_req: AuthRequest, res: Response): Promise<void> {
    try {
      // Get all analytics data
      const analytics = await AnalyticsService.getAllAnalytics();

      // Get recent sessions (last 10)
      const recentSessions = await Session.find()
        .sort({ startTime: -1 })
        .limit(10)
        .populate('userId', 'email profile.name')
        .select('userId jobRole status startTime endTime performanceReport.overallScore')
        .lean();

      res.status(200).json({
        status: 'success',
        data: {
          statistics: analytics,
          recentSessions
        }
      });
    } catch (error) {
      console.error('Error getting admin dashboard:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get dashboard data'
      });
    }
  }

  /**
   * Get all users with filtering and pagination
   * GET /api/admin/users
   * Query params: page, limit, role, search, sortBy, sortOrder
   */
  async getUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Parse query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const role = req.query.role as string;
      const search = req.query.search as string;
      const sortBy = (req.query.sortBy as string) || 'createdAt';
      const sortOrder = (req.query.sortOrder as string) === 'asc' ? 1 : -1;

      // Build filter query
      const filter: any = {};

      if (role && ['candidate', 'admin'].includes(role)) {
        filter.role = role;
      }

      if (search) {
        filter.$or = [
          { email: { $regex: search, $options: 'i' } },
          { 'profile.name': { $regex: search, $options: 'i' } }
        ];
      }

      // Calculate skip value for pagination
      const skip = (page - 1) * limit;

      // Build sort object
      const sort: any = {};
      sort[sortBy] = sortOrder;

      // Execute query with pagination
      const [users, totalCount] = await Promise.all([
        User.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .select('-passwordHash')
          .lean(),
        User.countDocuments(filter)
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      res.status(200).json({
        status: 'success',
        data: {
          users,
          pagination: {
            currentPage: page,
            totalPages,
            totalCount,
            limit,
            hasNextPage,
            hasPrevPage
          }
        }
      });
    } catch (error) {
      console.error('Error getting users:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get users'
      });
    }
  }

  /**
   * Get all sessions with filtering and pagination
   * GET /api/admin/sessions
   * Query params: page, limit, userId, jobRole, status, startDate, endDate, minScore, maxScore, sortBy, sortOrder
   */
  async getSessions(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Parse query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const userId = req.query.userId as string;
      const jobRole = req.query.jobRole as string;
      const status = req.query.status as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const minScore = req.query.minScore ? parseFloat(req.query.minScore as string) : undefined;
      const maxScore = req.query.maxScore ? parseFloat(req.query.maxScore as string) : undefined;
      const sortBy = (req.query.sortBy as string) || 'startTime';
      const sortOrder = (req.query.sortOrder as string) === 'asc' ? 1 : -1;

      // Build filter query
      const filter: any = {};

      if (userId) {
        filter.userId = userId;
      }

      if (jobRole) {
        filter.jobRole = { $regex: jobRole, $options: 'i' };
      }

      if (status && ['in-progress', 'completed', 'abandoned'].includes(status)) {
        filter.status = status;
      }

      // Date range filter
      if (startDate || endDate) {
        filter.startTime = {};
        if (startDate) {
          filter.startTime.$gte = new Date(startDate);
        }
        if (endDate) {
          filter.startTime.$lte = new Date(endDate);
        }
      }

      // Score range filter
      if (minScore !== undefined || maxScore !== undefined) {
        filter['performanceReport.overallScore'] = {};
        if (minScore !== undefined) {
          filter['performanceReport.overallScore'].$gte = minScore;
        }
        if (maxScore !== undefined) {
          filter['performanceReport.overallScore'].$lte = maxScore;
        }
      }

      // Calculate skip value for pagination
      const skip = (page - 1) * limit;

      // Build sort object
      const sort: any = {};
      sort[sortBy] = sortOrder;

      // Execute query with pagination
      const [sessions, totalCount] = await Promise.all([
        Session.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate('userId', 'email profile.name')
          .lean(),
        Session.countDocuments(filter)
      ]);

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      res.status(200).json({
        status: 'success',
        data: {
          sessions,
          pagination: {
            currentPage: page,
            totalPages,
            totalCount,
            limit,
            hasNextPage,
            hasPrevPage
          }
        }
      });
    } catch (error) {
      console.error('Error getting sessions:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get sessions'
      });
    }
  }

  /**
   * Get detailed session information
   * GET /api/admin/sessions/:sessionId
   */
  async getSessionDetails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      const session = await Session.findById(sessionId)
        .populate('userId', 'email profile.name role')
        .lean();

      if (!session) {
        res.status(404).json({
          status: 'error',
          message: 'Session not found'
        });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: { session }
      });
    } catch (error) {
      console.error('Error getting session details:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get session details'
      });
    }
  }

  /**
   * Get user details with session history
   * GET /api/admin/users/:userId
   */
  async getUserDetails(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const user = await User.findById(userId)
        .select('-passwordHash')
        .lean();

      if (!user) {
        res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
        return;
      }

      // Get user's session history
      const sessions = await Session.find({ userId })
        .sort({ startTime: -1 })
        .select('jobRole status startTime endTime performanceReport.overallScore')
        .lean();

      res.status(200).json({
        status: 'success',
        data: {
          user,
          sessions
        }
      });
    } catch (error) {
      console.error('Error getting user details:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get user details'
      });
    }
  }

  /**
   * Clear analytics cache
   * POST /api/admin/cache/clear
   */
  async clearCache(_req: AuthRequest, res: Response): Promise<void> {
    try {
      AnalyticsService.clearCache();

      res.status(200).json({
        status: 'success',
        message: 'Analytics cache cleared successfully'
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to clear cache'
      });
    }
  }

  /**
   * Export session data
   * POST /api/admin/export
   * Body: { format: 'csv' | 'json', filters: ExportFilters }
   */
  async exportData(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { format, filters } = req.body;

      // Validate format
      if (!format || !['csv', 'json'].includes(format)) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid format. Must be "csv" or "json"'
        });
        return;
      }

      // Get export statistics
      const stats = await ExportService.getExportStats(filters || {});

      console.log(`📊 Exporting ${stats.count} sessions (${stats.estimatedSize}) as ${format.toUpperCase()}`);

      // Set response headers
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `sessions-export-${timestamp}.${format}`;
      
      res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      // Stream the export
      let stream;
      if (format === 'csv') {
        stream = await ExportService.exportToCSV(filters || {});
      } else {
        stream = await ExportService.exportToJSON(filters || {});
      }

      // Pipe the stream to response
      stream.pipe(res);

      // Handle stream errors
      stream.on('error', (error: Error) => {
        console.error('Stream error during export:', error);
        if (!res.headersSent) {
          res.status(500).json({
            status: 'error',
            message: 'Failed to export data'
          });
        }
      });

    } catch (error) {
      console.error('Error exporting data:', error);
      if (!res.headersSent) {
        res.status(500).json({
          status: 'error',
          message: 'Failed to export data'
        });
      }
    }
  }

  /**
   * Get export preview/statistics
   * POST /api/admin/export/preview
   * Body: { filters: ExportFilters }
   */
  async getExportPreview(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { filters } = req.body;

      const stats = await ExportService.getExportStats(filters || {});

      res.status(200).json({
        status: 'success',
        data: stats
      });
    } catch (error) {
      console.error('Error getting export preview:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get export preview'
      });
    }
  }
}

export default new AdminController();
