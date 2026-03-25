# Implementation Plan

## Phase 1: Backend Foundation & Gemini Integration

- [x] 1. Set up enhanced backend project structure





  - Create new directory structure: `/backend/src` with subdirectories for `controllers`, `services`, `models`, `middleware`, `utils`, `config`
  - Initialize TypeScript configuration with strict mode enabled
  - Set up environment variables file (`.env.example`) with placeholders for `GEMINI_API_KEY`, `JWT_SECRET`, `DATABASE_URL`, `PORT`
  - Install core dependencies: `express`, `@google/generative-ai`, `jsonwebtoken`, `bcrypt`, `mongoose` or `pg`, `dotenv`, `cors`, `express-validator`
  - Create `server.ts` as main entry point with Express app initialization
  - _Requirements: 1.1, 1.2, 1.3, 13.1, 13.2_

- [x] 2. Implement authentication system




- [x] 2.1 Create User model and database schema


  - Define User schema with fields: `email`, `passwordHash`, `role`, `profile` (name, resumeUrl, totalSessions, averageScore), `createdAt`
  - Implement Mongoose model (MongoDB) or Sequelize model (PostgreSQL) with proper indexes on email field
  - Add validation rules for email format and password requirements
  - _Requirements: 1.1, 13.2_

- [x] 2.2 Build authentication controllers and routes


  - Create `AuthController` with methods: `signup`, `login`, `refreshToken`, `getProfile`
  - Implement password hashing with bcrypt (salt rounds = 10)
  - Generate JWT access tokens (15 min expiry) and refresh tokens (7 day expiry)
  - Create routes: `POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/profile`
  - Add input validation middleware using express-validator
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2.3 Create JWT authentication middleware


  - Implement `authMiddleware` to verify JWT tokens from Authorization header
  - Extract user information from token and attach to request object
  - Handle token expiration and invalid token errors
  - Create `roleMiddleware` to check user roles (candidate/admin)
  - _Requirements: 1.3, 1.4, 1.5_

- [ ]* 2.4 Write authentication tests
  - Unit tests for password hashing and JWT generation
  - Integration tests for signup, login, and token refresh endpoints
  - Test invalid credentials and expired token scenarios
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 3. Integrate Gemini AI service




- [x] 3.1 Create Gemini service foundation


  - Create `GeminiService` class in `/services/geminiService.ts`
  - Initialize Google Generative AI client with API key from environment
  - Configure Gemini 1.5 Pro model for complex tasks and Flash model for simple tasks
  - Implement error handling wrapper with retry logic (3 attempts with exponential backoff)
  - _Requirements: 4.1, 4.2_

- [x] 3.2 Implement question generation functionality


  - Create `generateQuestions` method accepting role, resume text, job description, and difficulty level
  - Build prompt templates for different interview modes (resume-based, JD-based, general)
  - Parse Gemini response to extract structured questions with categories and time limits
  - Implement context memory to avoid duplicate questions in same session
  - Return array of Question objects with id, text, category, difficulty, expectedKeywords, timeLimit
  - _Requirements: 2.2, 2.3, 3.2, 3.3_

- [x] 3.3 Build answer evaluation system


  - Create `evaluateAnswer` method accepting question, answer, and conversation history
  - Construct evaluation prompt with context from previous Q&A pairs
  - Parse Gemini response for score, feedback, strengths, improvements, and follow-up questions
  - Implement sentiment analysis using Gemini to assess tone and confidence
  - Return Evaluation object with all feedback components
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 14.1, 14.2_

- [x] 3.4 Create Gemini API endpoints


  - Create `GeminiController` with methods for question generation and answer evaluation
  - Implement routes: `POST /api/gemini/generate-questions`, `POST /api/gemini/evaluate-answer`
  - Add authentication middleware to protect endpoints
  - Implement rate limiting (10 requests per minute per user)
  - _Requirements: 4.1, 4.2_

