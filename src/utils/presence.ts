/**
 * Presence System
 * Real-time online/offline status tracking
 */

import type { ServerSocket } from "../types.js";

export interface PresenceState {
  status: "online" | "away" | "offline" | "busy";
  lastSeen: number;
  customData?: Record<string, unknown>;
}

export interface PresenceUpdate {
  userId: string;
  socketId: string;
  status: PresenceState["status"];
  timestamp: number;
}

export type PresenceHandler = (update: PresenceUpdate) => void;

export class PresenceManager {
  private presenceMap: Map<string, PresenceState> = new Map();
  private socketToUser: Map<string, string> = new Map();
  private userToSockets: Map<string, Set<string>> = new Map();
  private handlers: Set<PresenceHandler> = new Set();
  private awayTimeout: number = 5 * 60 * 1000; // 5 minutes
  private offlineTimeout: number = 10 * 60 * 1000; // 10 minutes

  /**
   * Track a socket connection for a user
   */
  track(socketId: string, userId: string, initialStatus: PresenceState["status"] = "online"): void {
    this.socketToUser.set(socketId, userId);
    
    if (!this.userToSockets.has(userId)) {
      this.userToSockets.set(userId, new Set());
    }
    this.userToSockets.get(userId)!.add(socketId);

    this.updatePresence(userId, socketId, initialStatus);
  }

  /**
   * Untrack a socket connection
   */
  untrack(socketId: string): void {
    const userId = this.socketToUser.get(socketId);
    
    if (!userId) return;

    this.socketToUser.delete(socketId);
    
    const sockets = this.userToSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      
      // If no more sockets, user is offline
      if (sockets.size === 0) {
        this.userToSockets.delete(userId);
        this.updatePresence(userId, socketId, "offline");
      }
    }
  }

  /**
   * Update presence status
   */
  updatePresence(
    userId: string,
    socketId: string,
    status: PresenceState["status"],
    customData?: Record<string, unknown>
  ): void {
    const previousState = this.presenceMap.get(userId);
    
    const newState: PresenceState = {
      status,
      lastSeen: Date.now(),
      customData: { ...previousState?.customData, ...customData },
    };

    this.presenceMap.set(userId, newState);

    // Notify handlers
    const update: PresenceUpdate = {
      userId,
      socketId,
      status,
      timestamp: newState.lastSeen,
    };

    this.handlers.forEach(handler => handler(update));
  }

  /**
   * Get presence for a user
   */
  getPresence(userId: string): PresenceState | null {
    return this.presenceMap.get(userId) || null;
  }

  /**
   * Get presence for multiple users
   */
  getPresenceMultiple(userIds: string[]): Map<string, PresenceState> {
    const result = new Map<string, PresenceState>();
    
    for (const userId of userIds) {
      const presence = this.presenceMap.get(userId);
      if (presence) {
        result.set(userId, presence);
      }
    }

    return result;
  }

  /**
   * Get all online users
   */
  getOnlineUsers(): string[] {
    return Array.from(this.presenceMap.entries())
      .filter(([, state]) => state.status === "online" || state.status === "away")
      .map(([userId]) => userId);
  }

  /**
   * Subscribe to presence updates
   */
  onPresenceChange(handler: PresenceHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /**
   * Handle heartbeat from socket
   */
  heartbeat(socketId: string): void {
    const userId = this.socketToUser.get(socketId);
    
    if (!userId) return;

    const currentState = this.presenceMap.get(userId);
    
    // If away, set back to online
    if (currentState?.status === "away") {
      this.updatePresence(userId, socketId, "online");
    } else if (currentState) {
      // Just update lastSeen without triggering notification
      currentState.lastSeen = Date.now();
    }
  }

  /**
   * Check for stale presences and update status
   */
  checkStalePresences(): void {
    const now = Date.now();

    for (const [userId, state] of this.presenceMap.entries()) {
      const elapsed = now - state.lastSeen;

      if (state.status === "online" && elapsed > this.awayTimeout) {
        // Mark as away
        const sockets = this.userToSockets.get(userId);
        const socketId = sockets?.values().next().value || "";
        this.updatePresence(userId, socketId, "away");
      } else if (state.status === "away" && elapsed > this.offlineTimeout) {
        // Mark as offline and cleanup
        const sockets = this.userToSockets.get(userId);
        if (sockets) {
          for (const socketId of sockets) {
            this.socketToUser.delete(socketId);
          }
          this.userToSockets.delete(userId);
        }
        this.updatePresence(userId, "", "offline");
      }
    }
  }

  /**
   * Create socket extension for presence
   */
  createSocketExtension(socket: ServerSocket, userId: string): PresenceSocketExtension {
    return new PresenceSocketExtension(this, socket, userId);
  }
}

export class PresenceSocketExtension {
  private manager: PresenceManager;
  private socket: ServerSocket;
  private userId: string;

  constructor(manager: PresenceManager, socket: ServerSocket, userId: string) {
    this.manager = manager;
    this.socket = socket;
    this.userId = userId;
    
    // Auto-track on creation
    this.manager.track(socket.id, userId);
  }

  /**
   * Set status
   */
  setStatus(status: PresenceState["status"]): void {
    this.manager.updatePresence(this.userId, this.socket.id, status);
  }

  /**
   * Set custom data
   */
  setCustomData(data: Record<string, unknown>): void {
    this.manager.updatePresence(this.userId, this.socket.id, "online", data);
  }

  /**
   * Get my presence
   */
  getMyPresence(): PresenceState | null {
    return this.manager.getPresence(this.userId);
  }

  /**
   * Get another user's presence
   */
  getPresence(userId: string): PresenceState | null {
    return this.manager.getPresence(userId);
  }

  /**
   * Subscribe to changes for specific users
   */
  subscribe(userIds: string[], handler: PresenceHandler): () => void {
    return this.manager.onPresenceChange((update) => {
      if (userIds.includes(update.userId)) {
        handler(update);
      }
    });
  }

  /**
   * Cleanup on disconnect
   */
  disconnect(): void {
    this.manager.untrack(this.socket.id);
  }
}

// Singleton instance
export const presenceManager = new PresenceManager();
