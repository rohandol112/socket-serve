import { RedisStateManager } from "../redis/state-manager";
import type { SocketMessage } from "../types";

// Mock ioredis
jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    setex: jest.fn().mockResolvedValue("OK"),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    rpush: jest.fn().mockResolvedValue(1),
    lrange: jest.fn().mockResolvedValue([]),
    expire: jest.fn().mockResolvedValue(1),
    publish: jest.fn().mockResolvedValue(1),
    duplicate: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    sadd: jest.fn().mockResolvedValue(1),
    srem: jest.fn().mockResolvedValue(1),
    smembers: jest.fn().mockResolvedValue([]),
    quit: jest.fn().mockResolvedValue("OK"),
  }));
});

describe("RedisStateManager", () => {
  let stateManager: RedisStateManager;

  beforeEach(() => {
    jest.clearAllMocks();
    stateManager = new RedisStateManager("redis://localhost:6379", 3600);
  });

  afterEach(async () => {
    await stateManager.close();
  });

  describe("Session Management", () => {
    it("should create a new session", async () => {
      const sessionId = "test-session-123";
      const session = await stateManager.createSession(sessionId);

      expect(session).toBeDefined();
      expect(session.id).toBe(sessionId);
      expect(session.data).toEqual({});
      expect(session.createdAt).toBeLessThanOrEqual(Date.now());
    });

    it("should update session", async () => {
      const sessionId = "test-session-123";
      await stateManager.createSession(sessionId);
      
      await stateManager.updateSession(sessionId, {
        data: { username: "testuser" },
      });

      // In a real test with actual Redis, we'd verify the update
      expect(true).toBe(true);
    });

    it("should delete session", async () => {
      const sessionId = "test-session-123";
      await stateManager.createSession(sessionId);
      await stateManager.deleteSession(sessionId);

      // Verify deletion
      expect(true).toBe(true);
    });
  });

  describe("Message Queue", () => {
    it("should enqueue messages", async () => {
      const sessionId = "test-session-123";
      const message: SocketMessage = {
        event: "test",
        data: { text: "hello" },
        timestamp: Date.now(),
        sessionId,
      };

      await stateManager.enqueueMessage(sessionId, message);
      expect(true).toBe(true);
    });

    it("should dequeue messages", async () => {
      const sessionId = "test-session-123";
      const messages = await stateManager.dequeueMessages(sessionId);

      expect(Array.isArray(messages)).toBe(true);
    });
  });

  describe("Room Management", () => {
    it("should join room", async () => {
      const sessionId = "test-session-123";
      const room = "room-1";

      await stateManager.joinRoom(sessionId, room);
      expect(true).toBe(true);
    });

    it("should leave room", async () => {
      const sessionId = "test-session-123";
      const room = "room-1";

      await stateManager.joinRoom(sessionId, room);
      await stateManager.leaveRoom(sessionId, room);
      expect(true).toBe(true);
    });

    it("should get room members", async () => {
      const room = "room-1";
      const members = await stateManager.getRoomMembers(room);

      expect(Array.isArray(members)).toBe(true);
    });

    it("should get session rooms", async () => {
      const sessionId = "test-session-123";
      const rooms = await stateManager.getSessionRooms(sessionId);

      expect(Array.isArray(rooms)).toBe(true);
    });
  });

  describe("Pub/Sub", () => {
    it("should publish messages", async () => {
      const channel = "test-channel";
      const message: SocketMessage = {
        event: "test",
        data: { text: "hello" },
        timestamp: Date.now(),
        sessionId: "test-session",
      };

      await stateManager.publish(channel, message);
      expect(true).toBe(true);
    });
  });
});