- [ ]* 3.5 Test Gemini integration
  - Mock Gemini API responses for unit tests
  - Test question generation with various inputs (resume, JD, role)
  - Test answer evaluation with sample answers
  - Verify retry logic handles API failures
  - _Requirements: 4.1, 4.2, 4.3_

## Phase 2: Resume Analysis & File Handling

- [x] 4. Implement resume upload and analysis




- [x] 4.1 Set up file upload infrastructure


  - Install and configure Multer middleware for file uploads
  - Create `/uploads` directory with subdirectories for resumes and recordings
  - Configure file size limit (5MB) and allowed types (PDF, DOC, DOCX)
  - Implement file validation middleware to check file type and size
  - Generate unique filenames using UUID to prevent collisions
  - _Requirements: 2.1, 8.2_

- [x] 4.2 Build resume text extraction


  - Install PDF parsing library (`pdf-parse`) and DOC parsing library (`mammoth`)
  - Create `ResumeParser` utility class with methods for each file type
  - Implement `extractTextFromPDF` and `extractTextFromDOC` methods
  - Handle parsing errors gracefully with informative error messages
  - Return extracted text as plain string
  - _Requirements: 2.1, 2.2_

- [x] 4.3 Create resume analysis with Gemini


  - Create `ResumeAnalyzer` service using Gemini AI
  - Implement `analyzeResume` method that sends resume text to Gemini
  - Build prompt to extract skills, experience, projects, education, and provide suggestions
  - Parse Gemini response into structured ResumeAnalysis object
  - Calculate JD match score when job description is provided
  - _Requirements: 2.2, 2.3, 2.4, 2.5_

- [x] 4.4 Build resume API endpoints


  - Create `ResumeController` with upload and analysis methods
  - Implement routes: `POST /api/resume/upload`, `POST /api/resume/analyze`, `GET /api/resume/:userId`
  - Store resume URL and analysis results in User profile
  - Add authentication middleware to ensure users can only access their own resumes
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 4.5 Test resume processing






  - Create sample resume files (PDF, DOC) for testing
  - Test file upload with valid and invalid files
  - Test text extraction from different file formats
  - Verify Gemini analysis produces expected structure
  - _Requirements: 2.1, 2.2, 2.3_

## Phase 3: Interview Session Management

- [x] 5. Build interview session system




- [x] 5.1 Create Session model and schema


  - Define Session schema with fields: `userId`, `jobRole`, `mode`, `status`, `startTime`, `endTime`, `questions`, `performanceReport`, `recordingUrl`, `transcriptUrl`, `metadata`
  - Implement database model with proper indexes on userId and status
  - Add methods for session lifecycle: `start`, `addQuestion`, `complete`, `abandon`
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 5.2 Implement session controller and routes


  - Create `SessionController` with methods: `startSession`, `submitAnswer`, `completeSession`, `getSession`, `getUserSessions`
  - Implement routes: `POST /api/sessions/start`, `POST /api/sessions/:id/submit-answer`, `POST /api/sessions/:id/complete`, `GET /api/sessions/:id`, `GET /api/sessions/user/:userId`
  - Validate session ownership before allowing operations
  - Update user statistics (totalSessions, averageScore) on session completion
  - _Requirements: 8.3, 8.4, 8.5_

- [x] 5.3 Build performance report generation


  - Create `PerformanceAnalyzer` service using Gemini AI
  - Implement `generateReport` method that analyzes complete session data
  - Calculate overall score, category scores (technical, behavioral, communication)
  - Compute word count metrics and sentiment analysis aggregates
  - Generate strengths, weaknesses, and recommendations using Gemini
  - Return structured PerformanceReport object
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 5.4 Integrate session recording


  - Create `RecordingService` to handle video/audio storage
  - Implement methods to save recording files to storage (local or cloud)
  - Generate transcript from audio using Web Speech API or external service
  - Store recording URL and transcript URL in session document
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 5.5 Test session management





  - Test complete session lifecycle from start to completion
  - Verify performance report generation with sample session data
  - Test session retrieval and filtering
  - Verify user statistics update correctly
  - _Requirements: 8.3, 8.4, 8.5_

