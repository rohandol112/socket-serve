/**
 * Enhanced Server Socket
 * With all optimizations and new features
 */

import type {
  ServerSocket,
  SocketMessage,
  SessionState,
} from "../types.js";
import { RedisStateManager } from "../redis/state-manager.js";
import { redisKeys } from "../redis/keys.js";
import { randomBytes } from "crypto";
import { encodeBinaryData, isBinaryData } from "../utils/binary.js";
import { compressMessageNode, COMPRESSION_THRESHOLD } from "../utils/compression.js";

export interface EnhancedSocketOptions {
  enableCompression?: boolean;
  compressionThreshold?: number;
  heartbeatInterval?: number;
  volatileTTL?: number;
}

export class EnhancedServerSocket implements ServerSocket {
  public id: string;
  private state: SessionState;
  private stateManager: RedisStateManager;
  private ackCallbacks: Map<string, (response?: unknown) => void> = new Map();
  private options: EnhancedSocketOptions;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  
  // Volatile message support
  private _volatile: VolatileEmitter;
  
  // Presence data
  private _presence: { userId?: string; status?: string } = {};

  constructor(
    sessionId: string,
    state: SessionState,
    stateManager: RedisStateManager,
    options: EnhancedSocketOptions = {}
  ) {
    this.id = sessionId;
    this.state = state;
    this.stateManager = stateManager;
    this.options = {
      enableCompression: true,
      compressionThreshold: COMPRESSION_THRESHOLD,
      heartbeatInterval: 30000,
      volatileTTL: 5,
      ...options,
    };
    
    this._volatile = new VolatileEmitter(this, stateManager, this.options.volatileTTL!);
  }

  /**
   * Emit event to this socket with optional acknowledgment
   */
  async emit(event: string, data: unknown, ack?: (response?: unknown) => void): Promise<void> {
    const messageId = ack ? randomBytes(8).toString("hex") : undefined;
    
    // Handle binary data
    let processedData = data;
    let isBinary = false;
    
    if (isBinaryData(data)) {
      processedData = await encodeBinaryData(data as ArrayBuffer | Blob | Uint8Array);
      isBinary = true;
    }

    // Check if compression is needed
    let _compressed = false;
    const dataStr = JSON.stringify(processedData);
    
    if (
      this.options.enableCompression &&
      !isBinary &&
      dataStr.length > this.options.compressionThreshold!
    ) {
      try {
        const compressedBuffer = await compressMessageNode(dataStr);
        processedData = {
          __compressed: true,
          data: compressedBuffer.toString("base64"),
        };
        _compressed = true;
      } catch {
        // Fallback to uncompressed
      }
    }

    const message: SocketMessage = {
      event,
      data: processedData,
      timestamp: Date.now(),
      sessionId: this.id,
      messageId,
      requiresAck: !!ack,
    };

    if (ack && messageId) {
      this.ackCallbacks.set(messageId, ack);
      setTimeout(() => {
        if (this.ackCallbacks.has(messageId)) {
          this.ackCallbacks.delete(messageId);
          ack(new Error("Acknowledgment timeout"));
        }
      }, 5000);
    }

    // Optimized: single operation for enqueue + publish
    await Promise.all([
      this.stateManager.enqueueMessage(this.id, message),
      this.stateManager.publish(redisKeys.channel(this.id), message),
    ]);
  }

  /**
   * Handle acknowledgment response
   */
  handleAck(messageId: string, response?: unknown): void {
    const callback = this.ackCallbacks.get(messageId);
    if (callback) {
      callback(response);
      this.ackCallbacks.delete(messageId);
    }
  }

  /**
   * Broadcast to all connected clients except self
   */
  async broadcast(event: string, data: unknown): Promise<void> {
    const message: SocketMessage = {
      event,
      data,
      timestamp: Date.now(),
      sessionId: this.id,
    };

    await this.stateManager.publish(redisKeys.channel("broadcast"), message);
  }

  /**
   * Broadcast to specific room
   */
  async broadcastToRoom(room: string, event: string, data: unknown): Promise<void> {
    const message: SocketMessage = {
      event,
      data,
      timestamp: Date.now(),
      sessionId: this.id,
    };

    const members = await this.stateManager.getRoomMembers(room);
    
    // Parallel publish to all room members
    const publishPromises = members
      .filter(memberId => memberId !== this.id)
      .map(memberId => this.stateManager.publish(redisKeys.channel(memberId), message));

    await Promise.all(publishPromises);
  }

  /**
   * Emit to all in room including self
   */
  async emitToRoom(room: string, event: string, data: unknown): Promise<void> {
    const message: SocketMessage = {
      event,
      data,
      timestamp: Date.now(),
      sessionId: this.id,
    };

    const members = await this.stateManager.getRoomMembers(room);
    
    const publishPromises = members.map(memberId =>
      this.stateManager.publish(redisKeys.channel(memberId), message)
    );

    await Promise.all(publishPromises);
  }

