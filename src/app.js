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
const { progressBroadcaster } = require('./services/progressBroadcaster');
const { MasterOrchestrator } = require('./agents/MasterOrchestrator');
const { ResearchAgent } = require('./agents/ResearchAgent');
const { AnalysisAgent } = require('./agents/analysisAgent');
const { CreativeAgent } = require('./agents/creativeAgent');
const { DevelopmentAgent } = require('./agents/DevelopmentAgent');
const { PlanningAgent } = require('./agents/PlanningAgent');
const { ExecutionAgent } = require('./agents/ExecutionAgent');
const { CommunicationAgent } = require('./agents/CommunicationAgent');
const { QualityAssuranceAgent } = require('./agents/QualityAssuranceAgent');

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
const analysisAgent = new AnalysisAgent(process.env.OPENAI_API_KEY);
const creativeAgent = new CreativeAgent(process.env.OPENAI_API_KEY);
const developmentAgent = new DevelopmentAgent();
const planningAgent = new PlanningAgent();
const executionAgent = new ExecutionAgent();
const communicationAgent = new CommunicationAgent();
const qaAgent = new QualityAssuranceAgent();

// Initialize database connections
async function initializeApp() {
  try {
    await databaseService.initialize();
    logger.info('Database services initialized successfully');
    
    // Initialize progress broadcaster with Socket.IO
    progressBroadcaster.initialize(io);
    logger.info('Progress broadcaster initialized successfully');
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
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
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
      logger.info('Processing message', { roomId, message, userId, username });
      
      // Add message to room
      const messageData = await chatroomService.addMessage(roomId, userId, message, 'user');
      
      // Broadcast to room
      io.to(roomId).emit('new_message', {
        ...messageData,
        username
      });
      
      // Process with AI agents
      logger.info('Calling Master Orchestrator', { message });
      let agentResult = null;
      
      try {
        const orchestrationResult = await masterOrchestrator.executeOrchestration({
          message,
          sessionId: roomId,
          userId
        });
        logger.info('Orchestration result', { orchestrationResult });

        // Execute primary agent
        const primaryAgent = orchestrationResult.orchestration_result?.routing?.primary;
        logger.info('Executing agent', { primaryAgent });
        
        if (primaryAgent === 'research') {
          logger.info('Calling research agent');
          agentResult = await researchAgent.executeResearch(
            message,
            roomId,
            orchestrationResult.session_id,
            { sessionId: roomId }
          );
        } else if (primaryAgent === 'analysis') {
          logger.info('Calling analysis agent');
          agentResult = await analysisAgent.executeAnalysis({
            task: { message, session_id: orchestrationResult.session_id, orchestration_id: orchestrationResult.orchestration_result?.routing?.primary }
          });
        } else if (primaryAgent === 'creative') {
          logger.info('Calling creative agent');
          agentResult = await creativeAgent.executeCreative({
            task: { content: message, session_id: orchestrationResult.session_id, orchestration_id: orchestrationResult.orchestration_result?.routing?.primary }
          });
        } else if (primaryAgent === 'development') {
          logger.info('Calling development agent');
          agentResult = await developmentAgent.executeDevelopment({
            task: { requirements: message, session_id: orchestrationResult.session_id, orchestration_id: orchestrationResult.orchestration_result?.routing?.primary }
          });
        } else if (primaryAgent === 'planning') {
          logger.info('Calling planning agent');
          agentResult = await planningAgent.executePlanning({
            task: { objective: message, session_id: orchestrationResult.session_id, orchestration_id: orchestrationResult.orchestration_result?.routing?.primary }
          });
        } else if (primaryAgent === 'execution') {
          logger.info('Calling execution agent');
          agentResult = await executionAgent.executeTask({
            task: { execution_plan: message, session_id: orchestrationResult.session_id, orchestration_id: orchestrationResult.orchestration_result?.routing?.primary }
          });
        } else if (primaryAgent === 'communication') {
          logger.info('Calling communication agent');
          agentResult = await communicationAgent.executeCommunication({
            task: { message: message, session_id: orchestrationResult.session_id, orchestration_id: orchestrationResult.orchestration_result?.routing?.primary }
          });
        } else if (primaryAgent === 'qa') {
          logger.info('Calling QA agent');
          agentResult = await qaAgent.executeQualityAssurance({
            task: { content: message, session_id: orchestrationResult.session_id, orchestration_id: orchestrationResult.orchestration_result?.routing?.primary }
          });
        } else {
          // For general messages, provide a helpful response
          logger.info('Using general response for agent:', primaryAgent);
          agentResult = {
            summary: `Hello! I'm AthenAI. I can help you with research, analysis, creative tasks, development, planning, execution, communication, and quality assurance. What would you like to explore today?`,
            agent_type: 'general',
            confidence: 0.9
          };
        }
        logger.info('Agent result', { agentResult });
      } catch (agentError) {
        logger.error('Agent execution failed:', agentError);
        // Fallback to simple response if AI agents fail
        agentResult = {
          summary: `I'm processing your request. How can I help you today?`,
          agent_type: 'general',
          confidence: 0.7
        };
      }

      // Add agent response to room
      if (agentResult) {
        logger.info('Processing agent result for broadcast', { agentResult });
        
        // Extract and format response text from agent result
        let responseText = '';
        
        if (agentResult.summary && typeof agentResult.summary === 'string') {
          responseText = agentResult.summary;
        } else if (agentResult.results && agentResult.results.summary) {
          // Format research agent response
          responseText = `I've completed research on "${agentResult.query}". ${agentResult.results.summary}`;
          if (agentResult.results.analysis && agentResult.results.analysis !== 'Analysis completed') {
            responseText += `\n\nKey findings: ${agentResult.results.analysis}`;
          }
          if (agentResult.results.recommendations && agentResult.results.recommendations.length > 0 && agentResult.results.recommendations[0] !== 'Recommendation 1') {
            responseText += `\n\nRecommendations: ${agentResult.results.recommendations.join(', ')}`;
          }
        } else if (agentResult.response) {
          responseText = agentResult.response;
        } else if (agentResult.content) {
          responseText = agentResult.content;
        } else {
          // Fallback for unstructured responses
          responseText = `I processed your request about "${message}". How can I help you further?`;
        }
        
        const responseData = await chatroomService.addAgentResponse(
          roomId,
          messageData.id,
          responseText,
          agentResult.agent_type || 'general'
        );

        logger.info('Broadcasting agent response', { responseData });
        
        // Broadcast agent response using the same event as user messages
        io.to(roomId).emit('new_message', {
          ...responseData,
          username: 'AthenAI',
          messageType: 'agent'
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
