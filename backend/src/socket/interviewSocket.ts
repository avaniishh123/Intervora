import { Server as SocketIOServer, Namespace } from 'socket.io';
import { AuthenticatedSocket, socketAuthMiddleware } from './socketAuth';
import Session from '../models/Session';
import { geminiService } from '../services/geminiService';

/**
 * Interview-specific event interfaces
 */
export interface SessionStartData {
  sessionId: string;
}

export interface AnswerSubmitData {
  sessionId: string;
  questionId: string;
  answer: string;
  questionText?: string;
  questionCategory?: string;
  questionTopic?: string;
}

export interface SessionEndData {
  sessionId: string;
}

/**
 * Server event data interfaces
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
  performanceReport: any;
}

export interface NotificationData {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
}

/**
 * Active sessions tracking
 * Maps sessionId to socket IDs in that session
 */
const activeSessions = new Map<string, Set<string>>();

/**
 * Socket to session mapping
 * Maps socket ID to session ID for cleanup
 */
const socketToSession = new Map<string, string>();

/**
 * Initialize interview namespace with authentication
 */
export function initializeInterviewNamespace(io: SocketIOServer): Namespace {
  // Create /interview namespace
  const interviewNamespace = io.of('/interview');

  // Apply authentication middleware
  interviewNamespace.use(socketAuthMiddleware);

  // Connection handler
  interviewNamespace.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`📡 Interview socket connected: ${socket.id} (User: ${socket.user?.email})`);

    // Handle session start
    socket.on('session:start', (data: SessionStartData) => {
      handleSessionStart(socket, data);
    });

    // Handle answer submission
    socket.on('answer:submit', (data: AnswerSubmitData) => {
      handleAnswerSubmit(socket, data);
    });

    // Handle session end
    socket.on('session:end', (data: SessionEndData) => {
      handleSessionEnd(socket, data);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      handleDisconnect(socket);
    });

    // Handle errors
    socket.on('error', (error: Error) => {
      console.error(`❌ Socket error for ${socket.id}:`, error.message);
      socket.emit('notification', {
        type: 'error',
        message: 'Connection error occurred'
      } as NotificationData);
    });
  });

  return interviewNamespace;
}

/**
 * Generate and send the first question when session starts
 */
