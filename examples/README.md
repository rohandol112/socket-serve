# socket-serve Examples

This directory contains example implementations of socket-serve with different frameworks and use cases.

## Available Examples

### Next.js App Router (`/nextjs`)

A complete chat application using socket-serve with Next.js 14 App Router.

**Features:**
- Server-side socket handling with API routes
- Client-side React integration
- Real-time messaging with SSE
- Redis state management

**Run the example:**

```bash
# 1. Start Redis locally (choose one method)
brew install redis && brew services start redis  # macOS
docker run -d -p 6379:6379 redis:latest         # Docker

# 2. Set up the example
cd nextjs
npm install
cp .env.example .env.local
# Edit .env.local and set: REDIS_URL=redis://localhost:6379

# 3. Run the dev server
npm run dev
```

Then open http://localhost:3000

**Requirements:**
- Redis instance (local or Upstash)
- Set `REDIS_URL` in `.env.local`

> 💡 See [../SETUP.md](../SETUP.md) for detailed Redis setup instructions

---

## Creating Your Own Example

1. Create a new directory in `examples/`
2. Add a README with setup instructions
3. Include a `.env.example` file
4. Document any special requirements

## Need Help?

Check the [main README](../README.md) or open an issue.
