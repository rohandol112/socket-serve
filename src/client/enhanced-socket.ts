/**
 * Enhanced Client Socket
 * With all optimizations and new features
 */

import type { ClientSocket } from "../types.js";
import { decompressMessage } from "../utils/compression.js";
import { decodeBinaryData, isBinaryData, type BinaryMessage } from "../utils/binary.js";

type EventHandler = (data: unknown) => void;
type AckCallback = (response?: unknown) => void;

export interface EnhancedClientOptions {
  transport?: "sse" | "polling";
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  heartbeatInterval?: number;
  enableCompression?: boolean;
  auth?: Record<string, unknown>;
  namespace?: string;
}

export class EnhancedClientSocket implements ClientSocket {
  public id: string = "";
  public connected: boolean = false;

  private baseUrl: string;
  private transport: "sse" | "polling";
  private eventSource: EventSource | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private ackCallbacks: Map<string, AckCallback> = new Map();
  
  // Reconnection
  private reconnectEnabled: boolean;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number;
  private reconnectDelay: number;
  private maxReconnectDelay: number;
  private reconnectTimer: NodeJS.Timeout | null = null;
  
  // Heartbeat
  private heartbeatInterval: number;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastPong: number = 0;
  private latency: number = 0;
  
  // Options
  private _enableCompression: boolean;
  private auth: Record<string, unknown>;
  private namespace: string;
  
  // Message deduplication
  private processedMessages: Set<string> = new Set();
  private dedupeCleanupInterval: NodeJS.Timeout | null = null;
  
  // Volatile
  private _volatile: VolatileClientEmitter;
  
  // Presence
  private _presence: ClientPresence;

  // Session recovery
  private lastMessageTimestamp: number = 0;
  private sessionData: Record<string, unknown> = {};

  constructor(baseUrl: string, options: EnhancedClientOptions = {}) {
    this.baseUrl = baseUrl;
    this.transport = options.transport || "sse";
    this.reconnectEnabled = options.reconnect !== false;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.reconnectDelay = options.reconnectDelay || 1000;
    this.maxReconnectDelay = options.maxReconnectDelay || 30000;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    this._enableCompression = options.enableCompression !== false;
    this.auth = options.auth || {};
    this.namespace = options.namespace || "/";
    
    this._volatile = new VolatileClientEmitter(this);
    this._presence = new ClientPresence(this);
    
    // Setup internal handlers
    this.setupInternalHandlers();
  }

  private setupInternalHandlers(): void {
    // Heartbeat response
    this.on("__ping", (data: unknown) => {
      const { timestamp } = data as { timestamp: number };
      this.emit("__pong", { timestamp });
    });

    // Pong from server (latency calculation)
    this.on("__pong", (data: unknown) => {
      const { timestamp } = data as { timestamp: number };
      this.latency = Date.now() - timestamp;
      this.lastPong = Date.now();
    });
  }

