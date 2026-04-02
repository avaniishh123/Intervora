/**
 * liveInterviewSocket — Socket.IO namespace for Human-Based Interview sessions.
 * Handles real-time messaging, session timer, and participant events.
 */
import { Server as SocketIOServer, Namespace, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import LiveSession from '../models/LiveSession';

interface LiveSocket extends Socket {
  liveSessionId?: string;
  liveRole?: 'interviewer' | 'candidate';
  liveName?: string;
}

// sessionId → timer handle
const sessionTimers = new Map<string, ReturnType<typeof setInterval>>();
// sessionId → seconds remaining
const sessionCountdowns = new Map<string, number>();

function clearSessionTimer(sessionId: string) {
  const t = sessionTimers.get(sessionId);
  if (t) { clearInterval(t); sessionTimers.delete(sessionId); }
  sessionCountdowns.delete(sessionId);
}

function startSessionTimer(ns: Namespace, sessionId: string, durationMinutes: number) {
  if (sessionTimers.has(sessionId)) return;
  let secondsLeft = durationMinutes * 60;
  sessionCountdowns.set(sessionId, secondsLeft);

  const handle = setInterval(async () => {
    secondsLeft -= 1;
    sessionCountdowns.set(sessionId, secondsLeft);
    ns.to(sessionId).emit('live:timer:tick', { secondsLeft });

    if (secondsLeft <= 0) {
      clearSessionTimer(sessionId);
      ns.to(sessionId).emit('live:session:end', { reason: 'time_expired' });
      try {
        await LiveSession.findOneAndUpdate(
          { sessionId, status: 'active' },
          { status: 'ended', endedAt: new Date() }
        );
      } catch { /* best-effort */ }
    }
  }, 1000);

  sessionTimers.set(sessionId, handle);
}

export function initializeLiveInterviewNamespace(io: SocketIOServer): Namespace {
  const ns = io.of('/live-interview');

  ns.on('connection', (rawSocket) => {
    const socket = rawSocket as LiveSocket;

    socket.on('live:join', async ({ sessionId, role, name }: { sessionId: string; role: string; name: string }) => {
      socket.liveSessionId = sessionId;
      socket.liveRole = role as 'interviewer' | 'candidate';
      socket.liveName = name;
      socket.join(sessionId);

      // Notify others in room
      socket.to(sessionId).emit('live:participant:joined', { name, role });

      // If session is active and timer not yet started, start it
      try {
        const session = await LiveSession.findOne({ sessionId });
        if (session?.status === 'active' && session.scheduledEndAt) {
          const msLeft = session.scheduledEndAt.getTime() - Date.now();
          if (msLeft > 0 && !sessionTimers.has(sessionId)) {
            const secondsLeft = Math.ceil(msLeft / 1000);
            sessionCountdowns.set(sessionId, secondsLeft);
            // Start timer with remaining time
            let sLeft = secondsLeft;
            const handle = setInterval(async () => {
              sLeft -= 1;
              sessionCountdowns.set(sessionId, sLeft);
              ns.to(sessionId).emit('live:timer:tick', { secondsLeft: sLeft });
              if (sLeft <= 0) {
                clearSessionTimer(sessionId);
                ns.to(sessionId).emit('live:session:end', { reason: 'time_expired' });
                try {
                  await LiveSession.findOneAndUpdate(
                    { sessionId, status: 'active' },
                    { status: 'ended', endedAt: new Date() }
                  );
                } catch { /* best-effort */ }
              }
            }, 1000);
            sessionTimers.set(sessionId, handle);
          }
        }
      } catch { /* best-effort */ }
    });

    socket.on('live:message', ({ sessionId, text, senderRole, senderName }: {
      sessionId: string; text: string; senderRole: string; senderName: string;
    }) => {
      const msg = {
        id: uuidv4(),
        senderRole,
        senderName,
        text,
        timestamp: new Date().toISOString(),
      };
      // Broadcast to everyone in room (including sender for confirmation)
      ns.to(sessionId).emit('live:message', msg);
    });

    socket.on('live:session:start', async ({ sessionId, durationMinutes }: { sessionId: string; durationMinutes: number }) => {
      startSessionTimer(ns, sessionId, durationMinutes);
      ns.to(sessionId).emit('live:session:started', { sessionId });
    });

    socket.on('live:session:end', async ({ sessionId }: { sessionId: string }) => {
      clearSessionTimer(sessionId);
      ns.to(sessionId).emit('live:session:end', { reason: 'interviewer_ended' });
      try {
        await LiveSession.findOneAndUpdate(
          { sessionId, status: 'active' },
          { status: 'ended', endedAt: new Date() }
        );
      } catch { /* best-effort */ }
    });

    socket.on('disconnect', () => {
      const sessionId = socket.liveSessionId;
      if (sessionId && socket.liveName) {
        socket.to(sessionId).emit('live:participant:left', { name: socket.liveName, role: socket.liveRole });
      }
    });
  });

  return ns;
}