## Phase 4: Real-Time Communication with Socket.io

- [x] 6. Enhance Socket.io integration





- [x] 6.1 Set up Socket.io server with authentication


  - Configure Socket.io with CORS settings for client origin
  - Implement Socket.io authentication middleware to verify JWT tokens
  - Create namespace for interview sessions: `/interview`
  - Set up connection and disconnection event handlers
  - _Requirements: 10.1, 10.4_

- [x] 6.2 Implement session-specific Socket.io rooms

  - Create room for each active session using session ID
  - Join user to their session room on connection
  - Implement room cleanup on session completion or disconnection
  - _Requirements: 10.4_

- [x] 6.3 Build real-time event handlers

  - Implement server events: `question:new`, `evaluation:result`, `score:update`, `session:completed`, `notification`
  - Implement client event listeners: `session:start`, `answer:submit`, `session:end`
  - Emit evaluation results immediately after Gemini processing
  - Broadcast score updates to client in real-time
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 6.4 Add Socket.io error handling and reconnection

  - Implement error event handlers for connection failures
  - Add automatic reconnection logic with exponential backoff
  - Restore session state on reconnection
  - _Requirements: 10.5_

- [x] 6.5 Test Socket.io communication






  - Test real-time question delivery and answer submission
  - Verify score updates broadcast correctly
  - Test multiple concurrent sessions in separate rooms
  - Test reconnection after network interruption
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

## Phase 5: Coding Challenge System

- [x] 7. Implement coding assessment features





- [x] 7.1 Create coding challenge data models


  - Define CodingChallenge schema with fields: `title`, `description`, `difficulty`, `role`, `languages`, `testCases`, `starterCode`
  - Create challenge bank with 3-5 challenges per role (AI/ML, Cloud, Cybersecurity, Software Engineer)
  - Store challenges in database or JSON configuration file
  - _Requirements: 6.1, 6.5_

- [x] 7.2 Build code validation service


  - Create `CodeValidator` service using Gemini AI
  - Implement `validateCode` method that sends code to Gemini for analysis
  - Build prompt to evaluate code quality, efficiency, correctness, and best practices
  - Parse Gemini response for feedback and suggestions
  - Generate follow-up questions based on code implementation
  - _Requirements: 6.3, 6.4_

- [x] 7.3 Implement code execution sandbox (optional)


  - Research safe code execution options (Docker containers, VM2, or external service)
  - Implement basic test case execution for supported languages
  - Return test results with pass/fail status for each test case
  - Add timeout protection (5 seconds max execution time)
  - _Requirements: 6.3_

- [x] 7.4 Create coding challenge API endpoints



  - Create `CodingController` with methods for challenge retrieval and code submission
  - Implement routes: `GET /api/coding/challenges/:role`, `POST /api/coding/submit`
  - Integrate code validation into session flow for technical roles
  - Store code submissions in session questions array
  - _Requirements: 6.1, 6.3, 6.4_

- [x] 7.5 Test coding challenge system










  - Test challenge retrieval for different roles
  - Test code submission with valid and invalid code
  - Verify Gemini provides meaningful code feedback
  - Test follow-up question generation
  - _Requirements: 6.1, 6.3, 6.4_

## Phase 6: Admin Dashboard & Analytics

- [x] 8. Build admin functionality



- [x] 8.1 Create admin dashboard data aggregation


  - Create `AnalyticsService` to compute platform statistics
  - Implement methods: `getTotalUsers`, `getActiveSessions`, `getCompletedSessions`, `getAveragePlatformScore`, `getRoleDistribution`
  - Use database aggregation queries for efficient computation
  - Cache results with 5-minute TTL using in-memory cache or Redis
  - _Requirements: 9.2, 9.3_

- [x] 8.2 Implement admin API endpoints


  - Create `AdminController` with methods for dashboard, user management, and session viewing
  - Implement routes: `GET /api/admin/dashboard`, `GET /api/admin/users`, `GET /api/admin/sessions`, `POST /api/admin/export`
  - Add role middleware to restrict access to admin users only
  - Implement filtering and pagination for user and session lists
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 8.3 Build data export functionality


  - Create export service to generate CSV or JSON files from session data
  - Implement filtering by date range, user, or job role
  - Stream large exports to prevent memory issues
  - Return download URL or file stream
  - _Requirements: 9.4_

