/**
 * Namespace Support
 * Socket.IO-style namespaces for logical separation
 */

import type { ServerSocket, ConnectHandler, MessageHandler, DisconnectHandler } from "../types.js";

export interface NamespaceHandlers {
  onConnect?: ConnectHandler;
  onDisconnect?: DisconnectHandler;
  messages: Map<string, MessageHandler>;
}

export class Namespace {
  public readonly name: string;
  private handlers: NamespaceHandlers = {
    messages: new Map(),
  };
  private sockets: Map<string, ServerSocket> = new Map();

  constructor(name: string) {
    this.name = name.startsWith("/") ? name : `/${name}`;
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
   * Handle new connection to this namespace
   */
  async handleConnection(socket: ServerSocket): Promise<void> {
    this.sockets.set(socket.id, socket);
    
    if (this.handlers.onConnect) {
      await this.handlers.onConnect(socket);
    }
  }

  /**
   * Handle disconnection from this namespace
   */
  async handleDisconnection(socket: ServerSocket): Promise<void> {
    this.sockets.delete(socket.id);
    
    if (this.handlers.onDisconnect) {
      await this.handlers.onDisconnect(socket);
    }
  }

  /**
   * Handle message in this namespace
   */
  async handleMessage(socket: ServerSocket, event: string, data: unknown): Promise<boolean> {
    const handler = this.handlers.messages.get(event);
    
    if (!handler) {
      return false;
    }

    await handler(socket, data);
    return true;
  }

  /**
   * Emit to all sockets in namespace
   */
  async emit(event: string, data: unknown): Promise<void> {
    const promises = Array.from(this.sockets.values()).map(socket =>
      socket.emit(event, data)
    );
    await Promise.all(promises);
  }

  /**
   * Get all connected sockets in namespace
   */
  getSockets(): Map<string, ServerSocket> {
    return new Map(this.sockets);
  }

  /**
   * Get socket by ID
   */
  getSocket(socketId: string): ServerSocket | undefined {
    return this.sockets.get(socketId);
  }

  /**
   * Get connected socket count
   */
  get socketCount(): number {
    return this.sockets.size;
  }
}

export class NamespaceManager {
  private namespaces: Map<string, Namespace> = new Map();
  private defaultNamespace: Namespace;

  constructor() {
    this.defaultNamespace = new Namespace("/");
    this.namespaces.set("/", this.defaultNamespace);
  }

  /**
   * Get or create a namespace
   */
  of(name: string): Namespace {
    const normalizedName = name.startsWith("/") ? name : `/${name}`;
    
    let namespace = this.namespaces.get(normalizedName);
    
    if (!namespace) {
      namespace = new Namespace(normalizedName);
      this.namespaces.set(normalizedName, namespace);
    }

    return namespace;
  }

  /**
   * Get the default namespace
   */
  get default(): Namespace {
    return this.defaultNamespace;
  }

  /**
   * Check if namespace exists
   */
  has(name: string): boolean {
    const normalizedName = name.startsWith("/") ? name : `/${name}`;
    return this.namespaces.has(normalizedName);
  }

  /**
   * Get all namespace names
   */
  getNamespaceNames(): string[] {
    return Array.from(this.namespaces.keys());
  }

  /**
   * Parse namespace from path (e.g., "/chat/events" -> "/chat")
   */
  parseNamespace(path: string): { namespace: string; event?: string } {
    if (!path.startsWith("/")) {
      path = `/${path}`;
    }

    // Check for exact match first
    if (this.namespaces.has(path)) {
      return { namespace: path };
    }

    // Find longest matching namespace
    const parts = path.split("/").filter(Boolean);
    
    for (let i = parts.length; i >= 1; i--) {
      const potentialNs = `/${parts.slice(0, i).join("/")}`;
      if (this.namespaces.has(potentialNs)) {
        const remaining = parts.slice(i).join("/");
        return {
          namespace: potentialNs,
          event: remaining || undefined,
        };
      }
    }

    // Default to root namespace
    return { namespace: "/" };
  }
}
