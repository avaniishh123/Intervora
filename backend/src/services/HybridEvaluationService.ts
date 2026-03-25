import { geminiService } from './geminiService';
import { IHybridEvaluation } from '../models/HybridSession';
import { v4 as uuidv4 } from 'uuid';

export interface HybridEvaluationInput {
  questionId: string;
  questionText: string;
  answerText: string;
  jobRole?: string;
}

export interface HybridEvaluationResult extends Omit<IHybridEvaluation, 'evaluatedAt'> {
  evaluatedAt: Date;
}

const EVAL_TIMEOUT_MS = 15000;

/**
 * Wraps geminiService to produce four-dimension hybrid evaluation scores.
 * compositeScore = 0.4*technical + 0.2*clarity + 0.2*depth + 0.2*confidence
 */
class HybridEvaluationService {
  async evaluate(input: HybridEvaluationInput): Promise<HybridEvaluationResult> {
    const { questionId, questionText, answerText, jobRole } = input;

    const evalPromise = geminiService.evaluateAnswer({
      question: {
        id: questionId,
        text: questionText,
        category: 'technical',
        difficulty: 'medium',
        expectedKeywords: [],
        timeLimit: 180,
      },
      answer: answerText,
      conversationHistory: [],
      sessionId: uuidv4(),
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('EVAL_TIMEOUT')), EVAL_TIMEOUT_MS)
    );

    const geminiResult = await Promise.race([evalPromise, timeoutPromise]);

    // Map Gemini score (0-100) to four dimensions using heuristics
    const baseScore = geminiResult.score ?? 50;
    const sentiment = geminiResult.sentiment;

    const technicalScore = Math.round(baseScore);
    const clarityScore = Math.min(100, Math.round((sentiment?.clarity ?? baseScore * 0.9)));
    const confidenceScore = Math.min(100, Math.round((sentiment?.confidence ?? baseScore * 0.85)));
    const depthScore = Math.min(100, Math.round(baseScore * 0.95));

    const compositeScore = Math.round(
      0.4 * technicalScore +
      0.2 * clarityScore +
      0.2 * depthScore +
      0.2 * confidenceScore
    );

    return {
      questionId,
      technicalScore,
      clarityScore,
      depthScore,
      confidenceScore,
      compositeScore,
      feedback: geminiResult.feedback ?? 'Evaluation complete.',
      evaluatedAt: new Date(),
    };
  }
}

export const hybridEvaluationService = new HybridEvaluationService();
export default hybridEvaluationService;
