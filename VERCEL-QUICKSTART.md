# ⚡ Vercel Quick Start

Deploy socket-serve to Vercel in 5 minutes!

## 🚀 One-Command Deploy

```bash
# 1. Create Next.js app
npx create-next-app@latest my-chat --typescript --app --yes
cd my-chat

# 2. Install socket-serve
npm install socket-serve ioredis

# 3. Create API route
mkdir -p app/api/socket/[[...path]]
cat > app/api/socket/[[...path]]/route.ts << 'EOF'
import { serve } from 'socket-serve';

const adapter = serve({
  adapter: 'nextjs',
  redisUrl: process.env.REDIS_URL!,
});

adapter.onConnect((socket) => {
  socket.emit('welcome', { message: 'Connected!' });
});

adapter.onMessage('chat', async (socket, data: any) => {
  await socket.broadcast('chat', data);
});

export const GET = adapter.handlers.GET;
export const POST = adapter.handlers.POST;
EOF

# 4. Deploy to Vercel
npx vercel --prod
```

When prompted for `REDIS_URL`:
1. Go to [console.upstash.com](https://console.upstash.com)
2. Create a database (free)
3. Copy the Redis URL
4. Paste it when Vercel asks

**Done!** 🎉 Your real-time app is live on Vercel.

---

## 📝 What You Get

- ✅ Real-time WebSocket-like functionality
- ✅ Auto-scaling serverless deployment
- ✅ Global CDN with low latency
- ✅ Free tier for development
- ✅ SSL/HTTPS by default

---

## 🧪 Test It

Open your Vercel URL in two browser tabs:

```javascript
// In browser console
const socket = connect('/api/socket');
socket.on('welcome', console.log);
socket.emit('chat', { text: 'Hello!' });
```

Messages sent from one tab appear in the other instantly!

---

## 📚 Full Documentation

- [Complete Deployment Guide](./DEPLOYMENT.md)
- [Main README](./README.md)
- [API Reference](./README.md#-api-reference)

---

## 💡 Next Steps

1. **Add a UI**: Create a React component with the client SDK
2. **Customize events**: Add more message handlers
3. **Add rooms**: Implement room-based broadcasting
4. **Monitor**: Check Vercel logs and Upstash metrics

---

## 🆘 Troubleshooting

**"Cannot connect to Redis"**
- Verify `REDIS_URL` is set in Vercel environment variables
- Ensure URL starts with `rediss://` (with SSL)

**"SSE connection fails"**
- Check API route path: `app/api/socket/[[...path]]/route.ts`
- Verify both GET and POST are exported

**Need help?** [Open an issue](https://github.com/rohandol112/socket-serve/issues)

---

Made with ❤️ for the serverless community

