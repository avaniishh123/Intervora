import { Server as SocketIOServer, Namespace } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { socketAuthMiddleware, AuthenticatedSocket } from './socketAuth';
import HybridSession from '../models/HybridSession';
import ContestLeaderboard from '../models/ContestLeaderboard';
import hybridEvaluationService from '../services/HybridEvaluationService';

// ── Types ──────────────────────────────────────────────────────────────────

interface HybridSocket extends AuthenticatedSocket {
  hybridRole?: 'candidate' | 'interviewer' | 'contestant';
  hybridSessionId?: string;
  hybridContestId?: string;
}

interface SessionJoinData { sessionId: string; role?: string; }
interface QuestionData { sessionId: string; questionId?: string; text: string; }
interface AnswerSubmitData { sessionId: string; questionId: string; answer: string; autoSubmitted?: boolean; }
interface SessionEndData { sessionId: string; }
interface LiveTranscriptData { sessionId: string; text: string; }

// ── In-memory tracking ─────────────────────────────────────────────────────

/** sessionId → Set of socket IDs */
const sessionRooms = new Map<string, Set<string>>();
/** socketId → sessionId */
const socketSession = new Map<string, string>();
/** contestId → interval handle */
const contestTimers = new Map<string, ReturnType<typeof setInterval>>();
/** contestId → { startMs, perQuestionMs, currentQuestionStart } */
const contestMeta = new Map<string, { startMs: number; durationMs: number; perQuestionMs: number; currentQuestionStart: number }>();
/** socketId → disconnect timestamp (for 30s reconnect window) */
const disconnectTimestamps = new Map<string, number>();

// ── Helpers ────────────────────────────────────────────────────────────────

function joinRoom(socket: HybridSocket, sessionId: string): void {
  socket.join(sessionId);
  socket.hybridSessionId = sessionId;
  socketSession.set(socket.id, sessionId);
  if (!sessionRooms.has(sessionId)) sessionRooms.set(sessionId, new Set());
  sessionRooms.get(sessionId)!.add(socket.id);
}

function leaveRoom(socket: HybridSocket, sessionId: string): void {
  socket.leave(sessionId);
  socketSession.delete(socket.id);
  const room = sessionRooms.get(sessionId);
  if (room) {
    room.delete(socket.id);
    if (room.size === 0) sessionRooms.delete(sessionId);
  }
}

function deriveRole(socket: HybridSocket, requestedRole?: string): 'candidate' | 'interviewer' | 'contestant' {
  const jwtRole = socket.user?.role;
  if (jwtRole === 'interviewer') return 'interviewer';
  if (requestedRole === 'contestant') return 'contestant';
  return 'candidate';
}

async function runEvaluation(
  ns: Namespace,
  socket: HybridSocket,
  sessionId: string,
  questionId: string,
  questionText: string,
  answerText: string,
  jobRole: string,
  autoSubmitted: boolean
): Promise<void> {
  try {
    const result = await hybridEvaluationService.evaluate({
      questionId,
      questionText,
      answerText,
      jobRole,
    });

    // Persist evaluation
    await HybridSession.findOneAndUpdate(
      { sessionId },
      { $push: { evaluations: result } }
    );

    const payload = { ...result, autoSubmitted };
    // Send to candidate
    socket.emit('hybrid:evaluation:result', payload);
    // Also send to interviewer in same room (human mode)
    socket.to(sessionId).emit('hybrid:evaluation:result', payload);
  } catch (err: any) {
    if (err?.message === 'EVAL_TIMEOUT') {
      socket.emit('hybrid:evaluation:timeout', { questionId });
      await HybridSession.findOneAndUpdate(
        { sessionId },
        { $push: { evaluations: { questionId, technicalScore: 0, clarityScore: 0, depthScore: 0, confidenceScore: 0, compositeScore: 0, feedback: 'Evaluation timed out.', evaluatedAt: new Date() } } }
      );
    } else {
      console.error('[hybridSocket] evaluation error:', err);
    }
  }
}

