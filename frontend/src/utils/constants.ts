// API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    SIGNUP: '/auth/signup',
    LOGIN: '/auth/login',
    REFRESH: '/auth/refresh',
    PROFILE: '/auth/profile',
  },
  GEMINI: {
    GENERATE_QUESTIONS: '/api/gemini/generate-questions',
    EVALUATE_ANSWER: '/api/gemini/evaluate-answer',
  },
  RESUME: {
    UPLOAD: '/api/resume/upload',
    ANALYZE: '/api/resume/analyze',
    GET: '/api/resume',
  },
  SESSION: {
    START: '/api/sessions/start',
    SUBMIT_ANSWER: '/api/sessions/:id/submit-answer',
    COMPLETE: '/api/sessions/:id/complete',
    GET: '/api/sessions/:id',
    USER_SESSIONS: '/api/sessions/user/:userId',
  },
  CODING: {
    CHALLENGES: '/api/coding/challenges',
    SUBMIT: '/api/coding/submit',
  },
  ADMIN: {
    DASHBOARD: '/api/admin/dashboard',
    USERS: '/api/admin/users',
    SESSIONS: '/api/admin/sessions',
    EXPORT: '/api/admin/export',
  },
};

// Socket events
export const SOCKET_EVENTS = {
  CLIENT: {
    SESSION_START: 'session:start',
    ANSWER_SUBMIT: 'answer:submit',
    SESSION_END: 'session:end',
  },
  SERVER: {
    QUESTION_NEW: 'question:new',
    EVALUATION_RESULT: 'evaluation:result',
    SCORE_UPDATE: 'score:update',
    SESSION_COMPLETED: 'session:completed',
    NOTIFICATION: 'notification',
  },
};

// Job roles
export const JOB_ROLES = [
  'AI/ML Engineer',
  'Cloud Engineer',
  'Cybersecurity Specialist',
  'Software Engineer',
  'Full Stack Developer',
  'Frontend Developer',
  'Backend Developer',
  'DevOps Engineer',
  'Data Scientist',
  'Product Manager',
];

// Interview modes
export const INTERVIEW_MODES = {
  RESUME_BASED: 'resume-based',
  JD_BASED: 'jd-based',
  GENERAL: 'general',
} as const;

// Question categories
export const QUESTION_CATEGORIES = {
  TECHNICAL: 'technical',
  BEHAVIORAL: 'behavioral',
  SITUATIONAL: 'situational',
  CODING: 'coding',
} as const;

// Difficulty levels
export const DIFFICULTY_LEVELS = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
} as const;

// File upload limits
export const FILE_LIMITS = {
  RESUME_MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_RESUME_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ALLOWED_RESUME_EXTENSIONS: ['.pdf', '.doc', '.docx'],
};

// Time limits
export const TIME_LIMITS = {
  QUESTION_DEFAULT: 180, // 3 minutes in seconds
  CODING_CHALLENGE: 1800, // 30 minutes in seconds
};
