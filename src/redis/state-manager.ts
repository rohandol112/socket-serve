import Redis from "ioredis";
import { redisKeys } from "./keys.js";
import type { SessionState, SocketMessage } from "../types.js";

export class RedisStateManager {
  private redis: Redis;
  private ttl: number;

  constructor(redisUrl: string, ttl: number = 3600) {
    this.redis = new Redis(redisUrl);
    this.ttl = ttl;
  }

  async createSession(sessionId: string): Promise<SessionState> {
    const state: SessionState = {
      id: sessionId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      data: {},
    };

    await this.redis.setex(
      redisKeys.session(sessionId),
      this.ttl,
      JSON.stringify(state)
    );

    return state;
  }

  async getSession(sessionId: string): Promise<SessionState | null> {
    const data = await this.redis.get(redisKeys.session(sessionId));
    if (!data) return null;
    return JSON.parse(data) as SessionState;
  }

  async updateSession(
    sessionId: string,
    updates: Partial<SessionState>
  ): Promise<void> {
    const current = await this.getSession(sessionId);
    if (!current) return;

    const updated = {
      ...current,
      ...updates,
      lastActivity: Date.now(),
    };

    await this.redis.setex(
      redisKeys.session(sessionId),
      this.ttl,
      JSON.stringify(updated)
    );
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.redis.del(redisKeys.session(sessionId));
  }

  async enqueueMessage(sessionId: string, message: SocketMessage): Promise<void> {
    await this.redis.rpush(
      redisKeys.queue(sessionId),
      JSON.stringify(message)
    );
    await this.redis.expire(redisKeys.queue(sessionId), this.ttl);
  }

  async dequeueMessages(sessionId: string): Promise<SocketMessage[]> {
    const messages = await this.redis.lrange(redisKeys.queue(sessionId), 0, -1);
    await this.redis.del(redisKeys.queue(sessionId));
    return messages.map((msg: string) => JSON.parse(msg) as SocketMessage);
  }

  async publish(channel: string, message: SocketMessage): Promise<void> {
    await this.redis.publish(channel, JSON.stringify(message));
  }

  async subscribe(
    channel: string,
    handler: (message: SocketMessage) => void
  ): Promise<void> {
    const subscriber = this.redis.duplicate();
    await subscriber.subscribe(channel);
    
    subscriber.on("message", (ch: string, msg: string) => {
      if (ch === channel) {
        handler(JSON.parse(msg) as SocketMessage);
      }
    });
  }

  async joinRoom(sessionId: string, room: string): Promise<void> {
    await this.redis.sadd(redisKeys.rooms(room), sessionId);
    await this.redis.sadd(redisKeys.sessionRooms(sessionId), room);
  }

  async leaveRoom(sessionId: string, room: string): Promise<void> {
    await this.redis.srem(redisKeys.rooms(room), sessionId);
    await this.redis.srem(redisKeys.sessionRooms(sessionId), room);
  }

  async getRoomMembers(room: string): Promise<string[]> {
    return await this.redis.smembers(redisKeys.rooms(room));
  }

  async getSessionRooms(sessionId: string): Promise<string[]> {
    return await this.redis.smembers(redisKeys.sessionRooms(sessionId));
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}