  /**
   * Join a room
   */
  async join(room: string): Promise<void> {
    await this.stateManager.joinRoom(this.id, room);
  }

  /**
   * Join multiple rooms at once
   */
  async joinAll(rooms: string[]): Promise<void> {
    await Promise.all(rooms.map(room => this.join(room)));
  }

  /**
   * Leave a room
   */
  async leave(room: string): Promise<void> {
    await this.stateManager.leaveRoom(this.id, room);
  }

  /**
   * Leave all rooms
   */
  async leaveAll(): Promise<void> {
    const rooms = await this.getRooms();
    await Promise.all(rooms.map(room => this.leave(room)));
  }

  /**
   * Get all rooms this socket has joined
   */
  async getRooms(): Promise<string[]> {
    return await this.stateManager.getSessionRooms(this.id);
  }

  /**
   * Get members of a room
   */
  async getRoomMembers(room: string): Promise<string[]> {
    return await this.stateManager.getRoomMembers(room);
  }

  /**
   * Get session data
   */
  get<T>(key: string): T | undefined {
    return this.state.data[key] as T | undefined;
  }

  /**
   * Set session data
   */
  set(key: string, value: unknown): void {
    this.state.data[key] = value;
    this.stateManager.updateSession(this.id, this.state).catch(console.error);
  }

  /**
   * Get all session data
   */
  getData(): Record<string, unknown> {
    return { ...this.state.data };
  }

  /**
   * Set multiple session data at once
   */
  setData(data: Record<string, unknown>): void {
    this.state.data = { ...this.state.data, ...data };
    this.stateManager.updateSession(this.id, this.state).catch(console.error);
  }

  /**
   * Volatile emitter - messages that can be dropped
   */
  get volatile(): VolatileEmitter {
    return this._volatile;
  }

  /**
   * Start heartbeat
   */
  startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    
    this.heartbeatTimer = setInterval(async () => {
      await this.emit("__ping", { timestamp: Date.now() });
    }, this.options.heartbeatInterval!);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Handle pong from client
   */
  handlePong(timestamp: number): number {
    return Date.now() - timestamp; // Return latency
  }

  /**
   * Set presence data
   */
  setPresence(userId: string, status: string = "online"): void {
    this._presence = { userId, status };
  }

  /**
   * Get presence data
   */
  getPresence(): { userId?: string; status?: string } {
    return { ...this._presence };
  }

  /**
   * Emit binary data
   */
  async emitBinary(event: string, data: ArrayBuffer | Blob | Uint8Array): Promise<void> {
    const encoded = await encodeBinaryData(data);
    await this.emit(event, encoded);
  }

  /**
   * Disconnect cleanup
   */
  async cleanup(): Promise<void> {
    this.stopHeartbeat();
    await this.leaveAll();
    this.ackCallbacks.clear();
  }
}

/**
 * Volatile Emitter
 * For non-critical messages that can be dropped
 */
class VolatileEmitter {
  private socket: EnhancedServerSocket;
  private stateManager: RedisStateManager;
  private _ttl: number;

  constructor(socket: EnhancedServerSocket, stateManager: RedisStateManager, ttl: number) {
    this.socket = socket;
    this.stateManager = stateManager;
    this._ttl = ttl;
  }

  /**
   * Emit volatile message (no persistence, short TTL)
   */
  async emit(event: string, data: unknown): Promise<void> {
    const message: SocketMessage = {
      event,
      data,
      timestamp: Date.now(),
      sessionId: this.socket.id,
    };

    // Only publish, don't enqueue (volatile = no persistence)
    await this.stateManager.publish(redisKeys.channel(this.socket.id), message);
  }

  /**
   * Broadcast volatile message
   */
  async broadcast(event: string, data: unknown): Promise<void> {
    const message: SocketMessage = {
      event,
      data,
      timestamp: Date.now(),
      sessionId: this.socket.id,
    };

    await this.stateManager.publish(redisKeys.channel("broadcast"), message);
  }

  /**
   * Broadcast volatile to room
   */
  async broadcastToRoom(room: string, event: string, data: unknown): Promise<void> {
    const message: SocketMessage = {
      event,
      data,
      timestamp: Date.now(),
      sessionId: this.socket.id,
    };

    const members = await this.stateManager.getRoomMembers(room);
    
    const publishPromises = members
      .filter(memberId => memberId !== this.socket.id)
      .map(memberId => this.stateManager.publish(redisKeys.channel(memberId), message));

    await Promise.all(publishPromises);
  }
}
