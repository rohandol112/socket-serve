// Client-side socket implementation for Express example
class ClientSocket {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.id = '';
    this.connected = false;
    this.eventSource = null;
    this.handlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async connect() {
    try {
      // Create session
      const response = await fetch(`${this.baseUrl}/connect`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to connect');
      }

      const { sessionId } = await response.json();
      this.id = sessionId;
      this.connected = true;
      this.reconnectAttempts = 0;

      // Start SSE connection
      this.startSSE();
    } catch (error) {
      console.error('Connection failed:', error);
      this.handleReconnect();
    }
  }

  disconnect() {
    this.connected = false;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.id) {
      fetch(`${this.baseUrl}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.id }),
      }).catch(console.error);
    }
  }

  emit(event, data) {
    if (!this.connected || !this.id) {
      console.error('Not connected');
      return;
    }

    fetch(`${this.baseUrl}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: this.id,
        event,
        data,
      }),
    }).catch(console.error);
  }

  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event).add(handler);
  }

  off(event, handler) {
    if (!handler) {
      this.handlers.delete(event);
    } else {
      this.handlers.get(event)?.delete(handler);
    }
  }

  startSSE() {
    if (!this.id) return;

    this.eventSource = new EventSource(`${this.baseUrl}/sse?sessionId=${this.id}`);

    this.eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    };

    this.eventSource.onerror = () => {
      console.error('SSE connection error');
      this.eventSource?.close();
      this.connected = false;
      this.handleReconnect();
    };
  }

  handleMessage(message) {
    const handlers = this.handlers.get(message.event);
    if (handlers) {
      handlers.forEach((handler) => handler(message.data));
    }
  }

  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
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

export function connect(url) {
  const socket = new ClientSocket(url);
  socket.connect();
  return socket;
}
