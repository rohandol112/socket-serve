/**
 * Redis keys and utilities for state management
 */

export class RedisKeys {
  private prefix = "ss";

  session(sessionId: string): string {
    return `${this.prefix}:${sessionId}:state`;
  }

  queue(sessionId: string): string {
    return `${this.prefix}:${sessionId}:queue`;
  }

  version(sessionId: string): string {
    return `${this.prefix}:${sessionId}:ver`;
  }

  processed(sessionId: string): string {
    return `${this.prefix}:${sessionId}:processed`;
  }

  channel(sessionId: string): string {
    return `${this.prefix}:channel:${sessionId}`;
  }

  rooms(room: string): string {
    return `${this.prefix}:room:${room}`;
  }

  sessionRooms(sessionId: string): string {
    return `${this.prefix}:${sessionId}:rooms`;
  }

  // New keys for optimizations
  presence(sessionId: string): string {
    return `${this.prefix}:presence:${sessionId}`;
  }

  heartbeat(sessionId: string): string {
    return `${this.prefix}:heartbeat:${sessionId}`;
  }

  namespace(ns: string): string {
    return `${this.prefix}:ns:${ns}`;
  }

  namespaceRooms(ns: string, room: string): string {
    return `${this.prefix}:ns:${ns}:room:${room}`;
  }

  volatile(sessionId: string): string {
    return `${this.prefix}:volatile:${sessionId}`;
  }
}

export const redisKeys = new RedisKeys();
