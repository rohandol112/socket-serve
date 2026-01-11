/**
 * Middleware System
 * Express-style middleware chain for socket connections
 */

import type { ServerSocket } from "../types.js";

export interface MiddlewareContext {
  socket: ServerSocket;
  event?: string;
  data?: unknown;
  auth?: {
    token?: string;
    userId?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export type NextFunction = (error?: Error) => void;
export type MiddlewareFunction = (
  ctx: MiddlewareContext,
  next: NextFunction
) => void | Promise<void>;

export class MiddlewareChain {
  private middlewares: MiddlewareFunction[] = [];

  /**
   * Add middleware to the chain
   */
  use(middleware: MiddlewareFunction): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Execute the middleware chain
   */
  async execute(ctx: MiddlewareContext): Promise<void> {
    let index = 0;

    const next: NextFunction = async (error?: Error) => {
      if (error) {
        throw error;
      }

      if (index >= this.middlewares.length) {
        return;
      }

      const middleware = this.middlewares[index++];
      await middleware(ctx, next);
    };

    await next();
  }

  /**
   * Get the number of middlewares
   */
  get length(): number {
    return this.middlewares.length;
  }
}

// Built-in middlewares

/**
 * Authentication middleware
 */
export function authMiddleware(
  verifyToken: (token: string) => Promise<{ userId: string; [key: string]: unknown } | null>
): MiddlewareFunction {
  return async (ctx, next) => {
    const token = ctx.auth?.token;
    
    if (!token) {
      throw new Error("Authentication required");
    }

    const user = await verifyToken(token);
    
    if (!user) {
      throw new Error("Invalid token");
    }

    ctx.auth = { ...ctx.auth, ...user };
    await next();
  };
}

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(
  options: {
    windowMs?: number;
    maxRequests?: number;
  } = {}
): MiddlewareFunction {
  const { windowMs = 60000, maxRequests = 100 } = options;
  const requestCounts = new Map<string, { count: number; resetAt: number }>();

  return async (ctx, next) => {
    const key = ctx.socket.id;
    const now = Date.now();
    
    let entry = requestCounts.get(key);
    
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      requestCounts.set(key, entry);
    }

    entry.count++;

    if (entry.count > maxRequests) {
      throw new Error("Rate limit exceeded");
    }

    await next();
  };
}

/**
 * Logging middleware
 */
export function loggingMiddleware(
  logger: (message: string, data?: unknown) => void = console.log
): MiddlewareFunction {
  return async (ctx, next) => {
    const start = Date.now();
    
    logger(`[Socket] Event: ${ctx.event || "connection"}`, {
      socketId: ctx.socket.id,
      data: ctx.data,
    });

    await next();

    const duration = Date.now() - start;
    logger(`[Socket] Completed in ${duration}ms`);
  };
}

/**
 * Validation middleware
 */
export function validationMiddleware<T>(
  schema: {
    validate: (data: unknown) => { error?: Error; value?: T };
  }
): MiddlewareFunction {
  return async (ctx, next) => {
    if (ctx.data) {
      const result = schema.validate(ctx.data);
      
      if (result.error) {
        throw new Error(`Validation failed: ${result.error.message}`);
      }

      ctx.data = result.value;
    }

    await next();
  };
}

/**
 * Error handling middleware (should be first in chain)
 */
export function errorHandlerMiddleware(
  onError: (error: Error, ctx: MiddlewareContext) => void
): MiddlewareFunction {
  return async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      onError(error as Error, ctx);
    }
  };
}
