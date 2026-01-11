# Socket-Serve Chat App

A simple real-time chat application built with Next.js and socket-serve. Perfect for testing socket-serve functionality on Vercel.

## Features

- ✅ Real-time messaging between multiple users
- ✅ Username support
- ✅ Typing indicators
- ✅ User join notifications
- ✅ Responsive design
- ✅ Works on Vercel serverless

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Redis

Get a free Redis instance from [Upstash](https://upstash.com):

1. Go to https://upstash.com
2. Create a free account
3. Create a new Redis database
4. Copy the connection URL

### 3. Configure Environment

Create `.env.local`:

```bash
REDIS_URL=rediss://default:your_password@your-redis.upstash.io:6379
```

### 4. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000 in multiple browser tabs to test the chat.

## Deploy to Vercel

### Option 1: Deploy with Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Add environment variable when prompted:
# REDIS_URL=rediss://...
```

### Option 2: Deploy via GitHub

1. Push this code to a GitHub repository
2. Go to https://vercel.com
3. Import your repository
4. Add environment variable:
   - Key: `REDIS_URL`
   - Value: Your Upstash Redis URL
5. Click "Deploy"

## Testing

1. Deploy to Vercel
2. Open your Vercel URL in multiple browser tabs
3. Set different usernames in each tab
4. Start chatting between tabs
5. Test typing indicators
6. Test real-time message delivery

## How It Works

- **Client**: Uses `socket-serve/client` for real-time connection
- **Server**: Next.js API route with socket-serve server
- **State**: Redis for distributed state management
- **Transport**: SSE (Server-Sent Events) for server→client
- **Messages**: HTTP POST for client→server

## Architecture

```
Browser Tabs ←→ Next.js API Route ←→ Redis
    (SSE)         (socket-serve)      (State)
```

Each user connects to the serverless function via SSE, and Redis synchronizes state across all serverless instances.

## Troubleshooting

### Connection Issues

- Verify `REDIS_URL` is set correctly
- Check Redis connection from Upstash dashboard
- Look at browser console for errors
- Check Vercel function logs

### Messages Not Syncing

- Ensure Redis is running
- Check that multiple tabs are using the same Redis instance
- Verify no firewall blocking Redis connection

### Vercel Deployment Issues

- Ensure `REDIS_URL` environment variable is set in Vercel dashboard
- Check function logs in Vercel dashboard
- Verify no build errors

## License

MIT
