// src/routes/websocket.js
const { chatroomService } = require('../services/chatroom');
const { logger } = require('../utils/logger');

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
    logger.error('Get rooms error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
    logger.error('Get room details error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
    logger.error('Get user rooms error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
