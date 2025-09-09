// tests/unit/chatroom.test.js
const { chatroomService } = require('../../src/services/chatroom');

describe('Chatroom Service Unit Tests', () => {
  beforeEach(() => {
    // Reset any mocks or state
    jest.clearAllMocks();
    chatroomService.rooms.clear();
  });

  describe('Room Management', () => {
    test('Should create room successfully', () => {
      const roomId = 'test_room';
      const result = chatroomService.createRoom(roomId);

      expect(result.success).toBe(true);
      expect(chatroomService.rooms.has(roomId)).toBe(true);
    });

    test('Should not create duplicate rooms', () => {
      const roomId = 'test_room';
      chatroomService.createRoom(roomId);
      const result = chatroomService.createRoom(roomId);

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
    });

    test('Should get room details', () => {
      const roomId = 'test_room';
      chatroomService.createRoom(roomId);
      
      const room = chatroomService.getRoom(roomId);
      expect(room).toHaveProperty('id', roomId);
      expect(room).toHaveProperty('users');
      expect(room).toHaveProperty('messages');
      expect(room).toHaveProperty('created_at');
    });

    test('Should list all rooms', () => {
      chatroomService.createRoom('room1');
      chatroomService.createRoom('room2');
      
      const rooms = chatroomService.getAllRooms();
      expect(rooms.length).toBe(2);
      expect(rooms.map(r => r.id)).toContain('room1');
      expect(rooms.map(r => r.id)).toContain('room2');
    });
  });

  describe('User Management', () => {
    beforeEach(() => {
      chatroomService.createRoom('test_room');
    });

    test('Should add user to room', () => {
      const result = chatroomService.addUserToRoom('test_room', 'user1', 'TestUser');
      
      expect(result.success).toBe(true);
      const room = chatroomService.getRoom('test_room');
      expect(room.users.has('user1')).toBe(true);
    });

    test('Should remove user from room', () => {
      chatroomService.addUserToRoom('test_room', 'user1', 'TestUser');
      const result = chatroomService.removeUserFromRoom('test_room', 'user1');
      
      expect(result.success).toBe(true);
      const room = chatroomService.getRoom('test_room');
      expect(room.users.has('user1')).toBe(false);
    });

    test('Should get user count in room', () => {
      chatroomService.addUserToRoom('test_room', 'user1', 'TestUser1');
      chatroomService.addUserToRoom('test_room', 'user2', 'TestUser2');
      
      const count = chatroomService.getUserCount('test_room');
      expect(count).toBe(2);
    });
  });

  describe('Message Management', () => {
    beforeEach(() => {
      chatroomService.createRoom('test_room');
      chatroomService.addUserToRoom('test_room', 'user1', 'TestUser');
    });

    test('Should add message to room', () => {
      const message = {
        userId: 'user1',
        username: 'TestUser',
        message: 'Hello World',
        timestamp: new Date()
      };

      const result = chatroomService.addMessage('test_room', message);
      expect(result.success).toBe(true);
      
      const room = chatroomService.getRoom('test_room');
      expect(room.messages.length).toBe(1);
      expect(room.messages[0].message).toBe('Hello World');
    });

    test('Should get message history', () => {
      const messages = [
        { userId: 'user1', username: 'TestUser', message: 'Message 1', timestamp: new Date() },
        { userId: 'user1', username: 'TestUser', message: 'Message 2', timestamp: new Date() }
      ];

      messages.forEach(msg => chatroomService.addMessage('test_room', msg));
      
      const history = chatroomService.getMessageHistory('test_room', 10);
      expect(history.length).toBe(2);
    });

    test('Should limit message history', () => {
      // Add more messages than the limit
      for (let i = 0; i < 15; i++) {
        chatroomService.addMessage('test_room', {
          userId: 'user1',
          username: 'TestUser',
          message: `Message ${i}`,
          timestamp: new Date()
        });
      }
      
      const history = chatroomService.getMessageHistory('test_room', 10);
      expect(history.length).toBe(10);
    });
  });

  describe('Cleanup Operations', () => {
    test('Should cleanup empty rooms', () => {
      chatroomService.createRoom('empty_room');
      chatroomService.createRoom('active_room');
      chatroomService.addUserToRoom('active_room', 'user1', 'TestUser');
      
      const cleaned = chatroomService.cleanupEmptyRooms();
      expect(cleaned).toBe(1);
      expect(chatroomService.rooms.has('empty_room')).toBe(false);
      expect(chatroomService.rooms.has('active_room')).toBe(true);
    });

    test('Should cleanup old messages', () => {
      chatroomService.createRoom('test_room');
      
      // Add old message
      const oldMessage = {
        userId: 'user1',
        username: 'TestUser',
        message: 'Old message',
        timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      };
      
      chatroomService.addMessage('test_room', oldMessage);
      
      const cleaned = chatroomService.cleanupOldMessages(24); // 24 hour limit
      expect(cleaned).toBe(1);
      
      const room = chatroomService.getRoom('test_room');
      expect(room.messages.length).toBe(0);
    });
  });
});
