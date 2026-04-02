/**
 * LiveSessionController — REST API for Human-Based Interview sessions.
 * All session state is persisted in MongoDB (survives server restarts).
 */
import { Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from './AuthController';
import LiveSession, { ILiveEvalCriteria } from '../models/LiveSession';
import { geminiService } from '../services/geminiService';

const MAX_PARTICIPANTS = 2; // 1 interviewer + 1 candidate

class LiveSessionController {
  // ── POST /api/live/sessions ──────────────────────────────────────────────
  async createSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobRole, durationMinutes, hostName } = req.body;
      const hostId = req.user!.userId;
      const hostEmail = req.user!.email;

      if (!jobRole?.trim()) {
        res.status(400).json({ status: 'error', message: 'jobRole is required' });
        return;
      }
      const validDurations = [5, 15, 25, 40];
      if (!validDurations.includes(Number(durationMinutes))) {
        res.status(400).json({ status: 'error', message: 'durationMinutes must be 5, 15, 25, or 40' });
        return;
      }

      const session = await LiveSession.create({
        jobRole: jobRole.trim(),
        durationMinutes: Number(durationMinutes),
        hostId,
        hostName: (hostName ?? hostEmail).trim(),
        hostEmail,
        status: 'waiting',
        participants: [],
      });

      res.status(201).json({
        status: 'success',
        data: { sessionId: session.sessionId, session },
      });
    } catch (err) { next(err); }
  }

  // ── GET /api/live/sessions/:sessionId ────────────────────────────────────
  async getSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await LiveSession.findOne({ sessionId: req.params.sessionId });
      if (!session) {
        res.status(404).json({ status: 'error', message: 'Session not found or has expired' });
        return;
      }
      res.json({ status: 'success', data: { session } });
    } catch (err) { next(err); }
  }

  // ── POST /api/live/sessions/:sessionId/join ──────────────────────────────
  // Public — no auth required. Candidate joins by name + role selection.
  async joinSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, role } = req.body;
      if (!name?.trim()) {
        res.status(400).json({ status: 'error', message: 'name is required' });
        return;
      }
      if (!['interviewer', 'candidate'].includes(role)) {
        res.status(400).json({ status: 'error', message: 'role must be interviewer or candidate' });
        return;
      }

      const session = await LiveSession.findOne({ sessionId: req.params.sessionId });
      if (!session) {
        res.status(404).json({ status: 'error', message: 'Session not found or has expired' });
        return;
      }
      if (session.status === 'ended' || session.status === 'reported') {
        res.status(409).json({ status: 'error', message: 'Session has already ended' });
        return;
      }

      // Enforce max 2 participants
      const activeParticipants = session.participants.filter(p => !p.leftAt);
      if (activeParticipants.length >= MAX_PARTICIPANTS) {
        res.status(409).json({ status: 'error', message: 'Session is full (max 2 participants)' });
        return;
      }

      // Only one interviewer allowed
      if (role === 'interviewer') {
        const existingInterviewer = activeParticipants.find(p => p.role === 'interviewer');
        if (existingInterviewer) {
          res.status(409).json({ status: 'error', message: 'An interviewer has already joined this session' });
          return;
        }
      }

      // Only one candidate allowed
      if (role === 'candidate') {
        const existingCandidate = activeParticipants.find(p => p.role === 'candidate');
        if (existingCandidate) {
          res.status(409).json({ status: 'error', message: 'A candidate has already joined this session' });
          return;
        }
      }

      const participant = {
        id: uuidv4(),
        name: name.trim(),
        role: role as 'interviewer' | 'candidate',
        joinedAt: new Date(),
      };

      session.participants.push(participant);
      await session.save();

      res.json({ status: 'success', data: { participant, session } });
    } catch (err) { next(err); }
  }

  // ── POST /api/live/sessions/:sessionId/start ─────────────────────────────
  async startSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await LiveSession.findOne({ sessionId: req.params.sessionId });
      if (!session) {
        res.status(404).json({ status: 'error', message: 'Session not found' });
        return;
      }
      if (session.hostId !== req.user!.userId) {
        res.status(403).json({ status: 'error', message: 'Only the interviewer can start the session' });
        return;
      }
      if (session.status !== 'waiting') {
        res.status(409).json({ status: 'error', message: 'Session already started' });
        return;
      }

      const now = new Date();
      session.status = 'active';
      session.startedAt = now;
      session.scheduledEndAt = new Date(now.getTime() + session.durationMinutes * 60 * 1000);
      await session.save();

      res.json({ status: 'success', data: { session } });
    } catch (err) { next(err); }
  }

  // ── POST /api/live/sessions/:sessionId/end ───────────────────────────────
  async endSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await LiveSession.findOne({ sessionId: req.params.sessionId });
      if (!session) {
        res.status(404).json({ status: 'error', message: 'Session not found' });
        return;
      }
      if (session.hostId !== req.user!.userId) {
        res.status(403).json({ status: 'error', message: 'Only the interviewer can end the session' });
        return;
      }
      if (session.status === 'ended' || session.status === 'reported') {
        res.json({ status: 'success', data: { session } });
        return;
      }

      session.status = 'ended';
      session.endedAt = new Date();
      await session.save();

      res.json({ status: 'success', data: { session } });
    } catch (err) { next(err); }
  }

  // ── POST /api/live/sessions/:sessionId/leave ─────────────────────────────
  // Public — candidate leaves
  async leaveSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { participantId } = req.body;
      const session = await LiveSession.findOne({ sessionId: req.params.sessionId });
      if (!session) {
        res.status(404).json({ status: 'error', message: 'Session not found' });
        return;
      }
      if (participantId) {
        const p = session.participants.find(x => x.id === participantId);
        if (p && !p.leftAt) p.leftAt = new Date();
        await session.save();
      }
      res.json({ status: 'success', data: { message: 'Left session' } });
    } catch (err) { next(err); }
  }

  // ── POST /api/live/sessions/:sessionId/report ────────────────────────────
  async submitReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await LiveSession.findOne({ sessionId: req.params.sessionId });
      if (!session) {
        res.status(404).json({ status: 'error', message: 'Session not found' });
        return;
      }
      if (session.hostId !== req.user!.userId) {
        res.status(403).json({ status: 'error', message: 'Only the interviewer can submit the report' });
        return;
      }
      if (session.status !== 'ended') {
        res.status(409).json({ status: 'error', message: 'Session must be ended before submitting report' });
        return;
      }

      const { candidateName, criteria, strengths, improvements, recommendation, additionalNotes } = req.body;

      if (!candidateName?.trim() || !criteria || !recommendation) {
        res.status(400).json({ status: 'error', message: 'candidateName, criteria, and recommendation are required' });
        return;
      }

      const c: ILiveEvalCriteria = criteria;
      const overallScore = Math.round(
        ((c.technicalSkills + c.communicationSkills + c.problemSolving + c.culturalFit + c.overallImpression) / 5) * 10
      );

      const reportId = uuidv4();
      session.report = {
        submittedAt: new Date(),
        candidateName: candidateName.trim(),
        jobRole: session.jobRole,
        durationMinutes: session.durationMinutes,
        criteria: c,
        overallScore,
        strengths: strengths ?? '',
        improvements: improvements ?? '',
        recommendation,
        additionalNotes: additionalNotes ?? '',
        reportId,
      };
      session.status = 'reported';
      await session.save();

      res.json({ status: 'success', data: { reportId, session } });
    } catch (err) { next(err); }
  }

  // ── GET /api/live/report/:reportId ───────────────────────────────────────
  // Public — candidate views their report via shareable link
  async getReport(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await LiveSession.findOne({ 'report.reportId': req.params.reportId });
      if (!session || !session.report) {
        res.status(404).json({ status: 'error', message: 'Report not found' });
        return;
      }
      res.json({ status: 'success', data: { report: session.report, sessionId: session.sessionId } });
    } catch (err) { next(err); }
  }

  // ── POST /api/live/sessions/:sessionId/ai-suggest ────────────────────────
  // Interviewer-only: get AI question suggestions
  async aiSuggest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await LiveSession.findOne({ sessionId: req.params.sessionId });
      if (!session) {
        res.status(404).json({ status: 'error', message: 'Session not found' });
        return;
      }
      if (session.hostId !== req.user!.userId) {
        res.status(403).json({ status: 'error', message: 'Only the interviewer can request AI suggestions' });
        return;
      }

      const { previousQuestions = [] } = req.body;

      const questions = await geminiService.generateQuestions({
        role: session.jobRole,
        count: 3,
        difficulty: 'medium',
        previousQuestions,
      });

      res.json({ status: 'success', data: { suggestions: questions.map(q => q.text) } });
    } catch (err) { next(err); }
  }

  // ── GET /api/live/sessions (host's own sessions) ─────────────────────────
  async getMySessions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessions = await LiveSession.find({ hostId: req.user!.userId })
        .sort({ createdAt: -1 })
        .limit(20);
      res.json({ status: 'success', data: { sessions } });
    } catch (err) { next(err); }
  }
}

export default new LiveSessionController();