async function generateAndSendFirstQuestion(socket: AuthenticatedSocket, sessionId: string): Promise<void> {
  try {
    console.log(`🔍 Fetching session ${sessionId} for question generation...`);
    
    // Fetch the session to get interview mode and parameters
    const session = await Session.findById(sessionId);
    
    if (!session) {
      console.error(`❌ Session not found: ${sessionId}`);
      socket.emit('notification', {
        type: 'error',
        message: 'Session not found'
      } as NotificationData);
      return;
    }

    console.log(`📝 Session details:`, {
      id: sessionId,
      mode: session.mode,
      role: session.jobRole,
      hasJobDescription: !!session.metadata?.jobDescription,
      jdLength: session.metadata?.jobDescription?.length || 0
    });

    // Validate session data
    if (!session.jobRole || session.jobRole.trim().length === 0) {
      console.error('❌ Session has no job role');
      socket.emit('notification', {
        type: 'error',
        message: 'Invalid session: missing job role'
      } as NotificationData);
      return;
    }

    // For JD-based mode, ensure JD is present
    if (session.mode === 'jd-based' && (!session.metadata?.jobDescription || session.metadata.jobDescription.trim().length === 0)) {
      console.error('❌ JD-based mode but no job description found');
      socket.emit('notification', {
        type: 'error',
        message: 'Job description is required for JD-based interviews'
      } as NotificationData);
      return;
    }

    console.log(`📝 Generating questions for session ${sessionId} (mode: ${session.mode})`);

    // Generate questions using Gemini service
    let questions;
    try {
      // Extract resume analysis if available
      const resumeAnalysis = session.metadata?.resumeAnalysis;
      let resumeText = undefined;
      
      if (resumeAnalysis && session.mode === 'resume-based') {
        // Convert resume analysis to text format for question generation
        resumeText = `
Resume Analysis:
Skills: ${resumeAnalysis.skills?.join(', ') || 'Not specified'}
Strength Areas: ${resumeAnalysis.strengthAreas?.join(', ') || 'Not specified'}
Improvement Areas: ${resumeAnalysis.improvementAreas?.join(', ') || 'Not specified'}
        `.trim();
        console.log('📄 Using resume analysis for question generation');
      }

      const params = {
        role: session.jobRole,
        resume: resumeText,
        jobDescription: session.metadata?.jobDescription,
        difficulty: 'medium' as const,
        count: 5,
        sessionId: sessionId
      };

      console.log('📤 Calling geminiService.generateQuestions with params:', {
        role: params.role,
        hasResume: !!params.resume,
        hasJobDescription: !!params.jobDescription,
        jdLength: params.jobDescription?.length || 0,
        difficulty: params.difficulty,
        count: params.count
      });

      questions = await geminiService.generateQuestions(params);
      
      console.log(`✅ Question generation completed, received ${questions?.length || 0} questions`);
    } catch (error) {
      console.error('❌ Failed to generate questions:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      socket.emit('notification', {
        type: 'error',
        message: `Failed to generate questions: ${error instanceof Error ? error.message : 'Unknown error'}`
      } as NotificationData);
      return;
    }

    if (!questions || questions.length === 0) {
      console.error('❌ No questions generated - empty array returned');
      socket.emit('notification', {
        type: 'error',
        message: 'Failed to generate interview questions. Please try again or contact support.'
      } as NotificationData);
      return;
    }

    // Send the first question to the session
    const firstQuestion = questions[0];
    console.log('📤 Sending first question to client:', {
      id: firstQuestion.id,
      text: firstQuestion.text.substring(0, 60) + '...',
      category: firstQuestion.category,
      difficulty: firstQuestion.difficulty
    });

    socket.emit('question:new', {
      questionId: firstQuestion.id,
      text: firstQuestion.text,
      category: firstQuestion.category,
      difficulty: firstQuestion.difficulty,
      timeLimit: firstQuestion.timeLimit || 120
    });

    console.log(`✅ First question sent successfully for session ${sessionId}`);
  } catch (error) {
    console.error('❌ Error in generateAndSendFirstQuestion:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    socket.emit('notification', {
      type: 'error',
      message: 'Failed to initialize interview questions. Please try again.'
    } as NotificationData);
  }
}

/**
 * Handle session start event
 */
function handleSessionStart(socket: AuthenticatedSocket, data: SessionStartData): void {
  try {
    const { sessionId } = data;

    if (!sessionId) {
      socket.emit('notification', {
        type: 'error',
        message: 'Invalid session ID'
      } as NotificationData);
      return;
    }

    // Join session room
    socket.join(sessionId);
    console.log(`🎯 Socket ${socket.id} joined session room: ${sessionId}`);

    // Track active session
    if (!activeSessions.has(sessionId)) {
      activeSessions.set(sessionId, new Set());
    }
    activeSessions.get(sessionId)!.add(socket.id);
    socketToSession.set(socket.id, sessionId);

    // Confirm session start
    socket.emit('notification', {
      type: 'success',
      message: 'Connected to interview session'
    } as NotificationData);

    console.log(`✅ Session ${sessionId} started for user ${socket.user?.email}`);
    
    // Asynchronously generate and send the first question
    generateAndSendFirstQuestion(socket, sessionId);
  } catch (error) {
    console.error('Error handling session start:', error);
    socket.emit('notification', {
      type: 'error',
      message: 'Failed to start session'
    } as NotificationData);
  }
}

/**
 * Handle answer submission event
 */
