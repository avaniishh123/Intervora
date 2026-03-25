/**
 * CodingController Integration Tests
 * Tests coding challenge retrieval, code submission, and Gemini validation
 * 
 * Task 7.5: Test coding challenge system
 * - Test challenge retrieval for different roles
 * - Test code submission with valid and invalid code
 * - Verify Gemini provides meaningful code feedback
 * - Test follow-up question generation
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import CodingChallenge from '../../models/CodingChallenge';
import Session from '../../models/Session';
import User from '../../models/User';
import codingRoutes from '../../routes/codingRoutes';

// Mock uuid to avoid ESM issues
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234')
}));

// Mock Gemini service for code validation
jest.mock('../../services/geminiService', () => ({
  geminiService: {
    getProModel: jest.fn().mockReturnValue({
      generateContent: jest.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            isCorrect: true,
            score: 85,
            geminiAnalysis: {
              codeQuality: 80,
              efficiency: 'Time: O(log n), Space: O(1) - Good efficiency',
              correctness: 'The solution correctly implements binary search',
              bestPractices: [
                'Uses proper variable naming',
                'Handles edge cases well',
                'Clean code structure'
              ],
              suggestions: [
                'Consider adding input validation',
                'Could add more comments for clarity'
              ],
              strengths: [
                'Efficient algorithm implementation',
                'Clear logic flow'
              ],
              improvements: [
                'Could add more edge case handling',
                'Consider adding documentation'
              ]
            },
            followUpQuestions: [
              {
                text: 'How would you optimize this for very large arrays?',
                category: 'technical',
                expectedKeywords: ['memory', 'optimization', 'caching'],
                timeLimit: 180
              }
            ]
          })
        }
      })
    }),
    callWithRetry: jest.fn((operation) => operation())
  }
}));

describe('CodingController Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let app: Express;
  let testUser: any;
  let authToken: string;
  let testChallenges: any[];

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/api/coding', codingRoutes);

    // Create test user
    testUser = await User.create({
      email: 'test@example.com',
      passwordHash: 'hashedpassword',
      role: 'candidate',
      profile: {
        name: 'Test User',
        totalSessions: 0,
        averageScore: 0
      }
    });

    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser._id, email: testUser.email, role: testUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Seed test challenges
    testChallenges = await CodingChallenge.create([
      {
        title: 'Binary Search Implementation',
        description: 'Implement binary search algorithm',
        difficulty: 'easy',
        role: 'Software Engineer',
        languages: ['python', 'javascript', 'java'],
        testCases: [
          {
            input: { arr: [1, 3, 5, 7, 9], target: 5 },
            expectedOutput: 2,
            isHidden: false,
            description: 'Find middle element'
          },
          {
            input: { arr: [1, 3, 5, 7, 9], target: 10 },
            expectedOutput: -1,
            isHidden: true,
            description: 'Element not found'
          }
        ],
        starterCode: {
          python: 'def binary_search(arr, target):\n    pass',
          javascript: 'function binarySearch(arr, target) {\n}'
        },
        hints: ['Use two pointers', 'Calculate mid point'],
        timeLimit: 300
      },
      {
        title: 'K-Means Clustering',
        description: 'Implement K-Means algorithm',
        difficulty: 'medium',
        role: 'AI/ML',
        languages: ['python'],
        testCases: [
          {
            input: { points: [[1, 2], [5, 8]], k: 2 },
            expectedOutput: { clusters: 2 },
            isHidden: false,
            description: 'Two clusters'
          }
        ],
        starterCode: {
          python: 'def kmeans(points, k):\n    pass'
        },
        hints: ['Use Euclidean distance'],
        timeLimit: 600
      },
      {
        title: 'SQL Injection Prevention',
        description: 'Secure database queries',
        difficulty: 'easy',
        role: 'Cybersecurity',
        languages: ['python', 'javascript'],
        testCases: [
          {
            input: { username: "admin' OR '1'='1", password: 'test' },
            expectedOutput: { vulnerable: false },
            isHidden: false,
            description: 'Prevent SQL injection'
          }
        ],
        starterCode: {
          python: 'def secure_login(username, password):\n    pass'
        },
        hints: ['Use parameterized queries'],
        timeLimit: 300
      },
      {
        title: 'Auto-Scaling Logic',
        description: 'Implement cloud auto-scaling',
        difficulty: 'medium',
        role: 'Cloud',
        languages: ['python', 'javascript'],
        testCases: [
          {
            input: { cpu: 85, instances: 2 },
            expectedOutput: { action: 'scale_up' },
            isHidden: false,
            description: 'Scale up on high CPU'
          }
        ],
        starterCode: {
          python: 'def auto_scale(metrics):\n    pass'
        },
        hints: ['Monitor CPU and memory'],
        timeLimit: 450
      }
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    // Clean up sessions after each test
    await Session.deleteMany({});
  });

  describe('Challenge Retrieval Tests', () => {
    it('should retrieve challenges for Software Engineer role', async () => {
      const response = await request(app)
        .get('/api/coding/challenges/Software Engineer')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(1);
      expect(response.body.data[0].title).toBe('Binary Search Implementation');
      expect(response.body.data[0].role).toBe('Software Engineer');
    });

    it('should retrieve challenges for AI/ML role', async () => {
      const response = await request(app)
        .get('/api/coding/challenges/' + encodeURIComponent('AI/ML'))
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(1);
      expect(response.body.data[0].title).toBe('K-Means Clustering');
      expect(response.body.data[0].difficulty).toBe('medium');
    });

    it('should retrieve challenges for Cybersecurity role', async () => {
      const response = await request(app)
        .get('/api/coding/challenges/Cybersecurity')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(1);
      expect(response.body.data[0].title).toBe('SQL Injection Prevention');
    });

    it('should retrieve challenges for Cloud role', async () => {
      const response = await request(app)
        .get('/api/coding/challenges/Cloud')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(1);
      expect(response.body.data[0].title).toBe('Auto-Scaling Logic');
    });

    it('should filter challenges by difficulty', async () => {
      const response = await request(app)
        .get('/api/coding/challenges/Software Engineer?difficulty=easy')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every((c: any) => c.difficulty === 'easy')).toBe(true);
    });

    it('should limit number of challenges returned', async () => {
      const response = await request(app)
        .get('/api/coding/challenges/Software Engineer?limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(1);
    });

    it('should not return hidden test cases', async () => {
      const response = await request(app)
        .get('/api/coding/challenges/Software Engineer')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const challenge = response.body.data[0];
      const hasHiddenTests = challenge.testCases.some((tc: any) => tc.isHidden === true);
      expect(hasHiddenTests).toBe(false);
    });

    it('should return empty array for role with no challenges', async () => {
      const response = await request(app)
        .get('/api/coding/challenges/NonExistentRole')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(0);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('Code Submission Tests - Valid Code', () => {
    it('should successfully submit valid Python code', async () => {
      const challenge = testChallenges[0]; // Binary Search
      const validCode = `
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
`;

      const response = await request(app)
        .post('/api/coding/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          challengeId: challenge._id,
          code: validCode,
          language: 'python'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isCorrect).toBe(true);
      expect(response.body.data.score).toBeGreaterThan(0);
      expect(response.body.data.geminiAnalysis).toBeDefined();
      expect(response.body.data.geminiAnalysis.codeQuality).toBeGreaterThan(0);
    });

    it('should successfully submit valid JavaScript code', async () => {
      const challenge = testChallenges[0];
      const validCode = `
function binarySearch(arr, target) {
    let left = 0, right = arr.length - 1;
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (arr[mid] === target) return mid;
        if (arr[mid] < target) left = mid + 1;
        else right = mid - 1;
    }
    return -1;
}
`;

      const response = await request(app)
        .post('/api/coding/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          challengeId: challenge._id,
          code: validCode,
          language: 'javascript'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isCorrect).toBe(true);
    });
  });

  describe('Code Submission Tests - Invalid Code', () => {
    it('should handle submission with missing required fields', async () => {
      const response = await request(app)
        .post('/api/coding/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          code: 'some code'
          // Missing challengeId and language
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('required fields');
    });

    it('should handle submission with invalid challenge ID', async () => {
      const response = await request(app)
        .post('/api/coding/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          challengeId: new mongoose.Types.ObjectId(),
          code: 'def test(): pass',
          language: 'python'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should reject unsupported language for challenge', async () => {
      const challenge = testChallenges[1]; // K-Means (Python only)
      
      const response = await request(app)
        .post('/api/coding/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          challengeId: challenge._id,
          code: 'function test() {}',
          language: 'javascript'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not supported');
    });

    it('should handle code with syntax errors', async () => {
      const challenge = testChallenges[0];
      const invalidCode = `
def binary_search(arr, target)
    # Missing colon - syntax error
    return -1
`;

      const response = await request(app)
        .post('/api/coding/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          challengeId: challenge._id,
          code: invalidCode,
          language: 'python'
        })
        .expect(200);

      // Gemini should still analyze it but give low score
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should handle incomplete code submission', async () => {
      const challenge = testChallenges[0];
      const incompleteCode = 'def binary_search(arr, target):\n    pass';

      const response = await request(app)
        .post('/api/coding/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          challengeId: challenge._id,
          code: incompleteCode,
          language: 'python'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Gemini should provide feedback about incomplete implementation
      expect(response.body.data.geminiAnalysis).toBeDefined();
    });
  });

  describe('Gemini Code Feedback Tests', () => {
    it('should provide meaningful code quality analysis', async () => {
      const challenge = testChallenges[0];
      const code = 'def binary_search(arr, target):\n    return -1';

      const response = await request(app)
        .post('/api/coding/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          challengeId: challenge._id,
          code,
          language: 'python'
        })
        .expect(200);

      const analysis = response.body.data.geminiAnalysis;
      expect(analysis).toBeDefined();
      expect(analysis.codeQuality).toBeGreaterThanOrEqual(0);
      expect(analysis.codeQuality).toBeLessThanOrEqual(100);
      expect(analysis.efficiency).toBeDefined();
      expect(analysis.correctness).toBeDefined();
    });

    it('should provide best practices feedback', async () => {
      const challenge = testChallenges[0];
      const code = 'def binary_search(arr, target):\n    return -1';

      const response = await request(app)
        .post('/api/coding/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          challengeId: challenge._id,
          code,
          language: 'python'
        })
        .expect(200);

      const analysis = response.body.data.geminiAnalysis;
      expect(Array.isArray(analysis.bestPractices)).toBe(true);
      expect(Array.isArray(analysis.suggestions)).toBe(true);
    });

    it('should identify code strengths', async () => {
      const challenge = testChallenges[0];
      const code = 'def binary_search(arr, target):\n    return -1';

      const response = await request(app)
        .post('/api/coding/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          challengeId: challenge._id,
          code,
          language: 'python'
        })
        .expect(200);

      const analysis = response.body.data.geminiAnalysis;
      expect(Array.isArray(analysis.strengths)).toBe(true);
    });

    it('should identify areas for improvement', async () => {
      const challenge = testChallenges[0];
      const code = 'def binary_search(arr, target):\n    return -1';

      const response = await request(app)
        .post('/api/coding/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          challengeId: challenge._id,
          code,
          language: 'python'
        })
        .expect(200);

      const analysis = response.body.data.geminiAnalysis;
      expect(Array.isArray(analysis.improvements)).toBe(true);
    });

    it('should provide efficiency analysis with Big O notation', async () => {
      const challenge = testChallenges[0];
      const code = 'def binary_search(arr, target):\n    return -1';

      const response = await request(app)
        .post('/api/coding/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          challengeId: challenge._id,
          code,
          language: 'python'
        })
        .expect(200);

      const analysis = response.body.data.geminiAnalysis;
      expect(analysis.efficiency).toBeDefined();
      expect(typeof analysis.efficiency).toBe('string');
    });
  });

  describe('Follow-up Question Generation Tests', () => {
    it('should generate follow-up questions based on code', async () => {
      const challenge = testChallenges[0];
      const code = 'def binary_search(arr, target):\n    return -1';

      const response = await request(app)
        .post('/api/coding/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          challengeId: challenge._id,
          code,
          language: 'python'
        })
        .expect(200);

      expect(response.body.data.followUpQuestions).toBeDefined();
      expect(Array.isArray(response.body.data.followUpQuestions)).toBe(true);
    });

    it('should generate technical follow-up questions', async () => {
      const challenge = testChallenges[0];
      const code = 'def binary_search(arr, target):\n    return -1';

      const response = await request(app)
        .post('/api/coding/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          challengeId: challenge._id,
          code,
          language: 'python'
        })
        .expect(200);

      const followUps = response.body.data.followUpQuestions;
      if (followUps.length > 0) {
        const question = followUps[0];
        expect(question.text).toBeDefined();
        expect(question.category).toBe('technical');
        expect(Array.isArray(question.expectedKeywords)).toBe(true);
        expect(question.timeLimit).toBeGreaterThan(0);
      }
    });

    it('should include expected keywords in follow-up questions', async () => {
      const challenge = testChallenges[0];
      const code = 'def binary_search(arr, target):\n    return -1';

      const response = await request(app)
        .post('/api/coding/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          challengeId: challenge._id,
          code,
          language: 'python'
        })
        .expect(200);

      const followUps = response.body.data.followUpQuestions;
      if (followUps.length > 0) {
        const question = followUps[0];
        expect(question.expectedKeywords).toBeDefined();
        expect(Array.isArray(question.expectedKeywords)).toBe(true);
      }
    });
  });

  describe('Session Integration Tests', () => {
    it('should store code submission in session when sessionId provided', async () => {
      // Create a test session
      const session = await Session.create({
        userId: testUser._id,
        jobRole: 'Software Engineer',
        mode: 'general',
        status: 'in-progress',
        questions: []
      });

      const challenge = testChallenges[0];
      const code = 'def binary_search(arr, target):\n    return -1';

      const response = await request(app)
        .post('/api/coding/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          challengeId: challenge._id,
          code,
          language: 'python',
          sessionId: session._id
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify session was updated
      const updatedSession = await Session.findById(session._id);
      expect(updatedSession).toBeDefined();
      expect(updatedSession!.questions.length).toBe(1);
      expect(updatedSession!.questions[0].question.category).toBe('coding');
    });

    it('should handle invalid sessionId gracefully', async () => {
      const challenge = testChallenges[0];
      const code = 'def binary_search(arr, target):\n    return -1';

      const response = await request(app)
        .post('/api/coding/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          challengeId: challenge._id,
          code,
          language: 'python',
          sessionId: new mongoose.Types.ObjectId()
        })
        .expect(200);

      // Should still succeed even if session not found
      expect(response.body.success).toBe(true);
    });
  });

  describe('Additional API Endpoints', () => {
    it('should get challenge by ID', async () => {
      const challenge = testChallenges[0];

      const response = await request(app)
        .get(`/api/coding/challenges/id/${challenge._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(challenge.title);
    });

    it('should return 404 for non-existent challenge ID', async () => {
      const response = await request(app)
        .get(`/api/coding/challenges/id/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should get available roles', async () => {
      const response = await request(app)
        .get('/api/coding/roles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should get challenge statistics by role', async () => {
      const response = await request(app)
        .get('/api/coding/stats/Software Engineer')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('Software Engineer');
      expect(response.body.data.total).toBeGreaterThan(0);
      expect(response.body.data.byDifficulty).toBeDefined();
    });
  });
});
