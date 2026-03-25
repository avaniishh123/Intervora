import { Server as SocketIOServer } from 'socket.io';

/**
 * Socket.io instance holder
 * This module provides a way to access the Socket.io instance
 * without circular dependencies
 */

let socketInstance: SocketIOServer | null = null;

/**
 * Set the Socket.io instance
 */
export function setSocketInstance(io: SocketIOServer): void {
  socketInstance = io;
  console.log('✅ Socket.io instance registered');
}

/**
 * Get the Socket.io instance
 */
export function getSocketInstance(): SocketIOServer {
  if (!socketInstance) {
    throw new Error('Socket.io instance not initialized. Call setSocketInstance first.');
  }
  return socketInstance;
}

/**
 * Check if Socket.io instance is initialized
 */
export function isSocketInitialized(): boolean {
  return socketInstance !== null;
}

export default {
  setSocketInstance,
  getSocketInstance,
  isSocketInitialized
};