async function handleAnswerSubmit(socket: AuthenticatedSocket, data: AnswerSubmitData): Promise<void> {
  try {
    const { sessionId, questionId, answer, questionText, questionCategory, questionTopic } = data;

    if (!sessionId || !questionId || !answer) {
      socket.emit('notification', {
        type: 'error',
        message: 'Invalid answer submission data'
      } as NotificationData);
      return;
    }

    console.log(`📝 Answer submitted for session ${sessionId}, question ${questionId}`);
    console.log(`📝 Answer content: ${answer.substring(0, 100)}...`);

    // Acknowledge receipt
    socket.emit('notification', {
      type: 'info',
      message: 'Answer received, evaluating...'
    } as NotificationData);

    // Get session data for context
    const session = await Session.findById(sessionId);
    if (!session) {
      socket.emit('notification', {
        type: 'error',
        message: 'Session not found'
      } as NotificationData);
      return;
    }

    // Check if session has reached question limit
    const totalQuestions = session.metadata?.totalQuestions || 20;
    const answeredQuestions = session.questions?.length || 0;
    const isLastQuestion = answeredQuestions + 1 >= totalQuestions;

    console.log(`📊 Progress: ${answeredQuestions + 1}/${totalQuestions} questions`);

    // Use Gemini service for evaluation and reasoning
    console.log('🤖 Calling Gemini service for answer evaluation...');

    try {
      // Build conversation history for context
      const conversationHistory = session.questions?.map((q: any) => [
        { role: 'interviewer' as const, content: q.question.text, timestamp: q.timestamp },
        { role: 'candidate' as const, content: q.answer, timestamp: q.timestamp }
      ]).flat() || [];

      // Create question object for evaluation
      const currentQuestion = {
        id: questionId,
        text: `Current interview question for ${session.jobRole}`,
        category: 'technical' as const,
        difficulty: 'medium' as const,
        expectedKeywords: [],
        timeLimit: 180
      };

      // Call Gemini service for evaluation
      const geminiEvaluation = await geminiService.evaluateAnswer({
        question: currentQuestion,
        answer,
        conversationHistory,
        sessionId // Pass session ID for topic tracking
      });

      console.log('✅ Gemini evaluation completed:', {
        score: geminiEvaluation.score,
        feedback: geminiEvaluation.feedback.substring(0, 100) + '...'
      });

      // Persist the Q&A to the database so the report has real data
      try {
        await Session.findByIdAndUpdate(sessionId, {
          $push: {
            questions: {
              question: {
                id: questionId,
                text: questionText || `Interview question for ${session.jobRole}`,
                category: (questionCategory || 'technical') as any,
                topic: questionTopic || 'General',
                difficulty: 'medium',
                expectedKeywords: [],
                timeLimit: 180
              },
              answer,
              evaluation: {
                score: geminiEvaluation.score,
                feedback: geminiEvaluation.feedback,
                strengths: geminiEvaluation.strengths || [],
                improvements: geminiEvaluation.improvements || [],
                sentiment: geminiEvaluation.sentiment || {
                  overall: 'neutral',
                  confidence: 60,
                  clarity: 60,
                  professionalism: 70
                }
              },
              timeSpent: 60,
              timestamp: new Date()
            }
          }
        });
        console.log('✅ Q&A persisted to database');
      } catch (dbErr) {
        console.warn('⚠️ Could not persist Q&A to DB:', dbErr);
      }

      // If this is the last question, don't generate follow-up
      if (isLastQuestion) {
        console.log('🏁 Last question reached, completing session...');

        // Emit evaluation result WITHOUT follow-up question
        socket.emit('evaluation:result', {
          questionId: questionId,
          score: geminiEvaluation.score,
          feedback: geminiEvaluation.feedback,
          strengths: geminiEvaluation.strengths || ['Provided response to the question'],
          improvements: geminiEvaluation.improvements || ['Continue with clear explanations'],
          appreciation: "That's all for this session. Thank you for attending. You will get to know your feedback very soon.",
          followUpQuestion: undefined, // No follow-up for last question
          sentiment: geminiEvaluation.sentiment || {
            overall: 'neutral',
            confidence: 60,
            clarity: 60,
            professionalism: 70,
            tone: 'engaged'
          },
          emotions: geminiEvaluation.sentiment?.emotions || {
            nervousness: 30,
            confidence: 60,
            hesitation: 30,
            excitement: 50,
            confusion: 20,
            stress: 30,
            enthusiasm: 60
          },
          emotionalResponse: geminiEvaluation.emotionalResponse,
          nextPhaseRecommendation: 'conclude-interview'
        } as EvaluationResultData);

        // Wait 3 seconds then emit session completed
        setTimeout(() => {
          socket.emit('session:completed', {
            sessionId: sessionId,
            performanceReport: {
              message: 'Interview completed successfully. Redirecting to results...'
            }
          } as SessionCompletedData);
        }, 3000);

        console.log('✅ Session completion sequence initiated');
      } else {
        // Normal evaluation with follow-up question
        socket.emit('evaluation:result', {
          questionId: questionId,
          score: geminiEvaluation.score,
          feedback: geminiEvaluation.feedback,
          strengths: geminiEvaluation.strengths || ['Provided response to the question'],
          improvements: geminiEvaluation.improvements || ['Continue with clear explanations'],
          appreciation: geminiEvaluation.appreciation || 'Thank you for your answer',
          followUpQuestion: geminiEvaluation.followUpQuestion ? {
            questionId: geminiEvaluation.followUpQuestion.id,
            text: geminiEvaluation.followUpQuestion.text,
            category: geminiEvaluation.followUpQuestion.category,
            difficulty: geminiEvaluation.followUpQuestion.difficulty,
            timeLimit: geminiEvaluation.followUpQuestion.timeLimit
          } : undefined,
          sentiment: geminiEvaluation.sentiment || {
            overall: 'neutral',
            confidence: 60,
            clarity: 60,
            professionalism: 70,
            tone: 'engaged'
          },
          emotions: geminiEvaluation.sentiment?.emotions || {
            nervousness: 30,
            confidence: 60,
            hesitation: 30,
            excitement: 50,
            confusion: 20,
            stress: 30,
            enthusiasm: 60
          },
          emotionalResponse: geminiEvaluation.emotionalResponse,
          nextPhaseRecommendation: geminiEvaluation.nextPhaseRecommendation || 'continue-technical'
        } as EvaluationResultData);

        console.log('✅ Gemini evaluation result sent to frontend');
      }

    } catch (geminiError) {
      console.error('❌ Gemini service error:', geminiError);

      // Fallback response if Gemini fails
      socket.emit('evaluation:result', {
        questionId: questionId,
        score: 50,
        feedback: 'Your answer has been received. Let\'s continue with the next question.',
        strengths: ['Provided a response'],
        improvements: ['Continue with detailed explanations'],
        appreciation: isLastQuestion ? "That's all for this session. Thank you for attending. You will get to know your feedback very soon." : 'Thank you for your answer',
        followUpQuestion: isLastQuestion ? undefined : {
          questionId: `fallback_${Date.now()}`,
          text: 'Can you tell me about your experience with problem-solving in your field?',
          category: 'technical',
          difficulty: 'medium',
          timeLimit: 180
        },
        sentiment: {
          overall: 'neutral',
          confidence: 50,
          clarity: 50,
          professionalism: 70,
          tone: 'engaged'
        },
        emotions: {
          nervousness: 40,
          confidence: 50,
          hesitation: 30,
          excitement: 50,
          confusion: 30,
          stress: 40,
          enthusiasm: 50
        },
        nextPhaseRecommendation: isLastQuestion ? 'conclude-interview' : 'continue-technical'
      } as EvaluationResultData);

      console.log('✅ Fallback evaluation result sent');

      if (isLastQuestion) {
        setTimeout(() => {
          socket.emit('session:completed', {
            sessionId: sessionId,
            performanceReport: {
              message: 'Interview completed successfully. Redirecting to results...'
            }
          } as SessionCompletedData);
        }, 3000);
      }
    }

  } catch (error) {
    console.error('Error handling answer submit:', error);
    socket.emit('notification', {
      type: 'error',
      message: 'Failed to submit answer'
    } as NotificationData);
  }
}


