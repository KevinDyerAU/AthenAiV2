// src/routes/index.js
const express = require('express');
const { 
  MasterOrchestrator,
  ResearchAgent,
  AnalysisAgent,
  CreativeAgent,
  DevelopmentAgent,
  CommunicationAgent,
  PlanningAgent,
  ExecutionAgent,
  QualityAssuranceAgent,
  AgentHandlers
} = require('../agents');
const { databaseService } = require('../services/database');
const { logger } = require('../utils/logger');
const websocketRoutes = require('./websocket');

const router = express.Router();

// Initialize all agents
const masterOrchestrator = new MasterOrchestrator();
const researchAgent = new ResearchAgent();
const analysisAgent = new AnalysisAgent();
const creativeAgent = new CreativeAgent(process.env.OPENAI_API_KEY);
const developmentAgent = new DevelopmentAgent();
const communicationAgent = new CommunicationAgent();
const planningAgent = new PlanningAgent();
const executionAgent = new ExecutionAgent();
const qaAgent = new QualityAssuranceAgent();
const agentHandlers = new AgentHandlers();

// Register all agents with the handler
agentHandlers.registerAgent('master', masterOrchestrator, { type: 'orchestration' });
agentHandlers.registerAgent('research', researchAgent, { type: 'research' });
agentHandlers.registerAgent('analysis', analysisAgent, { type: 'analysis' });
agentHandlers.registerAgent('creative', creativeAgent, { type: 'creative' });
agentHandlers.registerAgent('development', developmentAgent, { type: 'development' });
agentHandlers.registerAgent('communication', communicationAgent, { type: 'communication' });
agentHandlers.registerAgent('planning', planningAgent, { type: 'planning' });
agentHandlers.registerAgent('execution', executionAgent, { type: 'execution' });
agentHandlers.registerAgent('qa', qaAgent, { type: 'qa' });

// WebSocket API routes
router.use('/ws', websocketRoutes);

