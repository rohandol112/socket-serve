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
  
  /** Enable message compression (default: true) */
  enableCompression?: boolean;
  
  /** Compression threshold in bytes (default: 1024) */
  compressionThreshold?: number;
  
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatInterval?: number;
  
  /** Enable presence tracking (default: true) */
  enablePresence?: boolean;
  
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
  
  /** Optional Upstash config for Edge runtime */
  upstash?: {
    url: string;
    token: string;
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
  messageId?: string;
  requiresAck?: boolean;
  namespace?: string;
  volatile?: boolean;
  compressed?: boolean;
  binary?: boolean;
}

export interface ServerSocket {
  id: string;
  emit(event: string, data: unknown, ack?: (response?: unknown) => void): Promise<void>;
  broadcast(event: string, data: unknown): Promise<void>;
  broadcastToRoom(room: string, event: string, data: unknown): Promise<void>;
  join(room: string): Promise<void>;
  leave(room: string): Promise<void>;
  getRooms(): Promise<string[]>;
  get<T>(key: string): T | undefined;
  set(key: string, value: unknown): void;
}

export interface EnhancedServerSocket extends ServerSocket {
  // Enhanced room operations
  joinAll(rooms: string[]): Promise<void>;
  leaveAll(): Promise<void>;
  getRoomMembers(room: string): Promise<string[]>;
  emitToRoom(room: string, event: string, data: unknown): Promise<void>;
  
  // Data operations
  getData(): Record<string, unknown>;
  setData(data: Record<string, unknown>): void;
  
  // Volatile messages
  volatile: {
    emit(event: string, data: unknown): Promise<void>;
    broadcast(event: string, data: unknown): Promise<void>;
    broadcastToRoom(room: string, event: string, data: unknown): Promise<void>;
  };
  
  // Heartbeat
  startHeartbeat(): void;
  stopHeartbeat(): void;
  handlePong(timestamp: number): number;
  
  // Presence
  setPresence(userId: string, status?: string): void;
  getPresence(): { userId?: string; status?: string };
  
  // Binary
  emitBinary(event: string, data: ArrayBuffer | Blob | Uint8Array): Promise<void>;
  
  // Cleanup
  cleanup(): Promise<void>;
}

export interface ClientSocket {
  id: string;
  connected: boolean;
  connect(): Promise<void>;
  disconnect(): void;
  emit(event: string, data: unknown, ack?: (response?: unknown) => void): void;
  on(event: string, handler: (data: unknown) => void): void;
  off(event: string, handler?: (data: unknown) => void): void;
}

export interface EnhancedClientSocket extends ClientSocket {
  // Enhanced event handling
  once(event: string, handler: (data: unknown) => void): void;
  offAll(): void;
  
  // Latency
  getLatency(): number;
  
  // Session
  getSessionData<T>(key: string): T | undefined;
  setSessionData(key: string, value: unknown): void;
  
  // Transport
  switchTransport(transport: "sse" | "polling"): void;
  
  // Binary
  emitBinary(event: string, data: ArrayBuffer | Blob | Uint8Array): void;
  
  // Volatile
  volatile: {
    emit(event: string, data: unknown): void;
  };
  
  // Presence
  presence: {
    setStatus(status: "online" | "away" | "offline" | "busy"): void;
    setCustomData(data: Record<string, unknown>): void;
    getStatus(): string;
    subscribe(userIds: string[]): void;
    unsubscribe(userIds: string[]): void;
  };
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
