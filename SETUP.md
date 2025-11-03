# Development Setup

## Prerequisites

- Node.js 18+ 
- Redis (local or remote)
- npm or yarn

## Local Redis Setup

### macOS (using Homebrew)

```bash
# Install Redis
brew install redis

# Start Redis server
brew services start redis

# Or run Redis in foreground
redis-server

# Test connection
redis-cli ping
# Should respond with "PONG"
```

### Linux (Ubuntu/Debian)

```bash
# Install Redis
sudo apt update
sudo apt install redis-server

# Start Redis
sudo systemctl start redis-server

# Enable on boot
sudo systemctl enable redis-server

# Test connection
redis-cli ping
```

### Docker (All platforms)

```bash
# Run Redis in Docker
docker run -d -p 6379:6379 --name redis redis:latest

# Or with persistence
docker run -d -p 6379:6379 -v redis-data:/data --name redis redis:latest

# Test connection
docker exec -it redis redis-cli ping
```

## Project Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/rohandol112/socket-serve.git
   cd socket-serve
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

## Running the Example

1. **Navigate to the example:**
   ```bash
   cd examples/nextjs
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env.local
   ```

4. **Edit `.env.local`:**
   ```env
   REDIS_URL=redis://localhost:6379
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Open browser:**
   Navigate to http://localhost:3000

## Redis Configuration

### Default Local URL
```
redis://localhost:6379
```

### With Password
```
redis://:password@localhost:6379
```

### Remote Redis (Upstash, Redis Cloud, etc.)
```
redis://username:password@host:port
```

### Redis URL Format
```
redis://[username][:password]@host[:port][/database]
```

## Troubleshooting

### Redis Connection Issues

**Check if Redis is running:**
```bash
redis-cli ping
```

**Check Redis logs (macOS):**
```bash
tail -f /usr/local/var/log/redis.log
```

**Check Redis logs (Linux):**
```bash
sudo journalctl -u redis-server -f
```

**Check Redis logs (Docker):**
```bash
docker logs redis -f
```

### Port Already in Use

If port 6379 is already in use:

```bash
# Find process using port 6379
lsof -i :6379

# Kill the process
kill -9 <PID>

# Or run Redis on different port
redis-server --port 6380
```

Then update your `.env.local`:
```env
REDIS_URL=redis://localhost:6380
```

## Development Workflow

1. Make changes in `src/`
2. Run build: `npm run build`
3. Run tests: `npm test`
4. Test in example: `cd examples/nextjs && npm run dev`
5. Commit changes: `git commit -m "feat: your changes"`

## Using Remote Redis

For production or if you prefer not to run Redis locally:

### Upstash (Free tier available)
1. Sign up at https://upstash.com
2. Create a Redis database
3. Copy the Redis URL
4. Update `.env.local`

### Redis Cloud
1. Sign up at https://redis.com/try-free
2. Create a database
3. Copy connection string
4. Update `.env.local`

## Next Steps

- Read the [Contributing Guide](CONTRIBUTING.md)
- Check out the [Examples](examples/)
- Read the [Main README](README.md)

## Need Help?

- Open an [issue](https://github.com/rohandol112/socket-serve/issues)
- Check existing [discussions](https://github.com/rohandol112/socket-serve/discussions)
