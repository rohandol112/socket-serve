import { createNextJSAdapter } from "./adapters/nextjs";
import type { SocketServeConfig } from "./types";

export function serve(config: SocketServeConfig) {
  if (config.adapter === "nextjs") {
    return createNextJSAdapter(config);
  }

  throw new Error(`Adapter ${config.adapter} not supported yet`);
}

export * from "./types";
export { connect } from "./client";
