import dotenv from 'dotenv';

// Load environment variables with override to force .env file values
dotenv.config({ override: true });

/**
 * Environment configuration with validation
 */
export const config = {
  // Server
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  databaseUrl: process.env.MONGODB_URI || process.env.DATABASE_URL || '',
  
  // Authentication
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  
  // Gemini AI
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  
  // File Upload
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10), // 5MB default
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  
  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10', 10),
};

/**
 * Validate required environment variables
 */
export function validateEnv(): void {
  const requiredVars = [
    'GEMINI_API_KEY',
    'JWT_SECRET'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  // Check for either MONGODB_URI or DATABASE_URL
  if (!process.env.MONGODB_URI && !process.env.DATABASE_URL) {
    missingVars.push('MONGODB_URI or DATABASE_URL');
  }
  
  if (missingVars.length > 0) {
    console.warn(`⚠️  Warning: Missing environment variables: ${missingVars.join(', ')}`);
    console.warn('⚠️  Some features may not work correctly. Please check your .env file.');
  }
}

export default config;
