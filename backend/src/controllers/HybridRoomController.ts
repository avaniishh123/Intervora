/**
 * HybridRoomController — in-memory waiting room for Human Interview Mode only.
 * No WebSockets. Pure REST polling.
 *
 * Room lifecycle: waiting → started → ended
 * Rooms are cleaned up after 2 hours of inactivity.
 */
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from './AuthController';

export interface RoomParticipant {
  id: string;
  name: string;
  joinedAt: string;
  leftAt?: string;
}

export interface SessionEvent {
  type: 'start' | 'end' | 'join' | 'leave' | 'question' | 'answer';
  participantId?: string;
  participantName?: string;
  content?: string;
  timestamp: string;
}

export interface HybridRoom {
  sessionId: string;
  jobRole: string;
  hostId: string;
  hostName: string;
  status: 'waiting' | 'started' | 'ended';
  participants: RoomParticipant[];
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  elapsedSeconds: number;
  eventLog: SessionEvent[];
}

// In-memory store — keyed by sessionId
const rooms = new Map<string, HybridRoom>();

// Auto-cleanup after 2 hours
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
setInterval(() => {
  const cutoff = Date.now() - ROOM_TTL_MS;
  for (const [id, room] of rooms.entries()) {
    if (new Date(room.createdAt).getTime() < cutoff) rooms.delete(id);
  }
}, 15 * 60 * 1000);

/** Safely extract a single string from a route param that may be string | string[] */
function toParamString(param: string | string[]): string {
  return Array.isArray(param) ? param[0] : param;
}

class HybridRoomController {
  /**
   * POST /api/hybrid/rooms
   * Host creates a waiting room (requires auth).
   */
  createRoom(req: AuthRequest, res: Response): void {
    const { jobRole, hostName } = req.body;
    if (!jobRole?.trim()) {
      res.status(400).json({ status: 'error', message: 'jobRole is required' });
      return;
    }

    const sessionId = uuidv4();
    const room: HybridRoom = {
      sessionId,
      jobRole: jobRole.trim(),
      hostId: req.user?.userId ?? 'unknown',
      hostName: (hostName ?? req.user?.email ?? 'Host').trim(),
      status: 'waiting',
      participants: [],
      createdAt: new Date().toISOString(),
      elapsedSeconds: 0,
      eventLog: [],
    };
    rooms.set(sessionId, room);

    res.status(201).json({ status: 'success', data: { sessionId, room } });
  }

  /**
   * GET /api/hybrid/rooms/:sessionId
   * Poll room state — public (no auth needed so participants can check).
   */
  getRoom(req: Request, res: Response): void {
    const room = rooms.get(toParamString(req.params.sessionId));
    if (!room) {
      res.status(404).json({ status: 'error', message: 'Room not found or expired' });
      return;
    }
    // Compute live elapsedSeconds if session is active
    if (room.status === 'started' && room.startedAt) {
      room.elapsedSeconds = Math.floor(
        (Date.now() - new Date(room.startedAt).getTime()) / 1000
      );
    }
    res.json({ status: 'success', data: { room } });
  }

