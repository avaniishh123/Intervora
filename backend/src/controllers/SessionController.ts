import { Request, Response, NextFunction } from 'express';
import Session, { ISessionQuestion } from '../models/Session';
import User from '../models/User';
import { geminiService } from '../services/geminiService';
import { recordingService } from '../services/RecordingService';
import { PerformanceAnalyzer } from '../services/PerformanceAnalyzer';
import { leaderboardService } from '../services/LeaderboardService';
import { Question } from '../types/gemini.types';
import { 
  emitEvaluationResult, 
  emitScoreUpdate, 
  emitSessionCompleted,
  emitNotification,
  saveSessionState,
  clearSessionState
} from '../socket';
import { getSocketInstance } from '../socket/socketInstance';

/**
 * SessionController - Handles interview session lifecycle
 */
export class SessionController {
  /**
   * Start a new interview session
   * POST /api/sessions/start
   */
  async startSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { jobRole, mode, mentorModeEnabled, jobDescription, resumeUsed, duration, resumeAnalysis } = req.body;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          status: 'error',
          message: 'User not authenticated'
        });
        return;
      }

      // Validate required fields
      if (!jobRole || !mode) {
        res.status(400).json({
          status: 'error',
          message: 'Job role and mode are required'
        });
        return;
      }

      // Validate mode
      const validModes = ['resume-based', 'jd-based', 'general'];
      if (!validModes.includes(mode)) {
        res.status(400).json({
          status: 'error',
          message: 'Invalid mode. Must be resume-based, jd-based, or general'
        });
        return;
      }

      // Calculate total questions based on duration
      const durationInMinutes = duration || 15; // Default 15 minutes
      let totalQuestions: number;
      
      switch (durationInMinutes) {
        case 5:
          totalQuestions = 15;
          break;
        case 10:
          totalQuestions = 20;
          break;
        case 15:
          totalQuestions = 20;
          break;
        case 25:
          totalQuestions = 30;
          break;
        case 40:
          totalQuestions = 40;
          break;
        default:
          totalQuestions = 20; // Default fallback
      }

      console.log(`🧹 Creating fresh interview session (${durationInMinutes} min, ${totalQuestions} questions)...`);
      
      // Clean up any previous sessions for this user
      await Session.updateMany(
        { userId, status: 'in-progress' },
        { status: 'abandoned', endTime: new Date() }
      );

      console.log('✅ Previous sessions cleaned up');

      // Create completely fresh session
      const session = new Session({
        userId,
        jobRole,
        mode,
        status: 'in-progress',
        startTime: new Date(),
        questions: [], // Ensure empty questions array
        metadata: {
          mentorModeEnabled: mentorModeEnabled || false,
          jobDescription: jobDescription || undefined,
          resumeUsed: resumeUsed || false,
          duration: durationInMinutes,
          totalQuestions,
          resumeAnalysis: resumeAnalysis || undefined // Store resume analysis if provided
        }
      });

      await session.save();

      // Initialize topic tracker for domain-specific interview
      const sessionIdStr = String(session._id);
      geminiService.initializeTopicTracker(sessionIdStr, jobRole);

      console.log(`✅ Fresh session created: ${session._id} (${totalQuestions} questions)`);
      if (resumeAnalysis) {
        console.log('📄 Resume analysis data attached to session');
      }

      res.status(201).json({
        status: 'success',
        message: 'Fresh interview session started successfully',
        data: {
          session
        }
      });
    } catch (error) {
      console.error('Error starting session:', error);
      next(error);
    }
  }

  /**
   * Submit an answer for evaluation
   * POST /api/sessions/:id/submit-answer
   */
  async submitAnswer(req: Request, res: Response, _next: NextFunction): Promise<void> {
    const { id } = req.params;
    const { question, answer, timeSpent } = req.body;
    const userId = (req as any).user?.userId;
    let session: any = null;

    try {
      if (!userId) {
        res.status(401).json({
          status: 'error',
          message: 'User not authenticated'
        });
        return;
      }

      // Validate required fields
      if (!question || !answer || timeSpent === undefined) {
        res.status(400).json({
          status: 'error',
          message: 'Question, answer, and timeSpent are required'
        });
        return;
      }

      // Find session
      session = await Session.findById(id);

      if (!session) {
        res.status(404).json({
          status: 'error',
          message: 'Session not found'
        });
        return;
      }

      // Verify session ownership
      if (session.userId.toString() !== userId) {
        res.status(403).json({
          status: 'error',
          message: 'You do not have permission to access this session'
        });
        return;
      }

      // Verify session is in progress
      if (session.status !== 'in-progress') {
        res.status(400).json({
          status: 'error',
          message: 'Session is not in progress'
        });
        return;
      }

      // Build conversation history for context
      const conversationHistory = session.questions.map((q: any) => [
        { role: 'interviewer' as const, content: q.question.text, timestamp: q.timestamp },
        { role: 'candidate' as const, content: q.answer, timestamp: q.timestamp }
      ]).flat();

      // ANTI-FREEZE: Evaluate answer with timeout protection
      console.log('🔄 Starting evaluation with anti-freeze protection...');
      const evaluationStartTime = Date.now();
      
      const evaluation = await geminiService.evaluateAnswer({
        question: question as Question,
        answer,
        conversationHistory
      });
      
      const evaluationDuration = Date.now() - evaluationStartTime;
      console.log(`✅ Evaluation completed in ${evaluationDuration}ms`);

      // Update topic performance tracking
      const sessionIdStr = String(session._id);
      const questionTopic = (question as Question).topic;
      if (questionTopic) {
        geminiService.updateTopicPerformance(sessionIdStr, questionTopic, evaluation.score);
      }

      // Simplified follow-up logic: Each evaluation generates its own follow-up based on the answer
      // No complex chains - just direct answer-based follow-ups

      // Add question with evaluation to session
      const questionData: ISessionQuestion = {
        question: question as Question,
        answer,
        evaluation,
        timeSpent,
        timestamp: new Date()
      };

      await session.addQuestion(questionData);

      // Emit evaluation result via Socket.io with emotion data
      const io = getSocketInstance();
      const sessionId = String(session._id);
      
      console.log('🎭 Emitting evaluation with emotions:', evaluation.sentiment.emotions);
      if (evaluation.emotionalResponse) {
        console.log('💝 Including emotional response:', evaluation.emotionalResponse);
      }
      
      emitEvaluationResult(io, sessionId, {
        questionId: question.id,
        score: evaluation.score,
        feedback: evaluation.feedback,
        strengths: evaluation.strengths,
        improvements: evaluation.improvements,
        appreciation: evaluation.appreciation, // Include appreciation message
        followUpQuestion: evaluation.followUpQuestion ? {
          questionId: evaluation.followUpQuestion.id,
          text: evaluation.followUpQuestion.text,
          category: evaluation.followUpQuestion.category,
          difficulty: evaluation.followUpQuestion.difficulty,
          timeLimit: evaluation.followUpQuestion.timeLimit
        } : undefined,
        sentiment: {
          overall: evaluation.sentiment.overall,
          confidence: evaluation.sentiment.confidence,
          clarity: evaluation.sentiment.clarity,
          professionalism: evaluation.sentiment.professionalism,
          tone: evaluation.sentiment.tone
        },
        emotions: evaluation.sentiment.emotions,
        emotionalResponse: evaluation.emotionalResponse,
        nextPhaseRecommendation: evaluation.nextPhaseRecommendation
      });

      // Calculate and emit score update
      const totalQuestions = session.questions.length;
      const totalScore = session.questions.reduce((sum: number, q: any) => sum + q.evaluation.score, 0);
      const currentScore = totalScore / totalQuestions;

      emitScoreUpdate(io, sessionId, {
        currentScore: Math.round(currentScore * 100) / 100,
        totalQuestions,
        answeredQuestions: totalQuestions
      });

      // Save session state for reconnection
      saveSessionState(userId, sessionId, {
        currentQuestionId: question.id,
        questionsAnswered: totalQuestions,
        currentScore
      });

      res.status(200).json({
        status: 'success',
        message: 'Answer submitted and evaluated successfully',
        data: {
          evaluation,
          sessionId: session._id
        }
      });
    } catch (error) {
      console.error('❌ Error submitting answer:', error);
      
      // ANTI-FREEZE: Emit fallback evaluation to prevent frontend from getting stuck
      const io = getSocketInstance();
      const sessionId = String(session._id);
      
      // ANTI-FREEZE: Only emit fallback if we have valid session and question data
      if (session && question) {
        console.log('🔄 Emitting fallback evaluation due to error');
        emitEvaluationResult(io, sessionId, {
          questionId: (question as Question).id,
          score: 50,
          feedback: 'There was a technical issue with evaluation. Let\'s continue with the next question.',
          strengths: ['Provided an answer despite technical difficulties'],
          improvements: ['System will retry evaluation in the next question'],
          appreciation: 'Thanks for your patience!',
          followUpQuestion: {
            questionId: `fallback_${Date.now()}`,
            text: 'Let\'s continue. Can you elaborate on your previous response?',
            category: (question as Question).category,
            difficulty: (question as Question).difficulty,
            timeLimit: 120
          },
          sentiment: {
            overall: 'neutral',
            confidence: 50,
            clarity: 50,
            professionalism: 70,
            tone: 'understanding'
          },
          emotions: {
            nervousness: 30,
            confidence: 50,
            hesitation: 20,
            excitement: 40,
            confusion: 10,
            stress: 20,
            enthusiasm: 50
          },
          nextPhaseRecommendation: 'continue-technical'
        });

        // Send error response but don't fail the request
        res.status(200).json({
          status: 'warning',
          message: 'Answer submitted with technical difficulties. Continuing interview.',
          data: {
            sessionId: session._id,
            fallbackUsed: true
          }
        });
      } else {
        // If we don't have session/question data, use standard error response
        _next(error);
      }
    }
  }

  /**
   * Complete an interview session
   * POST /api/sessions/:id/complete
   */
  async completeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { recordingUrl, transcriptUrl } = req.body;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          status: 'error',
          message: 'User not authenticated'
        });
        return;
      }

      // Find session
      const session = await Session.findById(id);

      if (!session) {
        res.status(404).json({
          status: 'error',
          message: 'Session not found'
        });
        return;
      }

      // Verify session ownership
      if (session.userId.toString() !== userId) {
        res.status(403).json({
          status: 'error',
          message: 'You do not have permission to access this session'
        });
        return;
      }

      // Verify session is in progress
      if (session.status !== 'in-progress') {
        res.status(400).json({
          status: 'error',
          message: 'Session is not in progress'
        });
        return;
      }

      // Store recording URLs if provided
      if (recordingUrl) {
        session.recordingUrl = recordingUrl;
      }
      if (transcriptUrl) {
        session.transcriptUrl = transcriptUrl;
      }

      // Generate performance report
      const performanceAnalyzer = new PerformanceAnalyzer();
      const performanceReport = await performanceAnalyzer.generateReport(session);

      // Complete session with report
      await session.complete(performanceReport);

      // Update user statistics
      const user = await User.findById(userId);
      if (user) {
        const totalSessions = user.profile.totalSessions + 1;
        const currentAverage = user.profile.averageScore;
        const newAverage = ((currentAverage * user.profile.totalSessions) + performanceReport.overallScore) / totalSessions;

        user.profile.totalSessions = totalSessions;
        user.profile.averageScore = Math.round(newAverage * 100) / 100; // Round to 2 decimal places
        await user.save();

        // Update leaderboard entry
        try {
          await leaderboardService.updateLeaderboardEntry(userId);
        } catch (error) {
          console.error('Error updating leaderboard:', error);
          // Don't fail the session completion if leaderboard update fails
        }
      }

      // Emit session completed event via Socket.io
      const io = getSocketInstance();
      const sessionId = String(session._id);
      emitSessionCompleted(io, sessionId, {
        sessionId,
        performanceReport
      });

      // Clear session state
      clearSessionState(userId);

      // Send success notification
      emitNotification(io, sessionId, {
        type: 'success',
        message: 'Interview completed! View your performance report.'
      });

      res.status(200).json({
        status: 'success',
        message: 'Session completed successfully',
        data: {
          session,
          performanceReport
        }
      });
    } catch (error) {
      console.error('Error completing session:', error);
      next(error);
    }
  }

  /**
   * Delete a session permanently
   * DELETE /api/sessions/:id
   */
  async deleteSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({ status: 'error', message: 'User not authenticated' });
        return;
      }

      const session = await Session.findById(id);

      if (!session) {
        res.status(404).json({ status: 'error', message: 'Session not found' });
        return;
      }

      if (session.userId.toString() !== userId) {
        res.status(403).json({ status: 'error', message: 'You do not have permission to delete this session' });
        return;
      }

      const deletedScore = session.performanceReport?.overallScore ?? null;
      const wasCompleted = session.status === 'completed';

      // Delete the session
      await Session.findByIdAndDelete(id);

      // Recalculate user stats from remaining completed sessions
      if (wasCompleted) {
        const remainingSessions = await Session.find({ userId, status: 'completed' });
        const totalSessions = remainingSessions.length;
        const averageScore = totalSessions > 0
          ? remainingSessions.reduce((sum, s) => sum + (s.performanceReport?.overallScore ?? 0), 0) / totalSessions
          : 0;

        await User.findByIdAndUpdate(userId, {
          'profile.totalSessions': totalSessions,
          'profile.averageScore': Math.round(averageScore * 100) / 100
        });

        // Refresh leaderboard entry
        try {
          await leaderboardService.updateLeaderboardEntry(userId);
        } catch (err) {
          console.warn('Leaderboard update after delete failed:', err);
        }
      }

      res.status(200).json({
        status: 'success',
        message: 'Session deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting session:', error);
      next(error);
    }
  }

  /**
   * Get a specific session by ID
   * GET /api/sessions/:id
   */
  async getSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          status: 'error',
          message: 'User not authenticated'
        });
        return;
      }

      // Find session
      const session = await Session.findById(id);

      if (!session) {
        res.status(404).json({
          status: 'error',
          message: 'Session not found'
        });
        return;
      }

      // Verify session ownership (or admin access)
      const user = await User.findById(userId);
      if (session.userId.toString() !== userId && user?.role !== 'admin') {
        res.status(403).json({
          status: 'error',
          message: 'You do not have permission to access this session'
        });
        return;
      }

      res.status(200).json({
        status: 'success',
        data: {
          session
        }
      });
    } catch (error) {
      console.error('Error getting session:', error);
      next(error);
    }
  }

  /**
   * Get all sessions for a user
   * GET /api/sessions/user/:userId
   */
  async getUserSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId: targetUserId } = req.params;
      const currentUserId = (req as any).user?.userId;

      if (!currentUserId) {
        res.status(401).json({
          status: 'error',
          message: 'User not authenticated'
        });
        return;
      }

      // Verify access (user can only view their own sessions, unless admin)
      const user = await User.findById(currentUserId);
      if (targetUserId !== currentUserId && user?.role !== 'admin') {
        res.status(403).json({
          status: 'error',
          message: 'You do not have permission to access these sessions'
        });
        return;
      }

      // Get query parameters for filtering
      const { status, jobRole, limit = '10', skip = '0' } = req.query;

      // Build query
      const query: any = { userId: targetUserId };
      if (status) {
        query.status = status;
      }
      if (jobRole) {
        query.jobRole = jobRole;
      }

      // Find sessions with pagination
      const sessions = await Session.find(query)
        .sort({ startTime: -1 })
        .limit(parseInt(limit as string))
        .skip(parseInt(skip as string));

      // Get total count for pagination
      const total = await Session.countDocuments(query);

      res.status(200).json({
        status: 'success',
        data: {
          sessions,
          pagination: {
            total,
            limit: parseInt(limit as string),
            skip: parseInt(skip as string),
            hasMore: total > parseInt(skip as string) + sessions.length
          }
        }
      });
    } catch (error) {
      console.error('Error getting user sessions:', error);
      next(error);
    }
  }

  /**
   * Delete the recording for a session (file + DB reference)
   * DELETE /api/sessions/:id/recording
   */
  async deleteRecording(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({ status: 'error', message: 'User not authenticated' });
        return;
      }

      const session = await Session.findById(id);
      if (!session) {
        res.status(404).json({ status: 'error', message: 'Session not found' });
        return;
      }

      if (session.userId.toString() !== userId) {
        res.status(403).json({ status: 'error', message: 'You do not have permission to modify this session' });
        return;
      }

      if (!session.recordingUrl) {
        res.status(404).json({ status: 'error', message: 'No recording found for this session' });
        return;
      }

      // Delete the physical file from disk
      try {
        await recordingService.deleteRecording(session.recordingUrl);
      } catch (fileErr) {
        console.warn('⚠️ Could not delete recording file (may already be gone):', fileErr);
      }

      // Clear the reference in MongoDB
      session.recordingUrl = undefined;
      await session.save();

      console.log(`✅ Recording deleted for session ${id}`);
      res.status(200).json({ status: 'success', message: 'Recording deleted successfully' });
    } catch (error) {
      console.error('Error deleting recording:', error);
      next(error);
    }
  }

  /**
   * Upload session recording
   * POST /api/sessions/:id/upload-recording
   * Accepts multipart/form-data with field "recording"
   */
  async uploadRecording(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({ status: 'error', message: 'User not authenticated' });
        return;
      }

      // Find session
      const session = await Session.findById(id);
      if (!session) {
        res.status(404).json({ status: 'error', message: 'Session not found' });
        return;
      }

      // Verify session ownership
      if (session.userId.toString() !== userId) {
        res.status(403).json({ status: 'error', message: 'You do not have permission to access this session' });
        return;
      }

      let recordingUrl: string;

      // ── Path A: multipart/form-data (preferred — no size limit issues) ──
      if ((req as any).file) {
        const file = (req as any).file as Express.Multer.File;
        console.log(`📹 Recording file received: ${file.filename}, size: ${(file.size / 1024 / 1024).toFixed(2)} MB, type: ${file.mimetype}`);

        if (file.size === 0) {
          res.status(400).json({ status: 'error', message: 'Recording file is empty' });
          return;
        }

        // File is already saved to disk by multer — just build the URL
        recordingUrl = `/uploads/recordings/${file.filename}`;
        console.log(`✅ Recording saved via multipart: ${recordingUrl}`);
      }
      // ── Path B: base64 JSON fallback ──
      else if (req.body?.recordingData) {
        const { recordingData, fileExtension = 'webm' } = req.body;
        console.log(`📹 Recording base64 received, extension: ${fileExtension}`);
        recordingUrl = await recordingService.saveRecordingFromBase64(recordingData, fileExtension, id);
        console.log(`✅ Recording saved via base64: ${recordingUrl}`);
      } else {
        res.status(400).json({ status: 'error', message: 'No recording data provided. Send multipart/form-data with field "recording".' });
        return;
      }

      // Persist URL to MongoDB
      session.recordingUrl = recordingUrl;
      await session.save();
      console.log(`✅ recordingUrl persisted to session ${id}: ${recordingUrl}`);

      res.status(200).json({
        status: 'success',
        message: 'Recording uploaded successfully',
        data: { recordingUrl }
      });
    } catch (error) {
      console.error('Error uploading recording:', error);
      next(error);
    }
  }

  /**
   * Upload session transcript
   * POST /api/sessions/:id/upload-transcript
   */
  async uploadTranscript(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { transcriptData } = req.body;
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          status: 'error',
          message: 'User not authenticated'
        });
        return;
      }

      if (!transcriptData) {
        res.status(400).json({
          status: 'error',
          message: 'Transcript data is required'
        });
        return;
      }

      // Find session
      const session = await Session.findById(id);

      if (!session) {
        res.status(404).json({
          status: 'error',
          message: 'Session not found'
        });
        return;
      }

      // Verify session ownership
      if (session.userId.toString() !== userId) {
        res.status(403).json({
          status: 'error',
          message: 'You do not have permission to access this session'
        });
        return;
      }

      // Save transcript (can be string or structured array)
      let transcriptUrl: string;
      if (typeof transcriptData === 'string') {
        transcriptUrl = await recordingService.saveTranscript(transcriptData, id);
      } else if (Array.isArray(transcriptData)) {
        transcriptUrl = await recordingService.saveStructuredTranscript(transcriptData, id);
      } else {
        res.status(400).json({
          status: 'error',
          message: 'Invalid transcript data format'
        });
        return;
      }

      // Update session
      session.transcriptUrl = transcriptUrl;
      await session.save();

      res.status(200).json({
        status: 'success',
        message: 'Transcript uploaded successfully',
        data: {
          transcriptUrl
        }
      });
    } catch (error) {
      console.error('Error uploading transcript:', error);
      next(error);
    }
  }
}

// Export singleton instance
export const sessionController = new SessionController();
export default sessionController;
