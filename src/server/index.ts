import { RedisStateManager } from "../redis/state-manager.js";
import { ServerSocketImpl } from "./socket.js";
import type {
  SocketServeConfig,
  SocketHandlers,
  ConnectHandler,
  MessageHandler,
  DisconnectHandler,
} from "../types.js";
import { randomBytes } from "crypto";

export class SocketServer {
  private stateManager: RedisStateManager;
  private handlers: SocketHandlers = {
    messages: new Map(),
  };

  constructor(config: SocketServeConfig) {
    this.stateManager = new RedisStateManager(
      config.redisUrl,
      config.ttl || 3600
    );
  }

  onConnect(handler: ConnectHandler): void {
    this.handlers.onConnect = handler;
  }

  onMessage(event: string, handler: MessageHandler): void {
    this.handlers.messages.set(event, handler);
  }

  onDisconnect(handler: DisconnectHandler): void {
    this.handlers.onDisconnect = handler;
  }

  async handleConnect(): Promise<{ sessionId: string }> {
    const sessionId = this.generateSessionId();
    const state = await this.stateManager.createSession(sessionId);
    
    // Delay calling onConnect to ensure SSE is connected first
    if (this.handlers.onConnect) {
      setTimeout(async () => {
        const socket = new ServerSocketImpl(sessionId, state, this.stateManager);
        await this.handlers.onConnect!(socket);
      }, 100);
    }

    return { sessionId };
  }

  async handleMessage(
    sessionId: string,
    event: string,
    data: unknown
  ): Promise<void> {
    const state = await this.stateManager.getSession(sessionId);
    if (!state) {
      throw new Error("Session not found");
    }

    const handler = this.handlers.messages.get(event);
    if (!handler) {
      console.warn(`No handler for event: ${event}`);
      return;
    }

    const socket = new ServerSocketImpl(sessionId, state, this.stateManager);
    await handler(socket, data);
  }

  async handleDisconnect(sessionId: string): Promise<void> {
    const state = await this.stateManager.getSession(sessionId);
    if (!state) return;

    if (this.handlers.onDisconnect) {
      const socket = new ServerSocketImpl(sessionId, state, this.stateManager);
      await this.handlers.onDisconnect(socket);
    }

    await this.stateManager.deleteSession(sessionId);
  }

  async getMessages(sessionId: string): Promise<unknown[]> {
    const messages = await this.stateManager.dequeueMessages(sessionId);
    return messages;
  }

  private generateSessionId(): string {
    return randomBytes(16).toString("hex");
  }

  getStateManager(): RedisStateManager {
    return this.stateManager;
  }
}
