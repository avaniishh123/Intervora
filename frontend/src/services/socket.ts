import { io, Socket } from 'socket.io-client';
import { PerformanceReport } from '../types';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

/**
 * Interview-specific event data interfaces
 */
export interface QuestionNewData {
  questionId: string;
  text: string;
  category: string;
  difficulty: string;
  timeLimit: number;
}

export interface EvaluationResultData {
  questionId: string;
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  appreciation?: string; // Immediate appreciation message
  followUpQuestion?: QuestionNewData;
  sentiment: {
    overall: string;
    confidence: number;
    clarity: number;
    professionalism: number;
    tone: string;
  };
  emotions?: {
    nervousness: number;
    confidence: number;
    hesitation: number;
    excitement: number;
    confusion: number;
    stress: number;
    enthusiasm: number;
  };
  emotionalResponse?: string;
  nextPhaseRecommendation?: 'continue-technical' | 'move-to-hr' | 'conclude-interview';
}

export interface ScoreUpdateData {
  currentScore: number;
  totalQuestions: number;
  answeredQuestions: number;
}

export interface SessionCompletedData {
  sessionId: string;
  performanceReport: PerformanceReport;
}

export interface NotificationData {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

/**
 * Event callback types
 */
export type QuestionNewCallback = (data: QuestionNewData) => void;
export type EvaluationResultCallback = (data: EvaluationResultData) => void;
export type ScoreUpdateCallback = (data: ScoreUpdateData) => void;
export type SessionCompletedCallback = (data: SessionCompletedData) => void;
export type NotificationCallback = (data: NotificationData) => void;
export type ConnectionCallback = () => void;
export type ErrorCallback = (error: Error) => void;

class SocketService {
  private socket: Socket | null = null;
  private interviewNamespace: Socket | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private currentSessionId: string | null = null;

  /**
   * Connect to the main socket server
   */
  connect(token: string): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventHandlers();

    return this.socket;
  }

  /**
   * Connect to the interview namespace with JWT authentication
   */
  connectInterview(token: string): Socket {
    if (this.interviewNamespace?.connected) {
      return this.interviewNamespace;
    }

    this.interviewNamespace = io(`${SOCKET_URL}/interview`, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupInterviewEventHandlers();

    return this.interviewNamespace;
  }

  /**
   * Set up basic event handlers for main socket
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
      }
    });

    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
    });
  }

  /**
   * Set up event handlers for interview namespace
   */
  private setupInterviewEventHandlers(): void {
    if (!this.interviewNamespace) return;

    this.interviewNamespace.on('connect', () => {
      console.log('✅ Interview socket connected:', this.interviewNamespace?.id);
      this.reconnectAttempts = 0;

      // Rejoin session room if we were in one
      if (this.currentSessionId) {
        console.log('🔄 Rejoining session after reconnection:', this.currentSessionId);
        this.startSession(this.currentSessionId);
      }
    });

    this.interviewNamespace.on('disconnect', (reason) => {
      console.log('🔌 Interview socket disconnected:', reason);
    });

    this.interviewNamespace.on('connect_error', (error) => {
      console.error('❌ Interview socket connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached for interview socket');
      }
    });

    this.interviewNamespace.on('error', (error) => {
      console.error('❌ Interview socket error:', error);
    });
  }

  /**
   * Disconnect from main socket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Disconnect from interview namespace
   */
  disconnectInterview(): void {
    if (this.interviewNamespace) {
      this.interviewNamespace.disconnect();
      this.interviewNamespace = null;
      this.currentSessionId = null;
    }
  }

  /**
   * Get main socket instance
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Get interview namespace socket instance
   */
  getInterviewSocket(): Socket | null {
    return this.interviewNamespace;
  }

  /**
   * Check if interview socket is connected
   */
  isInterviewConnected(): boolean {
    return this.interviewNamespace?.connected || false;
  }

