/**
 * ResumeController Integration Tests
 * Tests resume upload, text extraction, and Gemini analysis
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import path from 'path';
import fs from 'fs';
import User from '../../models/User';
import resumeRoutes from '../../routes/resumeRoutes';
import config from '../../config/env';

// Mock uuid module
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234')
}));

// Mock Gemini service for resume analysis
jest.mock('../../services/ResumeAnalyzer', () => ({
  resumeAnalyzer: {
    analyzeResume: jest.fn().mockResolvedValue({
      skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'MongoDB'],
      experience: [
        {
          company: 'Tech Corp',
          role: 'Senior Software Engineer',
          duration: '2020 - Present',
          highlights: [
            'Led development of microservices architecture',
            'Improved system performance by 40%',
            'Mentored junior developers'
          ]
        }
      ],
      projects: [
        {
          name: 'E-commerce Platform',
          description: 'Built scalable e-commerce solution',
          technologies: ['React', 'Node.js', 'PostgreSQL'],
          highlights: ['Handled 10k+ concurrent users', 'Implemented payment gateway']
        }
      ],
      education: [
        {
          institution: 'University of Technology',
          degree: "Bachelor's",
          field: 'Computer Science',
          year: '2019'
        }
      ],
      suggestions: [
        'Add more quantifiable achievements',
        'Include certifications if any',
        'Expand on leadership experience'
      ],
      strengthAreas: [
        'Strong technical skills',
        'Relevant experience',
        'Clear project descriptions'
      ],
      improvementAreas: [
        'Add more metrics',
        'Include soft skills',
        'Expand education section'
      ],
      jdMatchScore: 85
    })
  },
  ResumeAnalysis: {}
}));

describe('ResumeController Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let app: Express;
  let testUser: any;
  let testToken: string;
  let testUserId: string;

  // Sample resume files directory
  const testFilesDir = path.join(__dirname, 'test-files');
  const samplePdfPath = path.join(testFilesDir, 'sample-resume.pdf');
  const sampleDocxPath = path.join(testFilesDir, 'sample-resume.docx');
  const invalidFilePath = path.join(testFilesDir, 'invalid-file.txt');

  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/resume', resumeRoutes);

    // Ensure upload directories exist
    const resumesDir = path.join(config.uploadDir, 'resumes');
    if (!fs.existsSync(resumesDir)) {
      fs.mkdirSync(resumesDir, { recursive: true });
    }

    // Create test files directory
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }

    // Create sample PDF file (minimal valid PDF)
    const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length 85
>>
stream
BT
/F1 12 Tf
50 700 Td
(John Doe - Software Engineer) Tj
0 -20 Td
(Skills: JavaScript, React, Node.js) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000317 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
451
%%EOF`;
    fs.writeFileSync(samplePdfPath, pdfContent);

    // Create sample DOCX file (minimal valid DOCX - ZIP format)
    // For testing purposes, we'll create a simple text file
    // In real scenario, DOCX is a ZIP containing XML files
    const docxContent = 'Jane Smith\nFull Stack Developer\n\nExperience:\n- 5 years in web development\n- Expert in React and Node.js\n\nSkills: TypeScript, MongoDB, AWS';
    fs.writeFileSync(sampleDocxPath, docxContent);

    // Create invalid file
    fs.writeFileSync(invalidFilePath, 'This is not a valid resume file');

    console.log('✅ Test database and files setup complete');
  });

  afterAll(async () => {
    // Cleanup test files
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true, force: true });
    }

    // Cleanup uploaded files
    const resumesDir = path.join(config.uploadDir, 'resumes');
    if (fs.existsSync(resumesDir)) {
      const files = fs.readdirSync(resumesDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(resumesDir, file));
      });
    }

    await mongoose.disconnect();
    await mongoServer.stop();
    console.log('✅ Test cleanup complete');
  });

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});

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
      { userId: testUserId, email: testUser.email, role: testUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('Resume Upload', () => {
    it('should successfully upload a valid PDF resume', async () => {
      const response = await request(app)
        .post('/api/resume/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('resume', samplePdfPath);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Resume uploaded successfully');
      expect(response.body.data.resumeUrl).toBeDefined();
      expect(response.body.data.filename).toBeDefined();
      expect(response.body.data.originalName).toBe('sample-resume.pdf');

      // Verify file was saved
      const user = await User.findById(testUserId);
      expect(user?.profile.resumeUrl).toBeDefined();
      expect(user?.profile.resumeUrl).toContain('.pdf');
    });

    it('should successfully upload a valid DOCX resume', async () => {
      const response = await request(app)
        .post('/api/resume/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('resume', sampleDocxPath);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.originalName).toBe('sample-resume.docx');
    });

    it('should reject upload without authentication', async () => {
      const response = await request(app)
        .post('/api/resume/upload')
        .attach('resume', samplePdfPath);

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Unauthorized');
    });

    it('should reject upload without file', async () => {
      const response = await request(app)
        .post('/api/resume/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('No file uploaded');
    });

    it('should reject invalid file type', async () => {
      const response = await request(app)
        .post('/api/resume/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('resume', invalidFilePath);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid file type');
    });

    it('should replace existing resume on new upload', async () => {
      // First upload
      const response1 = await request(app)
        .post('/api/resume/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('resume', samplePdfPath);

      const firstResumeUrl = response1.body.data.resumeUrl;

      // Second upload
      const response2 = await request(app)
        .post('/api/resume/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('resume', sampleDocxPath);

      const secondResumeUrl = response2.body.data.resumeUrl;

      expect(firstResumeUrl).not.toBe(secondResumeUrl);

      // Verify user has latest resume
      const user = await User.findById(testUserId);
      expect(user?.profile.resumeUrl).toBe(secondResumeUrl);
    });
  });

  describe('Resume Text Extraction', () => {
    it('should extract text from PDF file', async () => {
      // Upload PDF
      await request(app)
        .post('/api/resume/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('resume', samplePdfPath);

      // Analyze resume (which triggers text extraction)
      const response = await request(app)
        .post('/api/resume/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.analysis).toBeDefined();
    });

    it('should handle corrupted or empty files gracefully', async () => {
      // Create empty file
      const emptyFilePath = path.join(testFilesDir, 'empty.pdf');
      fs.writeFileSync(emptyFilePath, '');

      const uploadResponse = await request(app)
        .post('/api/resume/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('resume', emptyFilePath);

      // Upload might succeed but analysis should fail
      if (uploadResponse.status === 200) {
        const analyzeResponse = await request(app)
          .post('/api/resume/analyze')
          .set('Authorization', `Bearer ${testToken}`)
          .send({});

        expect(analyzeResponse.status).toBeGreaterThanOrEqual(400);
      }

      // Cleanup
      fs.unlinkSync(emptyFilePath);
    });
  });

  describe('Resume Analysis with Gemini', () => {
    beforeEach(async () => {
      // Upload a resume before each test
      await request(app)
        .post('/api/resume/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('resume', samplePdfPath);
    });

    it('should analyze resume and return structured data', async () => {
      const response = await request(app)
        .post('/api/resume/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.message).toBe('Resume analyzed successfully');

      const analysis = response.body.data.analysis;

      // Verify structure
      expect(analysis.skills).toBeDefined();
      expect(Array.isArray(analysis.skills)).toBe(true);
      expect(analysis.skills.length).toBeGreaterThan(0);

      expect(analysis.experience).toBeDefined();
      expect(Array.isArray(analysis.experience)).toBe(true);

      expect(analysis.projects).toBeDefined();
      expect(Array.isArray(analysis.projects)).toBe(true);

      expect(analysis.education).toBeDefined();
      expect(Array.isArray(analysis.education)).toBe(true);

      expect(analysis.suggestions).toBeDefined();
      expect(Array.isArray(analysis.suggestions)).toBe(true);

      expect(analysis.strengthAreas).toBeDefined();
      expect(Array.isArray(analysis.strengthAreas)).toBe(true);

      expect(analysis.improvementAreas).toBeDefined();
      expect(Array.isArray(analysis.improvementAreas)).toBe(true);
    });

    it('should analyze resume with job description and return match score', async () => {
      const jobDescription = `
        We are looking for a Senior Software Engineer with:
        - 5+ years of experience in JavaScript/TypeScript
        - Strong React and Node.js skills
        - Experience with MongoDB and cloud platforms
        - Leadership and mentoring experience
      `;

      const response = await request(app)
        .post('/api/resume/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ jobDescription });

      expect(response.status).toBe(200);

      const analysis = response.body.data.analysis;
      expect(analysis.jdMatchScore).toBeDefined();
      expect(typeof analysis.jdMatchScore).toBe('number');
      expect(analysis.jdMatchScore).toBeGreaterThanOrEqual(0);
      expect(analysis.jdMatchScore).toBeLessThanOrEqual(100);
    });

    it('should store analysis in user profile', async () => {
      await request(app)
        .post('/api/resume/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      const user = await User.findById(testUserId);
      expect((user?.profile as any).resumeAnalysis).toBeDefined();
      expect((user?.profile as any).resumeAnalysis.skills).toBeDefined();
    });

    it('should reject analysis without uploaded resume', async () => {
      // Create new user without resume
      const newUser = await User.create({
        email: 'newuser@example.com',
        passwordHash: 'hashed',
        role: 'candidate',
        profile: { name: 'New User', totalSessions: 0, averageScore: 0 }
      });

      const newToken = jwt.sign(
        { userId: String(newUser._id), email: newUser.email, role: newUser.role },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post('/api/resume/analyze')
        .set('Authorization', `Bearer ${newToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('No resume found');
    });

    it('should reject analysis without authentication', async () => {
      const response = await request(app)
        .post('/api/resume/analyze')
        .send({});

      expect(response.status).toBe(401);
    });
  });

  describe('Resume Retrieval', () => {
    beforeEach(async () => {
      // Upload and analyze resume
      await request(app)
        .post('/api/resume/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('resume', samplePdfPath);

      await request(app)
        .post('/api/resume/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({});
    });

    it('should retrieve user resume information', async () => {
      const response = await request(app)
        .get(`/api/resume/${testUserId}`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.resumeUrl).toBeDefined();
      expect(response.body.data.resumeAnalysis).toBeDefined();
    });

    it('should deny access to other users resumes', async () => {
      // Create another user
      const otherUser = await User.create({
        email: 'other@example.com',
        passwordHash: 'hashed',
        role: 'candidate',
        profile: { name: 'Other User', totalSessions: 0, averageScore: 0 }
      });

      const otherToken = jwt.sign(
        { userId: String(otherUser._id), email: otherUser.email, role: otherUser.role },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get(`/api/resume/${testUserId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Access denied');
    });

    it('should allow admin to access any user resume', async () => {
      // Create admin user
      const adminUser = await User.create({
        email: 'admin@example.com',
        passwordHash: 'hashed',
        role: 'admin',
        profile: { name: 'Admin User', totalSessions: 0, averageScore: 0 }
      });

      const adminToken = jwt.sign(
        { userId: String(adminUser._id), email: adminUser.email, role: adminUser.role },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get(`/api/resume/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it('should return 404 for user without resume', async () => {
      const newUser = await User.create({
        email: 'noresume@example.com',
        passwordHash: 'hashed',
        role: 'candidate',
        profile: { name: 'No Resume User', totalSessions: 0, averageScore: 0 }
      });

      const newToken = jwt.sign(
        { userId: String(newUser._id), email: newUser.email, role: newUser.role },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get(`/api/resume/${newUser._id}`)
        .set('Authorization', `Bearer ${newToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('No resume found');
    });
  });

  describe('Resume Deletion', () => {
    beforeEach(async () => {
      // Upload resume
      await request(app)
        .post('/api/resume/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('resume', samplePdfPath);
    });

    it('should delete user resume and file', async () => {
      // Get resume URL before deletion
      const user = await User.findById(testUserId);
      const resumeUrl = user?.profile.resumeUrl;
      expect(resumeUrl).toBeDefined();

      // Delete resume
      const response = await request(app)
        .delete('/api/resume')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Resume deleted successfully');

      // Verify resume removed from user profile
      const updatedUser = await User.findById(testUserId);
      expect(updatedUser?.profile.resumeUrl).toBeUndefined();
      expect((updatedUser?.profile as any).resumeAnalysis).toBeUndefined();
    });

    it('should return 404 when deleting non-existent resume', async () => {
      // Create user without resume
      const newUser = await User.create({
        email: 'noresume@example.com',
        passwordHash: 'hashed',
        role: 'candidate',
        profile: { name: 'No Resume', totalSessions: 0, averageScore: 0 }
      });

      const newToken = jwt.sign(
        { userId: String(newUser._id), email: newUser.email, role: newUser.role },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .delete('/api/resume')
        .set('Authorization', `Bearer ${newToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('No resume found to delete');
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      // Upload resume
      await request(app)
        .post('/api/resume/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('resume', samplePdfPath);

      // Manually delete the file to simulate file system error
      const user = await User.findById(testUserId);
      const resumeFilename = path.basename(user!.profile.resumeUrl!);
      const resumePath = path.join(config.uploadDir, 'resumes', resumeFilename);
      if (fs.existsSync(resumePath)) {
        fs.unlinkSync(resumePath);
      }

      // Try to analyze - should fail gracefully
      const response = await request(app)
        .post('/api/resume/analyze')
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Resume file not found');
    });

    it('should handle large file size limit', async () => {
      // Create a file larger than 5MB
      const largeFilePath = path.join(testFilesDir, 'large-resume.pdf');
      const largeContent = Buffer.alloc(6 * 1024 * 1024); // 6MB
      fs.writeFileSync(largeFilePath, largeContent);

      const response = await request(app)
        .post('/api/resume/upload')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('resume', largeFilePath);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('File size exceeds');

      // Cleanup
      fs.unlinkSync(largeFilePath);
    });
  });
});
