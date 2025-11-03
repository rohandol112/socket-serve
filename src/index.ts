import { createNextJSAdapter } from "./adapters/nextjs";
import { createExpressAdapter } from "./adapters/express";
import type { SocketServeConfig } from "./types";

export function serve(config: SocketServeConfig) {
  if (config.adapter === "nextjs") {
    return createNextJSAdapter(config);
  }

  if (config.adapter === "express") {
    return createExpressAdapter(config);
  }

  throw new Error(`Adapter ${config.adapter} not supported yet`);
}

export * from "./types";
export { connect } from "./client";
