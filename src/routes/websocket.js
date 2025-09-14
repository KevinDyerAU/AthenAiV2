// src/routes/websocket.js
const { chatroomService } = require('../services/chatroom');
const { logger } = require('../utils/logger');
const { ErrorHandler, ValidationError } = require('../utils/errorHandler');

// WebSocket API routes for room management
const express = require('express');
const router = express.Router();

// Get all rooms
router.get('/rooms', (req, res) => {
  try {
    const rooms = chatroomService.getAllRooms();
    res.json({
      rooms,
      count: rooms.length
    });
  } catch (error) {
    const handledError = ErrorHandler.handleDatabaseError(error, 'get_rooms');
    res.status(handledError.statusCode).json(ErrorHandler.sanitizeErrorForClient(handledError));
  }
});

// Get room details
router.get('/rooms/:roomId', (req, res) => {
  try {
    const { roomId } = req.params;
    const users = chatroomService.getRoomUsers(roomId);
    const messages = chatroomService.getMessageHistory(roomId);
    
    res.json({
      roomId,
      users,
      messages,
      userCount: users.length,
      messageCount: messages.length
    });
  } catch (error) {
    const handledError = ErrorHandler.handleDatabaseError(error, 'get_room_details', { roomId: req.params.roomId });
    res.status(handledError.statusCode).json(ErrorHandler.sanitizeErrorForClient(handledError));
  }
});

// Get user's rooms
router.get('/users/:userId/rooms', (req, res) => {
  try {
    const { userId } = req.params;
    const rooms = chatroomService.getUserRooms(userId);
    
    res.json({
      userId,
      rooms,
      count: rooms.length
    });
  } catch (error) {
    const handledError = ErrorHandler.handleDatabaseError(error, 'get_user_rooms', { userId: req.params.userId });
    res.status(handledError.statusCode).json(ErrorHandler.sanitizeErrorForClient(handledError));
  }
});

module.exports = router;
