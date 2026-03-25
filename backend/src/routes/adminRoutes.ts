import { Router } from 'express';
import AdminController from '../controllers/AdminController';
import { authMiddleware, roleMiddleware } from '../middleware/authMiddleware';

const router = Router();

/**
 * All admin routes require authentication and admin role
 */

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get admin dashboard statistics
 * @access  Admin only
 */
router.get(
  '/dashboard',
  authMiddleware,
  roleMiddleware('admin'),
  AdminController.getDashboard
);

/**
 * @route   GET /api/admin/users
 * @desc    Get all users with filtering and pagination
 * @access  Admin only
 * @query   page, limit, role, search, sortBy, sortOrder
 */
router.get(
  '/users',
  authMiddleware,
  roleMiddleware('admin'),
  AdminController.getUsers
);

/**
 * @route   GET /api/admin/users/:userId
 * @desc    Get user details with session history
 * @access  Admin only
 */
router.get(
  '/users/:userId',
  authMiddleware,
  roleMiddleware('admin'),
  AdminController.getUserDetails
);

/**
 * @route   GET /api/admin/sessions
 * @desc    Get all sessions with filtering and pagination
 * @access  Admin only
 * @query   page, limit, userId, jobRole, status, startDate, endDate, minScore, maxScore, sortBy, sortOrder
 */
router.get(
  '/sessions',
  authMiddleware,
  roleMiddleware('admin'),
  AdminController.getSessions
);

/**
 * @route   GET /api/admin/sessions/:sessionId
 * @desc    Get detailed session information
 * @access  Admin only
 */
router.get(
  '/sessions/:sessionId',
  authMiddleware,
  roleMiddleware('admin'),
  AdminController.getSessionDetails
);

/**
 * @route   POST /api/admin/cache/clear
 * @desc    Clear analytics cache
 * @access  Admin only
 */
router.post(
  '/cache/clear',
  authMiddleware,
  roleMiddleware('admin'),
  AdminController.clearCache
);

/**
 * @route   POST /api/admin/export
 * @desc    Export session data to CSV or JSON
 * @access  Admin only
 * @body    { format: 'csv' | 'json', filters: ExportFilters }
 */
router.post(
  '/export',
  authMiddleware,
  roleMiddleware('admin'),
  AdminController.exportData
);

/**
 * @route   POST /api/admin/export/preview
 * @desc    Get export statistics/preview
 * @access  Admin only
 * @body    { filters: ExportFilters }
 */
router.post(
  '/export/preview',
  authMiddleware,
  roleMiddleware('admin'),
  AdminController.getExportPreview
);

export default router;
