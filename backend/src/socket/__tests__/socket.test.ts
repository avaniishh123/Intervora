/**
 * Socket.io Integration Tests
 * Tests real-time communication, authentication, and session management
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import express from 'express';
import jwt from 'jsonwebtoken';

// Use require for socket.io-client due to CommonJS module issues
const ioClient = require('socket.io-client').io;
type ClientSocket = ReturnType<typeof ioClient>;
import {
  initializeInterviewNamespace,
  emitNewQuestion,
  emitEvaluationResult,
  emitScoreUpdate,
  emitSessionCompleted,
  emitNotification,
  getActiveSessionsCount,
  getSessionSocketCount,
  QuestionNewData,
  EvaluationResultData,
  ScoreUpdateData,
  SessionCompletedData,
  NotificationData
} from '../interviewSocket';
import { setSocketInstance } from '../socketInstance';

describe('Socket.io Communication Tests', () => {
  let httpServer: HTTPServer;
  let io: SocketIOServer;
  let serverPort: number;
  let clientSocket: ClientSocket;
  let clientSocket2: ClientSocket;
  let testToken: string;
  let testToken2: string;

  // Test user data
  const testUser = {
    userId: 'test-user-123',
    email: 'test@example.com',
    role: 'candidate'
  };

  const testUser2 = {
    userId: 'test-user-456',
    email: 'test2@example.com',
    role: 'candidate'
  };

  const testSessionId = 'test-session-123';
  const testSessionId2 = 'test-session-456';

  beforeAll((done) => {
    // Create Express app and HTTP server
    const app = express();
    httpServer = new HTTPServer(app);

    // Create Socket.io server
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    // Set socket instance for the application
    setSocketInstance(io);

    // Initialize interview namespace
    initializeInterviewNamespace(io);

    // Start server on random port
    httpServer.listen(() => {
      const address = httpServer.address();
      if (address && typeof address === 'object') {
        serverPort = address.port;
        console.log(`Test server listening on port ${serverPort}`);
        done();
      }
    });
  });

  afterAll((done) => {
    // Close all connections
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    if (clientSocket2 && clientSocket2.connected) {
      clientSocket2.disconnect();
    }

    // Close server
    io.close();
    httpServer.close(() => {
      done();
    });
  });

  beforeEach(() => {
    // Generate test JWT tokens
    testToken = jwt.sign(testUser, process.env.JWT_SECRET || 'test-secret', {
      expiresIn: '1h'
    });

    testToken2 = jwt.sign(testUser2, process.env.JWT_SECRET || 'test-secret', {
      expiresIn: '1h'
    });
  });

  afterEach(() => {
    // Disconnect clients after each test
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    if (clientSocket2 && clientSocket2.connected) {
      clientSocket2.disconnect();
    }
  });

  describe('Authentication', () => {
    it('should connect with valid JWT token', (done) => {
      clientSocket = ioClient(`http://localhost:${serverPort}/interview`, {
        auth: {
          token: testToken
        }
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', (error: Error) => {
        done(error);
      });
    });

    it('should reject connection without token', (done) => {
      clientSocket = ioClient(`http://localhost:${serverPort}/interview`);

      clientSocket.on('connect', () => {
        done(new Error('Should not connect without token'));
      });

      clientSocket.on('connect_error', (error: Error) => {
        expect(error.message).toContain('Authentication error');
        done();
      });
    });

    it('should reject connection with invalid token', (done) => {
      clientSocket = ioClient(`http://localhost:${serverPort}/interview`, {
        auth: {
          token: 'invalid-token'
        }
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect with invalid token'));
      });

      clientSocket.on('connect_error', (error: Error) => {
        expect(error.message).toContain('Authentication error');
        done();
      });
    });
  });

  describe('Real-time Question Delivery and Answer Submission', () => {
    beforeEach((done) => {
      clientSocket = ioClient(`http://localhost:${serverPort}/interview`, {
        auth: { token: testToken }
      });

      clientSocket.on('connect', () => {
        // Start session
        clientSocket.emit('session:start', { sessionId: testSessionId });
        
        // Wait for session start confirmation
        clientSocket.on('notification', (data: NotificationData) => {
          if (data.message.includes('Connected to interview session')) {
            done();
          }
        });
      });
    });

    it('should receive new question in real-time', (done) => {
      const questionData: QuestionNewData = {
        questionId: 'q1',
        text: 'What is your experience with TypeScript?',
        category: 'technical',
        difficulty: 'medium',
        timeLimit: 300
      };

      clientSocket.on('question:new', (data: QuestionNewData) => {
        expect(data.questionId).toBe(questionData.questionId);
        expect(data.text).toBe(questionData.text);
        expect(data.category).toBe(questionData.category);
        expect(data.difficulty).toBe(questionData.difficulty);
        expect(data.timeLimit).toBe(questionData.timeLimit);
        done();
      });

      // Emit question from server
      setTimeout(() => {
        emitNewQuestion(io, testSessionId, questionData);
      }, 100);
    });

    it('should submit answer and receive acknowledgment', (done) => {
      let sessionStarted = false;

      clientSocket.on('notification', (data: NotificationData) => {
        if (data.message.includes('Connected to interview session')) {
          sessionStarted = true;
          return;
        }
        
        // Check for answer received notification
        if (sessionStarted && data.message.includes('Answer received')) {
          expect(data.type).toBe('info');
          done();
        }
      });

      // Wait a bit for session to be fully started, then submit answer
      setTimeout(() => {
        clientSocket.emit('answer:submit', {
          sessionId: testSessionId,
          questionId: 'q1',
          answer: 'I have 3 years of experience with TypeScript...'
        });
      }, 100);
    });

    it('should receive evaluation result after answer submission', (done) => {
      const evaluationData: EvaluationResultData = {
        questionId: 'q1',
        score: 85,
        feedback: 'Good answer with specific examples',
        strengths: ['Clear communication', 'Relevant experience'],
        improvements: ['Could add more technical details'],
        sentiment: {
          overall: 'positive',
          confidence: 0.8,
          clarity: 0.9,
          professionalism: 0.85,
          tone: 'confident'
        }
      };

      clientSocket.on('evaluation:result', (data: EvaluationResultData) => {
        expect(data.questionId).toBe(evaluationData.questionId);
        expect(data.score).toBe(evaluationData.score);
        expect(data.feedback).toBe(evaluationData.feedback);
        expect(data.strengths).toEqual(evaluationData.strengths);
        expect(data.improvements).toEqual(evaluationData.improvements);
        expect(data.sentiment.overall).toBe(evaluationData.sentiment.overall);
        done();
      });

      // Emit evaluation result from server
      setTimeout(() => {
        emitEvaluationResult(io, testSessionId, evaluationData);
      }, 100);
    });
  });

  describe('Score Updates Broadcast', () => {
    beforeEach((done) => {
      clientSocket = ioClient(`http://localhost:${serverPort}/interview`, {
        auth: { token: testToken }
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('session:start', { sessionId: testSessionId });
        
        clientSocket.on('notification', (data: NotificationData) => {
          if (data.message.includes('Connected to interview session')) {
            done();
          }
        });
      });
    });

    it('should broadcast score updates correctly', (done) => {
      const scoreData: ScoreUpdateData = {
        currentScore: 85,
        totalQuestions: 10,
        answeredQuestions: 3
      };

      clientSocket.on('score:update', (data: ScoreUpdateData) => {
        expect(data.currentScore).toBe(scoreData.currentScore);
        expect(data.totalQuestions).toBe(scoreData.totalQuestions);
        expect(data.answeredQuestions).toBe(scoreData.answeredQuestions);
        done();
      });

      // Emit score update from server
      setTimeout(() => {
        emitScoreUpdate(io, testSessionId, scoreData);
      }, 100);
    });

    it('should receive multiple score updates in sequence', (done) => {
      const scoreUpdates: ScoreUpdateData[] = [
        { currentScore: 70, totalQuestions: 10, answeredQuestions: 1 },
        { currentScore: 75, totalQuestions: 10, answeredQuestions: 2 },
        { currentScore: 80, totalQuestions: 10, answeredQuestions: 3 }
      ];

      let updateCount = 0;

      clientSocket.on('score:update', (data: ScoreUpdateData) => {
        expect(data).toEqual(scoreUpdates[updateCount]);
        updateCount++;

        if (updateCount === scoreUpdates.length) {
          done();
        }
      });

      // Emit score updates sequentially
      setTimeout(() => {
        scoreUpdates.forEach((update, index) => {
          setTimeout(() => {
            emitScoreUpdate(io, testSessionId, update);
          }, index * 100);
        });
      }, 100);
    });
  });

  describe('Multiple Concurrent Sessions in Separate Rooms', () => {
    it('should handle multiple sessions independently', (done) => {
      let session1Connected = false;
      let session2Connected = false;
      let session1ReceivedQuestion = false;
      let session2ReceivedQuestion = false;

      // Connect first client
      clientSocket = ioClient(`http://localhost:${serverPort}/interview`, {
        auth: { token: testToken }
      });

      // Connect second client
      clientSocket2 = ioClient(`http://localhost:${serverPort}/interview`, {
        auth: { token: testToken2 }
      });

      // Setup first client
      clientSocket.on('connect', () => {
        clientSocket.emit('session:start', { sessionId: testSessionId });
      });

      clientSocket.on('notification', (data: NotificationData) => {
        if (data.message.includes('Connected to interview session')) {
          session1Connected = true;
          checkCompletion();
        }
      });

      clientSocket.on('question:new', (data: QuestionNewData) => {
        expect(data.questionId).toBe('q1-session1');
        session1ReceivedQuestion = true;
        checkCompletion();
      });

      // Setup second client
      clientSocket2.on('connect', () => {
        clientSocket2.emit('session:start', { sessionId: testSessionId2 });
      });

      clientSocket2.on('notification', (data: NotificationData) => {
        if (data.message.includes('Connected to interview session')) {
          session2Connected = true;
          checkCompletion();
        }
      });

      clientSocket2.on('question:new', (data: QuestionNewData) => {
        expect(data.questionId).toBe('q1-session2');
        session2ReceivedQuestion = true;
        checkCompletion();
      });

      function checkCompletion() {
        if (session1Connected && session2Connected && !session1ReceivedQuestion && !session2ReceivedQuestion) {
          // Both sessions connected, emit different questions
          emitNewQuestion(io, testSessionId, {
            questionId: 'q1-session1',
            text: 'Question for session 1',
            category: 'technical',
            difficulty: 'medium',
            timeLimit: 300
          });

          emitNewQuestion(io, testSessionId2, {
            questionId: 'q1-session2',
            text: 'Question for session 2',
            category: 'behavioral',
            difficulty: 'easy',
            timeLimit: 180
          });
        }

        if (session1ReceivedQuestion && session2ReceivedQuestion) {
          done();
        }
      }
    });

    it('should track active sessions correctly', (done) => {
      clientSocket = ioClient(`http://localhost:${serverPort}/interview`, {
        auth: { token: testToken }
      });

      clientSocket2 = ioClient(`http://localhost:${serverPort}/interview`, {
        auth: { token: testToken2 }
      });

      let connectedCount = 0;

      const checkConnections = () => {
        connectedCount++;
        if (connectedCount === 2) {
          // Both clients connected and started sessions
          setTimeout(() => {
            const activeCount = getActiveSessionsCount();
            expect(activeCount).toBeGreaterThanOrEqual(2);
            
            const session1Count = getSessionSocketCount(testSessionId);
            const session2Count = getSessionSocketCount(testSessionId2);
            
            expect(session1Count).toBe(1);
            expect(session2Count).toBe(1);
            
            done();
          }, 200);
        }
      };

      clientSocket.on('connect', () => {
        clientSocket.emit('session:start', { sessionId: testSessionId });
        clientSocket.on('notification', (data: NotificationData) => {
          if (data.message.includes('Connected to interview session')) {
            checkConnections();
          }
        });
      });

      clientSocket2.on('connect', () => {
        clientSocket2.emit('session:start', { sessionId: testSessionId2 });
        clientSocket2.on('notification', (data: NotificationData) => {
          if (data.message.includes('Connected to interview session')) {
            checkConnections();
          }
        });
      });
    });
  });

  describe('Reconnection After Network Interruption', () => {
    it('should reconnect successfully after disconnection', (done) => {
      clientSocket = ioClient(`http://localhost:${serverPort}/interview`, {
        auth: { token: testToken },
        reconnection: true,
        reconnectionDelay: 100,
        reconnectionAttempts: 3
      });

      let initialConnectionId: string;
      let reconnected = false;
      let disconnected = false;

      clientSocket.on('connect', () => {
        if (!initialConnectionId) {
          // First connection
          initialConnectionId = clientSocket.id;
          clientSocket.emit('session:start', { sessionId: testSessionId });

          // Simulate network interruption after session start
          setTimeout(() => {
            disconnected = true;
            clientSocket.disconnect();
          }, 300);
        } else if (disconnected && !reconnected) {
          // Reconnected
          reconnected = true;
          expect(clientSocket.connected).toBe(true);
          expect(clientSocket.id).not.toBe(initialConnectionId); // New socket ID after reconnection
          done();
        }
      });

      clientSocket.on('disconnect', () => {
        // Socket.io will automatically attempt to reconnect
        if (disconnected && !reconnected) {
          // Wait a bit before checking reconnection
          setTimeout(() => {
            if (!reconnected) {
              done(new Error('Failed to reconnect'));
            }
          }, 2000);
        }
      });
    });

    it('should handle reconnection with automatic rejoin', (done) => {
      clientSocket = ioClient(`http://localhost:${serverPort}/interview`, {
        auth: { token: testToken },
        reconnection: true,
        reconnectionDelay: 100
      });

      let disconnected = false;
      let reconnected = false;

      clientSocket.on('connect', () => {
        if (!disconnected) {
          // Initial connection
          clientSocket.emit('session:start', { sessionId: testSessionId });

          clientSocket.on('notification', (data: NotificationData) => {
            if (data.message.includes('Connected to interview session') && !disconnected) {
              // Disconnect after session start
              setTimeout(() => {
                disconnected = true;
                clientSocket.disconnect();
                
                // Reconnect manually
                setTimeout(() => {
                  clientSocket.connect();
                }, 200);
              }, 200);
            }
          });
        } else if (!reconnected) {
          // After reconnection, rejoin session
          reconnected = true;
          clientSocket.emit('session:start', { sessionId: testSessionId });

          clientSocket.on('notification', (data: NotificationData) => {
            if (data.message.includes('Connected to interview session')) {
              // Successfully rejoined
              expect(clientSocket.connected).toBe(true);
              done();
            }
          });
        }
      });
    });

    it('should receive messages after reconnection', (done) => {
      clientSocket = ioClient(`http://localhost:${serverPort}/interview`, {
        auth: { token: testToken },
        reconnection: true,
        reconnectionDelay: 100
      });

      let disconnected = false;
      let reconnected = false;

      clientSocket.on('connect', () => {
        if (!disconnected) {
          clientSocket.emit('session:start', { sessionId: testSessionId });

          clientSocket.on('notification', (data: NotificationData) => {
            if (data.message.includes('Connected to interview session') && !disconnected) {
              setTimeout(() => {
                disconnected = true;
                clientSocket.disconnect();
                setTimeout(() => clientSocket.connect(), 200);
              }, 200);
            }
          });
        } else if (!reconnected) {
          reconnected = true;
          clientSocket.emit('session:start', { sessionId: testSessionId });

          // Listen for question after reconnection
          clientSocket.on('question:new', (data: QuestionNewData) => {
            expect(data.questionId).toBe('q-after-reconnect');
            expect(clientSocket.connected).toBe(true);
            done();
          });

          // Emit question after reconnection
          setTimeout(() => {
            emitNewQuestion(io, testSessionId, {
              questionId: 'q-after-reconnect',
              text: 'Question after reconnection',
              category: 'technical',
              difficulty: 'medium',
              timeLimit: 300
            });
          }, 300);
        }
      });
    });
  });

  describe('Session Completion', () => {
    beforeEach((done) => {
      clientSocket = ioClient(`http://localhost:${serverPort}/interview`, {
        auth: { token: testToken }
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('session:start', { sessionId: testSessionId });
        
        clientSocket.on('notification', (data: NotificationData) => {
          if (data.message.includes('Connected to interview session')) {
            done();
          }
        });
      });
    });

    it('should receive session completed event', (done) => {
      const completionData: SessionCompletedData = {
        sessionId: testSessionId,
        performanceReport: {
          overallScore: 85,
          categoryScores: {
            technical: 90,
            behavioral: 80,
            communication: 85
          },
          strengths: ['Clear communication', 'Technical knowledge'],
          weaknesses: ['Could provide more examples'],
          recommendations: ['Practice behavioral questions']
        }
      };

      clientSocket.on('session:completed', (data: SessionCompletedData) => {
        expect(data.sessionId).toBe(completionData.sessionId);
        expect(data.performanceReport.overallScore).toBe(85);
        expect(data.performanceReport.categoryScores.technical).toBe(90);
        done();
      });

      setTimeout(() => {
        emitSessionCompleted(io, testSessionId, completionData);
      }, 100);
    });

    it('should handle session end event', (done) => {
      let sessionStarted = false;

      clientSocket.on('notification', (data: NotificationData) => {
        if (data.message.includes('Connected to interview session')) {
          sessionStarted = true;
          return;
        }
        
        // Check for session end notification
        if (sessionStarted && data.message.includes('Session ended successfully')) {
          expect(data.type).toBe('success');
          done();
        }
      });

      // Wait for session to be fully started before ending it
      setTimeout(() => {
        clientSocket.emit('session:end', { sessionId: testSessionId });
      }, 100);
    });
  });

  describe('Error Handling', () => {
    beforeEach((done) => {
      clientSocket = ioClient(`http://localhost:${serverPort}/interview`, {
        auth: { token: testToken }
      });

      clientSocket.on('connect', done);
    });

    it('should handle invalid session start', (done) => {
      clientSocket.on('notification', (data: NotificationData) => {
        if (data.type === 'error' && data.message.includes('Invalid session ID')) {
          done();
        }
      });

      clientSocket.emit('session:start', { sessionId: '' });
    });

    it('should handle invalid answer submission', (done) => {
      clientSocket.emit('session:start', { sessionId: testSessionId });

      let sessionStarted = false;

      clientSocket.on('notification', (data: NotificationData) => {
        if (data.message.includes('Connected to interview session')) {
          sessionStarted = true;
          // Submit invalid answer
          clientSocket.emit('answer:submit', {
            sessionId: testSessionId,
            questionId: '',
            answer: ''
          });
        } else if (sessionStarted && data.type === 'error' && data.message.includes('Invalid answer submission')) {
          done();
        }
      });
    });
  });

  describe('Notifications', () => {
    beforeEach((done) => {
      clientSocket = ioClient(`http://localhost:${serverPort}/interview`, {
        auth: { token: testToken }
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('session:start', { sessionId: testSessionId });
        
        clientSocket.on('notification', (data: NotificationData) => {
          if (data.message.includes('Connected to interview session')) {
            done();
          }
        });
      });
    });

    it('should receive custom notifications', (done) => {
      const notification: NotificationData = {
        type: 'info',
        message: 'Custom test notification'
      };

      let sessionStarted = false;

      clientSocket.on('notification', (data: NotificationData) => {
        if (data.message.includes('Connected to interview session')) {
          sessionStarted = true;
          return;
        }
        
        if (sessionStarted && data.message === notification.message) {
          expect(data.type).toBe(notification.type);
          done();
        }
      });

      // Wait for session to be fully started before sending notification
      setTimeout(() => {
        emitNotification(io, testSessionId, notification);
      }, 200);
    });
  });
});