/**
 * Handle session end event
 */
function handleSessionEnd(socket: AuthenticatedSocket, data: SessionEndData): void {
  try {
    const { sessionId } = data;

    if (!sessionId) {
      socket.emit('notification', {
        type: 'error',
        message: 'Invalid session ID'
      } as NotificationData);
      return;
    }

    console.log(`🏁 Session ${sessionId} ended by user ${socket.user?.email}`);

    // Clean up session
    cleanupSession(socket, sessionId);

    // Acknowledge session end
    socket.emit('notification', {
      type: 'success',
      message: 'Session ended successfully'
    } as NotificationData);
  } catch (error) {
    console.error('Error handling session end:', error);
    socket.emit('notification', {
      type: 'error',
      message: 'Failed to end session'
    } as NotificationData);
  }
}

/**
 * Handle socket disconnection
 */
function handleDisconnect(socket: AuthenticatedSocket): void {
  console.log(`🔌 Interview socket disconnected: ${socket.id}`);

  // Get session ID for this socket
  const sessionId = socketToSession.get(socket.id);

  if (sessionId) {
    cleanupSession(socket, sessionId);
  }
}

/**
 * Clean up session data
 */
function cleanupSession(socket: AuthenticatedSocket, sessionId: string): void {
  // Remove socket from session tracking
  const sessionSockets = activeSessions.get(sessionId);
  if (sessionSockets) {
    sessionSockets.delete(socket.id);

    // If no more sockets in session, remove session
    if (sessionSockets.size === 0) {
      activeSessions.delete(sessionId);
      console.log(`🧹 Session ${sessionId} cleaned up (no active connections)`);
    }
  }

  // Remove socket to session mapping
  socketToSession.delete(socket.id);

  // Leave room
  socket.leave(sessionId);
}

