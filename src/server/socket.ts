import { RedisStateManager } from "../redis/state-manager.js";
import type {
  ServerSocket,
  SocketMessage,
  SessionState,
} from "../types.js";
import { redisKeys } from "../redis/keys.js";
import { randomBytes } from "crypto";

export class ServerSocketImpl implements ServerSocket {
  public id: string;
  private state: SessionState;
  private stateManager: RedisStateManager;
  private ackCallbacks: Map<string, (response?: unknown) => void> = new Map();

  constructor(
    sessionId: string,
    state: SessionState,
    stateManager: RedisStateManager
  ) {
    this.id = sessionId;
    this.state = state;
    this.stateManager = stateManager;
  }

  async emit(event: string, data: unknown, ack?: (response?: unknown) => void): Promise<void> {
    const messageId = ack ? randomBytes(8).toString("hex") : undefined;
    
    const message: SocketMessage = {
      event,
      data,
      timestamp: Date.now(),
      sessionId: this.id,
      messageId,
      requiresAck: !!ack,
    };

    if (ack && messageId) {
      this.ackCallbacks.set(messageId, ack);
      // Set timeout for ack (5 seconds)
      setTimeout(() => {
        if (this.ackCallbacks.has(messageId)) {
          this.ackCallbacks.delete(messageId);
          ack(new Error("Acknowledgment timeout"));
        }
      }, 5000);
    }

    await this.stateManager.enqueueMessage(this.id, message);
    await this.stateManager.publish(redisKeys.channel(this.id), message);
  }

  handleAck(messageId: string, response?: unknown): void {
    const callback = this.ackCallbacks.get(messageId);
    if (callback) {
      callback(response);
      this.ackCallbacks.delete(messageId);
    }
  }

  async broadcast(event: string, data: unknown): Promise<void> {
    const message: SocketMessage = {
      event,
      data,
      timestamp: Date.now(),
      sessionId: this.id,
    };

    // Publish to a broadcast channel (all clients except sender)
    await this.stateManager.publish(redisKeys.channel("broadcast"), message);
  }

  async broadcastToRoom(room: string, event: string, data: unknown): Promise<void> {
    const message: SocketMessage = {
      event,
      data,
      timestamp: Date.now(),
      sessionId: this.id,
    };

    // Get all members in the room
    const members = await this.stateManager.getRoomMembers(room);
    
    // Publish to each member's channel
    for (const memberId of members) {
      if (memberId !== this.id) { // Don't send to self
        await this.stateManager.publish(redisKeys.channel(memberId), message);
      }
    }
  }

  async join(room: string): Promise<void> {
    await this.stateManager.joinRoom(this.id, room);
  }

  async leave(room: string): Promise<void> {
    await this.stateManager.leaveRoom(this.id, room);
  }

  async getRooms(): Promise<string[]> {
    return await this.stateManager.getSessionRooms(this.id);
  }

  get<T>(key: string): T | undefined {
    return this.state.data[key] as T | undefined;
  }

  set(key: string, value: unknown): void {
    this.state.data[key] = value;
    // Update in Redis (fire and forget for performance)
    this.stateManager.updateSession(this.id, this.state).catch(console.error);
  }
}
