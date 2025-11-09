# 🚢 Deployment Guide

Complete guide for deploying socket-serve to various platforms.

## 🎯 Vercel Deployment (Recommended)

### Why Vercel?

- ✅ **Native SSE Support** - No WebSocket needed
- ✅ **Auto-scaling** - Handles traffic spikes automatically
- ✅ **Global CDN** - Low latency worldwide
- ✅ **Zero Config** - Deploy with one command
- ✅ **Free Tier** - Perfect for getting started

### Prerequisites

1. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
2. **Upstash Redis** - Free account at [upstash.com](https://upstash.com)
3. **Node.js 18+** - Install from [nodejs.org](https://nodejs.org)

### Step-by-Step Deployment

#### 1. Create Your Next.js Project

```bash
npx create-next-app@latest my-realtime-app
cd my-realtime-app
npm install socket-serve ioredis
```

When prompted:
- ✅ TypeScript: Yes
- ✅ ESLint: Yes
- ✅ Tailwind CSS: Yes (optional)
- ✅ App Router: Yes
- ✅ Import alias: No

#### 2. Create Socket API Route

Create `app/api/socket/[[...path]]/route.ts`:

```typescript
import { serve } from 'socket-serve';

const adapter = serve({
  adapter: 'nextjs',
  redisUrl: process.env.REDIS_URL!,
  ttl: 3600,
});

adapter.onConnect((socket) => {
  console.log('✅ Client connected:', socket.id);
  socket.emit('welcome', { 
    message: 'Welcome to serverless sockets!',
    timestamp: Date.now() 
  });
});

adapter.onMessage('chat', async (socket, data: any) => {
  console.log('💬 Message:', data);
  await socket.broadcast('chat', {
    ...data,
    from: socket.id,
    timestamp: Date.now(),
  });
});

adapter.onDisconnect((socket) => {
  console.log('❌ Client disconnected:', socket.id);
});

export const GET = adapter.handlers.GET;
export const POST = adapter.handlers.POST;
```

#### 3. Create Client Component

Create `app/components/Chat.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { connect } from 'socket-serve/client';

export default function Chat() {
  const [socket, setSocket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = connect('/api/socket');

    s.on('welcome', (data: any) => {
      console.log('Connected:', data);
      setConnected(true);
      setMessages(prev => [...prev, { 
        type: 'system', 
        text: data.message 
      }]);
    });

    s.on('chat', (data: any) => {
      setMessages(prev => [...prev, { 
        type: 'other', 
        ...data 
      }]);
    });

    setSocket(s);

    return () => s.disconnect();
  }, []);

  const send = () => {
    if (!input.trim() || !socket) return;
    
    socket.emit('chat', { text: input });
    setMessages(prev => [...prev, { 
      type: 'self', 
      text: input,
      timestamp: Date.now() 
    }]);
    setInput('');
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Real-time Chat</h2>
        <span className={`px-3 py-1 rounded-full text-sm ${
          connected 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {connected ? '🟢 Connected' : '🔴 Disconnected'}
        </span>
      </div>

      <div className="border rounded-lg p-4 h-96 overflow-y-auto mb-4 bg-gray-50 space-y-2">
        {messages.map((msg, i) => (
          <div 
            key={i} 
            className={`p-3 rounded-lg ${
              msg.type === 'system' 
                ? 'bg-blue-100 text-blue-800 text-center text-sm'
                : msg.type === 'self'
                ? 'bg-blue-500 text-white ml-auto max-w-xs'
                : 'bg-white max-w-xs'
            }`}
          >
            {msg.type !== 'system' && (
              <div className="text-xs opacity-70 mb-1">
                {msg.type === 'self' ? 'You' : msg.from?.slice(0, 8)}
              </div>
            )}
            <div>{msg.text}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && send()}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={!connected}
        />
        <button
          onClick={send}
          disabled={!connected}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Send
        </button>
      </div>
    </div>
  );
}
```

#### 4. Update Home Page

Update `app/page.tsx`:

```typescript
import Chat from './components/Chat';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
      <div className="container mx-auto">
        <h1 className="text-5xl font-bold text-center mb-4">
          ⚡ socket-serve
        </h1>
        <p className="text-center text-gray-600 mb-12">
          Real-time sockets on Vercel serverless
        </p>
        <Chat />
      </div>
    </main>
  );
}
```

#### 5. Set Up Upstash Redis

1. Go to [console.upstash.com](https://console.upstash.com)
2. Click "Create Database"
3. Choose:
   - Name: `socket-serve-prod`
   - Type: Regional (or Global for multi-region)
   - Region: Choose closest to your users
4. Click "Create"
5. Copy the `UPSTASH_REDIS_REST_URL` → This is your `REDIS_URL`

#### 6. Deploy to Vercel

**Option A: Using Vercel CLI (Fastest)**

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Add environment variable
vercel env add REDIS_URL production
# Paste your Upstash Redis URL

# Deploy to production
vercel --prod
```

**Option B: Using GitHub + Vercel Dashboard**

```bash
# Initialize git
git init
git add .
git commit -m "Initial commit"

# Push to GitHub
gh repo create my-realtime-app --public --source=. --remote=origin --push
# Or manually create repo and push
```

Then:
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure:
   - Framework Preset: Next.js
   - Root Directory: ./
   - Build Command: (leave default)
   - Output Directory: (leave default)
4. Add Environment Variable:
   - Key: `REDIS_URL`
   - Value: Your Upstash Redis URL
   - Environments: Production, Preview, Development
5. Click "Deploy"

#### 7. Test Your Deployment

1. Wait for deployment to complete (~2 minutes)
2. Click the deployment URL
3. Open the same URL in another browser/tab
4. Send messages and watch them appear in real-time! 🎉

### Vercel Environment Variables

Add these in your Vercel project settings:

| Variable | Value | Required |
|----------|-------|----------|
| `REDIS_URL` | `rediss://default:xxxxx@xxxxx.upstash.io:6379` | ✅ Yes |
| `NEXT_PUBLIC_API_URL` | Your Vercel URL (optional) | ❌ No |

### Vercel Configuration

Create `vercel.json` (optional):

```json
{
  "functions": {
    "app/api/socket/[[...path]]/route.ts": {
      "maxDuration": 300
    }
  }
}
```

This extends SSE connection timeout to 5 minutes (max on Hobby plan).

### Monitoring on Vercel

1. **Function Logs**: Vercel Dashboard → Your Project → Logs
2. **Analytics**: Vercel Dashboard → Analytics
3. **Redis Metrics**: Upstash Console → Your Database → Metrics

### Troubleshooting

**Build Fails**
```bash
# Check Node.js version
node --version  # Should be 18+

# Clear cache and rebuild
vercel --force
```

**Redis Connection Error**
```bash
# Test Redis URL locally
node -e "const Redis = require('ioredis'); const r = new Redis(process.env.REDIS_URL); r.ping().then(() => console.log('✅ Connected')).catch(e => console.error('❌', e));"
```

**SSE Not Working**
- Check browser console for errors
- Verify API route path: `app/api/socket/[[...path]]/route.ts`
- Ensure both GET and POST handlers are exported

---

## 🌐 Other Platforms

### Netlify

Similar to Vercel, but requires configuration:

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[functions]
  node_bundler = "esbuild"
```

Deploy:
```bash
netlify deploy --prod
```

### Railway

Railway supports long-running processes:

```bash
# Use Express adapter
railway up
```

### Cloudflare Workers

Coming soon! Track progress: [Issue #XX](https://github.com/rohandol112/socket-serve/issues)

---

## 💰 Cost Estimation

### Free Tier (Perfect for Testing)

- **Vercel Hobby**: Free forever
- **Upstash**: 10,000 commands/day free
- **Total**: $0/month for ~100 daily active users

### Production Scale

| Users | Vercel | Upstash | Total/Month |
|-------|--------|---------|-------------|
| 100 | Free | Free | $0 |
| 1,000 | Free | ~$5 | ~$5 |
| 10,000 | ~$20 | ~$50 | ~$70 |
| 100,000 | ~$200 | ~$500 | ~$700 |

*Estimates based on average usage patterns*

---

## 🚀 Performance Optimization

### 1. Enable Edge Runtime

Add to your route:
```typescript
export const runtime = 'edge';
```

### 2. Optimize Redis Commands

```typescript
// ❌ Bad: Multiple round trips
await redis.get('key1');
await redis.get('key2');

// ✅ Good: Pipeline
const pipeline = redis.pipeline();
pipeline.get('key1');
pipeline.get('key2');
await pipeline.exec();
```

### 3. Use Connection Pooling

ioredis handles this automatically, but you can tune:

```typescript
const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  lazyConnect: true,
});
```

### 4. Monitor Performance

- Vercel Analytics: Response times, error rates
- Upstash Metrics: Commands/sec, latency
- Browser DevTools: Network tab for SSE

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Upstash Documentation](https://docs.upstash.com)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Server-Sent Events Spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)

---

**Need help?** Open an issue on [GitHub](https://github.com/rohandol112/socket-serve/issues)

