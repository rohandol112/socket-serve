import type { ClientSocket } from "../types.js";

type EventHandler = (data: unknown) => void;
type AckCallback = (response?: unknown) => void;

export class ClientSocketImpl implements ClientSocket {
  public id: string = "";
  public connected: boolean = false;
  
  private baseUrl: string;
  private transport: "sse" | "polling" = "sse";
  private eventSource: EventSource | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private ackCallbacks: Map<string, AckCallback> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

  constructor(baseUrl: string, transport: "sse" | "polling" = "sse") {
    this.baseUrl = baseUrl;
    this.transport = transport;
  }

  async connect(): Promise<void> {
    try {
      // Create a new session
      const response = await fetch(`${this.baseUrl}/connect`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to connect");
      }

      const { sessionId } = await response.json();
      this.id = sessionId;
      this.connected = true;
      this.reconnectAttempts = 0;

      // Start appropriate transport
      if (this.transport === "sse") {
        this.startSSE();
      } else {
        this.startPolling();
      }
    } catch (error) {
      console.error("Connection failed:", error);
      this.handleReconnect();
    }
  }

  disconnect(): void {
    this.connected = false;
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    // Notify server
    if (this.id) {
      fetch(`${this.baseUrl}/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: this.id }),
      }).catch(console.error);
    }
  }

  emit(event: string, data: unknown, ack?: AckCallback): void {
    if (!this.connected || !this.id) {
      console.error("Not connected");
      if (ack) ack(new Error("Not connected"));
      return;
    }

    const messageId = ack ? Math.random().toString(36).substring(7) : undefined;
    
    if (ack && messageId) {
      this.ackCallbacks.set(messageId, ack);
      // Set timeout for ack (5 seconds)
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

  off(event: string, handler?: EventHandler): void {
    if (!handler) {
      this.handlers.delete(event);
    } else {
      this.handlers.get(event)?.delete(handler);
    }
  }

  private startSSE(): void {
    if (!this.id) return;

    this.eventSource = new EventSource(`${this.baseUrl}/sse?sessionId=${this.id}`);

    this.eventSource.onmessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error("Failed to parse message:", error);
      }
    };

    this.eventSource.onerror = () => {
      console.error("SSE connection error");
      this.eventSource?.close();
      this.connected = false;
      this.handleReconnect();
    };
  }

  private startPolling(): void {
    if (!this.id) return;

    this.pollingInterval = setInterval(async () => {
      try {
        const response = await fetch(`${this.baseUrl}/sse?sessionId=${this.id}&transport=polling`);
        if (!response.ok) {
          throw new Error("Polling failed");
        }

        const { messages } = await response.json();
        if (messages && Array.isArray(messages)) {
          messages.forEach((message: { event: string; data: unknown }) => {
            this.handleMessage(message);
          });
        }
      } catch (error) {
        console.error("Polling error:", error);
        this.connected = false;
        this.handleReconnect();
      }
    }, 1000); // Poll every second
  }

  private handleMessage(message: { event: string; data: unknown; messageId?: string }): void {
    // Handle acknowledgment responses
    if (message.event === "__ack" && message.messageId) {
      const callback = this.ackCallbacks.get(message.messageId);
      if (callback) {
        callback(message.data);
        this.ackCallbacks.delete(message.messageId);
      }
      return;
    }

    // Handle regular messages
    const handlers = this.handlers.get(message.event);
    if (handlers) {
      handlers.forEach((handler) => handler(message.data));
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 
      30000
    );

    setTimeout(() => {
      console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
      this.connect();
    }, delay);
  }
}
