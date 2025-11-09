# Testing Guide

This document describes the testing performed on socket-serve and how to run tests locally.

## ✅ Tested Components

### Core Functionality
- [x] **Session Management**
  - Session creation with unique IDs
  - Session retrieval from Redis
  - Session updates and TTL refresh
  - Session deletion on disconnect

- [x] **Redis Integration**
  - Connection establishment
  - State persistence (set/get)
  - Pub/sub messaging
  - Key expiration (TTL)
  - Queue operations (enqueue/dequeue)

- [x] **Event System**
  - `onConnect` handler execution
  - `onMessage` handler with custom events
  - `onDisconnect` handler cleanup
  - Event data serialization/deserialization

- [x] **Broadcasting**
  - Message publishing to Redis channels
  - Multiple client subscriptions
  - Real-time message delivery

- [x] **Client SDK**
  - Connection establishment
  - Event emission
  - Event listening
  - Auto-reconnection with exponential backoff
  - Graceful disconnection

## 🧪 Test Environment

### Requirements
- Node.js v18+ or v20+
- Redis 8.2.3+ (local or cloud)
- TypeScript 5.3+

### Setup

1. **Install Redis**
   ```bash
   # macOS
   brew install redis
   brew services start redis
   
   # Or Docker
   docker run -d -p 6379:6379 --name redis redis:latest
   ```

2. **Verify Redis**
   ```bash
   redis-cli ping
   # Expected output: PONG
   ```

3. **Install Dependencies**
   ```bash
   npm install
   npm run build
   ```

## 🔬 Running Tests

### Basic Functionality Test

```bash
# Run the basic test suite
npx tsx test-basic.ts
```

**Expected Output:**
```
Testing socket-serve basic functionality...
✅ Adapter created successfully
✅ Session created: <session-id>
✅ Message handler called with data: { message: 'Hello world!' }
✅ Message handled successfully
✅ Session retrieved: true
✅ Session disconnected
🎉 All basic tests passed!
✅ Connect handler called with socket ID: <session-id>
```

### Express Example Test

```bash
cd examples/express
npm install
npm run dev
```

Then open http://localhost:3000 in multiple browser tabs and:
1. Send messages from one tab
2. Verify they appear in other tabs in real-time
3. Test the typing indicator
4. Close and reopen tabs to test reconnection

### Manual Redis Verification

```bash
# Check active sessions
redis-cli KEYS "ss:*"

# View session data
redis-cli GET "ss:<session-id>:state"

# Monitor pub/sub activity
redis-cli MONITOR
```

## 📊 Test Results

### Session Management
- ✅ Sessions created with 32-character hex IDs
- ✅ State persisted to Redis with TTL
- ✅ Sessions retrievable across requests
- ✅ Cleanup on disconnect working

### Redis Operations
- ✅ All CRUD operations functional
- ✅ Pub/sub channels working correctly
- ✅ TTL expiration working as expected
- ✅ Queue operations (RPUSH/LRANGE) working

### Real-time Communication
- ✅ SSE connections established successfully
- ✅ Messages delivered in real-time
- ✅ Multiple clients can connect simultaneously
- ✅ Broadcasting to all clients works

### Client Behavior
- ✅ Auto-reconnect after connection loss
- ✅ Exponential backoff implemented (1s, 2s, 4s, 8s, 10s max)
- ✅ Event handlers persist across reconnections
- ✅ Graceful disconnect cleanup

## 🐛 Known Issues

None currently identified in core functionality.

## 🔜 Future Testing

- [ ] Load testing with 100+ concurrent clients
- [ ] Network failure scenarios
- [ ] Redis failover testing
- [ ] Memory leak detection
- [ ] Performance benchmarks
- [ ] Cross-browser compatibility
- [ ] Serverless deployment testing (Vercel, Netlify)

## 📝 Test Coverage

| Component | Coverage | Status |
|-----------|----------|--------|
| Session Management | Manual | ✅ Tested |
| Redis State Manager | Manual | ✅ Tested |
| Express Adapter | Manual | ✅ Tested |
| Next.js Adapter | Not tested | ⏳ Pending |
| Client SDK | Manual | ✅ Tested |
| SSE Transport | Manual | ✅ Tested |
| Broadcasting | Manual | ✅ Tested |
| Reconnection | Manual | ✅ Tested |

## 🤝 Contributing Tests

To add new tests:

1. Create test files in the root or `tests/` directory
2. Use TypeScript with `tsx` for execution
3. Test against a local Redis instance
4. Document expected behavior
5. Update this file with results

## 📚 Resources

- [Redis Commands Reference](https://redis.io/commands)
- [Server-Sent Events Spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [ioredis Documentation](https://github.com/redis/ioredis)

---

Last Updated: November 9, 2025
Test Environment: macOS 23.5.0, Node.js v24.11.0, Redis 8.2.3

