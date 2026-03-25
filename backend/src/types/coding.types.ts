import { Question } from './gemini.types';

/**
 * Code submission interface
 */
export interface CodeSubmission {
  challengeId: string;
  code: string;
  language: string;
  sessionId?: string;
}

/**
 * Test result interface
 */
export interface TestResult {
  testCase: number;
  passed: boolean;
  input: any;
  expectedOutput: any;
  actualOutput?: any;
  error?: string;
  executionTime?: number;
}

/**
 * Code feedback from Gemini AI
 */
export interface CodeFeedback {
  isCorrect: boolean;
  score: number;
  testResults?: TestResult[];
  geminiAnalysis: {
    codeQuality: number;
    efficiency: string;
    correctness: string;
    bestPractices: string[];
    suggestions: string[];
    strengths: string[];
    improvements: string[];
  };
  followUpQuestions: Question[];
}

/**
 * Code validation parameters
 */
export interface CodeValidationParams {
  code: string;
  language: string;
  challengeTitle: string;
  challengeDescription: string;
  testCases?: any[];
}
