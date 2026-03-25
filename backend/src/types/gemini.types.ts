/**
 * Type definitions for Gemini AI service
 */

export interface Question {
  id: string;
  text: string;
  category: 'technical' | 'behavioral' | 'situational' | 'coding' | 'greeting';
  difficulty: 'easy' | 'medium' | 'hard';
  expectedKeywords: string[];
  timeLimit: number; // in seconds
  topic?: string; // Domain-specific topic
  evaluation?: Evaluation; // Evaluation result when answered
}

export interface QuestionGenerationParams {
  role: string;
  resume?: string;
  jobDescription?: string;
  previousQuestions?: Question[];
  difficulty?: 'easy' | 'medium' | 'hard';
  count?: number;
  topicsCovered?: string[];
  sessionId?: string;
}

export interface DomainTopics {
  [role: string]: string[];
}

export interface TopicTracker {
  role: string;
  coveredTopics: string[];
  currentTopic?: string;
  topicPerformance: { [topic: string]: number }; // Average score per topic
}

export interface AnswerEvaluationParams {
  question: Question;
  answer: string;
  conversationHistory: ConversationMessage[];
  interviewPhase?: InterviewPhase;
  voiceMetrics?: VoiceMetrics;
  sessionId?: string; // For topic tracking
}

export interface VoiceMetrics {
  speechRate: number; // words per minute
  pauseDuration: number; // average pause length in seconds
  volumeVariation: number; // 0-100, voice volume consistency
  speechClarity: number; // 0-100, pronunciation clarity
}

export interface ConversationMessage {
  role: 'interviewer' | 'candidate';
  content: string;
  timestamp: Date;
}

export interface SentimentAnalysis {
  overall: 'positive' | 'neutral' | 'negative';
  confidence: number; // 0-100
  clarity: number; // 0-100
  professionalism: number; // 0-100
  tone: string;
  emotions: EmotionAnalysis;
}

export interface EmotionAnalysis {
  nervousness: number; // 0-100
  confidence: number; // 0-100
  hesitation: number; // 0-100
  excitement: number; // 0-100
  confusion: number; // 0-100
  stress: number; // 0-100
  enthusiasm: number; // 0-100
}

export interface InterviewPhase {
  current: 'technical' | 'hr' | 'mixed';
  questionsAsked: number;
  technicalQuestionsCount: number;
  hrQuestionsCount: number;
}

export interface Evaluation {
  score: number; // 0-100
  feedback: string;
  strengths: string[];
  improvements: string[];
  followUpQuestion?: Question;
  sentiment: SentimentAnalysis;
  emotionalResponse?: string; // Only for HR phase
  nextPhaseRecommendation?: 'continue-technical' | 'move-to-hr' | 'conclude-interview';
  appreciation?: string; // Immediate appreciation based on answer quality
  followUpChain?: FollowUpChain; // Chain of follow-up questions
}

export interface FollowUpChain {
  mainQuestionId: string;
  currentFollowUpIndex: number; // 0-3 (4 follow-ups total)
  followUpQuestions: Question[];
  isComplete: boolean;
}
