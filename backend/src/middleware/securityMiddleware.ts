import { Request, Response, NextFunction } from 'express';

/**
 * Security headers middleware
 * Adds various security headers to protect against common vulnerabilities
 */
export function securityHeadersMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  // Prevent clickjacking attacks
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection in older browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https:; " +
    "frame-ancestors 'none';"
  );

  // Strict Transport Security (HTTPS only)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Permissions Policy (formerly Feature Policy)
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );

  next();
}

/**
 * Request sanitization middleware
 * Sanitizes request body to prevent injection attacks
 */
export function sanitizeRequestMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }

  next();
}

/**
 * Recursively sanitize object properties
 * Removes potentially dangerous characters and patterns
 */
function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];

      if (typeof value === 'string') {
        // Remove null bytes
        obj[key] = value.replace(/\0/g, '');

        // Detect and warn about potential NoSQL injection attempts
        if (value.includes('$') || value.includes('{')) {
          console.warn(`⚠️ Potential injection attempt detected in field: ${key}`);
        }
      } else if (typeof value === 'object' && value !== null) {
        // Recursively sanitize nested objects
        sanitizeObject(value);
      }
    }
  }
}

/**
 * Prevent parameter pollution
 * Ensures query parameters are not arrays when they shouldn't be
 */
export function preventParameterPollution(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // List of parameters that should never be arrays
  const singleValueParams = ['email', 'password', 'userId', 'sessionId', 'role'];

  for (const param of singleValueParams) {
    if (req.query[param] && Array.isArray(req.query[param])) {
      // Take only the first value
      req.query[param] = (req.query[param] as string[])[0];
      console.warn(`⚠️ Parameter pollution detected for: ${param}`);
    }

    if (req.body && req.body[param] && Array.isArray(req.body[param])) {
      // Take only the first value
      req.body[param] = req.body[param][0];
      console.warn(`⚠️ Parameter pollution detected in body for: ${param}`);
    }
  }

  next();
}

/**
 * Request size limit middleware
 * Prevents DoS attacks via large payloads
 */
export function requestSizeLimitMiddleware(maxSize: number = 10 * 1024 * 1024) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.headers['content-length'];

    if (contentLength && parseInt(contentLength, 10) > maxSize) {
      res.status(413).json({
        status: 'error',
        message: `Request payload too large. Maximum size is ${maxSize / (1024 * 1024)}MB`
      });
      return;
    }

    next();
  };
}

export default {
  securityHeadersMiddleware,
  sanitizeRequestMiddleware,
  preventParameterPollution,
  requestSizeLimitMiddleware
};
