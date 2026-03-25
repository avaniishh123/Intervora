/**
 * AdminController Integration Tests
 * Tests dashboard statistics, user management, session filtering, data export, and admin-only access
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import Session from '../../models/Session';
import User from '../../models/User';
import adminRoutes from '../../routes/adminRoutes';
import AnalyticsService from '../../services/AnalyticsService';

// Mock Socket.io
jest.mock('../../socket/socketInstance', () => ({
  getSocketInstance: jest.fn().mockReturnValue({})
}));

describe('AdminController Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let app: Express;
  let adminUser: any;
  let candidateUser: any;
  let adminToken: string;
  let candidateToken: string;
  let adminUserId: string;
  let candidateUserId: string;

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);

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
    AnalyticsService.clearCache();

    // Create admin user
    adminUser = await User.create({
      email: 'admin@example.com',
      passwordHash: 'hashed_password',
      role: 'admin',
      profile: {
        name: 'Admin User',
        totalSessions: 0,
        averageScore: 0
      }
    });

    adminUserId = adminUser._id.toString();

    // Create candidate user
    candidateUser = await User.create({
      email: 'candidate@example.com',
      passwordHash: 'hashed_password',
      role: 'candidate',
      profile: {
        name: 'Candidate User',
        totalSessions: 5,
        averageScore: 85
      }
    });

    candidateUserId = candidateUser._id.toString();

    // Generate JWT tokens
    adminToken = jwt.sign(
      { id: adminUserId, email: adminUser.email, role: adminUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    candidateToken = jwt.sign(
      { id: candidateUserId, email: candidateUser.email, role: candidateUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('Dashboard Statistics Calculation', () => {
    beforeEach(async () => {
      // Create test data for statistics
      // Create additional users
      await User.create([
        {
          email: 'user1@example.com',
          passwordHash: 'hash',
          role: 'candidate',
          profile: { name: 'User 1', totalSessions: 3, averageScore: 75 }
        },
        {
          email: 'user2@example.com',
          passwordHash: 'hash',
          role: 'candidate',
          profile: { name: 'User 2', totalSessions: 2, averageScore: 90 }
        }
      ]);

      // Create sessions with different statuses and roles
      await Session.create([
        {
          userId: candidateUserId,
          jobRole: 'Software Engineer',
          mode: 'general',
          status: 'completed',
          startTime: new Date('2024-01-01'),
          endTime: new Date('2024-01-01'),
          questions: [],
          performanceReport: { overallScore: 85 },
          metadata: { mentorModeEnabled: false }
        },
        {
          userId: candidateUserId,
          jobRole: 'Frontend Developer',
          mode: 'resume-based',
          status: 'completed',
          startTime: new Date('2024-01-02'),
          endTime: new Date('2024-01-02'),
          questions: [],
          performanceReport: { overallScore: 90 },
          metadata: { mentorModeEnabled: false }
        },
        {
          userId: candidateUserId,
          jobRole: 'Software Engineer',
          mode: 'jd-based',
          status: 'in-progress',
          startTime: new Date('2024-01-03'),
          questions: [],
          metadata: { mentorModeEnabled: true }
        },
        {
          userId: candidateUserId,
          jobRole: 'Backend Developer',
          mode: 'general',
          status: 'completed',
          startTime: new Date('2024-01-04'),
          endTime: new Date('2024-01-04'),
          questions: [],
          performanceReport: { overallScore: 75 },
          metadata: { mentorModeEnabled: false }
        }
      ]);
    });

    it('should calculate correct dashboard statistics', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');

      const stats = response.body.data.statistics;

      // Verify total users (admin + candidate + 2 additional = 4)
      expect(stats.totalUsers).toBe(4);

      // Verify active sessions (1 in-progress)
      expect(stats.activeSessions).toBe(1);

      // Verify completed sessions (3 completed)
      expect(stats.completedSessions).toBe(3);

      // Verify average platform score ((85 + 90 + 75) / 3 = 83.33)
      expect(stats.averagePlatformScore).toBeCloseTo(83.33, 1);

      // Verify role distribution
      expect(stats.roleDistribution).toBeDefined();
      expect(stats.roleDistribution['Software Engineer']).toBe(2);
      expect(stats.roleDistribution['Frontend Developer']).toBe(1);
      expect(stats.roleDistribution['Backend Developer']).toBe(1);
    });

    it('should include recent sessions in dashboard', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.recentSessions).toBeDefined();
      expect(Array.isArray(response.body.data.recentSessions)).toBe(true);
      expect(response.body.data.recentSessions.length).toBeGreaterThan(0);
      expect(response.body.data.recentSessions.length).toBeLessThanOrEqual(10);

      // Verify sessions are sorted by most recent first
      const sessions = response.body.data.recentSessions;
      for (let i = 0; i < sessions.length - 1; i++) {
        const current = new Date(sessions[i].startTime);
        const next = new Date(sessions[i + 1].startTime);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });

    it('should use caching for dashboard statistics', async () => {
      // First request - should compute fresh data
      const response1 = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response1.status).toBe(200);

      // Second request - should use cached data
      const response2 = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response2.status).toBe(200);
      expect(response2.body.data.statistics).toEqual(response1.body.data.statistics);
    });

    it('should handle empty database gracefully', async () => {
      // Clear all data
      await User.deleteMany({});
      await Session.deleteMany({});
      AnalyticsService.clearCache();

      // Recreate only admin user for authentication
      const admin = await User.create({
        email: 'admin@example.com',
        passwordHash: 'hash',
        role: 'admin',
        profile: { name: 'Admin', totalSessions: 0, averageScore: 0 }
      });

      const token = jwt.sign(
        { id: String(admin._id), email: admin.email, role: admin.role },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.statistics.totalUsers).toBe(1);
      expect(response.body.data.statistics.activeSessions).toBe(0);
      expect(response.body.data.statistics.completedSessions).toBe(0);
      expect(response.body.data.statistics.averagePlatformScore).toBe(0);
    });
  });

  describe('User and Session Filtering', () => {
    beforeEach(async () => {
      // Create multiple users with different roles
      await User.create([
        {
          email: 'alice@example.com',
          passwordHash: 'hash',
          role: 'candidate',
          profile: { name: 'Alice Smith', totalSessions: 5, averageScore: 85 },
          createdAt: new Date('2024-01-01')
        },
        {
          email: 'bob@example.com',
          passwordHash: 'hash',
          role: 'candidate',
          profile: { name: 'Bob Johnson', totalSessions: 3, averageScore: 75 },
          createdAt: new Date('2024-01-02')
        },
        {
          email: 'charlie@example.com',
          passwordHash: 'hash',
          role: 'admin',
          profile: { name: 'Charlie Admin', totalSessions: 0, averageScore: 0 },
          createdAt: new Date('2024-01-03')
        }
      ]);

      // Create sessions with various attributes
      await Session.create([
        {
          userId: candidateUserId,
          jobRole: 'Software Engineer',
          mode: 'general',
          status: 'completed',
          startTime: new Date('2024-01-01'),
          endTime: new Date('2024-01-01'),
          questions: [],
          performanceReport: { overallScore: 85 },
          metadata: { mentorModeEnabled: false }
        },
        {
          userId: candidateUserId,
          jobRole: 'Frontend Developer',
          mode: 'resume-based',
          status: 'completed',
          startTime: new Date('2024-01-15'),
          endTime: new Date('2024-01-15'),
          questions: [],
          performanceReport: { overallScore: 90 },
          metadata: { mentorModeEnabled: false }
        },
        {
          userId: candidateUserId,
          jobRole: 'Backend Developer',
          mode: 'jd-based',
          status: 'in-progress',
          startTime: new Date('2024-02-01'),
          questions: [],
          metadata: { mentorModeEnabled: true }
        },
        {
          userId: candidateUserId,
          jobRole: 'Software Engineer',
          mode: 'general',
          status: 'completed',
          startTime: new Date('2024-02-15'),
          endTime: new Date('2024-02-15'),
          questions: [],
          performanceReport: { overallScore: 60 },
          metadata: { mentorModeEnabled: false }
        }
      ]);
    });

    it('should filter users by role', async () => {
      const response = await request(app)
        .get('/api/admin/users?role=candidate')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.users.every((u: any) => u.role === 'candidate')).toBe(true);
      expect(response.body.data.users.length).toBeGreaterThan(0);
    });

    it('should search users by email', async () => {
      const response = await request(app)
        .get('/api/admin/users?search=alice')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.users.length).toBeGreaterThan(0);
      expect(response.body.data.users[0].email).toContain('alice');
    });

    it('should search users by name', async () => {
      const response = await request(app)
        .get('/api/admin/users?search=Smith')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.users.length).toBeGreaterThan(0);
      expect(response.body.data.users[0].profile.name).toContain('Smith');
    });

    it('should paginate user results', async () => {
      const response = await request(app)
        .get('/api/admin/users?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.users.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
    });

    it('should sort users by different fields', async () => {
      const response = await request(app)
        .get('/api/admin/users?sortBy=email&sortOrder=asc')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      const emails = response.body.data.users.map((u: any) => u.email);
      const sortedEmails = [...emails].sort();
      expect(emails).toEqual(sortedEmails);
    });

    it('should filter sessions by status', async () => {
      const response = await request(app)
        .get('/api/admin/sessions?status=completed')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.sessions.every((s: any) => s.status === 'completed')).toBe(true);
    });

    it('should filter sessions by job role', async () => {
      const response = await request(app)
        .get('/api/admin/sessions?jobRole=Software Engineer')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.sessions.every((s: any) => 
        s.jobRole.includes('Software Engineer')
      )).toBe(true);
    });

    it('should filter sessions by date range', async () => {
      const response = await request(app)
        .get('/api/admin/sessions?startDate=2024-01-01&endDate=2024-01-31')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.sessions.length).toBeGreaterThan(0);
      
      response.body.data.sessions.forEach((s: any) => {
        const sessionDate = new Date(s.startTime);
        expect(sessionDate.getTime()).toBeGreaterThanOrEqual(new Date('2024-01-01').getTime());
        expect(sessionDate.getTime()).toBeLessThanOrEqual(new Date('2024-01-31').getTime());
      });
    });

    it('should filter sessions by score range', async () => {
      const response = await request(app)
        .get('/api/admin/sessions?minScore=80&maxScore=95')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      response.body.data.sessions.forEach((s: any) => {
        if (s.performanceReport?.overallScore) {
          expect(s.performanceReport.overallScore).toBeGreaterThanOrEqual(80);
          expect(s.performanceReport.overallScore).toBeLessThanOrEqual(95);
        }
      });
    });

    it('should filter sessions by user ID', async () => {
      const response = await request(app)
        .get(`/api/admin/sessions?userId=${candidateUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.sessions.every((s: any) => 
        s.userId._id === candidateUserId || s.userId === candidateUserId
      )).toBe(true);
    });

    it('should combine multiple filters', async () => {
      const response = await request(app)
        .get('/api/admin/sessions?status=completed&jobRole=Software&minScore=70')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      
      response.body.data.sessions.forEach((s: any) => {
        expect(s.status).toBe('completed');
        expect(s.jobRole).toContain('Software');
        if (s.performanceReport?.overallScore) {
          expect(s.performanceReport.overallScore).toBeGreaterThanOrEqual(70);
        }
      });
    });

    it('should paginate session results', async () => {
      const response = await request(app)
        .get('/api/admin/sessions?page=1&limit=2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.sessions.length).toBeLessThanOrEqual(2);
      expect(response.body.data.pagination.currentPage).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
    });
  });

  describe('Data Export with Various Filters', () => {
    beforeEach(async () => {
      // Create test sessions for export
      await Session.create([
        {
          userId: candidateUserId,
          jobRole: 'Software Engineer',
          mode: 'general',
          status: 'completed',
          startTime: new Date('2024-01-01'),
          endTime: new Date('2024-01-01'),
          questions: [
            {
              question: { id: 'q1', text: 'Test Q', category: 'technical', difficulty: 'medium', expectedKeywords: [], timeLimit: 300 },
              answer: 'Test answer',
              evaluation: { score: 85, feedback: 'Good', strengths: [], improvements: [], sentiment: { overall: 'positive', confidence: 80, clarity: 85, professionalism: 90 } },
              timeSpent: 120,
              timestamp: new Date()
            }
          ],
          performanceReport: {
            overallScore: 85,
            categoryScores: { technical: 85, behavioral: 0, communication: 80 },
            wordCountMetrics: { average: 50, total: 50, perQuestion: [50] },
            sentimentAnalysis: { overall: 'positive', confidence: 80, clarity: 85, professionalism: 90 },
            strengths: ['Clear communication'],
            weaknesses: [],
            recommendations: ['Practice more']
          },
          metadata: { mentorModeEnabled: false }
        },
        {
          userId: candidateUserId,
          jobRole: 'Frontend Developer',
          mode: 'resume-based',
          status: 'completed',
          startTime: new Date('2024-01-15'),
          endTime: new Date('2024-01-15'),
          questions: [],
          performanceReport: { overallScore: 90 },
          metadata: { mentorModeEnabled: true }
        }
      ]);
    });

    it('should get export preview with statistics', async () => {
      const response = await request(app)
        .post('/api/admin/export/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          filters: {}
        });

      expect(response.status).toBe(200);
      expect(response.body.data.count).toBeGreaterThan(0);
      expect(response.body.data.estimatedSize).toBeDefined();
      expect(typeof response.body.data.estimatedSize).toBe('string');
    });

    it('should export data in CSV format', async () => {
      const response = await request(app)
        .post('/api/admin/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          format: 'csv',
          filters: {}
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.csv');
    });

    it('should export data in JSON format', async () => {
      const response = await request(app)
        .post('/api/admin/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          format: 'json',
          filters: {}
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.json');
    });

    it('should export with status filter', async () => {
      const response = await request(app)
        .post('/api/admin/export/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          filters: {
            status: 'completed'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.count).toBeGreaterThan(0);
    });

    it('should export with date range filter', async () => {
      const response = await request(app)
        .post('/api/admin/export/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          filters: {
            startDate: '2024-01-01',
            endDate: '2024-01-10'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.count).toBeGreaterThan(0);
    });

    it('should export with score range filter', async () => {
      const response = await request(app)
        .post('/api/admin/export/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          filters: {
            minScore: 80,
            maxScore: 95
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.count).toBeGreaterThan(0);
    });

    it('should export with job role filter', async () => {
      const response = await request(app)
        .post('/api/admin/export/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          filters: {
            jobRole: 'Software Engineer'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.data.count).toBeGreaterThan(0);
    });

    it('should reject export with invalid format', async () => {
      const response = await request(app)
        .post('/api/admin/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          format: 'xml',
          filters: {}
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid format');
    });
  });

  describe('Admin-Only Access Restrictions', () => {
    it('should deny dashboard access to non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('admin');
    });

    it('should deny user list access to non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(response.status).toBe(403);
    });

    it('should deny session list access to non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/sessions')
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(response.status).toBe(403);
    });

    it('should deny export access to non-admin users', async () => {
      const response = await request(app)
        .post('/api/admin/export')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          format: 'csv',
          filters: {}
        });

      expect(response.status).toBe(403);
    });

    it('should deny cache clear access to non-admin users', async () => {
      const response = await request(app)
        .post('/api/admin/cache/clear')
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(response.status).toBe(403);
    });

    it('should deny access without authentication', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard');

      expect(response.status).toBe(401);
    });

    it('should deny access with invalid token', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('should allow admin to access all endpoints', async () => {
      // Test dashboard
      const dashboardResponse = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(dashboardResponse.status).toBe(200);

      // Test users
      const usersResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(usersResponse.status).toBe(200);

      // Test sessions
      const sessionsResponse = await request(app)
        .get('/api/admin/sessions')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(sessionsResponse.status).toBe(200);

      // Test export preview
      const exportResponse = await request(app)
        .post('/api/admin/export/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ filters: {} });
      expect(exportResponse.status).toBe(200);
    });
  });

  describe('Additional Admin Features', () => {
    it('should get user details with session history', async () => {
      // Create sessions for the candidate
      await Session.create([
        {
          userId: candidateUserId,
          jobRole: 'Developer',
          mode: 'general',
          status: 'completed',
          startTime: new Date('2024-01-01'),
          endTime: new Date('2024-01-01'),
          questions: [],
          performanceReport: { overallScore: 85 },
          metadata: { mentorModeEnabled: false }
        }
      ]);

      const response = await request(app)
        .get(`/api/admin/users/${candidateUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(candidateUser.email);
      expect(response.body.data.sessions).toBeDefined();
      expect(Array.isArray(response.body.data.sessions)).toBe(true);
    });

    it('should get session details', async () => {
      const session = await Session.create({
        userId: candidateUserId,
        jobRole: 'Developer',
        mode: 'general',
        status: 'completed',
        startTime: new Date(),
        endTime: new Date(),
        questions: [],
        performanceReport: { overallScore: 85 },
        metadata: { mentorModeEnabled: false }
      });

      const response = await request(app)
        .get(`/api/admin/sessions/${session._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.session).toBeDefined();
      expect(String(response.body.data.session._id)).toBe(String(session._id));
    });

    it('should clear analytics cache', async () => {
      const response = await request(app)
        .post('/api/admin/cache/clear')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('cleared');
    });

    it('should handle non-existent user gracefully', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/admin/users/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('should handle non-existent session gracefully', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/admin/sessions/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });
  });
});
