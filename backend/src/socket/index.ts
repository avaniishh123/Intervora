/**
 * Socket.io module exports
 * Centralized exports for all Socket.io functionality
 */

export {
  setSocketInstance,
  getSocketInstance,
  isSocketInitialized
} from './socketInstance';

export {
  socketAuthMiddleware,
  AuthenticatedSocket,
  SocketJWTPayload
} from './socketAuth';

export {
  initializeInterviewNamespace,
  emitNewQuestion,
  emitEvaluationResult,
  emitScoreUpdate,
  emitSessionCompleted,
  emitNotification,
  getActiveSessionsCount,
  getSessionSocketCount,
  SessionStartData,
  AnswerSubmitData,
  SessionEndData,
  QuestionNewData,
  EvaluationResultData,
  ScoreUpdateData,
  SessionCompletedData,
  NotificationData
} from './interviewSocket';

export {
  saveSessionState,
  restoreSessionState,
  clearSessionState,
  updateSessionActivity,
  cleanupExpiredStates,
  startStateCleanup,
  getActiveStatesCount
} from './reconnectionHandler';
