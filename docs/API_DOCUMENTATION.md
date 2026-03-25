# AI Interview Maker 2.0 - API Documentation

## Overview

This document provides comprehensive API documentation for the AI Interview Maker 2.0 platform. All endpoints use JSON for request and response bodies unless otherwise specified.

**Base URL:** `http://localhost:5000/api` (Development)

**Authentication:** Most endpoints require JWT authentication via the `Authorization` header:
```
Authorization: Bearer <access_token>
```

## Table of Contents

1. [Authentication APIs](#authentication-apis)
2. [Resume APIs](#resume-apis)
3. [Gemini AI APIs](#gemini-ai-apis)
4. [Session APIs](#session-apis)
5. [Coding Challenge APIs](#coding-challenge-apis)
6. [Leaderboard APIs](#leaderboard-apis)
7. [Admin APIs](#admin-apis)
8. [Socket.io Events](#socketio-events)

---

## Authentication APIs

### POST /auth/signup

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe",
  "role": "candidate"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "role": "candidate",
      "profile": {
        "name": "John Doe",
        "totalSessions": 0,
        "averageScore": 0
      }
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900
    }
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input or email already exists
- `500 Internal Server Error`: Server error

---

### POST /auth/login

Authenticate user and receive access tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "role": "candidate",
      "profile": {
        "name": "John Doe",
        "totalSessions": 5,
        "averageScore": 78.5
      }
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900
    }
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid credentials
- `500 Internal Server Error`: Server error

---

### POST /auth/refresh

Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or expired refresh token
- `500 Internal Server Error`: Server error

---

### GET /auth/profile

Get current user profile.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "role": "candidate",
    "profile": {
      "name": "John Doe",
      "resumeUrl": "https://storage.example.com/resumes/abc123.pdf",
      "totalSessions": 5,
      "averageScore": 78.5
    },
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `500 Internal Server Error`: Server error

---

## Resume APIs

### POST /api/resume/upload

Upload resume file for analysis.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Request Body (Form Data):**
- `resume`: File (PDF, DOC, or DOCX, max 5MB)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Resume uploaded successfully",
  "data": {
    "resumeUrl": "https://storage.example.com/resumes/abc123.pdf",
    "filename": "john_doe_resume.pdf",
    "size": 245678
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid file type or size
- `401 Unauthorized`: Missing or invalid token
- `500 Internal Server Error`: Server error

---

### POST /api/resume/analyze

Analyze uploaded resume with Gemini AI.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "resumeUrl": "https://storage.example.com/resumes/abc123.pdf",
  "jobDescription": "Optional JD text for match scoring"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "skills": [
      "JavaScript",
      "React",
      "Node.js",
      "MongoDB",
      "AWS"
    ],
    "experience": [
      {
        "company": "Tech Corp",
        "role": "Senior Developer",
        "duration": "2020-2023",
        "highlights": [
          "Led team of 5 developers",
          "Implemented microservices architecture"
        ]
      }
    ],
    "projects": [
      {
        "name": "E-commerce Platform",
        "description": "Built scalable online shopping system",
        "technologies": ["React", "Node.js", "PostgreSQL"]
      }
    ],
    "education": [
      {
        "degree": "B.S. Computer Science",
        "institution": "University of Technology",
        "year": "2019"
      }
    ],
    "suggestions": [
      "Add quantifiable achievements with metrics",
      "Include certifications section",
      "Optimize keywords for ATS systems"
    ],
    "jdMatchScore": 85,
    "strengthAreas": [
      "Strong technical skills in modern web technologies",
      "Proven leadership experience"
    ],
    "improvementAreas": [
      "Add more details about project impact",
      "Include soft skills section"
    ]
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid resume URL
- `401 Unauthorized`: Missing or invalid token
- `500 Internal Server Error`: Server or Gemini API error

---

### GET /api/resume/:userId

Get user's resume analysis.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "resumeUrl": "https://storage.example.com/resumes/abc123.pdf",
    "analysis": {
      "skills": ["JavaScript", "React", "Node.js"],
      "experience": [...],
      "projects": [...],
      "education": [...],
      "suggestions": [...],
      "jdMatchScore": 85
    },
    "uploadedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Cannot access other user's resume
- `404 Not Found`: Resume not found
- `500 Internal Server Error`: Server error

---

## Gemini AI APIs

### POST /api/gemini/generate-questions

Generate interview questions using Gemini AI.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "role": "Software Engineer",
  "mode": "resume-based",
  "resume": "Resume text content...",
  "jobDescription": "Optional JD text",
  "difficulty": "medium",
  "previousQuestions": []
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "questions": [
      {
        "id": "q1",
        "text": "Tell me about your experience with React and state management",
        "category": "technical",
        "difficulty": "medium",
        "expectedKeywords": ["React", "Redux", "Context API", "state"],
        "timeLimit": 180
      },
      {
        "id": "q2",
        "text": "Describe a challenging project you led and how you overcame obstacles",
        "category": "behavioral",
        "difficulty": "medium",
        "expectedKeywords": ["leadership", "problem-solving", "team"],
        "timeLimit": 240
      }
    ]
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input parameters
- `401 Unauthorized`: Missing or invalid token
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server or Gemini API error

---

### POST /api/gemini/evaluate-answer

Evaluate candidate's answer using Gemini AI.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "question": {
    "id": "q1",
    "text": "Tell me about your experience with React",
    "category": "technical",
    "expectedKeywords": ["React", "components", "hooks"]
  },
  "answer": "I have 3 years of experience with React...",
  "conversationHistory": [
    {
      "role": "assistant",
      "content": "Previous question..."
    },
    {
      "role": "user",
      "content": "Previous answer..."
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "score": 85,
    "feedback": "Strong answer demonstrating practical React experience. Good coverage of hooks and component lifecycle.",
    "strengths": [
      "Clear explanation of React concepts",
      "Provided specific examples from projects",
      "Mentioned modern React patterns"
    ],
    "improvements": [
      "Could elaborate more on performance optimization",
      "Add details about testing strategies"
    ],
    "followUpQuestion": {
      "id": "q1_followup",
      "text": "Can you explain how you optimized React performance in your projects?",
      "category": "technical",
      "difficulty": "medium",
      "timeLimit": 120
    },
    "sentiment": {
      "overall": "positive",
      "confidence": 0.85,
      "clarity": 0.90,
      "professionalism": 0.88
    }
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input parameters
- `401 Unauthorized`: Missing or invalid token
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server or Gemini API error

---

## Session APIs

### POST /api/sessions/start

Start a new interview session.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "jobRole": "Software Engineer",
  "mode": "resume-based",
  "metadata": {
    "mentorModeEnabled": true,
    "jobDescription": "Optional JD text"
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "sessionId": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439012",
    "jobRole": "Software Engineer",
    "mode": "resume-based",
    "status": "in-progress",
    "startTime": "2024-01-15T10:30:00.000Z",
    "questions": []
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input parameters
- `401 Unauthorized`: Missing or invalid token
- `500 Internal Server Error`: Server error

---

### POST /api/sessions/:id/submit-answer

Submit answer for evaluation.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "questionId": "q1",
  "answer": "I have 3 years of experience with React...",
  "timeSpent": 145
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "evaluation": {
      "score": 85,
      "feedback": "Strong answer...",
      "strengths": [...],
      "improvements": [...],
      "sentiment": {...}
    },
    "nextQuestion": {
      "id": "q2",
      "text": "Next question...",
      "category": "behavioral",
      "timeLimit": 180
    }
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input parameters
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Cannot access other user's session
- `404 Not Found`: Session not found
- `500 Internal Server Error`: Server error

---

### POST /api/sessions/:id/complete

Complete interview session and generate performance report.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "sessionId": "507f1f77bcf86cd799439011",
    "status": "completed",
    "endTime": "2024-01-15T11:15:00.000Z",
    "performanceReport": {
      "overallScore": 82,
      "categoryScores": {
        "technical": 85,
        "behavioral": 80,
        "communication": 81
      },
      "wordCountMetrics": {
        "average": 125,
        "total": 875,
        "perQuestion": [120, 135, 110, 140, 125, 130, 115]
      },
      "sentimentAnalysis": {
        "overall": "positive",
        "confidence": 0.83,
        "clarity": 0.87,
        "professionalism": 0.85
      },
      "strengths": [
        "Strong technical knowledge",
        "Clear communication",
        "Good use of examples"
      ],
      "weaknesses": [
        "Could provide more quantifiable results",
        "Some answers lacked depth"
      ],
      "recommendations": [
        "Practice STAR method for behavioral questions",
        "Add more metrics to demonstrate impact",
        "Work on concise explanations"
      ],
      "carFrameworkScore": 78
    }
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Cannot access other user's session
- `404 Not Found`: Session not found
- `500 Internal Server Error`: Server error

---

### GET /api/sessions/:id

Get session details.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "userId": "507f1f77bcf86cd799439012",
    "jobRole": "Software Engineer",
    "mode": "resume-based",
    "status": "completed",
    "startTime": "2024-01-15T10:30:00.000Z",
    "endTime": "2024-01-15T11:15:00.000Z",
    "questions": [
      {
        "question": {...},
        "answer": "...",
        "evaluation": {...},
        "timeSpent": 145,
        "timestamp": "2024-01-15T10:32:00.000Z"
      }
    ],
    "performanceReport": {...},
    "recordingUrl": "https://storage.example.com/recordings/session123.webm",
    "transcriptUrl": "https://storage.example.com/transcripts/session123.txt"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Cannot access other user's session
- `404 Not Found`: Session not found
- `500 Internal Server Error`: Server error

---

### GET /api/sessions/user/:userId

Get user's session history.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `role` (optional): Filter by job role
- `status` (optional): Filter by status

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "507f1f77bcf86cd799439011",
        "jobRole": "Software Engineer",
        "mode": "resume-based",
        "status": "completed",
        "startTime": "2024-01-15T10:30:00.000Z",
        "overallScore": 82
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 25,
      "itemsPerPage": 10
    }
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Cannot access other user's sessions
- `500 Internal Server Error`: Server error

---

## Coding Challenge APIs

### GET /api/coding/challenges/:role

Get coding challenges for specific role.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "challenges": [
      {
        "id": "challenge1",
        "title": "Implement Binary Search",
        "description": "Write a function that performs binary search on a sorted array...",
        "difficulty": "medium",
        "role": "Software Engineer",
        "languages": ["python", "javascript", "java", "cpp"],
        "testCases": [
          {
            "input": {"arr": [1, 2, 3, 4, 5], "target": 3},
            "expectedOutput": 2,
            "isHidden": false
          }
        ],
        "starterCode": {
          "python": "def binary_search(arr, target):\n    # Your code here\n    pass",
          "javascript": "function binarySearch(arr, target) {\n    // Your code here\n}"
        }
      }
    ]
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `404 Not Found`: No challenges found for role
- `500 Internal Server Error`: Server error

---

### POST /api/coding/submit

Submit code for validation.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "sessionId": "507f1f77bcf86cd799439011",
  "challengeId": "challenge1",
  "code": "def binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    ...",
  "language": "python"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "isCorrect": true,
    "testResults": [
      {
        "input": {"arr": [1, 2, 3, 4, 5], "target": 3},
        "expectedOutput": 2,
        "actualOutput": 2,
        "passed": true
      }
    ],
    "geminiAnalysis": {
      "codeQuality": 85,
      "efficiency": "Good time complexity O(log n)",
      "bestPractices": [
        "Clean variable naming",
        "Proper edge case handling"
      ],
      "suggestions": [
        "Consider adding input validation",
        "Add docstring for documentation"
      ]
    },
    "followUpQuestions": [
      {
        "id": "followup1",
        "text": "How would you modify this to find the first occurrence in case of duplicates?",
        "category": "coding",
        "timeLimit": 120
      }
    ]
  }
}
```

**Error Responses:**
- `400 Bad Request`: Invalid input parameters
- `401 Unauthorized`: Missing or invalid token
- `500 Internal Server Error`: Server or execution error

---

## Leaderboard APIs

### GET /api/leaderboard

Get global leaderboard.

**Query Parameters:**
- `role` (optional): Filter by job role
- `limit` (optional): Number of entries (default: 10)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "userId": "507f1f77bcf86cd799439011",
        "username": "user_abc***",
        "jobRole": "Software Engineer",
        "averageScore": 92.5,
        "totalSessions": 15
      },
      {
        "rank": 2,
        "userId": "507f1f77bcf86cd799439012",
        "username": "user_xyz***",
        "jobRole": "Software Engineer",
        "averageScore": 89.3,
        "totalSessions": 12
      }
    ],
    "currentUser": {
      "rank": 45,
      "percentile": 78,
      "averageScore": 82.0
    }
  }
}
```

**Error Responses:**
- `500 Internal Server Error`: Server error

---

## Admin APIs

### GET /api/admin/dashboard

Get admin dashboard statistics.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Note:** Requires admin role.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "totalUsers": 1250,
    "activeSessions": 23,
    "completedSessions": 5678,
    "averagePlatformScore": 78.5,
    "roleDistribution": {
      "Software Engineer": 450,
      "AI/ML Engineer": 320,
      "Cloud Engineer": 280,
      "Cybersecurity": 200
    },
    "recentSessions": [
      {
        "id": "507f1f77bcf86cd799439011",
        "userId": "507f1f77bcf86cd799439012",
        "userName": "John Doe",
        "jobRole": "Software Engineer",
        "score": 85,
        "completedAt": "2024-01-15T11:15:00.000Z"
      }
    ]
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Requires admin role
- `500 Internal Server Error`: Server error

---

### GET /api/admin/users

Get all users with filtering.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `role` (optional): Filter by role
- `search` (optional): Search by name or email

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "507f1f77bcf86cd799439011",
        "email": "user@example.com",
        "role": "candidate",
        "profile": {
          "name": "John Doe",
          "totalSessions": 5,
          "averageScore": 82.0
        },
        "createdAt": "2024-01-10T08:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 50,
      "totalItems": 1250
    }
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Requires admin role
- `500 Internal Server Error`: Server error

---

### GET /api/admin/sessions

Get all sessions with filtering.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page`, `limit`: Pagination
- `userId`: Filter by user
- `role`: Filter by job role
- `status`: Filter by status
- `startDate`, `endDate`: Date range filter

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "sessions": [...],
    "pagination": {...}
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Requires admin role
- `500 Internal Server Error`: Server error

---

### POST /api/admin/export

Export session data.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "format": "csv",
  "filters": {
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "role": "Software Engineer"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://storage.example.com/exports/sessions_2024-01.csv",
    "expiresAt": "2024-01-15T12:00:00.000Z"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Requires admin role
- `500 Internal Server Error`: Server error

---

## Socket.io Events

### Connection

**Client connects:**
```javascript
const socket = io('http://localhost:5000', {
  auth: {
    token: 'Bearer <access_token>'
  }
});
```

### Client → Server Events

#### session:start
Start interview session.
```javascript
socket.emit('session:start', { sessionId: '507f1f77bcf86cd799439011' });
```

#### answer:submit
Submit answer for evaluation.
```javascript
socket.emit('answer:submit', {
  sessionId: '507f1f77bcf86cd799439011',
  questionId: 'q1',
  answer: 'My answer text...'
});
```

#### session:end
End interview session.
```javascript
socket.emit('session:end', { sessionId: '507f1f77bcf86cd799439011' });
```

### Server → Client Events

#### question:new
Receive new question.
```javascript
socket.on('question:new', (question) => {
  console.log('New question:', question);
  // { id, text, category, difficulty, timeLimit }
});
```

#### evaluation:result
Receive answer evaluation.
```javascript
socket.on('evaluation:result', (evaluation) => {
  console.log('Evaluation:', evaluation);
  // { score, feedback, strengths, improvements, sentiment }
});
```

#### score:update
Receive score update.
```javascript
socket.on('score:update', (data) => {
  console.log('Score updated:', data.score);
});
```

#### session:completed
Session completion notification.
```javascript
socket.on('session:completed', (report) => {
  console.log('Session completed:', report);
  // Navigate to results page
});
```

#### notification
General notifications.
```javascript
socket.on('notification', (message) => {
  console.log('Notification:', message);
});
```

---

## Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR`: Invalid input parameters
- `AUTHENTICATION_ERROR`: Missing or invalid authentication
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `GEMINI_API_ERROR`: Gemini AI service error
- `DATABASE_ERROR`: Database operation failed
- `FILE_UPLOAD_ERROR`: File upload failed
- `INTERNAL_ERROR`: Unexpected server error

---

## Rate Limiting

API endpoints have the following rate limits:

- **Authentication endpoints**: 5 requests per minute
- **Gemini AI endpoints**: 10 requests per minute
- **General endpoints**: 60 requests per minute
- **Admin endpoints**: 100 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1642248000
```

---

## Pagination

List endpoints support pagination with these query parameters:

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)

Pagination response format:
```json
{
  "pagination": {
    "currentPage": 1,
    "totalPages": 10,
    "totalItems": 95,
    "itemsPerPage": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

## Versioning

The API uses URL versioning. Current version: v1

Future versions will be accessible via: `/api/v2/...`

---

## Support

For API support, contact: support@aiinterviewmaker.com

API Status: https://status.aiinterviewmaker.com