  async connect(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auth: this.auth,
          namespace: this.namespace,
          sessionData: this.sessionData,
          lastMessageTimestamp: this.lastMessageTimestamp,
        }),
      });

      if (!response.ok) {
        throw new Error(`Connection failed: ${response.status}`);
      }

      const data = await response.json();
      this.id = data.sessionId;
      this.connected = true;
      this.reconnectAttempts = 0;

      // Restore session data if provided
      if (data.sessionData) {
        this.sessionData = data.sessionData;
      }

      // Process any missed messages
      if (data.missedMessages?.length) {
        data.missedMessages.forEach((msg: { event: string; data: unknown }) => {
          this.handleMessage(msg);
        });
      }

      this.emitLocal("connect", { sessionId: this.id });

      // Start transport
      if (this.transport === "sse") {
        this.startSSE();
      } else {
        this.startPolling();
      }

      // Start heartbeat
      this.startHeartbeat();
      
      // Start deduplication cleanup
      this.startDedupeCleanup();

    } catch (error) {
      console.error("Connection failed:", error);
      this.emitLocal("connect_error", error);
      this.handleReconnect();
    }
  }

  disconnect(): void {
    this.connected = false;
    this.stopHeartbeat();
    this.stopDedupeCleanup();

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.emitLocal("disconnect", { reason: "client" });

    if (this.id) {
      fetch(`${this.baseUrl}/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: this.id }),
      }).catch(() => {});
    }
  }

  emit(event: string, data: unknown, ack?: AckCallback): void {
    if (!this.connected || !this.id) {
      console.error("Not connected");
      if (ack) ack(new Error("Not connected"));
      return;
    }

    const messageId = ack ? this.generateId() : undefined;

    if (ack && messageId) {
      this.ackCallbacks.set(messageId, ack);
      setTimeout(() => {
        if (this.ackCallbacks.has(messageId)) {
          this.ackCallbacks.delete(messageId);
          ack(new Error("Acknowledgment timeout"));
        }
      }, 5000);
    }

    fetch(`${this.baseUrl}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: this.id,
        event,
        data,
        messageId,
        requiresAck: !!ack,
        namespace: this.namespace,
      }),
    }).catch((error) => {
      console.error("Emit error:", error);
      if (ack && messageId) {
        this.ackCallbacks.delete(messageId);
        ack(error);
      }
    });
  }

  on(event: string, handler: EventHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  once(event: string, handler: EventHandler): void {
    const onceHandler: EventHandler = (data) => {
      this.off(event, onceHandler);
      handler(data);
    };
    this.on(event, onceHandler);
  }

  off(event: string, handler?: EventHandler): void {
    if (!handler) {
      this.handlers.delete(event);
    } else {
      this.handlers.get(event)?.delete(handler);
    }
  }

  offAll(): void {
    this.handlers.clear();
    this.setupInternalHandlers();
  }

  private emitLocal(event: string, data: unknown): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  private startSSE(): void {
    if (!this.id) return;

    const url = new URL(`${this.baseUrl}/sse`);
    url.searchParams.set("sessionId", this.id);
    url.searchParams.set("namespace", this.namespace);
    
    if (this.lastMessageTimestamp) {
      url.searchParams.set("since", this.lastMessageTimestamp.toString());
    }

    this.eventSource = new EventSource(url.toString());

    this.eventSource.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error("Failed to parse SSE message:", error);
      }
    };

    this.eventSource.onerror = () => {
      console.error("SSE connection error");
      this.eventSource?.close();
      this.eventSource = null;
      
      if (this.connected) {
        this.connected = false;
        this.emitLocal("disconnect", { reason: "transport" });
        this.handleReconnect();
      }
    };

    this.eventSource.onopen = () => {
      this.emitLocal("transport_open", { transport: "sse" });
    };
  }

  private startPolling(): void {
    if (!this.id) return;

    const poll = async () => {
      try {
        const url = new URL(`${this.baseUrl}/poll`);
        url.searchParams.set("sessionId", this.id);
        url.searchParams.set("namespace", this.namespace);
        
        if (this.lastMessageTimestamp) {
          url.searchParams.set("since", this.lastMessageTimestamp.toString());
        }

        const response = await fetch(url.toString());
        
        if (!response.ok) {
          throw new Error(`Polling failed: ${response.status}`);
        }

        const { messages } = await response.json();
        
        if (messages?.length) {
          messages.forEach((message: { event: string; data: unknown }) => {
            this.handleMessage(message);
          });
        }
      } catch (error) {
        console.error("Polling error:", error);
        if (this.connected) {
          this.connected = false;
          this.emitLocal("disconnect", { reason: "transport" });
          this.handleReconnect();
        }
      }
    };

    // Initial poll
    poll();
    
    // Continue polling
    this.pollingInterval = setInterval(poll, 1000);
  }

  private async handleMessage(message: {
    event: string;
    data: unknown;
    messageId?: string;
    timestamp?: number;
  }): Promise<void> {
    // Deduplication
    if (message.messageId) {
      if (this.processedMessages.has(message.messageId)) {
        return;
      }
      this.processedMessages.add(message.messageId);
    }

    // Update last message timestamp
    if (message.timestamp) {
      this.lastMessageTimestamp = Math.max(this.lastMessageTimestamp, message.timestamp);
    }

    // Handle ack responses
    if (message.event === "__ack" && message.messageId) {
      const callback = this.ackCallbacks.get(message.messageId);
      if (callback) {
        callback(message.data);
        this.ackCallbacks.delete(message.messageId);
      }
      return;
    }

    // Decompress if needed
    let processedData = message.data;
    
    if (
      typeof processedData === "object" &&
      processedData !== null &&
      (processedData as { __compressed?: boolean }).__compressed
    ) {
      try {
        const compressed = (processedData as { data: string }).data;
        processedData = JSON.parse(await decompressMessage(compressed));
      } catch {
        // Fallback to original data
      }
    }

    // Decode binary if needed
    if (isBinaryData(processedData)) {
      processedData = decodeBinaryData(processedData as BinaryMessage);
    }

    // Emit to handlers
    const handlers = this.handlers.get(message.event);
    if (handlers) {
      handlers.forEach((handler) => handler(processedData));
    }
  }

  private handleReconnect(): void {
    if (!this.reconnectEnabled) return;
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnect attempts reached");
      this.emitLocal("reconnect_failed", { attempts: this.reconnectAttempts });
      return;
    }

    this.reconnectAttempts++;
    
    // Exponential backoff with jitter
    const jitter = Math.random() * 1000;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1) + jitter,
      this.maxReconnectDelay
    );

    this.emitLocal("reconnecting", {
      attempt: this.reconnectAttempts,
      delay,
    });

    this.reconnectTimer = setTimeout(() => {
      console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    
    this.heartbeatTimer = setInterval(() => {
      if (this.connected) {
        this.emit("__pong", { timestamp: Date.now() });
        
        // Check if server is responsive
        if (this.lastPong && Date.now() - this.lastPong > this.heartbeatInterval * 2) {
          console.warn("Server not responding to heartbeats");
          this.emitLocal("heartbeat_timeout", { lastPong: this.lastPong });
        }
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private startDedupeCleanup(): void {
    // Clean up old message IDs every 5 minutes
    this.dedupeCleanupInterval = setInterval(() => {
      if (this.processedMessages.size > 10000) {
        // Keep only last 1000
        const arr = Array.from(this.processedMessages);
        this.processedMessages = new Set(arr.slice(-1000));
      }
    }, 5 * 60 * 1000);
  }

  private stopDedupeCleanup(): void {
    if (this.dedupeCleanupInterval) {
      clearInterval(this.dedupeCleanupInterval);
      this.dedupeCleanupInterval = null;
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // Public getters

  /**
   * Get current latency in ms
   */
  getLatency(): number {
    return this.latency;
  }

  /**
   * Get volatile emitter
   */
  get volatile(): VolatileClientEmitter {
    return this._volatile;
  }

  /**
   * Get presence manager
   */
  get presence(): ClientPresence {
    return this._presence;
  }

  /**
   * Get/set session data
   */
  getSessionData<T>(key: string): T | undefined {
    return this.sessionData[key] as T | undefined;
  }

  setSessionData(key: string, value: unknown): void {
    this.sessionData[key] = value;
  }

  /**
   * Force transport switch
   */
  switchTransport(transport: "sse" | "polling"): void {
    if (this.transport === transport) return;
    
    // Stop current transport
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    this.transport = transport;

    // Start new transport
    if (this.connected) {
      if (transport === "sse") {
        this.startSSE();
      } else {
        this.startPolling();
      }
    }
  }

  /**
   * Emit binary data
   */
  emitBinary(event: string, data: ArrayBuffer | Blob | Uint8Array): void {
    // Convert to base64 for transport
    const bytes = data instanceof Blob ? new Uint8Array() : new Uint8Array(data instanceof Uint8Array ? data : data);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    this.emit(event, {
      type: "binary",
      encoding: "base64",
      data: btoa(binary),
      size: bytes.byteLength,
    });
  }
}

/**
 * Volatile Client Emitter
 * For non-critical messages
 */
class VolatileClientEmitter {
  private socket: EnhancedClientSocket;

  constructor(socket: EnhancedClientSocket) {
    this.socket = socket;
  }

  emit(event: string, data: unknown): void {
    if (!this.socket.connected) return;
    
    // Volatile: fire and forget, no error handling
    fetch(`${(this.socket as unknown as { baseUrl: string }).baseUrl}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: this.socket.id,
        event,
        data,
        volatile: true,
      }),
    }).catch(() => {
      // Silently fail for volatile messages
    });
  }
}

/**
 * Client Presence Manager
 */
class ClientPresence {
  private socket: EnhancedClientSocket;
  private status: "online" | "away" | "offline" | "busy" = "online";
  private customData: Record<string, unknown> = {};

  constructor(socket: EnhancedClientSocket) {
    this.socket = socket;
  }

  setStatus(status: "online" | "away" | "offline" | "busy"): void {
    this.status = status;
    this.socket.emit("__presence", { status, ...this.customData });
  }

  setCustomData(data: Record<string, unknown>): void {
    this.customData = { ...this.customData, ...data };
    this.socket.emit("__presence", { status: this.status, ...this.customData });
  }

  getStatus(): string {
    return this.status;
  }

  subscribe(userIds: string[]): void {
    this.socket.emit("__presence_subscribe", { userIds });
  }

  unsubscribe(userIds: string[]): void {
    this.socket.emit("__presence_unsubscribe", { userIds });
  }
}

// Factory function
export function createEnhancedClient(
  url: string,
  options?: EnhancedClientOptions
): EnhancedClientSocket {
  return new EnhancedClientSocket(url, options);
}
