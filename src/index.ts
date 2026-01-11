import { createNextJSAdapter } from "./adapters/nextjs.js";
import { createExpressAdapter } from "./adapters/express.js";
import { createEdgeAdapter, createEdgeSocketServer, EdgeSocketServer } from "./adapters/nextjs-edge.js";
import { SocketServer, SocketServerConfig } from "./server/index.js";
import { EnhancedSocketServer, createEnhancedServer, type EnhancedServerConfig } from "./server/enhanced-server.js";
import type { SocketServeConfig } from "./types.js";

export function serve(config: SocketServeConfig) {
  if (config.adapter === "nextjs") {
    return createNextJSAdapter(config);
  }

  if (config.adapter === "express") {
    return createExpressAdapter(config);
  }

  throw new Error(`Adapter ${config.adapter} not supported yet`);
}

// Simple helper to create a socket server
export function createSocketServer(config: SocketServerConfig): SocketServer {
  return new SocketServer(config);
}

// Core exports
export * from "./types.js";
export { connect } from "./client/index.js";
export { SocketServer } from "./server/index.js";
export type { SocketServerConfig } from "./server/index.js";

// Enhanced exports
export { EnhancedSocketServer, createEnhancedServer };
export type { EnhancedServerConfig };

// Edge runtime exports
export { EdgeSocketServer, createEdgeSocketServer, createEdgeAdapter };
export type { EdgeAdapterConfig } from "./adapters/nextjs-edge.js";

// Client exports
export { EnhancedClientSocket, createEnhancedClient } from "./client/enhanced-socket.js";
export type { EnhancedClientOptions } from "./client/enhanced-socket.js";

// Utilities
export { MiddlewareChain, authMiddleware, rateLimitMiddleware, loggingMiddleware, validationMiddleware } from "./utils/middleware.js";
export type { MiddlewareFunction, MiddlewareContext } from "./utils/middleware.js";

export { Namespace, NamespaceManager } from "./utils/namespace.js";

export { PresenceManager, presenceManager } from "./utils/presence.js";
export type { PresenceState, PresenceUpdate } from "./utils/presence.js";

export { compressMessage, decompressMessage, COMPRESSION_THRESHOLD } from "./utils/compression.js";

export { 
  arrayBufferToBase64, 
  base64ToArrayBuffer, 
  blobToBase64, 
  base64ToBlob,
  encodeBinaryData,
  decodeBinaryData,
  isBinaryData,
  chunkBinaryData,
  reassembleChunks
} from "./utils/binary.js";
export type { BinaryMessage } from "./utils/binary.js";

// Redis exports
export { RedisStateManager } from "./redis/state-manager.js";
export { UpstashStateManager } from "./redis/upstash-state-manager.js";
export { redisKeys } from "./redis/keys.js";
