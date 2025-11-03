/**
 * Core types for socket-serve
 */

export type TransportType = "sse" | "polling" | "pusher" | "ably";

export interface SocketServeConfig {
  /** Adapter type (e.g., 'nextjs', 'express', 'cloudflare', 'netlify') */
  adapter: "nextjs" | "express" | "cloudflare" | "netlify";
  
  /** Redis connection URL */
  redisUrl: string;
  
  /** Session TTL in seconds (default: 3600) */
  ttl?: number;
  
  /** Transport mechanism (default: 'sse') */
  transport?: TransportType;
  
  /** Optional Pusher config */
  pusher?: {
    appId: string;
    key: string;
    secret: string;
    cluster: string;
  };
  
  /** Optional Ably config */
  ably?: {
    apiKey: string;
  };
}

export interface SessionState {
  id: string;
  createdAt: number;
  lastActivity: number;
  data: Record<string, unknown>;
}

export interface SocketMessage {
  event: string;
  data: unknown;
  timestamp: number;
  sessionId: string;
}

export interface ServerSocket {
  id: string;
  emit(event: string, data: unknown): Promise<void>;
  broadcast(event: string, data: unknown): Promise<void>;
  join(room: string): Promise<void>;
  leave(room: string): Promise<void>;
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown): void;
}

export interface ClientSocket {
  id: string;
  connected: boolean;
  connect(): Promise<void>;
  disconnect(): void;
  emit(event: string, data: unknown): void;
  on(event: string, handler: (data: unknown) => void): void;
  off(event: string, handler?: (data: unknown) => void): void;
}

export type ConnectHandler = (socket: ServerSocket) => void | Promise<void>;
export type MessageHandler = (
  socket: ServerSocket,
  data: unknown
) => void | Promise<void>;
export type DisconnectHandler = (socket: ServerSocket) => void | Promise<void>;

export interface SocketHandlers {
  onConnect?: ConnectHandler;
  onDisconnect?: DisconnectHandler;
  messages: Map<string, MessageHandler>;
}