/**
 * Emit new question to session
 */
export function emitNewQuestion(
  io: SocketIOServer,
  sessionId: string,
  questionData: QuestionNewData
): void {
  io.of('/interview').to(sessionId).emit('question:new', questionData);
  console.log(`📤 New question emitted to session ${sessionId}`);
}

/**
 * Emit evaluation result to session
 */
export function emitEvaluationResult(
  io: SocketIOServer,
  sessionId: string,
  evaluationData: EvaluationResultData
): void {
  io.of('/interview').to(sessionId).emit('evaluation:result', evaluationData);
  console.log(`📤 Evaluation result emitted to session ${sessionId}`);
}

/**
 * Emit score update to session
 */
export function emitScoreUpdate(
  io: SocketIOServer,
  sessionId: string,
  scoreData: ScoreUpdateData
): void {
  io.of('/interview').to(sessionId).emit('score:update', scoreData);
  console.log(`📤 Score update emitted to session ${sessionId}`);
}

/**
 * Emit session completed to session
 */
export function emitSessionCompleted(
  io: SocketIOServer,
  sessionId: string,
  completionData: SessionCompletedData
): void {
  io.of('/interview').to(sessionId).emit('session:completed', completionData);
  console.log(`📤 Session completed emitted to session ${sessionId}`);
}

/**
 * Emit notification to session
 */
export function emitNotification(
  io: SocketIOServer,
  sessionId: string,
  notification: NotificationData
): void {
  io.of('/interview').to(sessionId).emit('notification', notification);
}

/**
 * Get active sessions count
 */
export function getActiveSessionsCount(): number {
  return activeSessions.size;
}

/**
 * Get sockets in session
 */
export function getSessionSocketCount(sessionId: string): number {
  return activeSessions.get(sessionId)?.size || 0;
}



export default {
  initializeInterviewNamespace,
  emitNewQuestion,
  emitEvaluationResult,
  emitScoreUpdate,
  emitSessionCompleted,
  emitNotification,
  getActiveSessionsCount,
  getSessionSocketCount
};
