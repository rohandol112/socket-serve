# ⚡ socket-serve

**Convert traditional WebSockets into serverless-ready sockets.**  
Run real-time logic on platforms like **Vercel**, **Netlify**, or **Cloudflare Workers** without maintaining any socket servers.

[![npm version](https://img.shields.io/npm/v/socket-serve?color=blue)](https://www.npmjs.com/package/socket-serve)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🚀 Why socket-serve?

Traditional WebSockets need a **stateful server** — impossible on pure serverless hosts.  
**socket-serve** re-implements that pattern by translating socket APIs into:
- Stateless serverless endpoints (Next.js / API Routes)
- State stored in **Redis**
- Real-time delivery via **SSE**, **polling**, or **push adapters**

So you can write code that *feels like sockets*, but deploy it *as serverless*.

---

## 🧠 Concept

```
socket.io-style handlers   →   socket-serve runtime   →   Redis + SSE bridge
```

| Traditional WebSocket | socket-serve equivalent |
|-----------------------|-------------------------|
| `socket.emit()` | `socket.emit()` → POST → Redis |
| `socket.on()` | SSE or polling stream |
| `io.broadcast()` | Redis PUBLISH → fan-out |
| Persistent TCP | Stateless HTTP + Redis checkpoint |
| Node server | Vercel function |

---

## 🏗 Architecture

```
Browser SDK <--> Serverless adapter (Next.js API) <--> Redis (Upstash)
                 |
                 +--> Optional Pusher/Ably for high fan-out
```

- **Client SDK:** exposes familiar `connect`, `on`, `emit`  
- **Server runtime:** auto-generated adapter that converts each WebSocket event into a stateless call  
- **Redis:** holds session state + event queues  
- **SSE / polling:** delivers updates back to clients  

---

## 📦 Install

```bash
npm install socket-serve
```

### Requirements

- **Node.js 18+**
- **Redis** (local or remote like Upstash)

**Quick Redis Setup (macOS):**
```bash
brew install redis
brew services start redis
```

**Quick Redis Setup (Docker):**
```bash
docker run -d -p 6379:6379 --name redis redis:latest
```

See [SETUP.md](SETUP.md) for detailed installation instructions.

---

## 🧩 Example (Next.js)

### Server (API Route)

```typescript
// app/api/socket/route.ts
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

export const { POST, GET } = adapter.handlers;
```

### Client (Browser)

```typescript
import { connect } from "socket-serve/client";

const socket = connect("/api/socket");

socket.on("welcome", (data) => console.log(data.text));

socket.emit("chat", { text: "Hello world" });
```

Behind the scenes:

* `emit()` → POST to `/api/socket/message`
* `on()` → SSE stream from `/api/socket?sessionId=...`
* All session state lives in Redis.

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
  adapter: "nextjs",
  redisUrl: "...",
  ttl: 3600,
  transport: "sse", // or "polling", "pusher"
});
```

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

## 🧾 Roadmap

| Version        | Focus                                     |
| -------------- | ----------------------------------------- |
| **v0.1 (MVP)** | Next.js adapter + Redis state + SSE       |
| **v1.0**       | Reconnect + atomic Lua updates            |
| **v1.5**       | Push adapters (Pusher/Ably)               |
| **v2.0**       | DevTools + multi-region Redis + analytics |

---

## 🤝 Contributing

Open issues, fork, PR.  
Follow commit conventions in `CONTRIBUTING.md`.

---

## 📜 License

MIT © 2025 Rohan Samidha

---

**Tagline:**

> *socket-serve — WebSockets for the serverless world.*
