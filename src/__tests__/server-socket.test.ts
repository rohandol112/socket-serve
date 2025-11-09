import { ServerSocketImpl } from "../server/socket";
import { RedisStateManager } from "../redis/state-manager";
import type { SessionState } from "../types";

// Mock RedisStateManager
jest.mock("../redis/state-manager");

describe("ServerSocketImpl", () => {
  let socket: ServerSocketImpl;
  let mockStateManager: jest.Mocked<RedisStateManager>;
  let mockState: SessionState;

  beforeEach(() => {
    mockState = {
      id: "test-session-123",
      createdAt: Date.now(),
      lastActivity: Date.now(),
      data: {},
    };

    mockStateManager = {
      enqueueMessage: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockResolvedValue(undefined),
      joinRoom: jest.fn().mockResolvedValue(undefined),
      leaveRoom: jest.fn().mockResolvedValue(undefined),
      getRoomMembers: jest.fn().mockResolvedValue([]),
      getSessionRooms: jest.fn().mockResolvedValue([]),
      updateSession: jest.fn().mockResolvedValue(undefined),
    } as any;

    socket = new ServerSocketImpl("test-session-123", mockState, mockStateManager);
  });

  describe("emit", () => {
    it("should emit event to client", async () => {
      await socket.emit("test-event", { message: "hello" });

      expect(mockStateManager.enqueueMessage).toHaveBeenCalled();
      expect(mockStateManager.publish).toHaveBeenCalled();
    });

    it("should support acknowledgments", async () => {
      const ackCallback = jest.fn();
      await socket.emit("test-event", { message: "hello" }, ackCallback);

      expect(mockStateManager.enqueueMessage).toHaveBeenCalled();
    });
  });

  describe("broadcast", () => {
    it("should broadcast to all clients", async () => {
      await socket.broadcast("test-event", { message: "hello" });

      expect(mockStateManager.publish).toHaveBeenCalledWith(
        expect.stringContaining("broadcast"),
        expect.objectContaining({
          event: "test-event",
          data: { message: "hello" },
        })
      );
    });
  });

  describe("room operations", () => {
    it("should join a room", async () => {
      await socket.join("room-1");

      expect(mockStateManager.joinRoom).toHaveBeenCalledWith("test-session-123", "room-1");
    });

    it("should leave a room", async () => {
      await socket.leave("room-1");

      expect(mockStateManager.leaveRoom).toHaveBeenCalledWith("test-session-123", "room-1");
    });

    it("should get rooms", async () => {
      mockStateManager.getSessionRooms.mockResolvedValue(["room-1", "room-2"]);

      const rooms = await socket.getRooms();

      expect(rooms).toEqual(["room-1", "room-2"]);
      expect(mockStateManager.getSessionRooms).toHaveBeenCalledWith("test-session-123");
    });

    it("should broadcast to room", async () => {
      mockStateManager.getRoomMembers.mockResolvedValue([
        "session-1",
        "session-2",
        "test-session-123",
      ]);

      await socket.broadcastToRoom("room-1", "test-event", { message: "hello" });

      // Should publish to all members except self
      expect(mockStateManager.publish).toHaveBeenCalledTimes(2);
    });
  });

  describe("state management", () => {
    it("should get state value", () => {
      socket.set("username", "testuser");
      const username = socket.get<string>("username");

      expect(username).toBe("testuser");
    });

    it("should set state value", () => {
      socket.set("counter", 42);
      const counter = socket.get<number>("counter");

      expect(counter).toBe(42);
    });

    it("should return undefined for non-existent keys", () => {
      const value = socket.get<string>("nonexistent");

      expect(value).toBeUndefined();
    });
  });
});
