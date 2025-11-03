# Testing Guide for socket-serve

This guide shows you how to test all features of socket-serve.

## 🚀 Quick Start Test

### 1. Start the Server
```bash
cd examples/nextjs
npm run dev
```

Server will start at http://localhost:3000 (or 3001 if 3000 is busy)

---

## 🧪 Test Scenarios

### ✅ Test 1: Basic Connection

**What to test:**
- Client connects to server
- Welcome message is received

**Steps:**
1. Open http://localhost:3000 in browser
2. Open Browser DevTools (F12 or Cmd+Option+I)
3. Check Console tab - should see connection logs
4. Check the chat interface - should see "System: Connected to socket-serve!"

**Expected Results:**
- ✅ No errors in browser console
- ✅ Welcome message appears
- ✅ Server logs show: `Client connected: <sessionId>`

---

### ✅ Test 2: Send a Message

**What to test:**
- Client can emit events
- Server receives and processes them

**Steps:**
1. Type "Hello World" in the input box
2. Click "Send" button
3. Check the message appears in the chat area

**Expected Results:**
- ✅ Message appears as "User: Hello World"
- ✅ Server logs show: `Chat message: { text: 'Hello World' }`

---

### ✅ Test 3: Real-time Broadcasting (Multi-Tab)

**What to test:**
- Messages broadcast to all connected clients
- Multiple clients can connect simultaneously

**Steps:**
1. Keep first browser tab open
2. Open a NEW tab/window → http://localhost:3000
3. Send message from Tab 1: "From Tab 1"
4. Send message from Tab 2: "From Tab 2"
5. Check BOTH tabs

**Expected Results:**
- ✅ Both tabs show "System: Connected..." message
- ✅ Messages from Tab 1 appear in Tab 2
- ✅ Messages from Tab 2 appear in Tab 1
- ✅ Real-time updates (no refresh needed)
- ✅ Server logs show 2 connected clients

---

### ✅ Test 4: SSE Connection

**What to test:**
- Server-Sent Events stream is working

**Steps:**
1. Open Browser DevTools → Network tab
2. Refresh the page
3. Look for a request to `/api/socket?sessionId=...`
4. Click on it → Headers tab

**Expected Results:**
- ✅ Status: 200 OK
- ✅ Type: `eventsource` or `text/event-stream`
- ✅ Connection stays open (doesn't complete)
- ✅ EventStream tab shows incoming messages

---

### ✅ Test 5: Redis State Management

**What to test:**
- Session data is stored in Redis
- State persists across requests

**Steps:**
```bash
# Check Redis keys
docker exec redis redis-cli KEYS "ss:*"

# View a session
docker exec redis redis-cli GET "ss:<sessionId>:state"

# Monitor Redis in real-time
docker exec redis redis-cli MONITOR
```

**Expected Results:**
- ✅ Keys like `ss:<sessionId>:state` exist
- ✅ Session data is stored as JSON
- ✅ Keys expire after TTL (default: 3600 seconds)

---

### ✅ Test 6: Reconnection Logic

**What to test:**
- Client reconnects when connection is lost

**Steps:**
1. Open browser with DevTools
2. Connect to the app
3. Stop the Next.js server (Ctrl+C)
4. Check browser console - should see reconnection attempts
5. Restart the server: `npm run dev`
6. Client should auto-reconnect

**Expected Results:**
- ✅ Console shows "Reconnecting... (attempt X)"
- ✅ Client reconnects when server comes back
- ✅ New welcome message appears

---

### ✅ Test 7: Disconnect Handling

**What to test:**
- Server cleans up when client disconnects

**Steps:**
1. Connect to the app
2. Note the sessionId from browser console
3. Close the browser tab
4. Check Redis: `docker exec redis redis-cli KEYS "ss:*"`

**Expected Results:**
- ✅ Session is removed from Redis (eventually)
- ✅ Server logs disconnect event
- ✅ No memory leaks

---

## 🐛 Common Issues & Solutions

### Issue: 404 errors on `/api/socket/connect`

**Solution:**
- Check that route file is at: `app/api/socket/[[...path]]/route.ts`
- NOT at: `app/api/socket/route.ts`

### Issue: "Cannot find module 'socket-serve'"

**Solution:**
```bash
cd /path/to/socket-serve
npm run build
cd examples/nextjs
rm -rf node_modules package-lock.json
npm install
```

### Issue: Redis connection failed

**Solution:**
```bash
# Check Redis is running
docker ps | grep redis

# Start Redis if not running
docker start redis

# Or create new Redis container
docker run -d -p 6379:6379 --name redis redis:latest

# Verify connection
docker exec redis redis-cli ping
# Should return: PONG
```

### Issue: Port already in use

**Solution:**
- Next.js will automatically use next available port (3001, 3002, etc.)
- Or kill the process using port 3000:
```bash
lsof -i :3000
kill -9 <PID>
```

---

## 📊 Performance Testing

### Test Message Throughput

```bash
# In browser console
for(let i = 0; i < 100; i++) {
  socket.emit('chat', { text: `Message ${i}` });
}
```

**Expected:**
- ✅ All messages processed
- ✅ No errors
- ✅ Redis handles the load

### Test Concurrent Connections

1. Open 10+ browser tabs
2. All should connect successfully
3. Send messages from different tabs
4. All tabs receive all messages

---

## 🧪 Automated Testing (Coming Soon)

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

---

## 📝 Test Checklist

Before considering socket-serve production-ready:

- [ ] Basic connection works
- [ ] Messages send/receive correctly
- [ ] Broadcasting works across clients
- [ ] SSE connection stable
- [ ] Redis stores session data
- [ ] Reconnection logic works
- [ ] Cleanup on disconnect
- [ ] Multiple concurrent clients
- [ ] Performance acceptable
- [ ] No memory leaks
- [ ] Error handling robust

---

## 🎯 Next Steps

1. Write automated tests (Jest + Testing Library)
2. Add error handling edge cases
3. Test with production Redis (Upstash)
4. Load testing with many concurrent users
5. Deploy to Vercel and test serverless behavior

---

## 💡 Tips

- **Browser DevTools** is your friend - use Console, Network, and Application tabs
- **Redis CLI** shows what's happening in state management
- **Server logs** show backend processing
- **Multiple tabs** test real-time broadcasting
- **Kill/restart** tests reconnection logic

Happy testing! 🚀