- [x] 8.4 Test admin features






  - Test dashboard statistics calculation
  - Test user and session filtering
  - Test data export with various filters
  - Verify admin-only access restrictions
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

## Phase 7: Frontend Migration to React

- [x] 9. Set up React frontend project





  - Initialize React app using Vite with TypeScript template
  - Install dependencies: `react-router-dom`, `axios`, `socket.io-client`, `@react-three/fiber`, `@react-three/drei`, `@monaco-editor/react`, `react-chartjs-2`, `chart.js`, `canvas-confetti`, `react-hook-form`, `zustand` or `redux-toolkit`
  - Set up project structure: `/src` with subdirectories for `components`, `pages`, `services`, `hooks`, `utils`, `types`, `store`
  - Configure environment variables for API base URL and Socket.io URL
  - Set up Axios instance with interceptors for authentication headers
  - _Requirements: 1.1, 1.2_

- [x] 10. Implement authentication UI




- [x] 10.1 Create authentication pages


  - Build `LoginPage` component with email and password inputs
  - Build `SignupPage` component with email, password, name, and role selection
  - Implement form validation using react-hook-form
  - Add error message display for authentication failures
  - _Requirements: 1.1, 1.2_

- [x] 10.2 Build authentication state management


  - Create authentication store using Zustand or Redux
  - Implement actions: `login`, `signup`, `logout`, `refreshToken`
  - Store JWT tokens in memory and refresh token in httpOnly cookie or localStorage
  - Create `useAuth` hook for accessing auth state in components
  - _Requirements: 1.2, 1.3, 1.4_

- [x] 10.3 Create protected route component


  - Build `ProtectedRoute` wrapper component that checks authentication
  - Redirect to login page if user is not authenticated
  - Implement role-based route protection for admin pages
  - _Requirements: 1.3, 1.5_

 - [x] 11. Build interview setup interface





- [x] 11.1 Create role selection page

  - Build `InterviewSetupPage` component with job role dropdown
  - Add interview mode selection: resume-based, JD-based, or general
  - Implement navigation to appropriate setup step based on mode
  - _Requirements: 2.2, 3.1_

- [x] 11.2 Implement resume upload component


  - Create `ResumeUploader` component with drag-and-drop file input
  - Display file preview and upload progress
  - Call resume upload API and show analysis results
  - Display resume suggestions and JD match score
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 11.3 Build job description input


  - Create `JDInput` component with large textarea for job description
  - Add character count display (max 5000 characters)
  - Validate JD input before proceeding to interview
  - _Requirements: 3.1, 3.2_

- [x] 12. Migrate and enhance 3D avatar




- [x] 12.1 Convert Three.js avatar to React Three Fiber


  - Create `Avatar3D` component using `@react-three/fiber`
  - Migrate existing cube animation to React Three Fiber syntax
  - Add camera controls using `@react-three/drei` OrbitControls
  - _Requirements: 5.2_

- [x] 12.2 Enhance avatar with expressions and gestures


  - Add multiple animation states: idle, speaking, listening, thinking, celebrating
  - Implement state transitions based on interview events
  - Add facial expression changes using morph targets or texture swaps
  - Synchronize avatar speaking animation with question audio
  - _Requirements: 5.2, 5.4_

- [x] 12.3 Integrate camera and microphone access


  - Request camera and microphone permissions on interview start
  - Display user's camera feed in small preview window
  - Implement WebRTC video recording for session playback
  - _Requirements: 5.1, 8.1_

- [x] 13. Build interview interaction components




- [x] 13.1 Create question display component


  - Build `QuestionDisplay` component showing current question text
  - Add question category badge (technical, behavioral, situational, coding)
  - Display question number and total questions progress
  - Implement text-to-speech for question audio using Web Speech API
  - _Requirements: 4.1, 5.3_

