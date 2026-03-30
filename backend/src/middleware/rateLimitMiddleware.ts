import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../controllers/AuthController';
import { config } from '../config/env';

/**
 * Simple in-memory rate limiter
 * Tracks requests per user or IP within a time window
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 10) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request is allowed for user or IP
   */
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];

    // Filter out requests outside the time window
    const recentRequests = userRequests.filter(
      timestamp => now - timestamp < this.windowMs
    );

    if (recentRequests.length >= this.maxRequests) {
      return false;
    }

    // Add current request
    recentRequests.push(now);
    this.requests.set(identifier, recentRequests);

    return true;
  }

  /**
   * Get remaining requests for user or IP
   */
  getRemaining(identifier: string): number {
    const now = Date.now();
    const userRequests = this.requests.get(identifier) || [];
    const recentRequests = userRequests.filter(
      timestamp => now - timestamp < this.windowMs
    );

    return Math.max(0, this.maxRequests - recentRequests.length);
  }

  /**
   * Reset the request count for an identifier (e.g. on successful login)
   */
  reset(identifier: string): void {
    this.requests.delete(identifier);
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();
    
    for (const [userId, timestamps] of this.requests.entries()) {
      const recentRequests = timestamps.filter(
        timestamp => now - timestamp < this.windowMs
      );

      if (recentRequests.length === 0) {
        this.requests.delete(userId);
      } else {
        this.requests.set(userId, recentRequests);
      }
    }
  }
}

// Create rate limiter instances
const rateLimiter = new RateLimiter(
  config.rateLimitWindowMs,
  config.rateLimitMaxRequests
);

// Stricter rate limiter for authentication endpoints
// 15 attempts per 5 minutes per IP — only failed attempts are counted
const authRateLimiter = new RateLimiter(
  5 * 60 * 1000, // 5 minutes
  15 // 15 attempts
);

// Rate limiter for signup (per IP)
const signupRateLimiter = new RateLimiter(
  60 * 60 * 1000, // 1 hour
  3 // 3 signups per hour per IP
);

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Rate limiting middleware for authenticated endpoints
 * Limits requests per user within a time window
 */
export function rateLimitMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    // Require authentication for rate limiting
    if (!req.user || !req.user.userId) {
      res.status(401).json({
        status: 'error',
        message: 'Authentication required for this endpoint'
      });
      return;
    }

    const userId = req.user.userId;

    if (!rateLimiter.isAllowed(userId)) {
      const remaining = rateLimiter.getRemaining(userId);
      
      res.status(429).json({
        status: 'error',
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(config.rateLimitWindowMs / 1000),
        remaining
      });
      return;
    }

    // Add rate limit info to response headers
    const remaining = rateLimiter.getRemaining(userId);
    res.setHeader('X-RateLimit-Limit', config.rateLimitMaxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + config.rateLimitWindowMs).toISOString());

    next();
  } catch (error) {
    console.error('Rate limit middleware error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Rate limiting failed'
    });
  }
}

/**
 * Rate limiting middleware for login endpoint
 * Limits FAILED login attempts per IP address to prevent brute force attacks.
 * Successful logins reset the counter so legitimate users are never blocked.
 */
export function loginRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const clientIp = getClientIp(req);
    const identifier = `login:${clientIp}`;

    if (!authRateLimiter.isAllowed(identifier)) {
      const remaining = authRateLimiter.getRemaining(identifier);
      
      res.status(429).json({
        status: 'error',
        message: 'Too many login attempts. Please try again in 5 minutes.',
        retryAfter: 300, // 5 minutes in seconds
        remaining
      });
      return;
    }

    // Attach helpers to res.locals so AuthController can call them
    res.locals.loginRateLimitIdentifier = identifier;
    res.locals.resetLoginRateLimit = () => authRateLimiter.reset(identifier);

    // Add rate limit info to response headers
    const remaining = authRateLimiter.getRemaining(identifier);
    res.setHeader('X-RateLimit-Limit', '15');
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Window', '300');

    next();
  } catch (error) {
    console.error('Login rate limit middleware error:', error);
    // Don't block request on rate limiter error
    next();
  }
}

/**
 * Rate limiting middleware for signup endpoint
 * Limits signup attempts per IP address to prevent abuse
 */
export function signupRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const clientIp = getClientIp(req);
    const identifier = `signup:${clientIp}`;

    if (!signupRateLimiter.isAllowed(identifier)) {
      const remaining = signupRateLimiter.getRemaining(identifier);
      
      res.status(429).json({
        status: 'error',
        message: 'Too many signup attempts. Please try again later.',
        retryAfter: 3600, // 1 hour in seconds
        remaining
      });
      return;
    }

    // Add rate limit info to response headers
    const remaining = signupRateLimiter.getRemaining(identifier);
    res.setHeader('X-RateLimit-Limit', '3');
    res.setHeader('X-RateLimit-Remaining', remaining.toString());

    next();
  } catch (error) {
    console.error('Signup rate limit middleware error:', error);
    // Don't block request on rate limiter error
    next();
  }
}

// Singleton IP rate limiter for general endpoints (100 req/min per IP)
const generalIpLimiter = new RateLimiter(60000, 100);

/**
 * IP-based rate limiting for unauthenticated endpoints
 * General protection against abuse
 */
export function ipRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const clientIp = getClientIp(req);
    const identifier = `ip:${clientIp}`;

    if (!generalIpLimiter.isAllowed(identifier)) {
      res.status(429).json({
        status: 'error',
        message: 'Too many requests from this IP. Please try again later.',
        retryAfter: 60
      });
      return;
    }

    next();
  } catch (error) {
    console.error('IP rate limit middleware error:', error);
    // Don't block request on rate limiter error
    next();
  }
}

export default rateLimitMiddleware;
