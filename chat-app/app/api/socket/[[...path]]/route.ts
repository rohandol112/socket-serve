import { SocketServer } from 'socket-serve/server';
import type { ServerSocket } from 'socket-serve';
import { NextRequest } from 'next/server';

// Initialize socket server with Redis
const server = new SocketServer({
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
});

// Handle new connections
server.onConnect((socket: ServerSocket) => {
  console.log('Client connected:', socket.id);
});

// Handle username setting
server.onMessage('set_username', async (socket: ServerSocket, data: any) => {
  console.log('User set username:', data.username);
  // Broadcast to others that someone joined
  await socket.broadcast('user_joined', { username: data.username });
});

// Handle incoming messages
server.onMessage('message', async (socket: ServerSocket, data: any) => {
  console.log('Message received:', data);
  // Broadcast message to all other clients
  await socket.broadcast('message', data);
});

// Handle typing indicator
server.onMessage('typing', async (socket: ServerSocket, data: any) => {
  // Broadcast typing status to others
  await socket.broadcast('typing', data);
});

// Handle disconnections
server.onDisconnect((socket: ServerSocket) => {
  console.log('Client disconnected:', socket.id);
});

// Export Next.js route handlers
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (pathname.endsWith('/connect')) {
    const result = await server.handleConnect();
    return Response.json(result);
  }

  if (pathname.includes('/message') || pathname.includes('/emit')) {
    const body = await request.json();
    const { sessionId, event, data } = body;
    await server.handleMessage(sessionId, event, data);
    return Response.json({ success: true });
  }

  if (pathname.endsWith('/disconnect')) {
    const body = await request.json();
    const { sessionId } = body;
    await server.handleDisconnect(sessionId);
    return Response.json({ success: true });
  }

  return new Response('Not found', { status: 404 });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    return new Response('Missing sessionId', { status: 400 });
  }

  // SSE endpoint - handles /sse and any other GET request with sessionId
  const stateManager = server.getStateManager();
  const encoder = new TextEncoder();
  
  // Polling endpoint check
  if (pathname.includes('/polling')) {
    const messages = await server.getMessages(sessionId);
    return Response.json({ messages });
  }

  // Default to SSE for all other GET requests
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const sendEvent = (data: any) => {
        if (closed) return;
        try {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (error) {
          console.error('Failed to send SSE message:', error);
        }
      };

      // Send initial connection event
      sendEvent({ event: 'connected', data: { sessionId } });

      // Subscribe to messages for this specific session
      const sessionChannel = `ss:channel:${sessionId}`;
      await stateManager.subscribe(sessionChannel, (message) => {
        sendEvent(message);
      });

      // Also subscribe to broadcast channel for all clients
      const broadcastChannel = `ss:channel:broadcast`;
      await stateManager.subscribe(broadcastChannel, (message) => {
        // Don't send messages back to sender
        if (message.sessionId !== sessionId) {
          sendEvent(message);
        }
      });

      // Send keepalive every 15 seconds
      const keepalive = setInterval(() => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'));
          } catch (error) {
            clearInterval(keepalive);
          }
        }
      }, 15000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(keepalive);
        try {
          controller.close();
        } catch (e) {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Disable body parsing for streaming
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