// Main chat endpoint
router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId, userId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Execute orchestration
    const orchestrationResult = await masterOrchestrator.executeOrchestration({
      message,
      sessionId,
      userId
    });

    // Execute primary agent based on routing
    let agentResult = null;
    let primaryAgent = orchestrationResult.routing?.primary;
    
    // Validate and fallback if primaryAgent is undefined
    if (!primaryAgent || typeof primaryAgent !== 'string') {
      console.warn('primaryAgent is undefined or invalid in routes, using fallback', { 
        primaryAgent, 
        orchestrationResult 
      });
      primaryAgent = 'general';
    }
    
    // Additional safety check for orchestration_id
    const safeOrchestrationId = orchestrationResult.orchestration_id || primaryAgent;
    
    switch (primaryAgent) {
      case 'research':
        agentResult = await researchAgent.executeResearch(
          message,
          orchestrationResult.session_id,
          safeOrchestrationId
        );
        break;
      case 'analysis':
        agentResult = await analysisAgent.executeAnalysis({
          task: { content: message, sessionId: orchestrationResult.session_id, orchestrationId: safeOrchestrationId }
        });
        break;
      case 'creative':
        agentResult = await creativeAgent.executeCreative({
          task: { content: message, sessionId: orchestrationResult.session_id, orchestrationId: safeOrchestrationId }
        });
        break;
      case 'development':
        agentResult = await developmentAgent.executeDevelopment({
          task: { requirements: message, sessionId: orchestrationResult.session_id, orchestrationId: safeOrchestrationId }
        });
        break;
      case 'communication':
        agentResult = await communicationAgent.executeCommunication({
          task: { message, sessionId: orchestrationResult.session_id, orchestrationId: safeOrchestrationId }
        });
        break;
      case 'planning':
        agentResult = await planningAgent.executePlanning({
          task: { objective: message, sessionId: orchestrationResult.session_id, orchestrationId: safeOrchestrationId }
        });
        break;
      case 'execution':
        agentResult = await executionAgent.executeTask({
          task: { execution_plan: message, sessionId: orchestrationResult.session_id, orchestrationId: safeOrchestrationId }
        });
        break;
      case 'qa':
        agentResult = await qaAgent.executeQualityAssurance({
          task: { content: message, sessionId: orchestrationResult.session_id, orchestrationId: safeOrchestrationId }
        });
        break;
      default:
        agentResult = await researchAgent.executeResearch(
          message,
          orchestrationResult.session_id,
          safeOrchestrationId
        );
    }

    // Store conversation in Supabase
    await databaseService.createConversation(
      orchestrationResult.session_id,
      userId,
      message,
      agentResult?.summary || 'Processing...',
      orchestrationResult.routing?.primary || 'unknown',
      {
        orchestration_id: orchestrationResult.orchestration_id,
        complexity: orchestrationResult.complexity,
        execution_time: orchestrationResult.execution_time_ms
      }
    );

    res.json({
      orchestration: orchestrationResult,
      agent_result: agentResult,
      session_id: orchestrationResult.session_id
    });

  } catch (error) {
    logger.error('Chat endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get conversation history
router.get('/conversations/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 10 } = req.query;
    
    const history = await databaseService.getConversationHistory(sessionId, parseInt(limit));
    
    res.json({
      session_id: sessionId,
      conversations: history,
      count: history.length
    });

  } catch (error) {
    logger.error('Conversation history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Individual agent endpoints
router.post('/research', async (req, res) => {
  try {
    const { query, sessionId } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const result = await researchAgent.executeResearch(
      query,
      sessionId || 'direct_research',
      'direct_research_' + Date.now()
    );

    res.json({
      query,
      result,
      session_id: sessionId || 'direct_research'
    });
  } catch (error) {
    logger.error('Research endpoint error:', error);
    res.status(500).json({ error: 'Research failed' });
  }
});

// Development endpoint
router.post('/development', async (req, res) => {
  try {
    const { requirements, projectType, language, sessionId } = req.body;
    
    if (!requirements) {
      return res.status(400).json({ error: 'Requirements are required' });
    }

    const result = await developmentAgent.executeDevelopment({
      task: {
        requirements,
        project_type: projectType,
        language,
        sessionId: sessionId || 'direct_development'
      }
    });

    res.json({
      requirements,
      result,
      session_id: sessionId || 'direct_development'
    });
  } catch (error) {
    logger.error('Development endpoint error:', error);
    res.status(500).json({ error: 'Development task failed' });
  }
});

// Planning endpoint
router.post('/planning', async (req, res) => {
  try {
    const { objective, planningType, constraints, resources, timeline, sessionId } = req.body;
    
    if (!objective) {
      return res.status(400).json({ error: 'Objective is required' });
    }

    const result = await planningAgent.executePlanning({
      task: {
        objective,
        planning_type: planningType,
        constraints,
        resources,
        timeline,
        sessionId: sessionId || 'direct_planning'
      }
    });

    res.json({
      objective,
      result,
      session_id: sessionId || 'direct_planning'
    });
  } catch (error) {
    logger.error('Planning endpoint error:', error);
    res.status(500).json({ error: 'Planning task failed' });
  }
});

// Execution endpoint
router.post('/execution', async (req, res) => {
  try {
    const { executionPlan, executionType, environment, parameters, sessionId } = req.body;
    
    if (!executionPlan) {
      return res.status(400).json({ error: 'Execution plan is required' });
    }

    const result = await executionAgent.executeTask({
      task: {
        execution_plan: executionPlan,
        execution_type: executionType,
        environment,
        parameters,
        sessionId: sessionId || 'direct_execution'
      }
    });

    res.json({
      execution_plan: executionPlan,
      result,
      session_id: sessionId || 'direct_execution'
    });
  } catch (error) {
    logger.error('Execution endpoint error:', error);
    res.status(500).json({ error: 'Execution task failed' });
  }
});

// Communication endpoint
router.post('/communication', async (req, res) => {
  try {
    const { message, communicationType, channel, recipients, context, sessionId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await communicationAgent.executeCommunication({
      task: {
        message,
        communication_type: communicationType,
        channel,
        recipients,
        context,
        sessionId: sessionId || 'direct_communication'
      }
    });

    res.json({
      message,
      result,
      session_id: sessionId || 'direct_communication'
    });
  } catch (error) {
    logger.error('Communication endpoint error:', error);
    res.status(500).json({ error: 'Communication task failed' });
  }
});

// Quality Assurance endpoint
router.post('/qa', async (req, res) => {
  try {
    const { content, qaType, standards, context, sessionId } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const result = await qaAgent.executeQualityAssurance({
      task: {
        content,
        qa_type: qaType,
        standards,
        context,
        sessionId: sessionId || 'direct_qa'
      }
    });

    res.json({
      content,
      result,
      session_id: sessionId || 'direct_qa'
    });
  } catch (error) {
    logger.error('QA endpoint error:', error);
    res.status(500).json({ error: 'Quality assurance failed' });
  }
});

// Analysis endpoint
router.post('/analysis', async (req, res) => {
  try {
    const { content, analysisType, context, sessionId } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const result = await analysisAgent.executeAnalysis({
      task: {
        content,
        analysis_type: analysisType,
        context,
        sessionId: sessionId || 'direct_analysis'
      }
    });

    res.json({
      content,
      result,
      session_id: sessionId || 'direct_analysis'
    });
  } catch (error) {
    logger.error('Analysis endpoint error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// Creative endpoint
router.post('/creative', async (req, res) => {
  try {
    const { content, creativeType, context, sessionId } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const result = await creativeAgent.executeCreative({
      task: {
        content,
        creative_type: creativeType,
        context,
        sessionId: sessionId || 'direct_creative'
      }
    });

    res.json({
      content,
      result,
      session_id: sessionId || 'direct_creative'
    });
  } catch (error) {
    logger.error('Creative endpoint error:', error);
    res.status(500).json({ error: 'Creative task failed' });
  }
});

// Knowledge graph query
router.post('/knowledge/query', async (req, res) => {
  try {
    const { cypher, parameters = {} } = req.body;
    
    if (!cypher) {
      return res.status(400).json({ error: 'Cypher query is required' });
    }

    const results = await databaseService.queryKnowledge(cypher, parameters);
    
    res.json({
      query: cypher,
      results,
      count: results.length
    });

  } catch (error) {
    logger.error('Knowledge query error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Metrics endpoint
router.get('/metrics', async (req, res) => {
  try {
    // Get basic metrics from cache
    const metrics = await databaseService.cacheGet('app_metrics') || {
      requests: 0,
      errors: 0,
      uptime: process.uptime()
    };

    res.json({
      ...metrics,
      timestamp: new Date().toISOString(),
      memory_usage: process.memoryUsage(),
      uptime_seconds: process.uptime()
    });

  } catch (error) {
    logger.error('Metrics endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