  /**
   * Generic emit for main socket
   */
  emit(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected. Cannot emit event:', event);
    }
  }

  /**
   * Generic event listener for main socket
   */
  on(event: string, callback: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  /**
   * Remove event listener from main socket
   */
  off(event: string, callback?: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  // ==================== Interview-specific methods ====================

  /**
   * Start an interview session
   */
  startSession(sessionId: string): void {
    if (!this.interviewNamespace?.connected) {
      console.warn('Interview socket not connected. Cannot start session.');
      return;
    }

    this.currentSessionId = sessionId;
    this.interviewNamespace.emit('session:start', { sessionId });
    console.log('📤 Session start emitted:', sessionId);
  }

  /**
   * Submit an answer
   */
  submitAnswer(sessionId: string, questionId: string, answer: string, questionText?: string, questionCategory?: string, questionTopic?: string): void {
    if (!this.interviewNamespace?.connected) {
      console.warn('Interview socket not connected. Cannot submit answer.');
      return;
    }

    this.interviewNamespace.emit('answer:submit', {
      sessionId,
      questionId,
      answer,
      questionText,
      questionCategory,
      questionTopic,
    });
    console.log('📤 Answer submitted:', { sessionId, questionId });
  }

  /**
   * End an interview session
   */
  endSession(sessionId: string): void {
    if (!this.interviewNamespace?.connected) {
      console.warn('Interview socket not connected. Cannot end session.');
      return;
    }

    this.interviewNamespace.emit('session:end', { sessionId });
    this.currentSessionId = null;
    console.log('📤 Session end emitted:', sessionId);
  }

  /**
   * Listen for new questions
   */
  onQuestionNew(callback: QuestionNewCallback): void {
    if (this.interviewNamespace) {
      this.interviewNamespace.on('question:new', callback);
    }
  }

  /**
   * Listen for evaluation results
   */
  onEvaluationResult(callback: EvaluationResultCallback): void {
    if (this.interviewNamespace) {
      this.interviewNamespace.on('evaluation:result', callback);
    }
  }

  /**
   * Listen for score updates
   */
  onScoreUpdate(callback: ScoreUpdateCallback): void {
    if (this.interviewNamespace) {
      this.interviewNamespace.on('score:update', callback);
    }
  }

  /**
   * Listen for session completion
   */
  onSessionCompleted(callback: SessionCompletedCallback): void {
    if (this.interviewNamespace) {
      this.interviewNamespace.on('session:completed', callback);
    }
  }

  /**
   * Listen for notifications
   */
  onNotification(callback: NotificationCallback): void {
    if (this.interviewNamespace) {
      this.interviewNamespace.on('notification', callback);
    }
  }

  /**
   * Listen for connection events
   */
  onConnect(callback: ConnectionCallback): void {
    if (this.interviewNamespace) {
      this.interviewNamespace.on('connect', callback);
    }
  }

  /**
   * Listen for disconnection events
   */
  onDisconnect(callback: ConnectionCallback): void {
    if (this.interviewNamespace) {
      this.interviewNamespace.on('disconnect', callback);
    }
  }

  /**
   * Listen for connection errors
   */
  onConnectionError(callback: ErrorCallback): void {
    if (this.interviewNamespace) {
      this.interviewNamespace.on('connect_error', callback);
    }
  }

  /**
   * Remove all interview event listeners
   */
  removeAllInterviewListeners(): void {
    if (this.interviewNamespace) {
      this.interviewNamespace.removeAllListeners('question:new');
      this.interviewNamespace.removeAllListeners('evaluation:result');
      this.interviewNamespace.removeAllListeners('score:update');
      this.interviewNamespace.removeAllListeners('session:completed');
      this.interviewNamespace.removeAllListeners('notification');
    }
  }

  /**
   * Remove specific interview event listener
   */
  offInterview(event: string, callback?: (...args: any[]) => void): void {
    if (this.interviewNamespace) {
      this.interviewNamespace.off(event, callback);
    }
  }
}

export const socketService = new SocketService();
export default socketService;
