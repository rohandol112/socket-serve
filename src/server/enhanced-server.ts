/**
 * Enhanced Socket Server
 * With namespaces, middleware, presence, and all optimizations
 */

import { RedisStateManager } from "../redis/state-manager.js";
import { EnhancedServerSocket, type EnhancedSocketOptions } from "./enhanced-socket.js";
import { MiddlewareChain, type MiddlewareFunction, type MiddlewareContext } from "../utils/middleware.js";
import { NamespaceManager, Namespace } from "../utils/namespace.js";
import { PresenceManager, presenceManager } from "../utils/presence.js";
import type {
  SocketHandlers,
  ConnectHandler,
  MessageHandler,
  DisconnectHandler,
} from "../types.js";
import { randomBytes } from "crypto";

export interface EnhancedServerConfig {
  redisUrl: string;
  ttl?: number;
  enableCompression?: boolean;
  compressionThreshold?: number;
  heartbeatInterval?: number;
  enablePresence?: boolean;
}

export class EnhancedSocketServer {
  private stateManager: RedisStateManager;
  private handlers: SocketHandlers = { messages: new Map() };
  private middleware: MiddlewareChain = new MiddlewareChain();
  private namespaceManager: NamespaceManager = new NamespaceManager();
  private presence: PresenceManager;
  private _config: EnhancedServerConfig;
  private socketOptions: EnhancedSocketOptions;

  constructor(config: EnhancedServerConfig) {
    this._config = config;
    this.stateManager = new RedisStateManager(config.redisUrl, config.ttl || 3600);
    this.presence = config.enablePresence !== false ? presenceManager : new PresenceManager();
    
    this.socketOptions = {
      enableCompression: config.enableCompression !== false,
      compressionThreshold: config.compressionThreshold,
      heartbeatInterval: config.heartbeatInterval,
    };

    // Start presence cleanup interval
    if (config.enablePresence !== false) {
      setInterval(() => this.presence.checkStalePresences(), 60000);
    }
  }

  /**
   * Add middleware to the server
   */
  use(middleware: MiddlewareFunction): this {
    this.middleware.use(middleware);
    return this;
  }

  /**
   * Get or create a namespace
   */
  of(name: string): Namespace {
    return this.namespaceManager.of(name);
  }

  /**
   * Register event handler (Socket.IO style)
   */
  on(event: string, handler: ConnectHandler | MessageHandler | DisconnectHandler): this {
    if (event === "connection" || event === "connect") {
      this.handlers.onConnect = handler as ConnectHandler;
    } else if (event === "disconnect") {
      this.handlers.onDisconnect = handler as DisconnectHandler;
    } else {
      this.handlers.messages.set(event, handler as MessageHandler);
    }
    return this;
  }

  /**
   * Handle new connection
   */
  async handleConnect(options?: {
    auth?: Record<string, unknown>;
    namespace?: string;
    sessionData?: Record<string, unknown>;
    lastMessageTimestamp?: number;
  }): Promise<{
    sessionId: string;
    sessionData?: Record<string, unknown>;
    missedMessages?: unknown[];
  }> {
    const sessionId = this.generateSessionId();
    const namespace = options?.namespace || "/";
    
    // Create session with initial data
    const state = await this.stateManager.createSession(sessionId);
    
    if (options?.sessionData) {
      state.data = { ...state.data, ...options.sessionData };
      await this.stateManager.updateSession(sessionId, state);
    }

    const socket = new EnhancedServerSocket(
      sessionId,
      state,
      this.stateManager,
      this.socketOptions
    );

    // Run middleware
    const ctx: MiddlewareContext = {
      socket,
      auth: options?.auth,
    };

    try {
      await this.middleware.execute(ctx);
    } catch (error) {
      // Cleanup on middleware failure
      await this.stateManager.deleteSession(sessionId);
      throw error;
    }

    // Get missed messages if reconnecting
    let missedMessages: unknown[] = [];
    if (options?.lastMessageTimestamp) {
      const messages = await this.stateManager.dequeueMessages(sessionId);
      missedMessages = messages.filter(
        (m) => m.timestamp > options.lastMessageTimestamp!
      );
    }

    // Handle namespace connection
    const ns = this.namespaceManager.of(namespace);
    
    // Delayed connection handler to ensure SSE is ready
    setTimeout(async () => {
      await ns.handleConnection(socket);
      
      if (this.handlers.onConnect) {
        await this.handlers.onConnect(socket);
      }
    }, 100);

    return {
      sessionId,
      sessionData: state.data,
      missedMessages,
    };
  }

