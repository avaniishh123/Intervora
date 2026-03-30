import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import User from '../models/User';
import config from '../config/env';

/**
 * JWT payload interface
 */
interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Extended request interface with user
 */
export interface AuthRequest extends Request {
  user?: JWTPayload;
}

/**
 * Authentication Controller
 */
class AuthController {
  /**
   * User signup
   * POST /auth/signup
   */
  async signup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { email, password, name, role } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(409).json({
          status: 'error',
          message: 'User with this email already exists'
        });
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create new user
      const user = await User.create({
        email,
        passwordHash,
        role: role || 'candidate',
        profile: {
          name,
          totalSessions: 0,
          averageScore: 0
        }
      });

      // Generate tokens
      const accessToken = this.generateAccessToken({
        userId: String(user._id),
        email: user.email,
        role: user.role
      });

      const refreshToken = this.generateRefreshToken({
        userId: String(user._id),
        email: user.email,
        role: user.role
      });

      res.status(201).json({
        status: 'success',
        message: 'User registered successfully',
        data: {
          user: {
            id: String(user._id),
            email: user.email,
            role: user.role,
            profile: user.profile
          },
          accessToken,
          refreshToken
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * User login
   * POST /auth/login
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { email, password } = req.body;

      // Find user with password hash
      const user = await User.findOne({ email }).select('+passwordHash');
      if (!user) {
        res.status(401).json({
          status: 'error',
          message: 'Invalid email or password'
        });
        return;
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        res.status(401).json({
          status: 'error',
          message: 'Invalid email or password'
        });
        return;
      }

      // Generate tokens
      const accessToken = this.generateAccessToken({
        userId: String(user._id),
        email: user.email,
        role: user.role
      });

      const refreshToken = this.generateRefreshToken({
        userId: String(user._id),
        email: user.email,
        role: user.role
      });

      // Reset login rate limit counter on successful authentication
      if (typeof res.locals.resetLoginRateLimit === 'function') {
        res.locals.resetLoginRateLimit();
      }

      res.status(200).json({
        status: 'success',
        message: 'Login successful',
        data: {
          user: {
            id: String(user._id),
            email: user.email,
            role: user.role,
            profile: user.profile
          },
          accessToken,
          refreshToken
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   * POST /auth/refresh
   */
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          status: 'error',
          message: 'Refresh token is required'
        });
        return;
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwtSecret) as JWTPayload;

      // Generate new access token
      const newAccessToken = this.generateAccessToken({
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role
      });

      res.status(200).json({
        status: 'success',
        message: 'Token refreshed successfully',
        data: {
          accessToken: newAccessToken
        }
      });
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          status: 'error',
          message: 'Invalid or expired refresh token'
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Get user profile
   * GET /auth/profile
   */
  async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          status: 'error',
          message: 'Unauthorized'
        });
        return;
      }

      const user = await User.findById(req.user.userId);
      if (!user) {
        res.status(404).json({
          status: 'error',
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: {
          user: {
            id: String(user._id),
            email: user.email,
            role: user.role,
            profile: user.profile,
            createdAt: user.createdAt
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Forgot password - Reset user password
   * POST /auth/forgot-password
   */
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { email, newPassword } = req.body;

      // Find user by email
      const user = await User.findOne({ email }).select('+passwordHash');
      if (!user) {
        res.status(404).json({
          status: 'error',
          message: 'No account found with this email address'
        });
        return;
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 10);

      // Update user password
      user.passwordHash = passwordHash;
      await user.save();

      res.status(200).json({
        status: 'success',
        message: 'Password updated successfully, please sign in'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate access token (15 min expiry)
   */
  private generateAccessToken(payload: JWTPayload): string {
    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn
    } as jwt.SignOptions);
  }

  /**
   * Generate refresh token (7 day expiry)
   */
  private generateRefreshToken(payload: JWTPayload): string {
    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.refreshTokenExpiresIn
    } as jwt.SignOptions);
  }
}

export default new AuthController();
