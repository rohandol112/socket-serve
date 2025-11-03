import { ClientSocketImpl } from "./socket";
import type { ClientSocket } from "../types";

export function connect(url: string): ClientSocket {
  const socket = new ClientSocketImpl(url);
  socket.connect();
  return socket;
}

export type { ClientSocket };
