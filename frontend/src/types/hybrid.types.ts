export type HybridMode = 'ai' | 'human' | 'contest';
export type TurnGateState = 'locked' | 'open' | 'submitted';
export type HybridRole = 'candidate' | 'interviewer' | 'contestant';
export type SessionStatus = 'waiting' | 'active' | 'completed' | 'abandoned';

export interface HybridQuestion {
  questionId: string;
  text: string;
  turnGate?: 'locked' | 'open';
}

export interface HybridEvaluationResult {
  questionId: string;
  technicalScore: number;
  clarityScore: number;
  depthScore: number;
  confidenceScore: number;
  compositeScore: number;
  feedback: string;
  evaluatedAt: string;
  autoSubmitted?: boolean;
}

export interface TimerTick {
  contestTimeRemaining: number;
  questionTimeRemaining: number;
}

export interface RankingEntry {
  candidateId: string;
  username: string;
  finalScore: number;
  completionTimeMs: number;
  rank: number;
}

export interface HybridSessionData {
  sessionId: string;
  mode: HybridMode;
  status: SessionStatus;
  messages: any[];
  evaluations: HybridEvaluationResult[];
}

export interface HybridError {
  code: string;
  message: string;
}
