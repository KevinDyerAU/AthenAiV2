// src/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const { createServer } = require('http');
const { Server } = require('socket.io');

const { logger } = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');
const routes = require('./routes');
const { databaseService } = require('./services/database');
const { chatroomService } = require('./services/chatroom');
const { MasterOrchestrator } = require('./agents/MasterOrchestrator');
const { ResearchAgent } = require('./agents/ResearchAgent');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://your-domain.com'] 
      : ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Initialize agents
const masterOrchestrator = new MasterOrchestrator();
const researchAgent = new ResearchAgent();

// Initialize database connections
async function initializeApp() {
  try {
    await databaseService.initialize();
    logger.info('Database services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database services:', error);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    } else {
      throw error; // In test environment, throw error instead of exiting
    }
  }
}

// Security and performance middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "ws://localhost:3000", "http://localhost:3000"]
    }
  }
}));
app.use(compression());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] 
    : ['http://localhost:3000', 'http://localhost:3001']
}));

// Serve static files
app.use(express.static('public'));

// Logging
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
app.use(rateLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api', routes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await databaseService.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await databaseService.close();
  process.exit(0);
});

// WebSocket event handlers
io.on('connection', (socket) => {
  logger.info('Client connected', { socketId: socket.id });

  // Join room
  socket.on('join_room', async (data) => {
    try {
      const { roomId, userId, username } = data;
      
      // Join socket room
      socket.join(roomId);
      
      // Add to chatroom service
      chatroomService.joinRoom(roomId, userId, socket.id);
      
      // Get room info
      const roomUsers = chatroomService.getRoomUsers(roomId);
      const messageHistory = chatroomService.getMessageHistory(roomId);
      
      // Notify user they joined
      socket.emit('joined_room', {
        roomId,
        users: roomUsers,
        messageHistory
      });
      
      // Notify others in room
      socket.to(roomId).emit('user_joined', {
        userId,
        username,
        userCount: roomUsers.length
      });
      
      logger.info('User joined room via websocket', { roomId, userId, username });
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('Join room error:', error);
    }
  });

  // Send message
  socket.on('send_message', async (data) => {
    try {
      const { roomId, message, userId, username } = data;
      
      // Add message to room
      const messageData = await chatroomService.addMessage(roomId, userId, message, 'user');
      
      // Broadcast to room
      io.to(roomId).emit('new_message', {
        ...messageData,
        username
      });
      
      // Process with AI agents
      const orchestrationResult = await masterOrchestrator.executeOrchestration({
        message,
        sessionId: roomId,
        userId
      });

      // Execute primary agent
      let agentResult = null;
      if (orchestrationResult.routing?.primary === 'research') {
        agentResult = await researchAgent.executeResearch(
          message,
          roomId,
          orchestrationResult.orchestration_id
        );
      }

      // Add agent response to room
      if (agentResult && agentResult.summary) {
        const responseData = await chatroomService.addAgentResponse(
          roomId,
          messageData.id,
          agentResult.summary,
          orchestrationResult.routing?.primary
        );

        // Broadcast agent response
        io.to(roomId).emit('agent_response', {
          ...responseData,
          agentResult,
          orchestration: orchestrationResult
        });
      }
      
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('Send message error:', error);
    }
  });

  // Leave room
  socket.on('leave_room', (data) => {
    try {
      const { roomId, userId } = data;
      
      socket.leave(roomId);
      chatroomService.leaveRoom(roomId, userId, socket.id);
      
      const roomUsers = chatroomService.getRoomUsers(roomId);
      
      // Notify others in room
      socket.to(roomId).emit('user_left', {
        userId,
        userCount: roomUsers.length
      });
      
      logger.info('User left room via websocket', { roomId, userId });
    } catch (error) {
      socket.emit('error', { message: error.message });
      logger.error('Leave room error:', error);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    chatroomService.cleanupDisconnectedUser(socket.id);
    logger.info('Client disconnected', { socketId: socket.id });
  });
});

// Start server
async function startServer() {
  await initializeApp();
  
  server.listen(PORT, () => {
    logger.info(`AthenAI server with WebSocket running on port ${PORT}`);
  });
}

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer().catch(error => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = { app, startServer };
