/**
 * SessionController Integration Tests
 * Tests complete session lifecycle, performance report generation, and user statistics
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import Session from '../../models/Session';
import User from '../../models/User';
import sessionRoutes from '../../routes/sessionRoutes';

// Mock Gemini service
jest.mock('../../services/geminiService', () => ({
  geminiService: {
    evaluateAnswer: jest.fn().mockResolvedValue({
      score: 85,
      feedback: 'Good answer with clear examples',
      strengths: ['Clear communication', 'Relevant experience'],
      improvements: ['Could add more technical details'],
      sentiment: {
        overall: 'positive',
        confidence: 80,
        clarity: 85,
        professionalism: 90
      }
    }),
    getProModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            strengths: ['Strong technical knowledge', 'Clear communication'],
            weaknesses: ['Could provide more examples'],
            recommendations: ['Practice behavioral questions', 'Add more specific examples']
          })
        }
      })
    }),
    getFlashModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => '75'
        }
      })
    }),
    callWithRetry: jest.fn().mockImplementation(async (fn) => await fn())
  }
}));

// Mock Socket.io
jest.mock('../../socket', () => ({
  emitEvaluationResult: jest.fn(),
  emitScoreUpdate: jest.fn(),
  emitSessionCompleted: jest.fn(),
  emitNotification: jest.fn(),
  saveSessionState: jest.fn(),
  clearSessionState: jest.fn()
}));

// Mock socket instance
jest.mock('../../socket/socketInstance', () => ({
  getSocketInstance: jest.fn().mockReturnValue({})
}));

describe('SessionController Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let app: Express;
  let testUser: any;
  let testToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/sessions', sessionRoutes);

    console.log('✅ Test database connected');
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    console.log('✅ Test database disconnected');
  });

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await Session.deleteMany({});

    // Create test user
    testUser = await User.create({
      email: 'test@example.com',
      passwordHash: 'hashed_password',
      role: 'candidate',
      profile: {
        name: 'Test User',
        totalSessions: 0,
        averageScore: 0
      }
    });

    testUserId = testUser._id.toString();

    // Generate JWT token
    testToken = jwt.sign(
      { id: testUserId, email: testUser.email, role: testUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('Complete Session Lifecycle', () => {
    it('should complete full session lifecycle from start to completion', async () => {
      // Step 1: Start session
      const startResponse = await request(app)
        .post('/api/sessions/start')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          jobRole: 'Software Engineer',
          mode: 'general',
          mentorModeEnabled: false
        });

      expect(startResponse.status).toBe(201);
      expect(startResponse.body.status).toBe('success');
      expect(startResponse.body.data.session).toBeDefined();
      expect(startResponse.body.data.session.status).toBe('in-progress');

      const sessionId = startResponse.body.data.session._id;

      // Step 2: Submit first answer
      const answer1Response = await request(app)
        .post(`/api/sessions/${sessionId}/submit-answer`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          question: {
            id: 'q1',
            text: 'What is your experience with TypeScript?',
            category: 'technical',
            difficulty: 'medium',
            expectedKeywords: ['typescript', 'types'],
            timeLimit: 300
          },
          answer: 'I have 3 years of experience with TypeScript in production environments.',
          timeSpent: 120
        });

      expect(answer1Response.status).toBe(200);
      expect(answer1Response.body.data.evaluation).toBeDefined();
      expect(answer1Response.body.data.evaluation.score).toBe(85);

      // Step 3: Submit second answer
      const answer2Response = await request(app)
        .post(`/api/sessions/${sessionId}/submit-answer`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          question: {
            id: 'q2',
            text: 'Describe a challenging project you worked on',
            category: 'behavioral',
            difficulty: 'medium',
            expectedKeywords: ['challenge', 'solution'],
            timeLimit: 300
          },
          answer: 'I worked on a microservices migration project that required careful planning.',
          timeSpent: 150
        });

      expect(answer2Response.status).toBe(200);

      // Step 4: Complete session
      const completeResponse = await request(app)
        .post(`/api/sessions/${sessionId}/complete`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      expect(completeResponse.status).toBe(200);
      expect(completeResponse.body.status).toBe('success');
      expect(completeResponse.body.data.session.status).toBe('completed');
      expect(completeResponse.body.data.performanceReport).toBeDefined();

      // Step 5: Verify session is retrievable
      const getResponse = await request(app)
        .get(`/api/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.data.session.status).toBe('completed');
      expect(getResponse.body.data.session.questions).toHaveLength(2);
    });

    it('should handle session with mentor mode enabled', async () => {
      // Start session with mentor mode
      const startResponse = await request(app)
        .post('/api/sessions/start')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          jobRole: 'Product Manager',
          mode: 'general',
          mentorModeEnabled: true
        });

      expect(startResponse.status).toBe(201);
      const sessionId = startResponse.body.data.session._id;

      // Submit behavioral answer
      await request(app)
        .post(`/api/sessions/${sessionId}/submit-answer`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          question: {
            id: 'q1',
            text: 'Tell me about a time you led a team',
            category: 'behavioral',
            difficulty: 'medium',
            expectedKeywords: ['leadership', 'team'],
            timeLimit: 300
          },
          answer: 'Context: I led a team of 5 developers. Action: I implemented agile practices. Result: We delivered 20% faster.',
          timeSpent: 180
        });

      // Complete session
      const completeResponse = await request(app)
        .post(`/api/sessions/${sessionId}/complete`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      expect(completeResponse.status).toBe(200);
      expect(completeResponse.body.data.performanceReport.carFrameworkScore).toBeDefined();
      expect(completeResponse.body.data.performanceReport.carFrameworkScore).toBe(75);
    });
  });

  describe('Performance Report Generation', () => {
    it('should generate comprehensive performance report with sample session data', async () => {
      // Create session with multiple questions
      const session = await Session.create({
        userId: testUserId,
        jobRole: 'Full Stack Developer',
        mode: 'resume-based',
        status: 'in-progress',
        startTime: new Date(),
        questions: [
          {
            question: {
              id: 'q1',
              text: 'Explain REST API design',
              category: 'technical',
              difficulty: 'medium',
              expectedKeywords: ['REST', 'HTTP'],
              timeLimit: 300
            },
            answer: 'REST APIs use HTTP methods for CRUD operations with stateless communication.',
            evaluation: {
              score: 90,
              feedback: 'Excellent understanding',
              strengths: ['Clear explanation', 'Correct terminology'],
              improvements: [],
              sentiment: {
                overall: 'positive',
                confidence: 85,
                clarity: 90,
                professionalism: 88
              }
            },
            timeSpent: 120,
            timestamp: new Date()
          },
          {
            question: {
              id: 'q2',
              text: 'Describe your leadership style',
              category: 'behavioral',
              difficulty: 'medium',
              expectedKeywords: ['leadership', 'team'],
              timeLimit: 300
            },
            answer: 'I believe in servant leadership, empowering team members to make decisions.',
            evaluation: {
              score: 80,
              feedback: 'Good answer',
              strengths: ['Clear philosophy'],
              improvements: ['Add specific examples'],
              sentiment: {
                overall: 'positive',
                confidence: 75,
                clarity: 80,
                professionalism: 85
              }
            },
            timeSpent: 150,
            timestamp: new Date()
          }
        ],
        metadata: {
          mentorModeEnabled: false
        }
      });

      // Complete session
      const completeResponse = await request(app)
        .post(`/api/sessions/${session._id}/complete`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      expect(completeResponse.status).toBe(200);

      const report = completeResponse.body.data.performanceReport;

      // Verify report structure
      expect(report.overallScore).toBeDefined();
      expect(report.overallScore).toBe(85); // Average of 90 and 80

      expect(report.categoryScores).toBeDefined();
      expect(report.categoryScores.technical).toBe(90);
      expect(report.categoryScores.behavioral).toBe(80);
      expect(report.categoryScores.communication).toBeGreaterThan(0);

      expect(report.wordCountMetrics).toBeDefined();
      expect(report.wordCountMetrics.total).toBeGreaterThan(0);
      expect(report.wordCountMetrics.average).toBeGreaterThan(0);
      expect(report.wordCountMetrics.perQuestion).toHaveLength(2);

      expect(report.sentimentAnalysis).toBeDefined();
      expect(report.sentimentAnalysis.overall).toBe('positive');
      expect(report.sentimentAnalysis.confidence).toBeGreaterThan(0);
      expect(report.sentimentAnalysis.clarity).toBeGreaterThan(0);

      expect(report.strengths).toBeDefined();
      expect(Array.isArray(report.strengths)).toBe(true);

      expect(report.weaknesses).toBeDefined();
      expect(Array.isArray(report.weaknesses)).toBe(true);

      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    it('should calculate correct category scores for mixed question types', async () => {
      const session = await Session.create({
        userId: testUserId,
        jobRole: 'DevOps Engineer',
        mode: 'general',
        status: 'in-progress',
        questions: [
          {
            question: { id: 'q1', text: 'Q1', category: 'technical', difficulty: 'hard', expectedKeywords: [], timeLimit: 300 },
            answer: 'Answer 1',
            evaluation: { score: 95, feedback: 'Great', strengths: [], improvements: [], sentiment: { overall: 'positive', confidence: 90, clarity: 95, professionalism: 92 } },
            timeSpent: 100,
            timestamp: new Date()
          },
          {
            question: { id: 'q2', text: 'Q2', category: 'coding', difficulty: 'hard', expectedKeywords: [], timeLimit: 600 },
            answer: 'Answer 2',
            evaluation: { score: 85, feedback: 'Good', strengths: [], improvements: [], sentiment: { overall: 'positive', confidence: 80, clarity: 85, professionalism: 88 } },
            timeSpent: 200,
            timestamp: new Date()
          },
          {
            question: { id: 'q3', text: 'Q3', category: 'behavioral', difficulty: 'medium', expectedKeywords: [], timeLimit: 300 },
            answer: 'Answer 3',
            evaluation: { score: 75, feedback: 'Okay', strengths: [], improvements: [], sentiment: { overall: 'neutral', confidence: 70, clarity: 75, professionalism: 80 } },
            timeSpent: 150,
            timestamp: new Date()
          }
        ],
        metadata: { mentorModeEnabled: false }
      });

      const completeResponse = await request(app)
        .post(`/api/sessions/${session._id}/complete`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      const report = completeResponse.body.data.performanceReport;

      // Technical score should be average of technical (95) and coding (85) = 90
      expect(report.categoryScores.technical).toBe(90);

      // Behavioral score should be 75
      expect(report.categoryScores.behavioral).toBe(75);
    });
  });

  describe('Session Retrieval and Filtering', () => {
    beforeEach(async () => {
      // Create multiple sessions for testing
      await Session.create([
        {
          userId: testUserId,
          jobRole: 'Frontend Developer',
          mode: 'resume-based',
          status: 'completed',
          startTime: new Date('2024-01-01'),
          endTime: new Date('2024-01-01'),
          questions: [],
          metadata: { mentorModeEnabled: false }
        },
        {
          userId: testUserId,
          jobRole: 'Backend Developer',
          mode: 'jd-based',
          status: 'completed',
          startTime: new Date('2024-01-02'),
          endTime: new Date('2024-01-02'),
          questions: [],
          metadata: { mentorModeEnabled: false }
        },
        {
          userId: testUserId,
          jobRole: 'Full Stack Developer',
          mode: 'general',
          status: 'in-progress',
          startTime: new Date('2024-01-03'),
          questions: [],
          metadata: { mentorModeEnabled: true }
        }
      ]);
    });

    it('should retrieve all user sessions', async () => {
      const response = await request(app)
        .get(`/api/sessions/user/${testUserId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.sessions).toHaveLength(3);
      expect(response.body.data.pagination.total).toBe(3);
    });

    it('should filter sessions by status', async () => {
      const response = await request(app)
        .get(`/api/sessions/user/${testUserId}?status=completed`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.sessions).toHaveLength(2);
      expect(response.body.data.sessions.every((s: any) => s.status === 'completed')).toBe(true);
    });

    it('should filter sessions by job role', async () => {
      const response = await request(app)
        .get(`/api/sessions/user/${testUserId}?jobRole=Frontend Developer`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.sessions).toHaveLength(1);
      expect(response.body.data.sessions[0].jobRole).toBe('Frontend Developer');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get(`/api/sessions/user/${testUserId}?limit=2&skip=0`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.sessions).toHaveLength(2);
      expect(response.body.data.pagination.hasMore).toBe(true);
    });

    it('should retrieve specific session by ID', async () => {
      const sessions = await Session.find({ userId: testUserId });
      const sessionId = String(sessions[0]._id);

      const response = await request(app)
        .get(`/api/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.session._id).toBe(sessionId);
    });

    it('should deny access to other users sessions', async () => {
      // Create another user
      const otherUser = await User.create({
        email: 'other@example.com',
        passwordHash: 'hashed',
        role: 'candidate',
        profile: { name: 'Other User', totalSessions: 0, averageScore: 0 }
      });

      const otherToken = jwt.sign(
        { id: String(otherUser._id), email: otherUser.email, role: otherUser.role },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get(`/api/sessions/user/${testUserId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('User Statistics Update', () => {
    it('should update user statistics correctly after session completion', async () => {
      // Verify initial stats
      let user = await User.findById(testUserId);
      expect(user?.profile.totalSessions).toBe(0);
      expect(user?.profile.averageScore).toBe(0);

      // Complete first session with score 80
      const session1 = await Session.create({
        userId: testUserId,
        jobRole: 'Developer',
        mode: 'general',
        status: 'in-progress',
        questions: [
          {
            question: { id: 'q1', text: 'Q1', category: 'technical', difficulty: 'medium', expectedKeywords: [], timeLimit: 300 },
            answer: 'A1',
            evaluation: { score: 80, feedback: 'Good', strengths: [], improvements: [], sentiment: { overall: 'positive', confidence: 80, clarity: 80, professionalism: 80 } },
            timeSpent: 100,
            timestamp: new Date()
          }
        ],
        metadata: { mentorModeEnabled: false }
      });

      await request(app)
        .post(`/api/sessions/${session1._id}/complete`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      // Check updated stats
      user = await User.findById(testUserId);
      expect(user?.profile.totalSessions).toBe(1);
      expect(user?.profile.averageScore).toBe(80);

      // Complete second session with score 90
      const session2 = await Session.create({
        userId: testUserId,
        jobRole: 'Developer',
        mode: 'general',
        status: 'in-progress',
        questions: [
          {
            question: { id: 'q1', text: 'Q1', category: 'technical', difficulty: 'medium', expectedKeywords: [], timeLimit: 300 },
            answer: 'A1',
            evaluation: { score: 90, feedback: 'Great', strengths: [], improvements: [], sentiment: { overall: 'positive', confidence: 90, clarity: 90, professionalism: 90 } },
            timeSpent: 100,
            timestamp: new Date()
          }
        ],
        metadata: { mentorModeEnabled: false }
      });

      await request(app)
        .post(`/api/sessions/${session2._id}/complete`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      // Check updated stats - average should be (80 + 90) / 2 = 85
      user = await User.findById(testUserId);
      expect(user?.profile.totalSessions).toBe(2);
      expect(user?.profile.averageScore).toBe(85);
    });

    it('should handle multiple session completions correctly', async () => {
      const scores = [70, 80, 90, 85, 75];

      for (const score of scores) {
        const session = await Session.create({
          userId: testUserId,
          jobRole: 'Developer',
          mode: 'general',
          status: 'in-progress',
          questions: [
            {
              question: { id: 'q1', text: 'Q1', category: 'technical', difficulty: 'medium', expectedKeywords: [], timeLimit: 300 },
              answer: 'A1',
              evaluation: { score, feedback: 'Feedback', strengths: [], improvements: [], sentiment: { overall: 'positive', confidence: score, clarity: score, professionalism: score } },
              timeSpent: 100,
              timestamp: new Date()
            }
          ],
          metadata: { mentorModeEnabled: false }
        });

        await request(app)
          .post(`/api/sessions/${session._id}/complete`)
          .set('Authorization', `Bearer ${testToken}`)
          .send({});
      }

      const user = await User.findById(testUserId);
      expect(user?.profile.totalSessions).toBe(5);
      
      // Average should be (70 + 80 + 90 + 85 + 75) / 5 = 80
      expect(user?.profile.averageScore).toBe(80);
    });
  });

  describe('Error Handling', () => {
    it('should reject session start without authentication', async () => {
      const response = await request(app)
        .post('/api/sessions/start')
        .send({
          jobRole: 'Developer',
          mode: 'general'
        });

      expect(response.status).toBe(401);
    });

    it('should reject session start with invalid mode', async () => {
      const response = await request(app)
        .post('/api/sessions/start')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          jobRole: 'Developer',
          mode: 'invalid-mode'
        });

      expect(response.status).toBe(400);
    });

    it('should reject answer submission for non-existent session', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .post(`/api/sessions/${fakeId}/submit-answer`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          question: { id: 'q1', text: 'Q1', category: 'technical', difficulty: 'medium', expectedKeywords: [], timeLimit: 300 },
          answer: 'Answer',
          timeSpent: 100
        });

      expect(response.status).toBe(404);
    });

    it('should reject completion of already completed session', async () => {
      const session = await Session.create({
        userId: testUserId,
        jobRole: 'Developer',
        mode: 'general',
        status: 'completed',
        startTime: new Date(),
        endTime: new Date(),
        questions: [],
        metadata: { mentorModeEnabled: false }
      });

      const response = await request(app)
        .post(`/api/sessions/${session._id}/complete`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      expect(response.status).toBe(400);
    });
  });
});
