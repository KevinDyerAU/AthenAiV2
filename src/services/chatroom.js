// src/services/chatroom.js
const { logger } = require('../utils/logger');
const { databaseService } = require('./database');

class ChatroomService {
  constructor() {
    this.rooms = new Map(); // roomId -> { users: Set, metadata: {} }
    this.userSockets = new Map(); // userId -> socketId
    this.socketUsers = new Map(); // socketId -> userId
  }

  // Room management
  createRoom(roomId, metadata = {}) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        users: new Set(),
        metadata: {
          created: new Date().toISOString(),
          ...metadata
        },
        messageHistory: []
      });
      logger.info('Room created', { roomId, metadata });
    }
    return this.rooms.get(roomId);
  }

  joinRoom(roomId, userId, socketId) {
    const room = this.createRoom(roomId);
    room.users.add(userId);
    
    this.userSockets.set(userId, socketId);
    this.socketUsers.set(socketId, userId);
    
    logger.info('User joined room', { roomId, userId, socketId });
    return room;
  }

  leaveRoom(roomId, userId, socketId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.users.delete(userId);
      if (room.users.size === 0) {
        // Optionally keep room for history or delete it
        // this.rooms.delete(roomId);
      }
    }
    
    this.userSockets.delete(userId);
    this.socketUsers.delete(socketId);
    
    logger.info('User left room', { roomId, userId, socketId });
  }

  getRoomUsers(roomId) {
    const room = this.rooms.get(roomId);
    return room ? Array.from(room.users) : [];
  }

  getUserRooms(userId) {
    const rooms = [];
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.users.has(userId)) {
        rooms.push({
          roomId,
          userCount: room.users.size,
          metadata: room.metadata
        });
      }
    }
    return rooms;
  }

  // Message handling
  async addMessage(roomId, userId, message, messageType = 'user') {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const messageData = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      roomId,
      userId,
      message,
      messageType, // 'user', 'agent', 'system'
      timestamp: new Date().toISOString()
    };

    // Add to room history (keep last 100 messages in memory)
    room.messageHistory.push(messageData);
    if (room.messageHistory.length > 100) {
      room.messageHistory.shift();
    }

    // Store in database if available
    try {
      await databaseService.createConversation(
        roomId,
        userId,
        message,
        null, // response will be added later
        messageType,
        { messageId: messageData.id, roomId }
      );
    } catch (error) {
      logger.warn('Failed to store message in database', { error: error.message });
    }

    logger.info('Message added to room', { roomId, userId, messageType });
    return messageData;
  }

  getMessageHistory(roomId, limit = 50) {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    
    return room.messageHistory.slice(-limit);
  }

  // Agent response handling
  async addAgentResponse(roomId, originalMessageId, response, agentType = 'research') {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const responseData = {
      id: `resp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      roomId,
      userId: 'system',
      message: response,
      messageType: 'agent',
      agentType,
      originalMessageId,
      timestamp: new Date().toISOString()
    };

    room.messageHistory.push(responseData);
    if (room.messageHistory.length > 100) {
      room.messageHistory.shift();
    }

    logger.info('Agent response added to room', { roomId, agentType, originalMessageId });
    return responseData;
  }

  // Utility methods
  getSocketUser(socketId) {
    return this.socketUsers.get(socketId);
  }

  getUserSocket(userId) {
    return this.userSockets.get(userId);
  }

  getAllRooms() {
    const roomList = [];
    for (const [roomId, room] of this.rooms.entries()) {
      roomList.push({
        roomId,
        userCount: room.users.size,
        messageCount: room.messageHistory.length,
        metadata: room.metadata
      });
    }
    return roomList;
  }

  // Cleanup disconnected users
  cleanupDisconnectedUser(socketId) {
    const userId = this.socketUsers.get(socketId);
    if (userId) {
      // Remove from all rooms
      for (const [roomId, room] of this.rooms.entries()) {
        if (room.users.has(userId)) {
          this.leaveRoom(roomId, userId, socketId);
        }
      }
    }
  }
}

// Singleton instance
const chatroomService = new ChatroomService();

module.exports = { chatroomService };
