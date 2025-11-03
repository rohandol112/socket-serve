# Socket.IO vs socket-serve Comparison

This example demonstrates the differences between traditional Socket.IO and socket-serve.

## Why socket-serve instead of Socket.IO?

| Feature | Socket.IO | socket-serve |
|---------|-----------|--------------|
| **Deployment** | Requires persistent server | ✅ Serverless (Vercel, Netlify, etc.) |
| **WebSocket** | Native WebSocket protocol | ✅ HTTP/SSE (serverless compatible) |
| **State Storage** | In-memory (lost on restart) | ✅ Redis (persistent) |
| **Scaling** | Complex (sticky sessions) | ✅ Automatic (stateless functions) |
| **Cost** | Always-on server required | ✅ Pay-per-use serverless |
| **Cold Starts** | No | ⚠️ Yes (serverless functions) |
| **Latency** | Lower (persistent connection) | ⚠️ Slightly higher (HTTP overhead) |

## Code Comparison

### Traditional Socket.IO Server

```typescript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.emit('welcome', { 
    text: 'Connected to Socket.IO!' 
  });

  socket.on('chat', (data) => {
    console.log('Chat message:', data);
    socket.broadcast.emit('chat', data);
  });

  socket.on('typing', (data) => {
    socket.broadcast.emit('typing', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

httpServer.listen(3000);
```

### socket-serve Equivalent

```typescript
import express from 'express';
import { serve } from 'socket-serve';

const app = express();
app.use(express.json());

// Initialize socket-serve adapter
const adapter = serve({
  adapter: 'express',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  ttl: 3600,
  transport: 'sse'
});

// Same event handlers!
adapter.onConnect((socket) => {
  console.log('Client connected:', socket.id);
  socket.emit('welcome', { 
    text: 'Connected to socket-serve!' 
  });
});

adapter.onMessage('chat', async (socket, data) => {
  console.log('Chat message:', data);
  await socket.broadcast('chat', data);
});

adapter.onMessage('typing', async (socket, data) => {
  await socket.broadcast('typing', data);
});

adapter.onDisconnect((socket) => {
  console.log('Client disconnected:', socket.id);
});

// Mount socket routes
const handlers = adapter.middleware();
app.post('/socket/connect', handlers.connect);
app.post('/socket/message', handlers.message);
app.post('/socket/disconnect', handlers.disconnect);
app.get('/socket/sse', handlers.sse);

app.listen(3000);
```

## Client-Side Comparison

### Socket.IO Client

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('Connected');
});

socket.on('welcome', (data) => {
  console.log(data.text);
});

socket.emit('chat', { text: 'Hello' });

socket.on('chat', (data) => {
  console.log('Message:', data.text);
});
```

### socket-serve Client

```javascript
import { connect } from 'socket-serve/client';

const socket = connect('http://localhost:3000/socket');

socket.on('welcome', (data) => {
  console.log(data.text);
});

socket.emit('chat', { text: 'Hello' });

socket.on('chat', (data) => {
  console.log('Message:', data.text);
});
```

## When to Use Each?

### Use Socket.IO when:
- ✅ You need the lowest possible latency
- ✅ You can run a persistent Node.js server
- ✅ You need advanced features (rooms, namespaces, binary data)
- ✅ You're not deploying to serverless

### Use socket-serve when:
- ✅ You want to deploy to Vercel/Netlify/Cloudflare
- ✅ You want automatic scaling without sticky sessions
- ✅ You prefer stateless architecture
- ✅ You want to use serverless functions
- ✅ You need persistent state across deploys

## Migration Guide

To migrate from Socket.IO to socket-serve:

1. **Replace server imports:**
   ```typescript
   // Before
   import { Server } from 'socket.io';
   
   // After
   import { serve } from 'socket-serve';
   ```

2. **Update connection handling:**
   ```typescript
   // Before
   io.on('connection', (socket) => { ... });
   
   // After
   adapter.onConnect((socket) => { ... });
   ```

3. **Update event handlers:**
   ```typescript
   // Before
   socket.on('eventName', (data) => { ... });
   
   // After
   adapter.onMessage('eventName', (socket, data) => { ... });
   ```

4. **Update client:**
   ```typescript
   // Before
   import io from 'socket.io-client';
   const socket = io('http://localhost:3000');
   
   // After
   import { connect } from 'socket-serve/client';
   const socket = connect('http://localhost:3000/socket');
   ```

5. **Set up Redis:**
   - Install Redis (Docker/Upstash/Redis Cloud)
   - Set `REDIS_URL` environment variable

## Performance Comparison

| Metric | Socket.IO | socket-serve |
|--------|-----------|--------------|
| Connection Setup | ~10ms | ~50ms (includes Redis) |
| Message Latency | ~1-5ms | ~10-20ms |
| Concurrent Connections | 10,000+ | Limited by serverless |
| Memory Usage | ~1MB per 1000 connections | Stateless (Redis only) |
| Scaling | Manual (PM2/cluster) | Automatic (serverless) |

## Conclusion

**socket-serve** trades a small amount of latency for massive deployment flexibility. If you're building on serverless platforms like Vercel, it's the perfect solution for real-time features without managing WebSocket servers.
