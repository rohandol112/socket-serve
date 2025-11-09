import { ClientSocketImpl } from "./socket.js";
import type { ClientSocket } from "../types.js";

export interface ConnectOptions {
  transport?: "sse" | "polling";
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export function connect(url: string, options?: ConnectOptions): ClientSocket {
  const socket = new ClientSocketImpl(
    url,
    options?.transport || "sse"
  );
  socket.connect();
  return socket;
}

export type { ClientSocket };