function startContestTimer(ns: Namespace, contestId: string, sessionId: string): void {
  if (contestTimers.has(contestId)) return;

  const meta = contestMeta.get(contestId);
  if (!meta) return;

  const handle = setInterval(() => {
    const now = Date.now();
    const contestTimeRemaining = Math.max(0, meta.durationMs - (now - meta.startMs));
    const questionTimeRemaining = Math.max(0, meta.perQuestionMs - (now - meta.currentQuestionStart));

    ns.to(sessionId).emit('hybrid:timer:tick', { contestTimeRemaining, questionTimeRemaining });

    if (questionTimeRemaining === 0) {
      // Auto-submit: server emits to all in room
      ns.to(sessionId).emit('hybrid:answer:auto-submit', { autoSubmitted: true });
      meta.currentQuestionStart = Date.now(); // reset for next question
    }

    if (contestTimeRemaining === 0) {
      clearInterval(handle);
      contestTimers.delete(contestId);
      ns.to(sessionId).emit('hybrid:session:end', { sessionId, reason: 'contest_time_expired' });
      // Compute and emit leaderboard
      computeAndEmitLeaderboard(ns, contestId, sessionId);
    }
  }, 1000);

  contestTimers.set(contestId, handle);
}

async function computeAndEmitLeaderboard(ns: Namespace, contestId: string, sessionId: string): Promise<void> {
  try {
    const sessions = await HybridSession.find({ contestId, mode: 'contest' })
      .populate<{ candidateId: { _id: any; profile: { name: string } } }>('candidateId', 'profile.name');

    const entries = sessions
      .filter(s => s.status !== 'abandoned')
      .map(s => {
        const evals = s.evaluations ?? [];
        const finalScore = evals.length
          ? Math.round(evals.reduce((sum, e) => sum + e.compositeScore, 0) / evals.length)
          : 0;
        const completionTimeMs = s.endTime && s.startTime
          ? s.endTime.getTime() - s.startTime.getTime()
          : Date.now();
        const candidate = s.candidateId as any;
        return {
          candidateId: s.candidateId,
          username: candidate?.profile?.name ?? 'Unknown',
          finalScore,
          completionTimeMs,
        };
      });

    // Sort: score desc, then time asc
    entries.sort((a, b) => b.finalScore - a.finalScore || a.completionTimeMs - b.completionTimeMs);
    const rankings = entries.map((e, i) => ({ ...e, rank: i + 1 }));

    await ContestLeaderboard.findOneAndUpdate(
      { contestId },
      { contestId, rankings },
      { upsert: true, new: true }
    );

    ns.to(sessionId).emit('hybrid:leaderboard:update', { rankings });
  } catch (err) {
    console.error('[hybridSocket] leaderboard error:', err);
  }
}

// ── Namespace initializer ──────────────────────────────────────────────────

