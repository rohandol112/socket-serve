/**
 * Upstash Redis State Manager - Edge Runtime Compatible
 * Uses REST API instead of TCP for serverless edge environments
 */

import { redisKeys } from "./keys.js";
import type { SessionState, SocketMessage } from "../types.js";

interface UpstashConfig {
  url: string;
  token: string;
}

export class UpstashStateManager {
  private url: string;
  private token: string;
  private ttl: number;

  constructor(config: UpstashConfig, ttl: number = 3600) {
    this.url = config.url;
    this.token = config.token;
    this.ttl = ttl;
  }

  private async command<T>(...args: (string | number)[]): Promise<T> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`Redis command failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result as T;
  }

  // Pipeline multiple commands in a single request (HUGE latency reduction)
  private async pipeline<T>(commands: (string | number)[][]): Promise<T[]> {
    const response = await fetch(`${this.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      throw new Error(`Pipeline failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.map((item: { result: T }) => item.result);
  }

  async createSession(sessionId: string): Promise<SessionState> {
    const state: SessionState = {
      id: sessionId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      data: {},
    };

    await this.command(
      "SETEX",
      redisKeys.session(sessionId),
      this.ttl,
      JSON.stringify(state)
    );

    return state;
  }

  async getSession(sessionId: string): Promise<SessionState | null> {
    const data = await this.command<string | null>(
      "GET",
      redisKeys.session(sessionId)
    );
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

    await this.command(
      "SETEX",
      redisKeys.session(sessionId),
      this.ttl,
      JSON.stringify(updated)
    );
  }

  async deleteSession(sessionId: string): Promise<void> {
    // Pipeline: delete session, rooms, and queue in one request
    await this.pipeline([
      ["DEL", redisKeys.session(sessionId)],
      ["DEL", redisKeys.queue(sessionId)],
      ["DEL", redisKeys.sessionRooms(sessionId)],
    ]);
  }

  // Optimized: Pipeline enqueue + publish in single request
  async enqueueAndPublish(
    sessionId: string,
    message: SocketMessage,
    channel: string
  ): Promise<void> {
    const messageStr = JSON.stringify(message);
    
    await this.pipeline([
      ["RPUSH", redisKeys.queue(sessionId), messageStr],
      ["EXPIRE", redisKeys.queue(sessionId), this.ttl],
      ["PUBLISH", channel, messageStr],
    ]);
  }

  async enqueueMessage(sessionId: string, message: SocketMessage): Promise<void> {
    await this.pipeline([
      ["RPUSH", redisKeys.queue(sessionId), JSON.stringify(message)],
      ["EXPIRE", redisKeys.queue(sessionId), this.ttl],
    ]);
  }

  async dequeueMessages(sessionId: string): Promise<SocketMessage[]> {
    const [messages] = await this.pipeline<string[]>([
      ["LRANGE", redisKeys.queue(sessionId), 0, -1],
      ["DEL", redisKeys.queue(sessionId)],
    ]);
    
    return (messages || []).map((msg: string) => JSON.parse(msg) as SocketMessage);
  }

  async publish(channel: string, message: SocketMessage): Promise<void> {
    await this.command("PUBLISH", channel, JSON.stringify(message));
  }

  // Room operations with pipeline optimization
  async joinRoom(sessionId: string, room: string): Promise<void> {
    await this.pipeline([
      ["SADD", redisKeys.rooms(room), sessionId],
      ["SADD", redisKeys.sessionRooms(sessionId), room],
    ]);
  }

  async leaveRoom(sessionId: string, room: string): Promise<void> {
    await this.pipeline([
      ["SREM", redisKeys.rooms(room), sessionId],
      ["SREM", redisKeys.sessionRooms(sessionId), room],
    ]);
  }

  async getRoomMembers(room: string): Promise<string[]> {
    return await this.command<string[]>("SMEMBERS", redisKeys.rooms(room)) || [];
  }

  async getSessionRooms(sessionId: string): Promise<string[]> {
    return await this.command<string[]>("SMEMBERS", redisKeys.sessionRooms(sessionId)) || [];
  }

  // Presence tracking
  async setPresence(sessionId: string, status: "online" | "away" | "offline"): Promise<void> {
    const presenceKey = redisKeys.presence(sessionId);
    await this.pipeline([
      ["HSET", presenceKey, "status", status, "lastSeen", Date.now().toString()],
      ["EXPIRE", presenceKey, 300], // 5 min TTL for presence
    ]);
  }

  async getPresence(sessionId: string): Promise<{ status: string; lastSeen: number } | null> {
    const data = await this.command<Record<string, string>>(
      "HGETALL",
      redisKeys.presence(sessionId)
    );
    if (!data || Object.keys(data).length === 0) return null;
    return {
      status: data.status || "offline",
      lastSeen: parseInt(data.lastSeen || "0", 10),
    };
  }

  async getRoomPresence(room: string): Promise<Map<string, { status: string; lastSeen: number }>> {
    const members = await this.getRoomMembers(room);
    const presence = new Map<string, { status: string; lastSeen: number }>();
    
    // Get all presence data in parallel
    const presencePromises = members.map(async (memberId) => {
      const p = await this.getPresence(memberId);
      if (p) presence.set(memberId, p);
    });
    
    await Promise.all(presencePromises);
    return presence;
  }

  // Heartbeat tracking
  async heartbeat(sessionId: string): Promise<void> {
    await this.pipeline([
      ["SET", redisKeys.heartbeat(sessionId), Date.now().toString()],
      ["EXPIRE", redisKeys.heartbeat(sessionId), 60], // 60s heartbeat TTL
    ]);
  }

  async isAlive(sessionId: string): Promise<boolean> {
    const lastHeartbeat = await this.command<string | null>(
      "GET",
      redisKeys.heartbeat(sessionId)
    );
    if (!lastHeartbeat) return false;
    
    const elapsed = Date.now() - parseInt(lastHeartbeat, 10);
    return elapsed < 60000; // Alive if heartbeat within 60s
  }
}
