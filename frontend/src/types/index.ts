// User types
export interface User {
  id: string;
  email: string;
  role: 'candidate' | 'admin';
  profile: {
    name: string;
    resumeUrl?: string;
    totalSessions: number;
    averageScore: number;
  };
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Question types
export interface Question {
  id: string;
  text: string;
  category: 'technical' | 'behavioral' | 'situational' | 'coding';
  difficulty: 'easy' | 'medium' | 'hard';
  expectedKeywords: string[];
  timeLimit: number;
}

// Evaluation types
export interface SentimentAnalysis {
  overall: string;
  confidence: number;
  clarity: number;
  professionalism: number;
}

export interface Evaluation {
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  followUpQuestion?: Question;
  sentiment: SentimentAnalysis;
}

// Session types
export interface SessionQuestion {
  question: Question;
  answer: string;
  evaluation: Evaluation;
  timeSpent: number;
  timestamp: string;
}

export interface PerformanceReport {
  overallScore: number;
  categoryScores: {
    technical: number;
    behavioral: number;
    communication: number;
  };
  wordCountMetrics: {
    average: number;
    total: number;
    perQuestion: number[];
  };
  sentimentAnalysis: {
    overall: string;
    confidence: number;
    clarity: number;
    professionalism: number;
  };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  carFrameworkScore?: number;
}

export interface InterviewSession {
  id: string;
  userId: string;
  jobRole: string;
  mode: 'resume-based' | 'jd-based' | 'general';
  status: 'in-progress' | 'completed' | 'abandoned';
  startTime: string;
  endTime?: string;
  questions: SessionQuestion[];
  performanceReport?: PerformanceReport;
  recordingUrl?: string;
  transcriptUrl?: string;
}

// Resume types
export interface ExperienceItem {
  company: string;
  role: string;
  duration: string;
  highlights: string[];
}

export interface ProjectItem {
  name: string;
  description: string;
  technologies: string[];
}

export interface EducationItem {
  institution: string;
  degree: string;
  year: string;
}

export interface ResumeAnalysis {
  skills: string[];
  experience: ExperienceItem[];
  projects: ProjectItem[];
  education: EducationItem[];
  suggestions: string[];
  jdMatchScore?: number;
  strengthAreas: string[];
  improvementAreas: string[];
}

// Coding challenge types
export interface TestCase {
  input: any;
  expectedOutput: any;
  isHidden: boolean;
}

export interface CodingChallenge {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  role: string;
  language: string[];
  testCases: TestCase[];
  starterCode: Record<string, string>;
}

export interface CodeFeedback {
  isCorrect: boolean;
  testResults: any[];
  geminiAnalysis: {
    codeQuality: number;
    efficiency: string;
    bestPractices: string[];
    suggestions: string[];
  };
  followUpQuestions: Question[];
}

// Leaderboard types
export interface LeaderboardEntry {
  userId: string;
  username: string;
  jobRole: string;
  averageScore: number;
  totalSessions: number;
  rank: number;
  updatedAt: string;
}

export interface UserRankInfo {
  rank: number;
  percentile: number;
  totalCandidates: number;
  averageScore: number;
  totalSessions: number;
  jobRole: string;
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// User status badge
export type UserStatus = 'NOOB' | 'INTERMEDIATE' | 'PRO';

export function getUserStatus(totalSessions: number): UserStatus {
  if (totalSessions >= 19) return 'PRO';
  if (totalSessions >= 6) return 'INTERMEDIATE';
  return 'NOOB';
}

// Public profile for leaderboard panel
export interface UserPublicProfile {
  name: string;
  joinedAt: string;
  totalSessions: number;
  averageScore: number;
  rank: number | null;
  jobRole: string | null;
  profilePhoto?: string;
}
