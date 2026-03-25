import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config/env';

/**
 * JWT payload interface for Socket.io
 */
export interface SocketJWTPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Extended Socket interface with user data
 */
export interface AuthenticatedSocket extends Socket {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

/**
 * Socket.io authentication middleware
 * Verifies JWT token from handshake auth or query
 */
export function socketAuthMiddleware(
  socket: AuthenticatedSocket,
  next: (err?: Error) => void
): void {
  try {
    // Try to get token from auth object (preferred)
    let token = socket.handshake.auth?.token;

    // Fallback to query parameter
    if (!token) {
      token = socket.handshake.query?.token as string;
    }

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    // Remove 'Bearer ' prefix if present
    if (token.startsWith('Bearer ')) {
      token = token.substring(7);
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret) as SocketJWTPayload;

    // Attach user information to socket
    socket.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };

    console.log(`✅ Socket authenticated: ${socket.id} (User: ${decoded.email})`);
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new Error('Authentication error: Token has expired'));
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return next(new Error('Authentication error: Invalid token'));
    }

    return next(new Error('Authentication error: Failed to authenticate'));
  }
}

export default socketAuthMiddleware;
