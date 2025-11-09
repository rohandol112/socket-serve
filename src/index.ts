import { createNextJSAdapter } from "./adapters/nextjs.js";
import { createExpressAdapter } from "./adapters/express.js";
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

export * from "./types.js";
export { connect } from "./client/index.js";
