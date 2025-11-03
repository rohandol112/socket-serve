# socket-serve Express Example

A complete real-time chat application using socket-serve with Express.js and Server-Sent Events (SSE).

## 🚀 Features

- ✅ Real-time messaging with SSE
- ✅ Typing indicators
- ✅ Multiple concurrent clients
- ✅ Redis-backed state management
- ✅ Beautiful UI with animations
- ✅ Automatic reconnection

## 📦 Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env and set your Redis URL
# REDIS_URL=redis://localhost:6379
```

## 🏃 Running the App

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

Server will start at **http://localhost:3000**

## 🧪 Testing

1. **Start Redis** (if not already running):
   ```bash
   docker run -d -p 6379:6379 --name redis redis:latest
   ```

2. **Start the server**:
   ```bash
   npm run dev
   ```

3. **Open multiple browser tabs**:
   - Tab 1: http://localhost:3000
   - Tab 2: http://localhost:3000
   
4. **Send messages** from one tab and watch them appear in the other!

5. **Try typing** - you'll see typing indicators in real-time

## 📁 Project Structure

```
express/
├── src/
│   └── server.ts          # Express server with socket-serve
├── public/
│   ├── index.html         # Frontend UI
│   └── socket-client.js   # Client-side socket implementation
├── package.json
├── tsconfig.json
└── .env.example
```

## 🔧 API Endpoints

### Socket Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/socket/connect` | Create new session |
| POST | `/socket/message` | Send message |
| POST | `/socket/disconnect` | Close session |
| GET | `/socket/sse` | SSE stream (real-time updates) |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health status |

## 💻 Server Code Example

```typescript
import express from "express";
import { serve } from "socket-serve";

const app = express();
app.use(express.json());

// Initialize socket-serve
const adapter = serve({
  adapter: "express",
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  ttl: 3600,
  transport: "sse",
});

// Handle connections
adapter.onConnect((socket) => {
  console.log("Client connected:", socket.id);
  socket.emit("welcome", { text: "Connected!" });
});

// Handle messages
adapter.onMessage("chat", async (socket, data) => {
  console.log("Message:", data);
  await socket.broadcast("chat", data);
});

// Mount routes
const handlers = adapter.middleware();
app.post("/socket/connect", handlers.connect);
app.post("/socket/message", handlers.message);
app.get("/socket/sse", handlers.sse);

app.listen(3000);
```

## 🌐 Client Code Example

```javascript
import { connect } from '/socket-client.js';

const socket = connect('/socket');

socket.on('welcome', (data) => {
  console.log(data.text);
});

socket.on('chat', (data) => {
  console.log('New message:', data);
});

socket.emit('chat', { text: 'Hello!' });
```

## 🔑 Environment Variables

```env
# Redis connection URL
REDIS_URL=redis://localhost:6379

# Server port
PORT=3000
```

## 🐛 Troubleshooting

### Redis Connection Errors

Make sure Redis is running:
```bash
docker ps | grep redis
```

If not running:
```bash
docker start redis
# or
docker run -d -p 6379:6379 --name redis redis:latest
```

### Port Already in Use

Change the port in `.env`:
```env
PORT=3001
```

### SSE Connection Issues

- Check browser DevTools → Network tab
- Look for `/socket/sse` request
- Should stay open (status 200, type: eventsource)

## 📊 How It Works

1. **Client connects** → POST to `/socket/connect` → Gets sessionId
2. **SSE stream opens** → GET `/socket/sse?sessionId=...` → Real-time channel
3. **Client sends message** → POST `/socket/message` → Stored in Redis
4. **Redis pub/sub** → Broadcasts to all connected clients
5. **SSE delivers** → All clients receive message instantly

## 🎯 Features to Try

- [ ] Open 3+ tabs and chat between them
- [ ] Try the typing indicator
- [ ] Close and reopen tabs (auto-reconnect)
- [ ] Check Redis keys: `docker exec redis redis-cli KEYS "ss:*"`
- [ ] Monitor server logs for connection events

## 📚 Learn More

- [Main Documentation](../../README.md)
- [socket-serve Setup Guide](../../SETUP.md)
- [Testing Guide](../../TESTING.md)

## 🤝 Contributing

Issues and PRs welcome!

---

Built with ⚡ **socket-serve** - WebSockets for the serverless world.
