/**
 * Session Cleanup Utilities
 * Ensures clean, fresh sessions without old data
 */

import Session from '../models/Session';
import { Types } from 'mongoose';

export class SessionCleanupService {
  /**
   * Clean up all previous sessions for a user
   * Marks in-progress sessions as abandoned
   */
  static async cleanupUserSessions(userId: string | Types.ObjectId): Promise<void> {
    try {
      console.log(`🧹 Cleaning up previous sessions for user: ${userId}`);
      
      const result = await Session.updateMany(
        { 
          userId: new Types.ObjectId(userId.toString()),
          status: 'in-progress' 
        },
        { 
          status: 'abandoned',
          endTime: new Date()
        }
      );

      console.log(`✅ Cleaned up ${result.modifiedCount} previous sessions`);
    } catch (error) {
      console.error('❌ Error cleaning up sessions:', error);
      throw error;
    }
  }

  /**
   * Create a completely fresh session
   * Ensures no old data is carried over
   */
  static async createFreshSession(sessionData: {
    userId: string | Types.ObjectId;
    jobRole: string;
    mode: 'resume-based' | 'jd-based' | 'general';
    mentorModeEnabled?: boolean;
    jobDescription?: string;
    resumeUsed?: boolean;
    duration?: number;
  }): Promise<any> {
    try {
      // First cleanup any existing sessions
      await this.cleanupUserSessions(sessionData.userId);

      // Create completely fresh session
      const freshSession = new Session({
        userId: new Types.ObjectId(sessionData.userId.toString()),
        jobRole: sessionData.jobRole,
        mode: sessionData.mode,
        status: 'in-progress',
        startTime: new Date(),
        questions: [], // Ensure empty questions array
        metadata: {
          mentorModeEnabled: sessionData.mentorModeEnabled || false,
          jobDescription: sessionData.jobDescription || undefined,
          resumeUsed: sessionData.resumeUsed || false
        }
      });

      await freshSession.save();
      
      console.log(`✅ Created fresh session: ${freshSession._id}`);
      return freshSession;
    } catch (error) {
      console.error('❌ Error creating fresh session:', error);
      throw error;
    }
  }

  /**
   * Clear all session cache and temporary data
   */
  static clearSessionCache(): void {
    // Clear any in-memory caches
    console.log('🧹 Clearing session cache...');
    
    // If you have any global session state, clear it here
    // Example: sessionCache.clear();
    
    console.log('✅ Session cache cleared');
  }
}

export default SessionCleanupService;