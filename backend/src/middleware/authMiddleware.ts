import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/env';
import { AuthRequest } from '../controllers/AuthController';

/**
 * JWT payload interface
 */
interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Authentication middleware
 * Verifies JWT token from Authorization header
 */
export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        status: 'error',
        message: 'No token provided. Please provide a valid authorization token.'
      });
      return;
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid token format'
      });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;

    // Attach user information to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        status: 'error',
        message: 'Token has expired. Please refresh your token or login again.'
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid token. Please provide a valid authorization token.'
      });
      return;
    }

    res.status(500).json({
      status: 'error',
      message: 'Authentication failed'
    });
  }
}

/**
 * Role-based authorization middleware
 * Checks if user has required role(s)
 */
export function roleMiddleware(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          status: 'error',
          message: 'Unauthorized. Please authenticate first.'
        });
        return;
      }

      const userRole = req.user.role;

      if (!allowedRoles.includes(userRole)) {
        res.status(403).json({
          status: 'error',
          message: `Access denied. Required role: ${allowedRoles.join(' or ')}`
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Authorization failed'
      });
    }
  };
}

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't require it
 */
export function optionalAuthMiddleware(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      if (token) {
        const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role
        };
      }
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
}

export default {
  authMiddleware,
  roleMiddleware,
  optionalAuthMiddleware
};
