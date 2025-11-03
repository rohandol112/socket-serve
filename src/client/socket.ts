import type { ClientSocket } from "../types";

type EventHandler = (data: unknown) => void;

export class ClientSocketImpl implements ClientSocket {
  public id: string = "";
  public connected: boolean = false;
  
  private baseUrl: string;
  private eventSource: EventSource | null = null;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
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

      // Start SSE connection
      this.startSSE();
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

    // Notify server
    if (this.id) {
      fetch(`${this.baseUrl}/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: this.id }),
      }).catch(console.error);
    }
  }

  emit(event: string, data: unknown): void {
    if (!this.connected || !this.id) {
      console.error("Not connected");
      return;
    }

    fetch(`${this.baseUrl}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: this.id,
        event,
        data,
      }),
    }).catch(console.error);
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

  private handleMessage(message: { event: string; data: unknown }): void {
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
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);

    setTimeout(() => {
      console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
      this.connect();
    }, delay);
  }
}
