import { AuthenticatedSocket } from './socketAuth';

/**
 * Session state for reconnection
 */
interface SessionState {
  sessionId: string;
  userId: string;
  lastActivity: Date;
  currentQuestionId?: string;
  questionsAnswered: number;
  currentScore: number;
}

/**
 * Store session states for reconnection
 * Maps userId to their session state
 */
const sessionStates = new Map<string, SessionState>();

/**
 * Session state timeout (5 minutes)
 */
const SESSION_STATE_TIMEOUT = 5 * 60 * 1000;

/**
 * Save session state for potential reconnection
 */
export function saveSessionState(
  userId: string,
  sessionId: string,
  state: Partial<SessionState>
): void {
  const existingState = sessionStates.get(userId);

  const newState: SessionState = {
    sessionId,
    userId,
    lastActivity: new Date(),
    currentQuestionId: state.currentQuestionId,
    questionsAnswered: state.questionsAnswered || 0,
    currentScore: state.currentScore || 0,
    ...existingState
  };

  sessionStates.set(userId, newState);
  console.log(`💾 Session state saved for user ${userId}`);
}

/**
 * Restore session state on reconnection
 */
export function restoreSessionState(
  socket: AuthenticatedSocket
): SessionState | null {
  if (!socket.user) {
    return null;
  }

  const userId = socket.user.userId;
  const state = sessionStates.get(userId);

  if (!state) {
    console.log(`ℹ️  No saved state found for user ${userId}`);
    return null;
  }

  // Check if state is still valid (not expired)
  const now = new Date();
  const timeSinceLastActivity = now.getTime() - state.lastActivity.getTime();

  if (timeSinceLastActivity > SESSION_STATE_TIMEOUT) {
    console.log(`⏰ Session state expired for user ${userId}`);
    sessionStates.delete(userId);
    return null;
  }

  // Rejoin session room
  socket.join(state.sessionId);
  console.log(`🔄 Session state restored for user ${userId}, rejoined room ${state.sessionId}`);

  // Emit state restoration notification
  socket.emit('notification', {
    type: 'info',
    message: 'Session reconnected successfully'
  });

  // Emit current state
  socket.emit('state:restored', {
    sessionId: state.sessionId,
    currentQuestionId: state.currentQuestionId,
    questionsAnswered: state.questionsAnswered,
    currentScore: state.currentScore
  });

  return state;
}

/**
 * Clear session state
 */
export function clearSessionState(userId: string): void {
  sessionStates.delete(userId);
  console.log(`🗑️  Session state cleared for user ${userId}`);
}

/**
 * Update session state activity timestamp
 */
export function updateSessionActivity(userId: string): void {
  const state = sessionStates.get(userId);
  if (state) {
    state.lastActivity = new Date();
  }
}

/**
 * Clean up expired session states (run periodically)
 */
export function cleanupExpiredStates(): void {
  const now = new Date();
  let cleanedCount = 0;

  for (const [userId, state] of sessionStates.entries()) {
    const timeSinceLastActivity = now.getTime() - state.lastActivity.getTime();

    if (timeSinceLastActivity > SESSION_STATE_TIMEOUT) {
      sessionStates.delete(userId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} expired session states`);
  }
}

/**
 * Start periodic cleanup of expired states
 */
export function startStateCleanup(): void {
  // Run cleanup every minute
  setInterval(cleanupExpiredStates, 60 * 1000);
  console.log('🔄 Session state cleanup scheduler started');
}

/**
 * Get all active session states count
 */
export function getActiveStatesCount(): number {
  return sessionStates.size;
}

export default {
  saveSessionState,
  restoreSessionState,
  clearSessionState,
  updateSessionActivity,
  cleanupExpiredStates,
  startStateCleanup,
  getActiveStatesCount
};
