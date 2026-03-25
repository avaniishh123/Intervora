import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from './AuthController';
import HybridSession from '../models/HybridSession';
import ContestLeaderboard from '../models/ContestLeaderboard';

class HybridController {
  /**
   * POST /api/hybrid/sessions
   * Create a new HybridSession
   */
  async createSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { mode, jobRole, contestId } = req.body;
      const candidateId = req.user?.userId;

      if (!mode || !['ai', 'human', 'contest'].includes(mode)) {
        res.status(400).json({ status: 'error', message: 'mode must be ai, human, or contest' });
        return;
      }

      const sessionId = uuidv4();

      const session = await HybridSession.create({
        sessionId,
        mode,
        candidateId,
        contestId: contestId ?? undefined,
        status: 'waiting',
        startTime: new Date(),
        messages: [],
        evaluations: [],
        metadata: { jobRole: jobRole ?? 'Software Engineer' },
      });

      const redirectUrl =
        mode === 'contest'
          ? `/hybrid/contest/${contestId ?? sessionId}`
          : `/hybrid/interview/${sessionId}`;

      res.status(201).json({
        status: 'success',
        data: { sessionId: session.sessionId, mode, status: 'waiting', redirectUrl },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/hybrid/sessions/:sessionId
   * Get a HybridSession (only participants can access)
   */
  async getSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.userId;

      const session = await HybridSession.findOne({ sessionId });
      if (!session) {
        res.status(404).json({ status: 'error', message: 'Session not found' });
        return;
      }

      const isParticipant =
        session.candidateId.toString() === userId ||
        session.interviewerId?.toString() === userId;

      if (!isParticipant && req.user?.role !== 'admin') {
        res.status(403).json({ status: 'error', message: 'Access denied' });
        return;
      }

      res.status(200).json({ status: 'success', data: { session } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/hybrid/contest
   * Create a new Contest (generates a contestId, returns it)
   */
  async createContest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobRole, durationMinutes = 30, perQuestionSeconds = 120 } = req.body;
      const contestId = uuidv4();

      res.status(201).json({
        status: 'success',
        data: {
          contestId,
          jobRole: jobRole ?? 'Software Engineer',
          durationMs: durationMinutes * 60 * 1000,
          perQuestionMs: perQuestionSeconds * 1000,
          redirectUrl: `/hybrid/contest/${contestId}`,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/hybrid/contest/:contestId/leaderboard
   */
  async getLeaderboard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { contestId } = req.params;

      const leaderboard = await ContestLeaderboard.findOne({ contestId });
      if (!leaderboard) {
        res.status(404).json({ status: 'error', message: 'Leaderboard not found' });
        return;
      }

      res.status(200).json({ status: 'success', data: { leaderboard } });
    } catch (err) {
      next(err);
    }
  }
}

export default new HybridController();
