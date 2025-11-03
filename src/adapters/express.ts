import { SocketServer } from "../server";
import type { SocketServeConfig } from "../types";
import type { Request, Response } from "express";

export function createExpressAdapter(config: SocketServeConfig) {
  const server = new SocketServer(config);

  return {
    onConnect: server.onConnect.bind(server),
    onMessage: server.onMessage.bind(server),
    onDisconnect: server.onDisconnect.bind(server),

    // Express middleware for handling socket endpoints
    middleware() {
      return {
        // POST /socket/connect - Create new session
        connect: async (_req: Request, res: Response) => {
          try {
            const result = await server.handleConnect();
            res.json(result);
          } catch (error) {
            console.error("Connect error:", error);
            res.status(500).json({ error: "Failed to connect" });
          }
        },

        // POST /socket/message - Send message
        message: async (req: Request, res: Response) => {
          try {
            const { sessionId, event, data } = req.body;
            
            if (!sessionId || !event) {
              res.status(400).json({ error: "Missing sessionId or event" });
              return;
            }

            await server.handleMessage(sessionId, event, data);
            res.json({ success: true });
          } catch (error) {
            console.error("Message error:", error);
            res.status(500).json({ error: "Failed to send message" });
          }
        },

        // POST /socket/disconnect - Close session
        disconnect: async (req: Request, res: Response) => {
          try {
            const { sessionId } = req.body;
            
            if (!sessionId) {
              res.status(400).json({ error: "Missing sessionId" });
              return;
            }

            await server.handleDisconnect(sessionId);
            res.json({ success: true });
          } catch (error) {
            console.error("Disconnect error:", error);
            res.status(500).json({ error: "Failed to disconnect" });
          }
        },

        // GET /socket/sse?sessionId=xxx - SSE stream
        sse: async (req: Request, res: Response) => {
          const sessionId = req.query.sessionId as string;

          if (!sessionId) {
            res.status(400).json({ error: "Missing sessionId" });
            return;
          }

          // Set SSE headers
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

          // Send initial connection message
          res.write(
            `data: ${JSON.stringify({ event: "connected", data: {} })}\n\n`
          );

          // Subscribe to Redis messages
          const stateManager = server.getStateManager();
          
          try {
            await stateManager.subscribe(
              `ss:channel:${sessionId}`,
              (message) => {
                res.write(`data: ${JSON.stringify(message)}\n\n`);
              }
            );
          } catch (error) {
            console.error("SSE subscription error:", error);
            res.end();
            return;
          }

          // Keep alive ping every 30 seconds
          const keepAliveInterval = setInterval(() => {
            res.write(": keepalive\n\n");
          }, 30000);

          // Cleanup on client disconnect
          req.on("close", () => {
            clearInterval(keepAliveInterval);
            res.end();
          });
        },
      };
    },

    getServer() {
      return server;
    },
  };
}
