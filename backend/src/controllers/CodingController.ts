import { Request, Response } from 'express';
import CodingChallenge from '../models/CodingChallenge';
import Session from '../models/Session';
import { codeValidator } from '../services/CodeValidator';
import { CodeSubmission } from '../types/coding.types';

/**
 * CodingController - Handles coding challenge retrieval and code submission
 */
export class CodingController {
  /**
   * Get coding challenges for a specific role
   * GET /api/coding/challenges/:role
   */
  async getChallengesByRole(req: Request, res: Response): Promise<void> {
    try {
      const { role } = req.params;
      const { difficulty, limit } = req.query;

      // Build query
      const query: any = { role };
      
      if (difficulty && ['easy', 'medium', 'hard'].includes(difficulty as string)) {
        query.difficulty = difficulty;
      }

      // Fetch challenges
      let challengesQuery = CodingChallenge.find(query);
      
      if (limit) {
        const limitNum = parseInt(limit as string, 10);
        if (!isNaN(limitNum) && limitNum > 0) {
          challengesQuery = challengesQuery.limit(limitNum);
        }
      }

      const challenges = await challengesQuery.exec();

      // Filter out hidden test cases from response
      const sanitizedChallenges = challenges.map(challenge => {
        const challengeObj = challenge.toObject();
        challengeObj.testCases = challengeObj.testCases.filter(tc => !tc.isHidden);
        return challengeObj;
      });

      res.status(200).json({
        success: true,
        count: sanitizedChallenges.length,
        data: sanitizedChallenges
      });
    } catch (error) {
      console.error('Error fetching coding challenges:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch coding challenges',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get a specific coding challenge by ID
   * GET /api/coding/challenges/id/:challengeId
   */
  async getChallengeById(req: Request, res: Response): Promise<void> {
    try {
      const { challengeId } = req.params;

      const challenge = await CodingChallenge.findById(challengeId);

      if (!challenge) {
        res.status(404).json({
          success: false,
          message: 'Coding challenge not found'
        });
        return;
      }

      // Filter out hidden test cases
      const challengeObj = challenge.toObject();
      challengeObj.testCases = challengeObj.testCases.filter(tc => !tc.isHidden);

      res.status(200).json({
        success: true,
        data: challengeObj
      });
    } catch (error) {
      console.error('Error fetching coding challenge:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch coding challenge',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Submit code for validation
   * POST /api/coding/submit
   * Query params: executeTests=true to run code execution (optional)
   */
  async submitCode(req: Request, res: Response): Promise<void> {
    try {
      const submission: CodeSubmission = req.body;
      const { challengeId, code, language, sessionId } = submission;
      const executeTests = req.query.executeTests === 'true';

      // Validate required fields
      if (!challengeId || !code || !language) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: challengeId, code, and language are required'
        });
        return;
      }

      // Fetch the challenge
      const challenge = await CodingChallenge.findById(challengeId);

      if (!challenge) {
        res.status(404).json({
          success: false,
          message: 'Coding challenge not found'
        });
        return;
      }

      // Validate language is supported
      if (!challenge.languages.includes(language)) {
        res.status(400).json({
          success: false,
          message: `Language ${language} is not supported for this challenge. Supported languages: ${challenge.languages.join(', ')}`
        });
        return;
      }

      // Validate code with Gemini AI (and optionally execute tests)
      const feedback = await codeValidator.validateCode({
        code,
        language,
        challengeTitle: challenge.title,
        challengeDescription: challenge.description,
        testCases: challenge.testCases
      }, executeTests);

      // If sessionId is provided, store the submission in the session
      if (sessionId) {
        const session = await Session.findById(sessionId);
        
        if (session) {
          // Create a coding question entry
          const codingQuestion = {
            question: {
              id: challengeId,
              text: `Coding Challenge: ${challenge.title}`,
              category: 'coding' as const,
              difficulty: challenge.difficulty,
              expectedKeywords: [],
              timeLimit: challenge.timeLimit
            },
            answer: code,
            evaluation: {
              score: feedback.score,
              feedback: `Code Quality: ${feedback.geminiAnalysis.codeQuality}/100\n${feedback.geminiAnalysis.correctness}`,
              strengths: feedback.geminiAnalysis.strengths,
              improvements: feedback.geminiAnalysis.improvements,
              sentiment: {
                overall: 'neutral' as const,
                confidence: feedback.geminiAnalysis.codeQuality,
                clarity: feedback.geminiAnalysis.codeQuality,
                professionalism: 80,
                tone: 'technical',
                emotions: {
                  nervousness: 20,
                  confidence: feedback.geminiAnalysis.codeQuality,
                  hesitation: 20,
                  excitement: 50,
                  confusion: 20,
                  stress: 20,
                  enthusiasm: 60
                }
              }
            },
            timeSpent: 0, // This should be tracked on the client side
            timestamp: new Date()
          };

          await session.addQuestion(codingQuestion);
        }
      }

      res.status(200).json({
        success: true,
        data: feedback
      });
    } catch (error) {
      console.error('Error submitting code:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate code submission',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get all available roles with coding challenges
   * GET /api/coding/roles
   */
  async getAvailableRoles(_req: Request, res: Response): Promise<void> {
    try {
      const roles = await CodingChallenge.distinct('role');

      res.status(200).json({
        success: true,
        data: roles
      });
    } catch (error) {
      console.error('Error fetching available roles:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch available roles',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get challenge statistics by role
   * GET /api/coding/stats/:role
   */
  async getChallengeStats(req: Request, res: Response): Promise<void> {
    try {
      const { role } = req.params;

      const stats = await CodingChallenge.aggregate([
        { $match: { role } },
        {
          $group: {
            _id: '$difficulty',
            count: { $sum: 1 }
          }
        }
      ]);

      const formattedStats = {
        role,
        total: stats.reduce((sum, stat) => sum + stat.count, 0),
        byDifficulty: stats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {} as Record<string, number>)
      };

      res.status(200).json({
        success: true,
        data: formattedStats
      });
    } catch (error) {
      console.error('Error fetching challenge stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch challenge statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Execute code with test cases
   * POST /api/coding/execute
   */
  async executeCode(req: Request, res: Response): Promise<void> {
    try {
      const { challengeId, code, language } = req.body;

      // Validate required fields
      if (!challengeId || !code || !language) {
        res.status(400).json({
          success: false,
          message: 'Missing required fields: challengeId, code, and language are required'
        });
        return;
      }

      // Fetch the challenge
      const challenge = await CodingChallenge.findById(challengeId);

      if (!challenge) {
        res.status(404).json({
          success: false,
          message: 'Coding challenge not found'
        });
        return;
      }

      // Validate language is supported
      if (!challenge.languages.includes(language)) {
        res.status(400).json({
          success: false,
          message: `Language ${language} is not supported for this challenge. Supported languages: ${challenge.languages.join(', ')}`
        });
        return;
      }

      // Import code executor
      const { codeExecutor } = await import('../services/CodeExecutor');

      // Check if language is supported for execution
      if (!codeExecutor.isSupportedLanguage(language)) {
        res.status(400).json({
          success: false,
          message: `Code execution is not supported for ${language}. Supported languages: Python, JavaScript, Java, C++`
        });
        return;
      }

      // Execute code with test cases
      const testResults = await codeExecutor.executeCode(
        code,
        language,
        challenge.testCases
      );

      res.status(200).json({
        success: true,
        data: {
          testResults,
          totalTests: testResults.length,
          passedTests: testResults.filter(r => r.passed).length,
          failedTests: testResults.filter(r => !r.passed).length
        }
      });
    } catch (error) {
      console.error('Error executing code:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to execute code',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Export singleton instance
export const codingController = new CodingController();
export default codingController;