  /**
   * Handle incoming message
   */
  async handleMessage(
    sessionId: string,
    event: string,
    data: unknown,
    options?: {
      namespace?: string;
      messageId?: string;
      requiresAck?: boolean;
      volatile?: boolean;
    }
  ): Promise<{ ackData?: unknown }> {
    const state = await this.stateManager.getSession(sessionId);
    if (!state) {
      throw new Error("Session not found");
    }

    const socket = new EnhancedServerSocket(
      sessionId,
      state,
      this.stateManager,
      this.socketOptions
    );

    // Run middleware
    const ctx: MiddlewareContext = {
      socket,
      event,
      data,
    };

    try {
      await this.middleware.execute(ctx);
    } catch (error) {
      throw error;
    }

    // Handle internal events
    if (event === "__pong") {
      const latency = socket.handlePong((data as { timestamp: number }).timestamp);
      return { ackData: { latency } };
    }

    if (event === "__presence") {
      const presenceData = data as { status: string; userId?: string };
      if (presenceData.userId) {
        this.presence.track(sessionId, presenceData.userId, presenceData.status as "online");
      }
      return {};
    }

    if (event === "__presence_subscribe") {
      // Handle presence subscription
      return {};
    }

    // Try namespace handler first
    const namespace = options?.namespace || "/";
    const ns = this.namespaceManager.of(namespace);
    const handled = await ns.handleMessage(socket, event, data);

    // Fall back to global handler
    if (!handled) {
      const handler = this.handlers.messages.get(event);
      if (handler) {
        await handler(socket, data);
      } else {
        console.warn(`No handler for event: ${event}`);
      }
    }

    return {};
  }

  /**
   * Handle disconnection
   */
  async handleDisconnect(sessionId: string, namespace?: string): Promise<void> {
    const state = await this.stateManager.getSession(sessionId);
    if (!state) return;

    const socket = new EnhancedServerSocket(
      sessionId,
      state,
      this.stateManager,
      this.socketOptions
    );

    // Run cleanup
    await socket.cleanup();

    // Handle namespace disconnection
    const ns = this.namespaceManager.of(namespace || "/");
    await ns.handleDisconnection(socket);

    // Global disconnect handler
    if (this.handlers.onDisconnect) {
      await this.handlers.onDisconnect(socket);
    }

    // Remove presence
    this.presence.untrack(sessionId);

    // Delete session
    await this.stateManager.deleteSession(sessionId);
  }

  /**
   * Get messages for a session
   */
  async getMessages(sessionId: string): Promise<unknown[]> {
    return await this.stateManager.dequeueMessages(sessionId);
  }

  /**
   * Get state manager
   */
  getStateManager(): RedisStateManager {
    return this.stateManager;
  }

  /**
   * Get presence manager
   */
  getPresenceManager(): PresenceManager {
    return this.presence;
  }

  /**
   * Get namespace manager
   */
  getNamespaceManager(): NamespaceManager {
    return this.namespaceManager;
  }

  /**
   * Emit to all connected sockets
   */
  async emit(event: string, data: unknown): Promise<void> {
    // Use default namespace
    await this.namespaceManager.default.emit(event, data);
  }

  /**
   * Get connected socket count
   */
  getSocketCount(namespace?: string): number {
    const ns = this.namespaceManager.of(namespace || "/");
    return ns.socketCount;
  }

  private generateSessionId(): string {
    return randomBytes(16).toString("hex");
  }
}

// Factory function
export function createEnhancedServer(config: EnhancedServerConfig): EnhancedSocketServer {
  return new EnhancedSocketServer(config);
}