- [x] 13.2 Implement answer input component


  - Create `AnswerInput` component with textarea for typed answers
  - Add character count and word count display
  - Implement auto-save to prevent data loss
  - _Requirements: 4.1_

- [x] 13.3 Build voice recorder component


  - Create `VoiceRecorder` component with record button
  - Implement Web Speech API for speech-to-text transcription
  - Display real-time transcription in answer input
  - Add visual indicator for recording status
  - _Requirements: 5.3, 5.5_

- [x] 13.4 Create timer component


  - Build `Timer` component displaying countdown for current question
  - Implement visual warning when time is running low (< 10 seconds)
  - Auto-submit answer when timer reaches zero
  - _Requirements: 4.1_

- [x] 13.5 Implement progress bar and mentor mode toggle


  - Create `ProgressBar` component showing interview completion percentage
  - Build `MentorModeToggle` button component
  - Display mentor mode tips when enabled (Context-Action-Result framework)
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 14. Integrate Monaco Editor for coding challenges






- [x] 14.1 Create code editor component

  - Build `CodeEditor` component using `@monaco-editor/react`
  - Configure syntax highlighting for multiple languages (Python, JavaScript, Java, C++)
  - Add language selector dropdown
  - Implement theme toggle (light/dark mode)
  - _Requirements: 6.1, 6.2_


- [x] 14.2 Build coding challenge interface

  - Create `CodingChallenge` component displaying challenge description and test cases
  - Integrate CodeEditor for code input
  - Add submit button to send code for validation
  - Display Gemini feedback and follow-up questions after submission
  - _Requirements: 6.1, 6.3, 6.4_

- [x] 15. Build performance results page






- [x] 15.1 Create performance report display


  - Build `ResultsPage` component showing complete performance report
  - Display overall score with visual gauge or progress circle
  - Show category scores (technical, behavioral, communication) with bar chart
  - List strengths and weaknesses with icons
  - Display recommendations in expandable sections
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 15.2 Implement performance charts


  - Create `PerformanceChart` component using react-chartjs-2
  - Build word count chart showing words per question
  - Create sentiment analysis chart showing confidence and clarity trends
  - Add CAR framework score display when mentor mode was used
  - _Requirements: 7.2, 7.3, 11.5_

- [x] 15.3 Add confetti celebration

  - Integrate canvas-confetti library
  - Trigger confetti animation on results page load
  - Synchronize with avatar celebration animation
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [x] 15.4 Build session recording playback


  - Create `SessionRecording` component with video player
  - Display synchronized transcript with video timestamps
  - Add playback controls (play, pause, seek, speed)
  - _Requirements: 8.1, 8.2, 8.4_

- [x] 16. Implement real-time Socket.io integration




- [x] 16.1 Create Socket.io service


  - Build `socketService.ts` to manage Socket.io connection
  - Implement connection with JWT authentication
  - Add event emitters and listeners for interview events
  - Handle connection errors and reconnection
  - _Requirements: 10.1, 10.4, 10.5_

- [x] 16.2 Integrate Socket.io with interview flow


  - Connect Socket.io on interview start
  - Emit `answer:submit` event when candidate submits answer
  - Listen for `evaluation:result` event and display feedback
  - Listen for `score:update` event and update progress bar
  - Listen for `session:completed` event and navigate to results page
  - _Requirements: 10.1, 10.2, 10.3_

- [x] 17. Build candidate dashboard





  - Create `DashboardPage` component showing user statistics
  - Display total sessions, average score, and recent sessions list
  - Build `SessionHistory` component with session cards showing date, role, and score
  - Implement session filtering by date range and job role
  - Add navigation to view detailed session results
  - _Requirements: 8.4, 8.5_

- [x] 18. Implement leaderboard feature




