// ResearchAgent Test Suite
const { ResearchAgent } = require('../../src/agents/ResearchAgent');
const { logger } = require('../../src/utils/logger');

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/progressBroadcaster');
jest.mock('../../src/services/database');
jest.mock('../../src/utils/knowledgeSubstrateHelper');

describe('ResearchAgent', () => {
  let researchAgent;
  let mockInputData;

  beforeEach(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_API_KEY = 'test-key';
    
    researchAgent = new ResearchAgent();
    
    mockInputData = {
      sessionId: 'test-session-123',
      orchestrationId: 'test-orchestration-456',
      task: {
        query: 'Research the latest developments in artificial intelligence',
        research_type: 'comprehensive',
        depth: 'detailed'
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize ResearchAgent with correct properties', () => {
      expect(researchAgent).toBeDefined();
      expect(researchAgent.llm).toBeDefined();
      expect(researchAgent.knowledgeHelper).toBeDefined();
      expect(researchAgent.reasoning).toBeDefined();
      expect(researchAgent.name).toBe('ResearchAgent');
      expect(researchAgent.capabilities).toContain('web-search');
      expect(researchAgent.capabilities).toContain('data-analysis');
    });

    it('should use OpenRouter when configured', () => {
      process.env.USE_OPENROUTER = 'true';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      
      const agent = new ResearchAgent();
      expect(agent.llm).toBeDefined();
    });
  });

  describe('Knowledge Substrate Integration', () => {
    it('should retrieve knowledge context successfully', async () => {
      const mockContext = {
        domain: 'ai',
        similarResults: [],
        knowledgeEntities: [],
        queryHash: 'test-hash'
      };
      
      researchAgent.knowledgeHelper.retrieveKnowledgeContext = jest.fn().mockResolvedValue(mockContext);
      
      const result = await researchAgent.retrieveKnowledgeContext('AI research', 'test-session');
      
      expect(result).toEqual(mockContext);
      expect(researchAgent.knowledgeHelper.retrieveKnowledgeContext).toHaveBeenCalledWith(
        'AI research',
        'research',
        {
          complexity: 'medium',
          filters: { session_id: 'test-session' }
        }
      );
    });

    it('should handle knowledge context retrieval errors gracefully', async () => {
      researchAgent.knowledgeHelper.retrieveKnowledgeContext = jest.fn().mockRejectedValue(new Error('Network error'));
      
      const result = await researchAgent.retrieveKnowledgeContext('AI research', 'test-session');
      
      expect(result).toEqual({
        domain: 'general',
        similarResults: [],
        knowledgeEntities: [],
        queryHash: null
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should store research insights successfully', async () => {
      researchAgent.knowledgeHelper.storeKnowledgeResults = jest.fn().mockResolvedValue(true);
      
      const result = await researchAgent.storeResearchInsights(
        'AI research',
        'Research results about AI',
        'test-session'
      );
      
      expect(result).toBe(true);
      expect(researchAgent.knowledgeHelper.storeKnowledgeResults).toHaveBeenCalled();
    });

    it('should extract research insights correctly', () => {
      const results = 'Research findings: AI is advancing rapidly. Key insights: machine learning improvements.';
      const insights = researchAgent.extractResearchInsights(results);
      
      expect(insights).toHaveLength(2);
      expect(insights[0]).toEqual({ type: 'research_pattern', content: 'Research findings: AI is advancing rapidly.' });
      expect(insights[1]).toEqual({ type: 'research_pattern', content: 'Key insights: machine learning improvements.' });
    });
  });

  describe('executeResearch', () => {
    it('should execute research task successfully in test environment', async () => {
      const result = await researchAgent.executeResearch(mockInputData);
      
      expect(result).toBeDefined();
      expect(result.session_id).toBe('test-session-123');
      expect(result.orchestration_id).toBe('test-orchestration-456');
      expect(result.query).toBe('Research the latest developments in artificial intelligence');
      expect(result.research_type).toBe('comprehensive');
      expect(result.status).toBe('completed');
      expect(result.result).toContain('Research completed');
      expect(typeof result.research_time_ms).toBe('number');
    });

    it('should handle missing query gracefully', async () => {
      const invalidInput = {
        sessionId: 'test-session',
        task: {}
      };
      
      const result = await researchAgent.executeResearch(invalidInput);
      
      expect(result.status).toBe('error');
      expect(result.error).toContain('Research query is required');
    });

    it('should handle research execution errors', async () => {
      // Mock an error scenario
      const errorInput = {
        sessionId: 'test-session',
        task: {
          query: null // This should cause an error
        }
      };
      
      const result = await researchAgent.executeResearch(errorInput);
      
      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });

    it('should include strategy plan and evaluation in results', async () => {
      const result = await researchAgent.executeResearch(mockInputData);
      
      expect(result.strategy_plan).toBeDefined();
      expect(result.self_evaluation).toBeDefined();
      expect(result.confidence_score).toBeGreaterThanOrEqual(0);
      expect(result.confidence_score).toBeLessThanOrEqual(1);
      expect(result.reasoning_logs).toBeDefined();
    });
  });

  describe('Research Tools', () => {
    it('should initialize research tools correctly', () => {
      const tools = researchAgent.initializeResearchTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('web_search');
      expect(toolNames).toContain('think');
    });
  });

  describe('Input Validation', () => {
    it('should validate research input data correctly', () => {
      const validInput = {
        task: {
          query: 'Valid research query',
          research_type: 'comprehensive'
        }
      };
      
      expect(() => researchAgent.validateResearchInput(validInput)).not.toThrow();
    });

    it('should reject invalid input data', () => {
      const invalidInput = {
        task: {
          // Missing query
          research_type: 'comprehensive'
        }
      };
      
      expect(() => researchAgent.validateResearchInput(invalidInput)).toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should log errors appropriately', async () => {
      const errorInput = {
        sessionId: 'test-session',
        task: {
          query: '' // Empty query should cause validation error
        }
      };
      
      await researchAgent.executeResearch(errorInput);
      
      expect(logger.error).toHaveBeenCalled();
    });

    it('should return structured error responses', async () => {
      const errorInput = {
        sessionId: 'test-session',
        task: {} // Missing required fields
      };
      
      const result = await researchAgent.executeResearch(errorInput);
      
      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
      expect(result.session_id).toBe('test-session');
    });
  });

  describe('Performance', () => {
    it('should complete research within reasonable time', async () => {
      const startTime = Date.now();
      await researchAgent.executeResearch(mockInputData);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds in test mode
    });
  });
});
