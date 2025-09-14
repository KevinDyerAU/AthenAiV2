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
const { ErrorHandler, WebSocketError, AgentExecutionError } = require('./utils/errorHandler');
const routes = require('./routes');
const { databaseService } = require('./services/database');
const { chatroomService } = require('./services/chatroom');
const { progressBroadcaster } = require('./services/progressBroadcaster');
const { MasterOrchestrator } = require('./agents/MasterOrchestrator');
const { ResearchAgent } = require('./agents/ResearchAgent');
const { AnalysisAgent } = require('./agents/AnalysisAgent');
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
const analysisAgent = new AnalysisAgent();
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

// Helper function to format agent responses for better readability
function formatAgentResponse(agentResult, originalMessage, agentType) {
  let formattedText = '';
  let metadata = {
    agent: agentType,
    confidence: agentResult.confidence || 0.8,
    timestamp: new Date().toISOString()
  };

  // Log the full agent result for debugging
  logger.info('Formatting agent response:', {
    agentType,
    agentResultKeys: Object.keys(agentResult),
    agentResultPreview: JSON.stringify(agentResult, null, 2).substring(0, 500) + '...'
  });

  // Handle different agent response formats with comprehensive data preservation
  if (agentResult.results && typeof agentResult.results === 'object') {
    // Research/Analysis agent format with rich results
    const query = agentResult.query || originalMessage;
    formattedText = `## ${agentType.charAt(0).toUpperCase() + agentType.slice(1)} Agent Results: "${query}"\n\n`;
    
    // Summary
    if (agentResult.results.summary) {
      formattedText += `**Summary:**\n${agentResult.results.summary}\n\n`;
    }
    
    // Analysis/Key Findings
    if (agentResult.results.analysis && agentResult.results.analysis !== 'Analysis completed') {
      formattedText += `**Analysis & Key Findings:**\n${agentResult.results.analysis}\n\n`;
    }
    
    // Technical Details
    if (agentResult.results.technical_details) {
      formattedText += `**Technical Details:**\n${agentResult.results.technical_details}\n\n`;
    }
    
    // Architecture/Structure
    if (agentResult.results.architecture) {
      formattedText += `**Architecture:**\n${agentResult.results.architecture}\n\n`;
    }
    
    // Features
    if (agentResult.results.features && Array.isArray(agentResult.results.features)) {
      formattedText += `**Key Features:**\n`;
      agentResult.results.features.forEach((feature, i) => {
        formattedText += `• ${feature}\n`;
      });
      formattedText += '\n';
    }
    
    // Technologies
    if (agentResult.results.technologies && Array.isArray(agentResult.results.technologies)) {
      formattedText += `**Technologies Used:**\n`;
      agentResult.results.technologies.forEach((tech, i) => {
        formattedText += `• ${tech}\n`;
      });
      formattedText += '\n';
    }
    
    // Recommendations
    if (agentResult.results.recommendations && Array.isArray(agentResult.results.recommendations) && 
        agentResult.results.recommendations.length > 0 && agentResult.results.recommendations[0] !== 'Recommendation 1') {
      formattedText += `**Recommendations:**\n`;
      agentResult.results.recommendations.forEach((rec, i) => {
        formattedText += `${i + 1}. ${rec}\n`;
      });
      formattedText += '\n';
    }
    
    // Sources
    if (agentResult.results.sources && Array.isArray(agentResult.results.sources) && agentResult.results.sources.length > 0) {
      formattedText += `**Sources:**\n`;
      agentResult.results.sources.forEach((source, i) => {
        formattedText += `${i + 1}. ${source}\n`;
      });
      formattedText += '\n';
    }
    
    // Additional data fields
    Object.keys(agentResult.results).forEach(key => {
      if (!['summary', 'analysis', 'technical_details', 'architecture', 'features', 'technologies', 'recommendations', 'sources'].includes(key)) {
        const value = agentResult.results[key];
        if (value && typeof value === 'string' && value.length > 10) {
          formattedText += `**${key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}:**\n${value}\n\n`;
        } else if (Array.isArray(value) && value.length > 0) {
          formattedText += `**${key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}:**\n`;
          value.forEach((item, i) => {
            formattedText += `• ${item}\n`;
          });
          formattedText += '\n';
        }
      }
    });
    
    metadata.hasAnalysis = !!agentResult.results.analysis;
    metadata.hasRecommendations = !!(agentResult.results.recommendations && agentResult.results.recommendations.length > 0);
    metadata.sourceCount = agentResult.results.sources ? agentResult.results.sources.length : 0;
    metadata.featureCount = agentResult.results.features ? agentResult.results.features.length : 0;
    
  } else if (agentResult.summary && typeof agentResult.summary === 'string') {
    // Simple summary format
    formattedText = `**${agentType.charAt(0).toUpperCase() + agentType.slice(1)} Agent:** ${agentResult.summary}`;
  } else if (agentResult.response) {
    formattedText = agentResult.response;
  } else if (agentResult.content) {
    formattedText = agentResult.content;
  } else {
    // Fallback - try to extract any meaningful content
    const meaningfulKeys = Object.keys(agentResult).filter(key => 
      typeof agentResult[key] === 'string' && agentResult[key].length > 10
    );
    
    if (meaningfulKeys.length > 0) {
      formattedText = `## ${agentType.charAt(0).toUpperCase() + agentType.slice(1)} Agent Response\n\n`;
      meaningfulKeys.forEach(key => {
        formattedText += `**${key.charAt(0).toUpperCase() + key.slice(1)}:** ${agentResult[key]}\n\n`;
      });
    } else {
      formattedText = `## ${agentType.charAt(0).toUpperCase() + agentType.slice(1)} Agent Response\n\n`;
      formattedText += `I've processed your request: "${originalMessage}"\n\n`;
      formattedText += `How can I help you further?`;
    }
  }

  return {
    text: formattedText,
    metadata
  };
}

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
      const wsError = ErrorHandler.handleWebSocketError(error, 'join_room', socket.id, { roomId: data?.roomId, userId: data?.userId });
      socket.emit('error', ErrorHandler.sanitizeErrorForClient(wsError));
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
      let primaryAgent = 'general'; // Initialize with default value
      
      try {
        const orchestrationResult = await masterOrchestrator.executeOrchestration({
          message,
          sessionId: roomId,
          userId
        });
        logger.info('Orchestration result', { orchestrationResult });

        // Execute primary agent with proper error handling and detailed debugging
        logger.info('App.js: Extracting primaryAgent from orchestration result', {
          orchestrationResult: JSON.stringify(orchestrationResult, null, 2),
          hasOrchestrationResult: !!orchestrationResult.orchestration_result,
          hasRouting: !!orchestrationResult.orchestration_result?.routing,
          routingPrimary: orchestrationResult.orchestration_result?.routing?.primary,
          roomId
        });

        primaryAgent = orchestrationResult.orchestration_result?.routing?.primary;
        
        // Validate and fallback if primaryAgent is undefined
        if (!primaryAgent || typeof primaryAgent !== 'string') {
          logger.error('App.js: primaryAgent is undefined or invalid, using fallback', { 
            primaryAgent, 
            type: typeof primaryAgent,
            orchestrationResultKeys: Object.keys(orchestrationResult || {}),
            orchestrationResultStructure: orchestrationResult.orchestration_result ? Object.keys(orchestrationResult.orchestration_result) : 'undefined',
            routingStructure: orchestrationResult.orchestration_result?.routing ? Object.keys(orchestrationResult.orchestration_result.routing) : 'undefined',
            fullOrchestrationResult: JSON.stringify(orchestrationResult, null, 2),
            roomId
          });
          primaryAgent = 'general';
        }
        
        logger.info('Executing agent', { primaryAgent });
        
        // Additional safety check before template literal
        const safeAgentName = primaryAgent || 'general';
        
        // Start agent-specific progress tracking
        progressBroadcaster.startProgress(roomId, safeAgentName, `Processing with ${safeAgentName} agent`);
        
        if (primaryAgent === 'research') {
          logger.info('Calling research agent');
          agentResult = await researchAgent.executeResearch(
            message,
            roomId,
            orchestrationResult.session_id,
            { sessionId: roomId }
          );
        } else if (primaryAgent === 'analysis') {
          logger.info('Calling analysis agent', {
            message,
            sessionId: orchestrationResult.session_id,
            orchestrationId: orchestrationResult.orchestration_id || safeAgentName
          });
          try {
            agentResult = await analysisAgent.executeAnalysis({
              task: { 
                message, 
                data: message,
                session_id: orchestrationResult.session_id, 
                orchestration_id: orchestrationResult.orchestration_id || safeAgentName 
              }
            });
            logger.info('Analysis agent completed successfully', { agentResult });
          } catch (analysisError) {
            logger.error('Analysis agent execution failed:', {
              error: analysisError.message,
              stack: analysisError.stack,
              name: analysisError.name,
              timestamp: new Date().toISOString()
            });
            throw analysisError; // Re-throw to trigger fallback
          }
        } else if (primaryAgent === 'creative') {
          logger.info('Calling creative agent');
          agentResult = await creativeAgent.executeCreative({
            task: { content: message, session_id: orchestrationResult.session_id, orchestration_id: orchestrationResult.orchestration_id || safeAgentName }
          });
        } else if (primaryAgent === 'development') {
          logger.info('Calling development agent');
          agentResult = await developmentAgent.executeDevelopment({
            task: { requirements: message, session_id: orchestrationResult.session_id, orchestration_id: orchestrationResult.orchestration_id || safeAgentName }
          });
        } else if (primaryAgent === 'planning') {
          logger.info('Calling planning agent');
          agentResult = await planningAgent.executePlanning({
            task: { objective: message, session_id: orchestrationResult.session_id, orchestration_id: orchestrationResult.orchestration_id || safeAgentName }
          });
        } else if (primaryAgent === 'execution') {
          logger.info('Calling execution agent');
          agentResult = await executionAgent.executeTask({
            task: { execution_plan: message, session_id: orchestrationResult.session_id, orchestration_id: orchestrationResult.orchestration_id || safeAgentName }
          });
        } else if (primaryAgent === 'communication') {
          logger.info('Calling communication agent');
          agentResult = await communicationAgent.executeCommunication({
            task: { message: message, session_id: orchestrationResult.session_id, orchestration_id: orchestrationResult.orchestration_id || safeAgentName }
          });
        } else if (primaryAgent === 'qa') {
          logger.info('Calling QA agent');
          agentResult = await qaAgent.executeQualityAssurance({
            task: { content: message, session_id: orchestrationResult.session_id, orchestration_id: orchestrationResult.orchestration_id || safeAgentName }
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
        const handledError = ErrorHandler.handleAgentError(agentError, primaryAgent, roomId, { message: message?.substring(0, 100) });
        
        // Send specific error to user via WebSocket
        socket.emit('agent_error', ErrorHandler.sanitizeErrorForClient(handledError));
        
        // Fallback to simple response
        agentResult = {
          summary: handledError.userMessage,
          agent_type: 'general',
          confidence: 0.7,
          error: true
        };
      }

      // Add agent response to room
      if (agentResult) {
        logger.info('Processing agent result for broadcast', { agentResult });
        
        // Format response for better readability
        const agentType = agentResult.agent_type || primaryAgent || 'general';
        const formattedResponse = formatAgentResponse(agentResult, message, agentType);
        
        const responseData = await chatroomService.addAgentResponse(
          roomId,
          messageData.id,
          formattedResponse.text,
          agentType
        );

        logger.info('Broadcasting agent response', { responseData });
        
        // Complete progress tracking
        progressBroadcaster.completeProgress(roomId, {
          agent: agentType,
          responseLength: formattedResponse.text.length,
          confidence: agentResult.confidence || 0.8
        });
        
        // Broadcast formatted agent response
        io.to(roomId).emit('new_message', {
          ...responseData,
          username: 'AthenAI',
          messageType: 'agent',
          formatted: true,
          metadata: formattedResponse.metadata
        });
      }
      
    } catch (error) {
      const wsError = ErrorHandler.handleWebSocketError(error, 'send_message', socket.id, { 
        roomId: data?.roomId, 
        userId: data?.userId,
        messagePreview: data?.message?.substring(0, 100)
      });
      
      socket.emit('error', ErrorHandler.sanitizeErrorForClient(wsError));
      
      // Also broadcast to room that message processing failed
      if (data?.roomId) {
        io.to(data.roomId).emit('message_error', {
          error: true,
          message: wsError.userMessage,
          timestamp: new Date().toISOString()
        });
      }
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
      const wsError = ErrorHandler.handleWebSocketError(error, 'leave_room', socket.id, { roomId: data?.roomId, userId: data?.userId });
      socket.emit('error', ErrorHandler.sanitizeErrorForClient(wsError));
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