- [x] 18.1 Create leaderboard data model and API


  - Define Leaderboard schema with userId, username, jobRole, averageScore, totalSessions, rank
  - Implement leaderboard update logic triggered on session completion
  - Create API endpoint: `GET /api/leaderboard` with optional role filter
  - Calculate rankings based on average score with tie-breaking by total sessions
  - _Requirements: 12.1, 12.2, 12.3_

- [x] 18.2 Build leaderboard UI component


  - Create `Leaderboard` component displaying top 10 candidates
  - Show rank, anonymized username, job role, average score, and total sessions
  - Highlight current user's position if in top 10
  - Add role filter dropdown to view leaderboard by job category
  - Display user's current rank and percentile below leaderboard
  - _Requirements: 12.1, 12.2, 12.4, 12.5_

- [x] 19. Build admin dashboard UI
















- [x] 19.1 Create admin dashboard page


  - Build `AdminPage` component with statistics cards
  - Display total users, active sessions, completed sessions, average platform score
  - Show role distribution pie chart
  - List recent sessions with user info and scores
  - _Requirements: 9.1, 9.2_

- [x] 19.2 Implement user management interface


  - Create `UserManagement` component with user list table
  - Add search and filter functionality (by role, registration date)
  - Implement pagination for large user lists
  - Add user detail view showing session history
  - _Requirements: 9.3_

- [x] 19.3 Build session analytics interface


  - Create `SessionAnalytics` component with session list table
  - Add filters for date range, user, job role, and score range
  - Implement export button to download filtered data as CSV or JSON
  - Display session details modal with complete Q&A and performance report
  - _Requirements: 9.3, 9.4_

## Phase 8: Integration, Testing & Deployment

- [x] 20. Connect frontend and backend











  - Update all API service calls to use correct backend endpoints
  - Test complete user flows: signup → login → interview setup → interview → results
  - Verify Socket.io real-time communication works end-to-end
  - Test file uploads (resume) and downloads (session recordings, exports)
  - Ensure error handling displays user-friendly messages
  - _Requirements: All_

- [x] 21. Implement error boundaries and loading states





  - Create React error boundary component to catch and display errors gracefully
  - Add loading spinners for async operations (API calls, file uploads)
  - Implement skeleton screens for data-heavy pages (dashboard, leaderboard)
  - Add toast notifications for success and error messages
  - _Requirements: All_

- [x] 22. Optimize performance





  - Implement code splitting for large components (Monaco Editor, Three.js)
  - Add lazy loading for routes using React.lazy and Suspense
  - Optimize images and assets (compress, use WebP format)
  - Enable gzip compression on backend responses
  - Implement caching strategy for API responses (React Query or SWR)
  - _Requirements: All_

- [x] 23. Write end-to-end tests












  - Set up Cypress or Playwright for E2E testing
  - Write test for complete interview flow (resume-based)
  - Write test for JD-based interview with coding challenge
  - Write test for admin dashboard access and data export
  - Test authentication flows (signup, login, logout, token refresh)
  - _Requirements: All_

- [x] 24. Set up deployment pipeline





  - Configure environment variables for production (Gemini API key, database URL, JWT secret)
  - Set up MongoDB Atlas or AWS RDS PostgreSQL for production database
  - Configure file storage (AWS S3 or Google Cloud Storage) for resumes and recordings
  - Deploy backend to Vercel, AWS, or Google Cloud
  - Deploy frontend to Vercel or Netlify
  - Set up CI/CD pipeline with GitHub Actions for automated testing and deployment
  - _Requirements: 13.1, 13.2_

- [x] 25. Conduct security audit







  - Review all API endpoints for proper authentication and authorization
  - Test for SQL injection and NoSQL injection vulnerabilities
  - Verify input validation on all user inputs
  - Test rate limiting on authentication and Gemini API endpoints
  - Ensure sensitive data (passwords, tokens) is properly encrypted
  - Review CORS configuration for production
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 26. Create documentation





  - Write API documentation with endpoint descriptions, request/response examples
  - Create user guide for candidates (how to use the platform)
  - Write admin guide for managing users and viewing analytics
  - Document environment setup for developers
  - Create deployment guide with infrastructure requirements
  - _Requirements: All_
