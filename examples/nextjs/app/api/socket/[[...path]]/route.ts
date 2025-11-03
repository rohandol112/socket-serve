import { serve } from 'socket-serve';

const adapter = serve({
  adapter: 'nextjs',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  ttl: 3600,
  transport: 'sse'
});

adapter.onConnect((socket) => {
  console.log('Client connected:', socket.id);
  socket.emit('welcome', { text: 'Connected to socket-serve!' });
});

adapter.onMessage('chat', (socket, data) => {
  console.log('Chat message:', data);
  socket.broadcast('chat', data);
});

export const GET = adapter.handlers.GET;
export const POST = adapter.handlers.POST;