  /**
   * POST /api/hybrid/rooms/:sessionId/join
   * Participant joins by providing their name — public (no auth).
   */
  joinRoom(req: Request, res: Response): void {
    const room = rooms.get(toParamString(req.params.sessionId));
    if (!room) {
      res.status(404).json({ status: 'error', message: 'Room not found or expired' });
      return;
    }
    if (room.status !== 'waiting') {
      res.status(409).json({ status: 'error', message: 'Session has already started' });
      return;
    }

    const { name } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ status: 'error', message: 'name is required' });
      return;
    }

    const participant: RoomParticipant = {
      id: uuidv4(),
      name: name.trim(),
      joinedAt: new Date().toISOString(),
    };
    room.participants.push(participant);

    room.eventLog.push({
      type: 'join',
      participantId: participant.id,
      participantName: participant.name,
      timestamp: participant.joinedAt,
    });

    res.json({ status: 'success', data: { participant, room } });
  }

  /**
   * POST /api/hybrid/rooms/:sessionId/start
   * Host starts the interview (requires auth, must be host).
   */
  startRoom(req: AuthRequest, res: Response): void {
    const room = rooms.get(toParamString(req.params.sessionId));
    if (!room) {
      res.status(404).json({ status: 'error', message: 'Room not found' });
      return;
    }
    if (room.hostId !== req.user?.userId) {
      res.status(403).json({ status: 'error', message: 'Only the host can start the session' });
      return;
    }
    if (room.status !== 'waiting') {
      res.status(409).json({ status: 'error', message: 'Session already started' });
      return;
    }

    room.status = 'started';
    room.startedAt = new Date().toISOString();
    room.eventLog.push({
      type: 'start',
      participantName: room.hostName,
      timestamp: room.startedAt,
    });

    res.json({ status: 'success', data: { room } });
  }

  /**
   * POST /api/hybrid/rooms/:sessionId/leave
   * Candidate leaves — marks leftAt, appends leave event. Does NOT end session.
   * Public (no auth) — participant only has their participantId.
   */
  leaveRoom(req: Request, res: Response): void {
    const room = rooms.get(toParamString(req.params.sessionId));
    if (!room) {
      res.status(404).json({ status: 'error', message: 'Room not found' });
      return;
    }

    const { participantId, participantName } = req.body;
    const now = new Date().toISOString();

    if (participantId) {
      const p = room.participants.find(x => x.id === participantId);
      if (p && !p.leftAt) {
        p.leftAt = now;
      }
    }

    room.eventLog.push({
      type: 'leave',
      participantId: participantId ?? undefined,
      participantName: participantName ?? undefined,
      timestamp: now,
    });

    res.json({ status: 'success', data: { message: 'Left session' } });
  }

  /**
   * POST /api/hybrid/rooms/:sessionId/end
   * Host ends the session for all (requires auth, must be host).
   */
  endRoom(req: AuthRequest, res: Response): void {
    const room = rooms.get(toParamString(req.params.sessionId));
    if (!room) {
      res.status(404).json({ status: 'error', message: 'Room not found' });
      return;
    }
    if (room.hostId !== req.user?.userId) {
      res.status(403).json({ status: 'error', message: 'Only the host can end the session' });
      return;
    }
    if (room.status === 'ended') {
      res.json({ status: 'success', data: { room } });
      return;
    }

    const now = new Date().toISOString();
    room.status = 'ended';
    room.endedAt = now;

    if (room.startedAt) {
      room.elapsedSeconds = Math.floor(
        (new Date(now).getTime() - new Date(room.startedAt).getTime()) / 1000
      );
    }

    room.eventLog.push({
      type: 'end',
      participantName: room.hostName,
      timestamp: now,
    });

    res.json({ status: 'success', data: { room } });
  }

  /**
   * POST /api/hybrid/rooms/:sessionId/log-event
   * Log a Q&A event (question asked or answer submitted). Public.
   */
  logEvent(req: Request, res: Response): void {
    const room = rooms.get(toParamString(req.params.sessionId));
    if (!room) {
      res.status(404).json({ status: 'error', message: 'Room not found' });
      return;
    }

    const { type, participantId, participantName, content } = req.body;
    const validTypes = ['question', 'answer', 'join', 'leave'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ status: 'error', message: 'Invalid event type' });
      return;
    }

    room.eventLog.push({
      type,
      participantId: participantId ?? undefined,
      participantName: participantName ?? undefined,
      content: content ?? undefined,
      timestamp: new Date().toISOString(),
    });

    res.json({ status: 'success', data: { logged: true } });
  }

  /**
   * GET /api/hybrid/rooms/:sessionId/log
   * Returns full event log — host only (requires auth).
   */
  getLog(req: AuthRequest, res: Response): void {
    const room = rooms.get(toParamString(req.params.sessionId));
    if (!room) {
      res.status(404).json({ status: 'error', message: 'Room not found' });
      return;
    }
    if (room.hostId !== req.user?.userId) {
      res.status(403).json({ status: 'error', message: 'Only the host can view the event log' });
      return;
    }

    res.json({
      status: 'success',
      data: {
        sessionId: room.sessionId,
        jobRole: room.jobRole,
        startedAt: room.startedAt,
        endedAt: room.endedAt,
        elapsedSeconds: room.elapsedSeconds,
        participantCount: room.participants.length,
        eventLog: room.eventLog,
      },
    });
  }
}

export default new HybridRoomController();
