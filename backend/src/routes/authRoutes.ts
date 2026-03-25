import { Router } from 'express';
import { body } from 'express-validator';
import AuthController from '../controllers/AuthController';
import { authMiddleware } from '../middleware/authMiddleware';
import { loginRateLimitMiddleware, signupRateLimitMiddleware } from '../middleware/rateLimitMiddleware';

const router = Router();

/**
 * Validation rules for signup
 */
const signupValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('role')
    .optional()
    .isIn(['candidate', 'admin'])
    .withMessage('Role must be either candidate or admin')
];

/**
 * Validation rules for login
 */
const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

/**
 * POST /auth/signup
 * Register a new user
 * Rate limited: 3 signups per hour per IP
 */
router.post('/signup', signupRateLimitMiddleware, signupValidation, AuthController.signup.bind(AuthController));

/**
 * POST /auth/login
 * Authenticate user and get tokens
 * Rate limited: 5 attempts per 15 minutes per IP
 */
router.post('/login', loginRateLimitMiddleware, loginValidation, AuthController.login.bind(AuthController));

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', AuthController.refreshToken.bind(AuthController));

/**
 * GET /auth/profile
 * Get current user profile (protected route)
 */
router.get('/profile', authMiddleware, AuthController.getProfile.bind(AuthController));

/**
 * Validation rules for forgot password
 */
const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Passwords do not match')
];

/**
 * POST /auth/forgot-password
 * Reset user password
 * Rate limited: 3 attempts per hour per IP
 */
router.post('/forgot-password', signupRateLimitMiddleware, forgotPasswordValidation, AuthController.forgotPassword.bind(AuthController));

export default router;
