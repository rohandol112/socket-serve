/**
 * Next.js Edge Runtime Adapter
 * Optimized for Vercel Edge Functions with Upstash Redis
 */

import { UpstashStateManager } from "../redis/upstash-state-manager.js";
import { redisKeys } from "../redis/keys.js";
import type { SocketMessage, SessionState } from "../types.js";

export interface EdgeAdapterConfig {
  upstashUrl: string;
  upstashToken: string;
  ttl?: number;
  enableCompression?: boolean;
}

type ConnectHandler = (socket: EdgeServerSocket) => void | Promise<void>;
type MessageHandler = (socket: EdgeServerSocket, data: unknown) => void | Promise<void>;
type DisconnectHandler = (socket: EdgeServerSocket) => void | Promise<void>;

interface Handlers {
  onConnect?: ConnectHandler;
  onDisconnect?: DisconnectHandler;
  messages: Map<string, MessageHandler>;
}

/**
 * Edge-compatible Socket Server
 */
export class EdgeSocketServer {
  private stateManager: UpstashStateManager;
  private handlers: Handlers = { messages: new Map() };
  private _config: EdgeAdapterConfig;

  constructor(config: EdgeAdapterConfig) {
    this._config = config;
    this.stateManager = new UpstashStateManager(
      { url: config.upstashUrl, token: config.upstashToken },
      config.ttl || 3600
    );
  }

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

  async handleConnect(): Promise<{ sessionId: string }> {
    const sessionId = crypto.randomUUID();
    const state = await this.stateManager.createSession(sessionId);

    // Delay onConnect to ensure SSE is ready
    if (this.handlers.onConnect) {
      const socket = new EdgeServerSocket(sessionId, state, this.stateManager);
      // Non-blocking
      setTimeout(() => this.handlers.onConnect!(socket), 50);
    }

    return { sessionId };
  }

  async handleMessage(
    sessionId: string,
    event: string,
    data: unknown
  ): Promise<void> {
    const state = await this.stateManager.getSession(sessionId);
    if (!state) throw new Error("Session not found");

    const handler = this.handlers.messages.get(event);
    if (!handler) {
      console.warn(`No handler for event: ${event}`);
      return;
    }

    const socket = new EdgeServerSocket(sessionId, state, this.stateManager);
    await handler(socket, data);
  }

  async handleDisconnect(sessionId: string): Promise<void> {
    const state = await this.stateManager.getSession(sessionId);
    if (!state) return;

    if (this.handlers.onDisconnect) {
      const socket = new EdgeServerSocket(sessionId, state, this.stateManager);
      await this.handlers.onDisconnect(socket);
    }

    await this.stateManager.deleteSession(sessionId);
  }

  getStateManager(): UpstashStateManager {
    return this.stateManager;
  }
}

/**
 * Edge-compatible Server Socket
 */
class EdgeServerSocket {
  public id: string;
  private state: SessionState;
  private stateManager: UpstashStateManager;

  constructor(sessionId: string, state: SessionState, stateManager: UpstashStateManager) {
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

    // Optimized: single pipeline call
    await this.stateManager.enqueueAndPublish(
      this.id,
      message,
      redisKeys.channel(this.id)
    );
  }

  async broadcast(event: string, data: unknown): Promise<void> {
    const message: SocketMessage = {
      event,
      data,
      timestamp: Date.now(),
      sessionId: this.id,
    };

    await this.stateManager.publish(redisKeys.channel("broadcast"), message);
  }

  async broadcastToRoom(room: string, event: string, data: unknown): Promise<void> {
    const message: SocketMessage = {
      event,
      data,
      timestamp: Date.now(),
      sessionId: this.id,
    };

    const members = await this.stateManager.getRoomMembers(room);
    
    // Parallel emit to all members
    await Promise.all(
      members
        .filter(m => m !== this.id)
        .map(memberId => this.stateManager.publish(redisKeys.channel(memberId), message))
    );
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
    this.stateManager.updateSession(this.id, this.state).catch(console.error);
  }

  // Presence helpers
  async setOnline(): Promise<void> {
    await this.stateManager.setPresence(this.id, "online");
  }

  async setAway(): Promise<void> {
    await this.stateManager.setPresence(this.id, "away");
  }

  async heartbeat(): Promise<void> {
    await this.stateManager.heartbeat(this.id);
  }
}

/**
 * Create Edge-compatible Next.js Adapter
 */
export function createEdgeAdapter(server: EdgeSocketServer) {
  const stateManager = server.getStateManager();

  return {
    // GET handler for SSE
    GET: async (request: Request) => {
      const url = new URL(request.url);
      const sessionId = url.searchParams.get("sessionId");
      const transport = url.searchParams.get("transport");

      if (!sessionId) {
        return new Response("Session ID required", { status: 400 });
      }

      // Polling transport
      if (transport === "polling") {
        const messages = await stateManager.dequeueMessages(sessionId);
        return Response.json({ messages });
      }

      // SSE transport
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          // Subscribe to session channel
          const sendMessage = (message: SocketMessage) => {
            const data = `data: ${JSON.stringify(message)}\n\n`;
            controller.enqueue(encoder.encode(data));
          };

          // Send initial connection message
          sendMessage({
            event: "__connected",
            data: { sessionId },
            timestamp: Date.now(),
            sessionId,
          });

          // Set up heartbeat
          const heartbeatInterval = setInterval(() => {
            sendMessage({
              event: "__heartbeat",
              data: { timestamp: Date.now() },
              timestamp: Date.now(),
              sessionId,
            });
          }, 30000);

          // Polling for messages (Edge doesn't support Redis pub/sub)
          const pollInterval = setInterval(async () => {
            try {
              const messages = await stateManager.dequeueMessages(sessionId);
              messages.forEach(sendMessage);
            } catch (error) {
              console.error("Polling error:", error);
            }
          }, 100); // Poll every 100ms for low latency

          // Cleanup on close
          request.signal.addEventListener("abort", () => {
            clearInterval(heartbeatInterval);
            clearInterval(pollInterval);
            controller.close();
          });
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    },

    // POST handler for messages
    POST: async (request: Request) => {
      const url = new URL(request.url);
      const pathname = url.pathname;

      try {
        const body = await request.json();

        // Connect
        if (pathname.endsWith("/connect")) {
          const result = await server.handleConnect();
          return Response.json(result);
        }

        // Disconnect
        if (pathname.endsWith("/disconnect")) {
          await server.handleDisconnect(body.sessionId);
          return Response.json({ success: true });
        }

        // Message
        if (pathname.endsWith("/message") || !pathname.includes("/")) {
          await server.handleMessage(body.sessionId, body.event, body.data);
          return Response.json({ success: true });
        }

        return new Response("Not found", { status: 404 });
      } catch (error) {
        console.error("Handler error:", error);
        return Response.json(
          { error: (error as Error).message },
          { status: 500 }
        );
      }
    },
  };
}

// Factory
export function createEdgeSocketServer(config: EdgeAdapterConfig): EdgeSocketServer {
  return new EdgeSocketServer(config);
}
