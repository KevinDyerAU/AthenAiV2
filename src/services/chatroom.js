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
    if (this.rooms.has(roomId)) {
      return {
        success: false,
        message: `Room ${roomId} already exists`
      };
    }
    
    this.rooms.set(roomId, {
      id: roomId,
      users: new Set(),
      messages: [],
      created_at: new Date().toISOString(),
      metadata: {
        created: new Date().toISOString(),
        ...metadata
      },
      messageHistory: []
    });
    logger.info('Room created', { roomId, metadata });
    
    return {
      success: true,
      roomId
    };
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

  // Message handling - consolidated with improved version below

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

  // getAllRooms - consolidated with improved version below

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

  getRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    
    return {
      id: roomId,
      users: room.users,
      messages: room.messages || room.messageHistory,
      created_at: room.metadata.created,
      metadata: room.metadata
    };
  }

  addMessage(roomId, message) {
    const room = this.rooms.get(roomId);
    if (!room) {
      logger.warn('Attempted to add message to non-existent room', { roomId });
      return { success: false, message: `Room ${roomId} not found` };
    }

    const messageData = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: message.userId,
      username: message.username,
      message: message.message,
      timestamp: message.timestamp || new Date().toISOString(),
      type: message.type || 'user'
    };

    room.messageHistory.push(messageData);
    if (!room.messages) room.messages = [];
    room.messages.push(messageData);
    
    if (room.messageHistory.length > 100) {
      room.messageHistory = room.messageHistory.slice(-100);
    }
    if (room.messages.length > 100) {
      room.messages = room.messages.slice(-100);
    }

    logger.info('Message added to room', { 
      roomId, 
      userId: messageData.userId,
      messageType: messageData.type 
    });

    try {
      databaseService.createConversation(
        roomId,
        message.userId,
        message.message,
        null,
        'user',
        { roomId, username: message.username }
      ).catch(error => {
        logger.error('Failed to store message in database', { error: error.message });
      });
    } catch (error) {
      logger.warn('Database service not available', { error: error.message });
    }

    return { success: true, messageId: messageData.id };
  }

  addUserToRoom(roomId, userId, username) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return {
        success: false,
        message: `Room ${roomId} not found`
      };
    }

    room.users.add(userId);
    logger.info('User added to room', { roomId, userId, username });
    
    return {
      success: true,
      roomId,
      userId
    };
  }

  removeUserFromRoom(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return {
        success: false,
        message: `Room ${roomId} not found`
      };
    }

    room.users.delete(userId);
    logger.info('User removed from room', { roomId, userId });
    
    return {
      success: true,
      roomId,
      userId
    };
  }

  getUserCount(roomId) {
    const room = this.rooms.get(roomId);
    return room ? room.users.size : 0;
  }

  cleanupEmptyRooms() {
    let cleaned = 0;
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.users.size === 0) {
        this.rooms.delete(roomId);
        cleaned++;
        logger.info('Empty room cleaned up', { roomId });
      }
    }
    return cleaned;
  }

  cleanupOldMessages(hoursLimit = 24) {
    let cleaned = 0;
    const cutoffTime = new Date(Date.now() - hoursLimit * 60 * 60 * 1000);
    
    for (const [roomId, room] of this.rooms.entries()) {
      const originalHistoryLength = room.messageHistory.length;
      const originalMessagesLength = room.messages ? room.messages.length : 0;
      
      room.messageHistory = room.messageHistory.filter(msg => 
        new Date(msg.timestamp) > cutoffTime
      );
      
      if (room.messages) {
        room.messages = room.messages.filter(msg => 
          new Date(msg.timestamp) > cutoffTime
        );
      }
      
      const historyRemoved = originalHistoryLength - room.messageHistory.length;
      const messagesRemoved = originalMessagesLength - (room.messages ? room.messages.length : 0);
      const removedCount = Math.max(historyRemoved, messagesRemoved);
      
      cleaned += removedCount;
      
      if (removedCount > 0) {
        logger.info('Old messages cleaned up', { roomId, removedCount });
      }
    }
    return cleaned;
  }

  getAllRooms() {
    const rooms = [];
    for (const [roomId, room] of this.rooms.entries()) {
      rooms.push({
        id: roomId,
        users: Array.from(room.users),
        messages: room.messages || room.messageHistory,
        created_at: room.metadata.created,
        metadata: room.metadata
      });
    }
    return rooms;
  }

  getMessageHistory(roomId, limit = 10) {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    
    const messages = room.messages || room.messageHistory;
    return messages.slice(-limit);
  }
}

// Singleton instance
const chatroomService = new ChatroomService();

module.exports = { chatroomService };
