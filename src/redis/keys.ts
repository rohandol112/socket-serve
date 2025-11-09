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
}

export const redisKeys = new RedisKeys();
