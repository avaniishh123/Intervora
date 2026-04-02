/**
 * useLiveSocket — Socket.IO hook for Human-Based Interview sessions.
 * Uses the existing /hybrid-interview namespace but with live-session events.
 */
import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export interface LiveMessage {
  id: string;
  senderRole: 'interviewer' | 'candidate';
  senderName: string;
  text: string;
  timestamp: string;
}

interface UseLiveSocketOptions {
  sessionId: string;
  participantRole: 'interviewer' | 'candidate';
  participantName: string;
  onMessage?: (msg: LiveMessage) => void;
  onSessionEnd?: () => void;
  onParticipantJoined?: (name: string, role: string) => void;
  onParticipantLeft?: (name: string) => void;
  onTimerTick?: (secondsLeft: number) => void;
}

export function useLiveSocket(options: UseLiveSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    // Interviewers must be authenticated; candidates may not have a token
    const socket = io(`${SOCKET_URL}/live-interview`, {
      auth: token ? { token } : {},
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('live:join', {
        sessionId: optsRef.current.sessionId,
        role: optsRef.current.participantRole,
        name: optsRef.current.participantName,
      });
    });

    socket.on('live:message', (msg: LiveMessage) => optsRef.current.onMessage?.(msg));
    socket.on('live:session:end', () => optsRef.current.onSessionEnd?.());
    socket.on('live:participant:joined', (d: { name: string; role: string }) =>
      optsRef.current.onParticipantJoined?.(d.name, d.role)
    );
    socket.on('live:participant:left', (d: { name: string }) =>
      optsRef.current.onParticipantLeft?.(d.name)
    );
    socket.on('live:timer:tick', (d: { secondsLeft: number }) =>
      optsRef.current.onTimerTick?.(d.secondsLeft)
    );

    socket.on('connect_error', (err) => console.error('[live] connect error:', err.message));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [options.sessionId]);

  const sendMessage = useCallback((text: string) => {
    socketRef.current?.emit('live:message', {
      sessionId: optsRef.current.sessionId,
      text,
      senderRole: optsRef.current.participantRole,
      senderName: optsRef.current.participantName,
    });
  }, []);

  const emitEnd = useCallback(() => {
    socketRef.current?.emit('live:session:end', { sessionId: optsRef.current.sessionId });
  }, []);

  return { sendMessage, emitEnd };
}
