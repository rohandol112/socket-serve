# ⚡ socket-serve

> Real-time socket-like API for serverless platforms. Deploy Socket.IO-style code to Vercel, Netlify, and Cloudflare Workers without WebSockets.

[![npm version](https://img.shields.io/npm/v/socket-serve?color=blue)](https://www.npmjs.com/package/socket-serve)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

---

## 🎯 What is socket-serve?

**socket-serve** lets you write real-time applications with a Socket.IO-like API, but deploy them to serverless platforms that don't support WebSockets.

Instead of WebSockets, it uses:
- 📤 **HTTP/POST** for client → server communication
- 📥 **Server-Sent Events (SSE)** for server → client streaming
- 💾 **Redis** for state persistence and pub/sub

**Perfect for:**
- ✅ Vercel, Netlify, Cloudflare Workers
- ✅ Next.js App Router serverless functions
- ✅ Any platform without WebSocket support
- ✅ Projects that need persistent state across deployments

---

## 🚀 Quick Start

### Installation

```bash
npm install socket-serve ioredis
```

## 📚 API Reference

### Server API

#### `serve(config)`

Initialize socket-serve adapter.

```typescript
import { serve } from 'socket-serve';

const adapter = serve({
  adapter: 'nextjs' | 'express',
  redisUrl: string,
  ttl?: number,        // Session TTL in seconds (default: 3600)
  transport?: 'sse',   // Transport type (SSE only for now)
});
```

#### `adapter.onConnect(handler)`

Handle new client connections.

```typescript
adapter.onConnect((socket) => {
  console.log('Connected:', socket.id);
  socket.emit('event', data);
});
```

#### `adapter.onMessage(event, handler)`

Handle specific message events.

```typescript
adapter.onMessage('chat', async (socket, data) => {
  await socket.broadcast('chat', data);
});
```

#### `adapter.onDisconnect(handler)`

Handle client disconnections.

```typescript
adapter.onDisconnect((socket) => {
  console.log('Disconnected:', socket.id);
});
```

### Socket API

#### `socket.emit(event, data)`

Send event to this specific client.

```typescript
socket.emit('notification', { message: 'Hello!' });
```

#### `socket.broadcast(event, data)`

Send event to all other connected clients.

```typescript
await socket.broadcast('user-joined', { userId: socket.id });
```

#### `socket.join(room)` / `socket.leave(room)`

Join or leave a room (coming soon).

```typescript
await socket.join('room-123');
await socket.leave('room-123');
```

#### `socket.get(key)` / `socket.set(key, value)`

Store data in session state.

```typescript
socket.set('username', 'john');
const username = socket.get<string>('username');
```

### Client API

#### `connect(url)`

Connect to socket server.

```typescript
import { connect } from 'socket-serve/client';

const socket = connect('/api/socket');
```

#### `socket.on(event, handler)`

Listen for events.

```typescript
socket.on('message', (data) => {
  console.log('Received:', data);
});
```

#### `socket.emit(event, data)`

Send event to server.

```typescript
socket.emit('chat', { text: 'Hello!' });
```

#### `socket.disconnect()`

Close connection.

```typescript
socket.disconnect();
```

---

## 🎨 Use Cases

### Chat Applications
```typescript
adapter.onMessage('chat', async (socket, data) => {
  await socket.broadcast('chat', {
    from: socket.id,
    text: data.text,
    timestamp: Date.now()
  });
});
```

### Live Notifications
```typescript
adapter.onMessage('notify-all', async (socket, data) => {
  await socket.broadcast('notification', {
    type: 'info',
    message: data.message
  });
});
```

### Collaborative Tools
```typescript
adapter.onMessage('cursor-move', async (socket, data) => {
  await socket.broadcast('cursor-update', {
    userId: socket.id,
    x: data.x,
    y: data.y
  });
});
```

### Live Dashboards
```typescript
adapter.onMessage('metric-update', async (socket, data) => {
  socket.set('lastMetric', data);
  await socket.broadcast('dashboard-update', data);
});
```

---

**Server** (`app/api/socket/[[...path]]/route.ts`):

```typescript
import { serve } from 'socket-serve';

const adapter = serve({
  adapter: 'nextjs',
  redisUrl: process.env.REDIS_URL!,
});

adapter.onConnect((socket) => {
  socket.emit('welcome', { text: 'Connected!' });
});

adapter.onMessage('chat', (socket, data) => {
  socket.broadcast('chat', data);
});

export const GET = adapter.handlers.GET;
export const POST = adapter.handlers.POST;
```

**Client** (any React component):

```typescript
'use client';
import { connect } from 'socket-serve/client';
import { useEffect, useState } from 'react';

export default function Chat() {
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    const s = connect('/api/socket');
    
    s.on('welcome', (data) => {
      console.log(data.text);
    });

    s.on('chat', (data) => {
      console.log('New message:', data);
    });

    setSocket(s);
    return () => s.disconnect();
  }, []);

  const sendMessage = () => {
    socket?.emit('chat', { text: 'Hello!' });
  };

  return <button onClick={sendMessage}>Send</button>;
}
```

---

## 💡 Why Use socket-serve?

### The Problem with WebSockets on Serverless

Traditional Socket.IO and WebSocket libraries require:
- ❌ Persistent server connections
- ❌ Stateful servers (memory-based state)
- ❌ Infrastructure that supports WebSocket protocol
- ❌ Complex scaling with sticky sessions

**Serverless platforms like Vercel don't support this.**

### The socket-serve Solution

socket-serve provides the same developer experience but uses serverless-compatible technologies:

| Socket.IO | socket-serve |
|-----------|--------------|
| WebSocket protocol | HTTP + SSE |
| In-memory state | Redis persistence |
| Persistent connections | Stateless functions |
| Manual scaling | Auto-scaling |
| Dedicated server required | Serverless-ready |

---

## 🏗️ How It Works

```
┌─────────────┐         ┌──────────────────┐         ┌─────────┐
│   Browser   │         │ Serverless Func  │         │  Redis  │
│             │         │  (Next.js/Edge)  │         │         │
└──────┬──────┘         └────────┬─────────┘         └────┬────┘
       │                         │                        │
       │ emit('chat', msg)       │                        │
       ├────POST /api/socket─────►                        │
       │                         │                        │
       │                         ├──PUBLISH to channel───►│
       │                         │                        │
       │ on('chat')              │                        │
       ├────GET /api/socket/sse──►                        │
       │   <EventSource>         │                        │
       │                         ◄──SUBSCRIBE channel────┤│
       │                         │                        │
       ◄───SSE stream────────────┤                        │
       │                         │                        │
```

**No WebSockets. No persistent servers. Just HTTP + Redis.**

---

## 🚀 Why socket-serve?

Traditional Socket.IO uses **WebSockets** - which need a persistent server connection. This doesn't work on serverless platforms.

**socket-serve** provides the same developer experience but uses:
- **HTTP POST** - for `socket.emit()` calls
- **SSE (Server-Sent Events)** - for real-time updates from server
- **Redis** - for state persistence between function invocations

So you can write code that *feels like Socket.IO*, but deploy it *as serverless functions*.

### How It Works Internally:

```
Client                    Serverless Function              Redis
  |                              |                           |
  |  POST /socket/connect        |                           |
  |----------------------------->|                           |
  |                              |  CREATE SESSION           |
  |                              |-------------------------->|
  |                              |                           |
  |  GET /socket/sse             |                           |
  |----------------------------->|  SUBSCRIBE CHANNEL        |
  |  <SSE stream open>           |-------------------------->|
  |                              |                           |
  |  POST /socket/message        |                           |
  |----------------------------->|  PUBLISH MESSAGE          |
  |                              |-------------------------->|
  |  <SSE: new message>          |  <PUBSUB: broadcast>      |
  |<-----------------------------|<--------------------------|
```

**No WebSockets. No persistent connections. Pure HTTP + Redis.**

---

## 🔄 Traditional WebSocket vs socket-serve

### With Socket.IO (Traditional - Requires Stateful Server)

```typescript
import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

io.on('connection', (socket) => {
  socket.emit('welcome', { text: 'Connected!' });
  
  socket.on('chat', (msg) => {
    socket.broadcast.emit('chat', msg);
  });
});

httpServer.listen(3000); // ❌ Needs persistent server
```

### With socket-serve (Serverless-Ready)

```typescript
import express from 'express';
import { serve } from 'socket-serve';

const app = express();

const adapter = serve({
  adapter: 'express',
  redisUrl: process.env.REDIS_URL
});

adapter.onConnect((socket) => {
  socket.emit('welcome', { text: 'Connected!' });
});

adapter.onMessage('chat', (socket, msg) => {
  socket.broadcast('chat', msg);
});

const handlers = adapter.middleware();
app.post('/socket/connect', handlers.connect);
app.post('/socket/message', handlers.message);
app.get('/socket/sse', handlers.sse);

app.listen(3000); // ✅ Works on Vercel, Netlify, etc.
```

**Key Differences:**
- ❌ Socket.IO = Requires WebSocket server (not serverless)
- ✅ socket-serve = Works with serverless functions
- ❌ Socket.IO = State in memory (lost on redeploy)
- ✅ socket-serve = State in Redis (persistent)
- ❌ Socket.IO = WebSocket protocol
- ✅ socket-serve = SSE/HTTP (serverless compatible)

---

## 🏗 Architecture

```
Browser                 Next.js/Express           Redis         
  |                     Serverless API             |
  |                                                |
  | emit('chat', msg)                              |
  |---> POST /api/socket/message ----------------->| SAVE
  |                                                |
  | on('chat')                                     |
  |---> GET /api/socket/sse (EventSource)          |
  |     <--- SSE stream <------------------------- | PUBSUB
  |                                                |
```

### Technical Stack:
- **Client → Server**: `fetch()` API (HTTP POST)
- **Server → Client**: `EventSource` API (SSE)
- **State Management**: Redis (ioredis)
- **Session Storage**: Redis with TTL
- **Broadcasting**: Redis Pub/Sub

**NO WebSocket connections. NO persistent servers.**

---## 📦 Installation & Setup

### 1. Install Package

```bash
npm install socket-serve ioredis
# or
yarn add socket-serve ioredis
# or
pnpm add socket-serve ioredis
```

### 2. Set Up Redis

You need a Redis instance. Choose one:

**Option A: Upstash (Recommended for Production)**
```bash
# Free tier available
# Sign up at https://upstash.com
# Create Redis database
# Copy REDIS_URL to .env
```

**Option B: Local Redis (Development)**
```bash
# Using Docker
docker run -d -p 6379:6379 redis:latest

# Or install locally
brew install redis  # macOS
sudo apt install redis  # Linux
```

Add to your `.env.local`:
```env
REDIS_URL=redis://localhost:6379
# Or for Upstash:
# REDIS_URL=rediss://default:xxxxx@xxxxx.upstash.io:6379
```

### 3. Choose Your Framework

<details>
<summary><b>Next.js (App Router)</b></summary>

Create `app/api/socket/[[...path]]/route.ts`:

```typescript
import { serve } from 'socket-serve';

const adapter = serve({
  adapter: 'nextjs',
  redisUrl: process.env.REDIS_URL!,
  ttl: 3600, // Session TTL in seconds
});

// Connection handler
adapter.onConnect((socket) => {
  console.log('Client connected:', socket.id);
  socket.emit('welcome', { text: 'Connected!' });
});

// Message handlers
adapter.onMessage('chat', async (socket, data) => {
  console.log('Message:', data);
  await socket.broadcast('chat', data);
});

// Disconnect handler
adapter.onDisconnect((socket) => {
  console.log('Client disconnected:', socket.id);
});

export const GET = adapter.handlers.GET;
export const POST = adapter.handlers.POST;
```

</details>

<details>
<summary><b>Express.js</b></summary>

Create `server.ts`:

```typescript
import express from 'express';
import { serve } from 'socket-serve';

const app = express();
app.use(express.json());

const adapter = serve({
  adapter: 'express',
  redisUrl: process.env.REDIS_URL!,
  ttl: 3600,
});

adapter.onConnect((socket) => {
  socket.emit('welcome', { text: 'Connected!' });
});

adapter.onMessage('chat', async (socket, data) => {
  await socket.broadcast('chat', data);
});

const handlers = adapter.middleware();
app.post('/socket/connect', handlers.connect);
app.post('/socket/message', handlers.message);
app.post('/socket/disconnect', handlers.disconnect);
app.get('/socket/sse', handlers.sse);

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

</details>

### 4. Client Setup

```typescript
import { connect } from 'socket-serve/client';

const socket = connect('/api/socket'); // or 'http://localhost:3000/socket'

// Listen for events
socket.on('welcome', (data) => {
  console.log(data.text);
});

socket.on('chat', (data) => {
  console.log('New message:', data);
});

// Emit events
socket.emit('chat', { text: 'Hello world!' });

// Cleanup
socket.disconnect();
```

---

## 🧩 Examples

### Next.js App Router

```typescript
// app/api/socket/[[...path]]/route.ts
import { serve } from "socket-serve";

const adapter = serve({
  adapter: "nextjs",
  redisUrl: process.env.REDIS_URL!,
});

adapter.onConnect((socket) => {
  socket.emit("welcome", { text: "Connected!" });
});

adapter.onMessage("chat", (socket, msg) => {
  socket.broadcast("chat", msg);
});

export const GET = adapter.handlers.GET;
export const POST = adapter.handlers.POST;
```

### Express.js Server

```typescript
import express from "express";
import { serve } from "socket-serve";

const app = express();
app.use(express.json());

const adapter = serve({
  adapter: "express",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
});

adapter.onConnect((socket) => {
  console.log("Client connected:", socket.id);
  socket.emit("welcome", { text: "Connected!" });
});

adapter.onMessage("chat", async (socket, data) => {
  await socket.broadcast("chat", data);
});

// Mount socket routes
const handlers = adapter.middleware();
app.post("/socket/connect", handlers.connect);
app.post("/socket/message", handlers.message);
app.post("/socket/disconnect", handlers.disconnect);
app.get("/socket/sse", handlers.sse);

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
```
```

### Client (Browser)

```typescript
import { connect } from "socket-serve/client";

const socket = connect("/api/socket"); // Next.js
// or
const socket = connect("/socket");     // Express

socket.on("welcome", (data) => console.log(data.text));

socket.emit("chat", { text: "Hello world" });
```

**How it works:**

| Action | Next.js | Express |
|--------|---------|---------|
| Connect | POST `/api/socket/connect` | POST `/socket/connect` |
| Send | POST `/api/socket/message` | POST `/socket/message` |
| Receive | GET `/api/socket?sessionId=...` (SSE) | GET `/socket/sse?sessionId=...` (SSE) |
| State | Redis | Redis |

---

## 🧮 Redis model (default)

| Key                  | Purpose         |
| -------------------- | --------------- |
| `ss:{sid}:state`     | session data    |
| `ss:{sid}:queue`     | event queue     |
| `ss:{sid}:ver`       | version counter |
| `ss:{sid}:processed` | idempotency set |
| `ss:channel:{sid}`   | pub/sub channel |

---

## 🔧 Configuration

```typescript
serve({
  adapter: "nextjs",    // or "express"
  redisUrl: "...",
  ttl: 3600,
  transport: "sse",     // or "polling", "pusher"
});
```

### Supported Adapters

| Adapter | Platform | Status |
|---------|----------|--------|
| `nextjs` | Next.js App Router | ✅ Stable |
| `express` | Express.js | ✅ Stable |
| `cloudflare` | Cloudflare Workers | 🚧 Coming Soon |
| `netlify` | Netlify Functions | 🚧 Coming Soon |

---

## 📈 Flow summary

1. Client connects → `create()` session.
2. Emits event → API handler executes user logic.
3. State saved in Redis + published to channel.
4. Other clients receive via SSE/polling.
5. Session auto-expires if idle.

---

## ⚙️ Use cases

* Chat / presence systems
* Multiplayer prototypes
* Live dashboards
* Collaborative editors
* Real-time notifications on Vercel

---

## 🚢 Deployment

### Vercel (Next.js)

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your repository
   - Add environment variable: `REDIS_URL`

3. **Deploy!**
   - Vercel auto-deploys on push
   - Your socket API works at `/api/socket`

### Netlify

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

### Railway / Render

These platforms support long-running processes, so you can use Express:

```bash
# Deploy Express server
npm start
```

---

## 🔧 Configuration Options

### Redis Connection

```typescript
serve({
  redisUrl: 'redis://localhost:6379',
  // Or with authentication:
  redisUrl: 'redis://:password@host:port',
  // Or Upstash (TLS):
  redisUrl: 'rediss://default:xxxxx@xxxxx.upstash.io:6379'
});
```

### Session TTL

```typescript
serve({
  ttl: 7200, // 2 hours
});
```

### Custom Transport (Future)

```typescript
serve({
  transport: 'sse', // Currently only SSE supported
  // Coming soon: 'polling', 'pusher', 'ably'
});
```

---

## 🎯 Roadmap

- [x] **v0.1** - Next.js adapter with SSE
- [x] **v0.2** - Express adapter
- [ ] **v0.3** - Room-based broadcasting
- [ ] **v0.4** - Polling transport fallback
- [ ] **v0.5** - Pusher/Ably adapter
- [ ] **v1.0** - Production ready
  - [ ] Reconnection with exponential backoff
  - [ ] Message acknowledgments
  - [ ] TypeScript strict mode
  - [ ] Comprehensive tests
  - [ ] Performance benchmarks

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

```bash
# Development setup
git clone https://github.com/rohandol112/socket-serve.git
cd socket-serve
npm install
npm run build

# Run examples
cd examples/nextjs
npm install
npm run dev
```

---

## � License

MIT © 2025 [Rohan Samidha](https://github.com/rohandol112)

---

## 🙏 Acknowledgments

Built with:
- [ioredis](https://github.com/redis/ioredis) - Redis client
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- Inspired by [Socket.IO](https://socket.io/) - The original real-time framework

---

## 🔗 Links

- [GitHub](https://github.com/rohandol112/socket-serve)
- [npm](https://www.npmjs.com/package/socket-serve)
- [Issues](https://github.com/rohandol112/socket-serve/issues)
- [Examples](./examples)

---

<div align="center">

**Made with ❤️ for the serverless community**

[⭐ Star on GitHub](https://github.com/rohandol112/socket-serve) • [📦 Install from npm](https://www.npmjs.com/package/socket-serve)

</div>
