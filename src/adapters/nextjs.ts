import { SocketServer } from "../server";
import type { SocketServeConfig } from "../types";
import type { NextRequest } from "next/server";

export function createNextJSAdapter(config: SocketServeConfig) {
  const server = new SocketServer(config);

  return {
    onConnect: server.onConnect.bind(server),
    onMessage: server.onMessage.bind(server),
    onDisconnect: server.onDisconnect.bind(server),

    handlers: {
      async POST(request: NextRequest) {
        const url = new URL(request.url);
        const pathname = url.pathname;

        if (pathname.endsWith("/connect")) {
          const result = await server.handleConnect();
          return Response.json(result);
        }

        if (pathname.endsWith("/message")) {
          const body = await request.json();
          const { sessionId, event, data } = body;
          await server.handleMessage(sessionId, event, data);
          return Response.json({ success: true });
        }

        if (pathname.endsWith("/disconnect")) {
          const body = await request.json();
          const { sessionId } = body;
          await server.handleDisconnect(sessionId);
          return Response.json({ success: true });
        }

        return new Response("Not found", { status: 404 });
      },

      async GET(request: NextRequest) {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get("sessionId");

        if (!sessionId) {
          return new Response("Missing sessionId", { status: 400 });
        }

        // SSE endpoint
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller: ReadableStreamDefaultController) {
            // Send initial connection message
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ event: "connected", data: {} })}\n\n`
              )
            );

            // Subscribe to messages
            const stateManager = server.getStateManager();
            await stateManager.subscribe(
              `ss:channel:${sessionId}`,
              (message) => {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(message)}\n\n`)
                );
              }
            );

            // Keep alive
            const keepAlive = setInterval(() => {
              controller.enqueue(encoder.encode(": keepalive\n\n"));
            }, 30000);

            // Cleanup on close
            request.signal.addEventListener("abort", () => {
              clearInterval(keepAlive);
              controller.close();
            });
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      },
    },
  };
}
