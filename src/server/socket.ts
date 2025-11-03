import { RedisStateManager } from "../redis/state-manager";
import type {
  ServerSocket,
  SocketMessage,
  SessionState,
} from "../types";
import { redisKeys } from "../redis/keys";

export class ServerSocketImpl implements ServerSocket {
  public id: string;
  private state: SessionState;
  private stateManager: RedisStateManager;

  constructor(
    sessionId: string,
    state: SessionState,
    stateManager: RedisStateManager
  ) {
    this.id = sessionId;
    this.state = state;
    this.stateManager = stateManager;
  }

  async emit(event: string, data: unknown): Promise<void> {
    const message: SocketMessage = {
      event,
      data,
      timestamp: Date.now(),
      sessionId: this.id,
    };

    await this.stateManager.enqueueMessage(this.id, message);
    await this.stateManager.publish(redisKeys.channel(this.id), message);
  }

  async broadcast(event: string, data: unknown): Promise<void> {
    const message: SocketMessage = {
      event,
      data,
      timestamp: Date.now(),
      sessionId: this.id,
    };

    // Publish to a broadcast channel
    await this.stateManager.publish(redisKeys.channel("broadcast"), message);
  }

  async join(room: string): Promise<void> {
    await this.stateManager.joinRoom(this.id, room);
  }

  async leave(room: string): Promise<void> {
    await this.stateManager.leaveRoom(this.id, room);
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
