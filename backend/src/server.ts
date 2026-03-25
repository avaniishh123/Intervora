import dotenv from 'dotenv';
dotenv.config({ override: true });

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { connectDatabase } from './config/database';
import { validateEnv } from './config/env';
import authRoutes from './routes/authRoutes';
import geminiRoutes from './routes/geminiRoutes';
import resumeRoutes from './routes/resumeRoutes';
import sessionRoutes from './routes/sessionRoutes';
import codingRoutes from './routes/codingRoutes';
import adminRoutes from './routes/adminRoutes';
import leaderboardRoutes from './routes/leaderboardRoutes';
import simulationRoutes from './routes/simulationRoutes';
import hybridRoutes from './routes/hybridRoutes';
import hybridRoomRoutes from './routes/hybridRoomRoutes';
import { leaderboardService } from './services/LeaderboardService';
import { initializeInterviewNamespace } from './socket/interviewSocket';
import { initializeHybridNamespace } from './socket/hybridSocket';
import { startStateCleanup } from './socket/reconnectionHandler';
import { setSocketInstance } from './socket/socketInstance';
import {
  securityHeadersMiddleware,
  sanitizeRequestMiddleware,
  preventParameterPollution,
  requestSizeLimitMiddleware
} from './middleware/securityMiddleware';

validateEnv();

const app: Application = express();
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  connectTimeout: 10000,
  pingTimeout: 5000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,
  allowUpgrades: true,
  transports: ['websocket', 'polling']
});

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(securityHeadersMiddleware);
app.use(requestSizeLimitMiddleware(500 * 1024 * 1024));
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024
}));
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));
app.use(sanitizeRequestMiddleware);
app.use(preventParameterPollution);

app.use('/uploads', express.static(process.env.UPLOAD_DIR || './uploads'));
app.use('/uploads/recordings', express.static(process.env.UPLOAD_DIR ? `${process.env.UPLOAD_DIR}/recordings` : './uploads/recordings'));
app.use('/uploads/transcripts', express.static(process.env.UPLOAD_DIR ? `${process.env.UPLOAD_DIR}/transcripts` : './uploads/transcripts'));

app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'AI Interview Maker Backend v2.0',
    timestamp: new Date().toISOString(),
    services: {
      geminiApiKey: !!process.env.GEMINI_API_KEY,
      database: !!process.env.MONGODB_URI || !!process.env.DATABASE_URL,
      jwtSecret: !!process.env.JWT_SECRET
    }
  });
});

app.use('/auth', authRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/coding', codingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/simulation', simulationRoutes);
app.use('/api/hybrid', hybridRoutes);
app.use('/api/hybrid/rooms', hybridRoomRoutes);

app.get('/api', (_req: Request, res: Response) => {
  res.status(200).json({
    message: 'AI Interview Maker API v2.0',
    endpoints: {
      auth: '/auth', sessions: '/api/sessions', gemini: '/api/gemini',
      resume: '/api/resume', coding: '/api/coding', admin: '/api/admin',
      leaderboard: '/api/leaderboard', hybrid: '/api/hybrid'
    }
  });
});

setSocketInstance(io);
initializeInterviewNamespace(io);
initializeHybridNamespace(io);
startStateCleanup();

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.on('disconnect', () => console.log(`Socket disconnected: ${socket.id}`));
  socket.emit('notification', { type: 'info', message: 'Please connect to /interview namespace' });
});

interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

app.use((err: AppError, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  console.error(`Error: ${message}`, err);
  res.status(statusCode).json({
    status: 'error', message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    if (!process.env.GEMINI_API_KEY) { console.error('CRITICAL: GEMINI_API_KEY not set'); process.exit(1); }
    if (!process.env.JWT_SECRET) { console.error('CRITICAL: JWT_SECRET not set'); process.exit(1); }
    if (!process.env.MONGODB_URI && !process.env.DATABASE_URL) { console.error('CRITICAL: DB URI not set'); process.exit(1); }

    await connectDatabase();

    try {
      await leaderboardService.syncUsernames();
    } catch (e) {
      console.warn('Leaderboard sync failed (non-fatal):', e);
    }

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

process.on('SIGTERM', () => httpServer.close(() => process.exit(0)));
process.on('SIGINT', () => httpServer.close(() => process.exit(0)));

export { app, io };