export function initializeHybridNamespace(io: SocketIOServer): Namespace {
  const ns = io.of('/hybrid-interview');
  ns.use(socketAuthMiddleware);

  ns.on('connection', (rawSocket) => {
    const socket = rawSocket as HybridSocket;
    console.log(`[hybrid] connected: ${socket.id} (${socket.user?.email})`);

    // ── hybrid:session:join ──────────────────────────────────────────────
    socket.on('hybrid:session:join', async (data: SessionJoinData) => {
      const { sessionId, role } = data;
      if (!sessionId) return;

      socket.hybridRole = deriveRole(socket, role);
      joinRoom(socket, sessionId);

      // Restore state if reconnecting within 30s
      const prevDisconnect = disconnectTimestamps.get(socket.user?.userId + ':' + sessionId);
      if (prevDisconnect && Date.now() - prevDisconnect < 30000) {
        const session = await HybridSession.findOne({ sessionId });
        if (session) {
          socket.emit('hybrid:session:restore', {
            sessionId,
            status: session.status,
            messages: session.messages,
            evaluations: session.evaluations,
          });
        }
        disconnectTimestamps.delete(socket.user?.userId + ':' + sessionId);
      }

      // Activate session if waiting
      await HybridSession.findOneAndUpdate(
        { sessionId, status: 'waiting' },
        { status: 'active', startTime: new Date() }
      );

      socket.emit('hybrid:session:joined', { sessionId, role: socket.hybridRole });
      console.log(`[hybrid] ${socket.user?.email} joined ${sessionId} as ${socket.hybridRole}`);
    });

    // ── hybrid:question ──────────────────────────────────────────────────
    socket.on('hybrid:question', async (data: QuestionData) => {
      const { sessionId, text } = data;

      // Role enforcement
      if (socket.hybridRole !== 'interviewer') {
        socket.emit('hybrid:error', { code: 'ROLE_VIOLATION', message: 'Only interviewers can send questions.' });
        return;
      }

      const questionId = data.questionId ?? uuidv4();

      // Persist message
      await HybridSession.findOneAndUpdate(
        { sessionId },
        { $push: { messages: { messageId: questionId, senderRole: 'human_interviewer', content: text, deliveryStatus: 'sent' } } }
      );

      // Broadcast to room (candidate receives it)
      ns.to(sessionId).emit('hybrid:question', { questionId, text, turnGate: 'locked' });
    });

    // ── hybrid:answer:submit ─────────────────────────────────────────────
    socket.on('hybrid:answer:submit', async (data: AnswerSubmitData) => {
      const { sessionId, questionId, answer, autoSubmitted } = data;

      // Role enforcement
      if (socket.hybridRole === 'interviewer') {
        socket.emit('hybrid:error', { code: 'ROLE_VIOLATION', message: 'Interviewers cannot submit answers.' });
        return;
      }

      if (!answer || answer.trim().length === 0) {
        socket.emit('hybrid:error', { code: 'EMPTY_ANSWER', message: 'Answer cannot be empty.' });
        return;
      }

      // Persist message
      await HybridSession.findOneAndUpdate(
        { sessionId },
        { $push: { messages: { messageId: uuidv4(), senderRole: 'candidate', content: answer, deliveryStatus: 'sent' } } }
      );

      // Relay to interviewer
      socket.to(sessionId).emit('hybrid:answer:submit', { questionId, answer, autoSubmitted: !!autoSubmitted });

      // Fetch session for context
      const session = await HybridSession.findOne({ sessionId });
      const jobRole = session?.metadata?.jobRole ?? 'Software Engineer';

      // Find question text from messages
      const qMsg = session?.messages.find(m => m.messageId === questionId);
      const questionText = qMsg?.content ?? 'Interview question';

      // Run evaluation asynchronously
      runEvaluation(ns, socket, sessionId, questionId, questionText, answer, jobRole, !!autoSubmitted);
    });

    // ── hybrid:transcript:live ───────────────────────────────────────────
    socket.on('hybrid:transcript:live', (data: LiveTranscriptData) => {
      const { sessionId, text } = data;
      // Relay to interviewer only
      socket.to(sessionId).emit('hybrid:transcript:live', { text });
    });

    // ── hybrid:session:end ───────────────────────────────────────────────
    socket.on('hybrid:session:end', async (data: SessionEndData) => {
      const { sessionId } = data;

      if (socket.hybridRole !== 'interviewer' && socket.hybridRole !== 'candidate') {
        socket.emit('hybrid:error', { code: 'ROLE_VIOLATION', message: 'Not authorized to end session.' });
        return;
      }

      await HybridSession.findOneAndUpdate(
        { sessionId },
        { status: 'completed', endTime: new Date() }
      );

      ns.to(sessionId).emit('hybrid:session:end', { sessionId, reason: 'interviewer_ended' });

      // If contest, compute leaderboard
      const session = await HybridSession.findOne({ sessionId });
      if (session?.contestId) {
        const cid = session.contestId;
        const timer = contestTimers.get(cid);
        if (timer) { clearInterval(timer); contestTimers.delete(cid); }
        computeAndEmitLeaderboard(ns, cid, sessionId);
      }
    });

    // ── disconnect ───────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      const sessionId = socketSession.get(socket.id);
      if (sessionId) {
        // Record disconnect time for reconnect window
        disconnectTimestamps.set(socket.user?.userId + ':' + sessionId, Date.now());

        leaveRoom(socket, sessionId);

        // For contest: mark abandoned after 30s if not reconnected
        const session = await HybridSession.findOne({ sessionId });
        if (session?.mode === 'contest') {
          setTimeout(async () => {
            const stillDisconnected = disconnectTimestamps.has(socket.user?.userId + ':' + sessionId);
            if (stillDisconnected) {
              await HybridSession.findOneAndUpdate(
                { sessionId, candidateId: socket.user?.userId },
                { status: 'abandoned', endTime: new Date() }
              );
              disconnectTimestamps.delete(socket.user?.userId + ':' + sessionId);
            }
          }, 30000);
        }
      }
      console.log(`[hybrid] disconnected: ${socket.id}`);
    });
  });

  return ns;
}

export default { initializeHybridNamespace };
