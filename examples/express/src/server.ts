import express from "express";
import cors from "cors";
import { serve } from "socket-serve";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Initialize socket-serve with Express adapter
const adapter = serve({
  adapter: "express",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  ttl: 3600,
  transport: "sse",
});

// Register event handlers
adapter.onConnect((socket) => {
  console.log("✅ Client connected:", socket.id);
  socket.emit("welcome", { text: "Connected to socket-serve!" });
});

adapter.onMessage("chat", async (socket, data: any) => {
  console.log("💬 Chat message:", data);
  
  // Broadcast to all other clients
  await socket.broadcast("chat", {
    text: data.text,
    timestamp: Date.now(),
    from: socket.id,
  });
});

adapter.onMessage("typing", async (socket, data: any) => {
  console.log("⌨️  User typing:", socket.id);
  await socket.broadcast("typing", {
    userId: socket.id,
    isTyping: data.isTyping,
  });
});

adapter.onDisconnect((socket) => {
  console.log("❌ Client disconnected:", socket.id);
});

// Get middleware handlers
const handlers = adapter.middleware();

// Socket routes
app.post("/socket/connect", handlers.connect);
app.post("/socket/message", handlers.message);
app.post("/socket/disconnect", handlers.disconnect);
app.get("/socket/sse", handlers.sse);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// Serve index.html for root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Express server running on http://localhost:${PORT}`);
  console.log(`📡 Socket endpoints:`);
  console.log(`   POST http://localhost:${PORT}/socket/connect`);
  console.log(`   POST http://localhost:${PORT}/socket/message`);
  console.log(`   GET  http://localhost:${PORT}/socket/sse`);
});
