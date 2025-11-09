# socket-serve - Workspace Instructions

This is a TypeScript library project that converts traditional WebSocket logic into serverless-compatible socket behavior.

## Project Setup Progress

- [x] Verify that the copilot-instructions.md file in the .github directory is created.
- [x] Clarify Project Requirements
- [x] Scaffold the Project
- [x] Customize the Project
- [x] Install Required Extensions
- [x] Compile the Project
- [x] Create and Run Task
- [x] Launch the Project
- [x] Ensure Documentation is Complete

## Project Type
TypeScript npm library with Next.js adapter examples

## Key Features
- Serverless WebSocket abstraction layer
- Redis-based state management
- SSE and polling transports
- Room-based broadcasting
- Message acknowledgments
- Automatic reconnection with exponential backoff
- Next.js and Express.js integration
- Client SDK for browsers

## Recently Implemented Features (v0.6)

### Room-Based Broadcasting
- `socket.join(room)` - Join a room
- `socket.leave(room)` - Leave a room
- `socket.getRooms()` - Get all joined rooms
- `socket.broadcastToRoom(room, event, data)` - Broadcast to specific room

### Polling Transport
- Fallback transport for SSE-incompatible environments
- Client option: `connect(url, { transport: 'polling' })`
- Server automatically supports both SSE and polling

### Message Acknowledgments
- Server: `socket.emit(event, data, ackCallback)`
- Client: `socket.emit(event, data, ackCallback)`
- 5-second timeout with error handling

### Reconnection Strategy
- Exponential backoff (2^attempt)
- Max 5 attempts
- Delays capped at 30 seconds
- Automatic reconnection on connection loss

### Testing
- Jest test suite with 27+ passing tests
- Tests for state management, server socket, and socket server
- Mock Redis for testing without external dependencies
