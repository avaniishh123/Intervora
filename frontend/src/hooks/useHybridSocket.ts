/**
 * useHybridSocket — connects to the /hybrid-interview Socket.io namespace.
 * Completely separate from the existing /interview namespace.
 */
import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  HybridQuestion,
  HybridEvaluationResult,
  TimerTick,
  RankingEntry,
  HybridError,
  HybridRole,
  HybridSessionData,
} from '../types/hybrid.types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

interface UseHybridSocketOptions {
  onQuestion?: (q: HybridQuestion) => void;
  onEvaluationResult?: (r: HybridEvaluationResult) => void;
  onEvaluationTimeout?: (data: { questionId: string }) => void;
  onTimerTick?: (t: TimerTick) => void;
  onLeaderboardUpdate?: (rankings: RankingEntry[]) => void;
  onSessionEnd?: (data: { sessionId: string; reason: string }) => void;
  onSessionRestore?: (data: HybridSessionData) => void;
  onLiveTranscript?: (text: string) => void;
  onAnswerAutoSubmit?: () => void;
  onError?: (err: HybridError) => void;
}

export function useHybridSocket(options: UseHybridSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = io(`${SOCKET_URL}/hybrid-interview`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('hybrid:question', (data: HybridQuestion) => optionsRef.current.onQuestion?.(data));
    socket.on('hybrid:evaluation:result', (data: HybridEvaluationResult) => optionsRef.current.onEvaluationResult?.(data));
    socket.on('hybrid:evaluation:timeout', (data: { questionId: string }) => optionsRef.current.onEvaluationTimeout?.(data));
    socket.on('hybrid:timer:tick', (data: TimerTick) => optionsRef.current.onTimerTick?.(data));
    socket.on('hybrid:leaderboard:update', (data: { rankings: RankingEntry[] }) => optionsRef.current.onLeaderboardUpdate?.(data.rankings));
    socket.on('hybrid:session:end', (data: any) => optionsRef.current.onSessionEnd?.(data));
    socket.on('hybrid:session:restore', (data: HybridSessionData) => optionsRef.current.onSessionRestore?.(data));
    socket.on('hybrid:transcript:live', (data: { text: string }) => optionsRef.current.onLiveTranscript?.(data.text));
    socket.on('hybrid:answer:auto-submit', () => optionsRef.current.onAnswerAutoSubmit?.());
    socket.on('hybrid:error', (err: HybridError) => optionsRef.current.onError?.(err));

    socket.on('connect', () => console.log('[hybrid] socket connected:', socket.id));
    socket.on('disconnect', (reason) => console.log('[hybrid] socket disconnected:', reason));
    socket.on('connect_error', (err) => console.error('[hybrid] connect error:', err.message));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []); // connect once on mount

  const joinSession = useCallback((sessionId: string, role: HybridRole) => {
    socketRef.current?.emit('hybrid:session:join', { sessionId, role });
  }, []);

  const sendQuestion = useCallback((sessionId: string, text: string, questionId?: string) => {
    socketRef.current?.emit('hybrid:question', { sessionId, text, questionId });
  }, []);

  const submitAnswer = useCallback((sessionId: string, questionId: string, answer: string, autoSubmitted = false) => {
    socketRef.current?.emit('hybrid:answer:submit', { sessionId, questionId, answer, autoSubmitted });
  }, []);

  const sendLiveTranscript = useCallback((sessionId: string, text: string) => {
    socketRef.current?.emit('hybrid:transcript:live', { sessionId, text });
  }, []);

  const endSession = useCallback((sessionId: string) => {
    socketRef.current?.emit('hybrid:session:end', { sessionId });
  }, []);

  const isConnected = () => socketRef.current?.connected ?? false;

  return { joinSession, sendQuestion, submitAnswer, sendLiveTranscript, endSession, isConnected };
}
