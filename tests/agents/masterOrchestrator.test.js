// MasterOrchestrator Test Suite
const { MasterOrchestrator } = require('../../src/agents/MasterOrchestrator');
const { logger } = require('../../src/utils/logger');

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/progressBroadcaster');
jest.mock('../../src/services/chatroom');
jest.mock('../../src/agents/AgentRegistry');
jest.mock('../../src/utils/knowledgeSubstrateHelper');

describe('MasterOrchestrator', () => {
  let masterOrchestrator;
  let mockInputData;

  beforeEach(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_API_KEY = 'test-key';
    
    masterOrchestrator = new MasterOrchestrator();
    
    mockInputData = {
      sessionId: 'test-session-123',
      orchestrationId: 'test-orchestration-456',
      task: 'Analyze user engagement data and create a comprehensive report',
      conversationContext: [
        { role: 'user', content: 'I need help with data analysis' },
        { role: 'assistant', content: 'I can help you with that' }
      ]
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize MasterOrchestrator with correct properties', () => {
      expect(masterOrchestrator).toBeDefined();
      expect(masterOrchestrator.llm).toBeDefined();
      expect(masterOrchestrator.knowledgeHelper).toBeDefined();
      expect(masterOrchestrator.name).toBe('MasterOrchestrator');
      expect(masterOrchestrator.capabilities).toContain('task-analysis');
      expect(masterOrchestrator.capabilities).toContain('agent-routing');
      expect(masterOrchestrator.capabilities).toContain('orchestration');
    });

    it('should use OpenRouter when configured', () => {
      process.env.USE_OPENROUTER = 'true';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      
      const orchestrator = new MasterOrchestrator();
      expect(orchestrator.llm).toBeDefined();
    });
  });

  describe('Knowledge Substrate Integration', () => {
    it('should retrieve knowledge context successfully', async () => {
      const mockContext = {
        domain: 'orchestration',
        similarResults: [],
        knowledgeEntities: [],
        queryHash: 'test-hash'
      };
      
      masterOrchestrator.knowledgeHelper.retrieveKnowledgeContext = jest.fn().mockResolvedValue(mockContext);
      
      const result = await masterOrchestrator.retrieveKnowledgeContext('Task orchestration', 'test-session');
      
      expect(result).toEqual(mockContext);
      expect(masterOrchestrator.knowledgeHelper.retrieveKnowledgeContext).toHaveBeenCalledWith(
        'Task orchestration',
        'orchestration',
        {
          complexity: 'high',
          filters: { session_id: 'test-session' }
        }
      );
    });

    it('should store orchestration insights successfully', async () => {
      masterOrchestrator.knowledgeHelper.storeKnowledgeResults = jest.fn().mockResolvedValue(true);
      
      const result = await masterOrchestrator.storeOrchestrationInsights(
        'Multi-agent coordination',
        'Successfully coordinated analysis and creative tasks',
        'test-session'
      );
      
      expect(result).toBe(true);
      expect(masterOrchestrator.knowledgeHelper.storeKnowledgeResults).toHaveBeenCalled();
    });

    it('should extract orchestration insights correctly', () => {
      const results = 'Orchestration completed successfully. Agent routing optimized. Coordination between agents improved.';
      const insights = masterOrchestrator.extractOrchestrationInsights(results);
      
      expect(insights).toHaveLength(3);
      expect(insights[0]).toEqual({ type: 'orchestration_pattern', content: 'Orchestration completed successfully.' });
      expect(insights[1]).toEqual({ type: 'orchestration_pattern', content: 'Agent routing optimized.' });
      expect(insights[2]).toEqual({ type: 'orchestration_pattern', content: 'Coordination between agents improved.' });
    });
  });

  describe('analyzeTaskComplexity', () => {
    it('should analyze task complexity successfully', async () => {
      const task = 'Create a comprehensive analysis of user data';
      const result = await masterOrchestrator.analyzeTaskComplexity(task);
      
      expect(result).toBeDefined();
      expect(result.complexity_score).toBeGreaterThanOrEqual(0);
      expect(result.complexity_score).toBeLessThanOrEqual(1);
      expect(result.required_agents).toBeDefined();
      expect(result.estimated_time).toBeDefined();
    });

    it('should handle simple tasks', async () => {
      const simpleTask = 'Say hello';
      const result = await masterOrchestrator.analyzeTaskComplexity(simpleTask);
      
      expect(result.complexity_score).toBeLessThan(0.5);
      expect(result.required_agents.length).toBeLessThanOrEqual(2);
    });

    it('should handle complex multi-step tasks', async () => {
      const complexTask = 'Research market trends, analyze competitor data, create visualizations, and generate strategic recommendations';
      const result = await masterOrchestrator.analyzeTaskComplexity(complexTask);
      
      expect(result.complexity_score).toBeGreaterThan(0.7);
      expect(result.required_agents.length).toBeGreaterThan(2);
    });

    it('should include conversation context in analysis', async () => {
      const task = 'Continue the analysis';
      const context = [
        { role: 'user', content: 'I need a detailed financial report' },
        { role: 'assistant', content: 'I can help with financial analysis' }
      ];
      
      const result = await masterOrchestrator.analyzeTaskComplexity(task, context);
      
      expect(result).toBeDefined();
      expect(result.context_considered).toBe(true);
    });
  });

  describe('routeToAgent', () => {
    it('should route research tasks to ResearchAgent', async () => {
      const researchTask = 'Research the latest AI developments';
      const routing = await masterOrchestrator.routeToAgent(researchTask);
      
      expect(routing.selectedAgent).toBe('ResearchAgent');
      expect(routing.confidence).toBeGreaterThan(0.8);
    });

    it('should route analysis tasks to AnalysisAgent', async () => {
      const analysisTask = 'Analyze this dataset and find patterns';
      const routing = await masterOrchestrator.routeToAgent(analysisTask);
      
      expect(routing.selectedAgent).toBe('AnalysisAgent');
      expect(routing.confidence).toBeGreaterThan(0.8);
    });

    it('should route creative tasks to CreativeAgent', async () => {
      const creativeTask = 'Write a compelling story about AI';
      const routing = await masterOrchestrator.routeToAgent(creativeTask);
      
      expect(routing.selectedAgent).toBe('CreativeAgent');
      expect(routing.confidence).toBeGreaterThan(0.8);
    });

    it('should route development tasks to DevelopmentAgent', async () => {
      const devTask = 'Create a REST API for user management';
      const routing = await masterOrchestrator.routeToAgent(devTask);
      
      expect(routing.selectedAgent).toBe('DevelopmentAgent');
      expect(routing.confidence).toBeGreaterThan(0.8);
    });

    it('should handle multi-agent routing for complex tasks', async () => {
      const complexTask = 'Research market data, analyze trends, and create a presentation';
      const routing = await masterOrchestrator.routeToAgent(complexTask);
      
      expect(routing.multiAgent).toBe(true);
      expect(routing.agentSequence.length).toBeGreaterThan(1);
    });
  });

  describe('orchestrateMultiAgent', () => {
    it('should orchestrate multiple agents for complex tasks', async () => {
      const complexTask = {
        task: 'Research AI trends, analyze the data, and create a report',
        sessionId: 'test-session',
        orchestrationId: 'test-orchestration'
      };
      
      // Mock agent execution results
      const mockResults = {
        research: { status: 'completed', result: 'Research completed' },
        analysis: { status: 'completed', result: 'Analysis completed' },
        creative: { status: 'completed', result: 'Report created' }
      };
      
      masterOrchestrator.executeAgentSequence = jest.fn().mockResolvedValue(mockResults);
      
      const result = await masterOrchestrator.orchestrateMultiAgent(complexTask);
      
      expect(result).toBeDefined();
      expect(result.orchestration_complete).toBe(true);
      expect(result.agent_results).toBeDefined();
    });

    it('should handle agent execution failures gracefully', async () => {
      const task = {
        task: 'Complex task with potential failures',
        sessionId: 'test-session'
      };
      
      // Mock agent failure
      masterOrchestrator.executeAgentSequence = jest.fn().mockRejectedValue(new Error('Agent execution failed'));
      
      const result = await masterOrchestrator.orchestrateMultiAgent(task);
      
      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });
  });

  describe('processMessage', () => {
    it('should process user messages and route appropriately', async () => {
      const message = {
        content: 'Analyze user engagement metrics',
        sender: 'user',
        room: 'test-room'
      };
      
      const result = await masterOrchestrator.processMessage(message);
      
      expect(result).toBeDefined();
      expect(result.routed_to).toBeDefined();
      expect(result.response).toBeDefined();
    });

    it('should handle empty messages gracefully', async () => {
      const emptyMessage = {
        content: '',
        sender: 'user',
        room: 'test-room'
      };
      
      const result = await masterOrchestrator.processMessage(emptyMessage);
      
      expect(result.error).toBeDefined();
      expect(result.error).toContain('empty');
    });

    it('should maintain conversation context', async () => {
      const messages = [
        { content: 'I need help with data analysis', sender: 'user', room: 'test-room' },
        { content: 'Continue with the previous analysis', sender: 'user', room: 'test-room' }
      ];
      
      // Process first message
      await masterOrchestrator.processMessage(messages[0]);
      
      // Process second message with context
      const result = await masterOrchestrator.processMessage(messages[1]);
      
      expect(result.context_used).toBe(true);
    });
  });

  describe('Agent Registry Integration', () => {
    it('should access agent capabilities from registry', () => {
      const capabilities = masterOrchestrator.getAgentCapabilities();
      
      expect(capabilities).toBeDefined();
      expect(typeof capabilities).toBe('object');
    });

    it('should get agent performance metrics', () => {
      const metrics = masterOrchestrator.getAgentMetrics('ResearchAgent');
      
      expect(metrics).toBeDefined();
    });

    it('should validate agent availability', () => {
      const isAvailable = masterOrchestrator.isAgentAvailable('AnalysisAgent');
      
      expect(typeof isAvailable).toBe('boolean');
    });
  });

  describe('Execution Planning', () => {
    it('should create execution plans for complex tasks', () => {
      const task = 'Research, analyze, and present findings on AI market trends';
      const plan = masterOrchestrator.createExecutionPlan(task);
      
      expect(plan).toBeDefined();
      expect(plan.steps).toBeDefined();
      expect(plan.steps.length).toBeGreaterThan(1);
      expect(plan.estimated_duration).toBeDefined();
    });

    it('should optimize execution plans for efficiency', () => {
      const plan = {
        steps: [
          { agent: 'ResearchAgent', task: 'Research data', duration: 300 },
          { agent: 'AnalysisAgent', task: 'Analyze data', duration: 600 },
          { agent: 'CreativeAgent', task: 'Create report', duration: 400 }
        ]
      };
      
      const optimized = masterOrchestrator.optimizeExecutionPlan(plan);
      
      expect(optimized).toBeDefined();
      expect(optimized.total_duration).toBeLessThanOrEqual(
        plan.steps.reduce((sum, step) => sum + step.duration, 0)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle orchestration errors gracefully', async () => {
      const errorTask = {
        task: null, // This should cause an error
        sessionId: 'test-session'
      };
      
      const result = await masterOrchestrator.orchestrateMultiAgent(errorTask);
      
      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });

    it('should log errors appropriately', async () => {
      const invalidTask = '';
      
      await masterOrchestrator.analyzeTaskComplexity(invalidTask);
      
      expect(logger.error).toHaveBeenCalled();
    });

    it('should provide fallback responses for routing failures', async () => {
      const ambiguousTask = 'Do something';
      
      // Mock routing failure
      masterOrchestrator.routeToAgent = jest.fn().mockRejectedValue(new Error('Routing failed'));
      
      try {
        await masterOrchestrator.routeToAgent(ambiguousTask);
      } catch (error) {
        expect(error.message).toContain('Routing failed');
      }
    });
  });

  describe('Performance Monitoring', () => {
    it('should track orchestration performance metrics', async () => {
      const task = 'Simple test task';
      const startTime = Date.now();
      
      await masterOrchestrator.analyzeTaskComplexity(task);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should monitor agent response times', () => {
      const metrics = masterOrchestrator.getPerformanceMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.average_response_time).toBeDefined();
      expect(metrics.success_rate).toBeDefined();
    });
  });

  describe('Configuration Management', () => {
    it('should handle API key configuration correctly', () => {
      const hasValidConfig = masterOrchestrator.validateConfiguration();
      
      expect(typeof hasValidConfig).toBe('boolean');
    });

    it('should fallback to OpenAI when OpenRouter is unavailable', () => {
      process.env.USE_OPENROUTER = 'true';
      process.env.OPENROUTER_API_KEY = ''; // Empty key
      process.env.OPENAI_API_KEY = 'test-openai-key';
      
      const orchestrator = new MasterOrchestrator();
      expect(orchestrator.llm).toBeDefined();
    });
  });

  describe('Conversation Context', () => {
    it('should maintain conversation history', () => {
      const message = { content: 'Test message', sender: 'user' };
      
      masterOrchestrator.addToConversationHistory('test-room', message);
      
      const history = masterOrchestrator.getConversationHistory('test-room');
      expect(Array.isArray(history)).toBe(true);
    });

    it('should limit conversation history size', () => {
      const room = 'test-room-limit';
      
      // Add many messages
      for (let i = 0; i < 100; i++) {
        masterOrchestrator.addToConversationHistory(room, {
          content: `Message ${i}`,
          sender: 'user'
        });
      }
      
      const history = masterOrchestrator.getConversationHistory(room);
      expect(history.length).toBeLessThanOrEqual(50); // Should be limited
    });
  });

  describe('Integration Tests', () => {
    it('should handle end-to-end orchestration flow', async () => {
      const fullTask = {
        task: 'Research AI trends and create a summary report',
        sessionId: 'integration-test',
        orchestrationId: 'integration-orchestration'
      };
      
      // Mock the full flow
      masterOrchestrator.analyzeTaskComplexity = jest.fn().mockResolvedValue({
        complexity_score: 0.8,
        required_agents: ['ResearchAgent', 'CreativeAgent']
      });
      
      masterOrchestrator.routeToAgent = jest.fn().mockResolvedValue({
        multiAgent: true,
        agentSequence: ['ResearchAgent', 'CreativeAgent']
      });
      
      const result = await masterOrchestrator.orchestrateMultiAgent(fullTask);
      
      expect(result).toBeDefined();
    });
  });
});
