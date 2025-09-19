// CreativeAgent Test Suite
const { CreativeAgent } = require('../../src/agents/CreativeAgent');
const { logger } = require('../../src/utils/logger');

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/progressBroadcaster');
jest.mock('../../src/services/database');
jest.mock('../../src/utils/knowledgeSubstrateHelper');

describe('CreativeAgent', () => {
  let creativeAgent;
  let mockInputData;

  beforeEach(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_API_KEY = 'test-key';
    
    creativeAgent = new CreativeAgent();
    
    mockInputData = {
      sessionId: 'test-session-123',
      orchestrationId: 'test-orchestration-456',
      task: {
        prompt: 'Create a creative story about AI and humanity',
        creative_type: 'storytelling',
        tone: 'inspiring',
        length: 'medium'
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize CreativeAgent with correct properties', () => {
      expect(creativeAgent).toBeDefined();
      expect(creativeAgent.llm).toBeDefined();
      expect(creativeAgent.knowledgeHelper).toBeDefined();
      expect(creativeAgent.reasoning).toBeDefined();
      expect(creativeAgent.name).toBe('CreativeAgent');
      expect(creativeAgent.capabilities).toContain('content-creation');
      expect(creativeAgent.capabilities).toContain('storytelling');
    });

    it('should use OpenRouter when configured', () => {
      process.env.USE_OPENROUTER = 'true';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      
      const agent = new CreativeAgent();
      expect(agent.llm).toBeDefined();
    });
  });

  describe('Knowledge Substrate Integration', () => {
    it('should retrieve knowledge context successfully', async () => {
      const mockContext = {
        domain: 'creative',
        similarResults: [],
        knowledgeEntities: [],
        queryHash: 'test-hash'
      };
      
      creativeAgent.knowledgeHelper.retrieveKnowledgeContext = jest.fn().mockResolvedValue(mockContext);
      
      const result = await creativeAgent.retrieveKnowledgeContext('Creative writing', 'test-session');
      
      expect(result).toEqual(mockContext);
      expect(creativeAgent.knowledgeHelper.retrieveKnowledgeContext).toHaveBeenCalledWith(
        'Creative writing',
        'creative',
        {
          complexity: 'medium',
          filters: { session_id: 'test-session' }
        }
      );
    });

    it('should store creative insights successfully', async () => {
      creativeAgent.knowledgeHelper.storeKnowledgeResults = jest.fn().mockResolvedValue(true);
      
      const result = await creativeAgent.storeCreativeInsights(
        'Story creation',
        'A beautiful story about AI',
        'test-session'
      );
      
      expect(result).toBe(true);
      expect(creativeAgent.knowledgeHelper.storeKnowledgeResults).toHaveBeenCalled();
    });

    it('should extract creative insights correctly', () => {
      const results = 'Creative narrative with emotional depth. Character development shows growth.';
      const insights = creativeAgent.extractCreativeInsights(results);
      
      expect(insights).toHaveLength(2);
      expect(insights[0]).toEqual({ type: 'creative_pattern', content: 'Creative narrative with emotional depth.' });
      expect(insights[1]).toEqual({ type: 'creative_pattern', content: 'Character development shows growth.' });
    });
  });

  describe('executeCreative', () => {
    it('should execute creative task successfully in test environment', async () => {
      const result = await creativeAgent.executeCreative(mockInputData);
      
      expect(result).toBeDefined();
      expect(result.session_id).toBe('test-session-123');
      expect(result.orchestration_id).toBe('test-orchestration-456');
      expect(result.prompt).toBe('Create a creative story about AI and humanity');
      expect(result.creative_type).toBe('storytelling');
      expect(result.status).toBe('completed');
      expect(result.result).toContain('Creative content generated');
      expect(typeof result.creative_time_ms).toBe('number');
    });

    it('should handle missing prompt gracefully', async () => {
      const invalidInput = {
        sessionId: 'test-session',
        task: {}
      };
      
      const result = await creativeAgent.executeCreative(invalidInput);
      
      expect(result.status).toBe('error');
      expect(result.error).toContain('Creative prompt is required');
    });

    it('should include strategy plan and evaluation in results', async () => {
      const result = await creativeAgent.executeCreative(mockInputData);
      
      expect(result.strategy_plan).toBeDefined();
      expect(result.self_evaluation).toBeDefined();
      expect(result.confidence_score).toBeGreaterThanOrEqual(0);
      expect(result.confidence_score).toBeLessThanOrEqual(1);
      expect(result.reasoning_logs).toBeDefined();
    });
  });

  describe('Creative Tools', () => {
    it('should initialize creative tools correctly', () => {
      const tools = creativeAgent.initializeCreativeTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('content_generator');
      expect(toolNames).toContain('tone_analyzer');
      expect(toolNames).toContain('think');
    });
  });

  describe('Content Analysis', () => {
    it('should analyze content structure correctly', () => {
      const content = 'Once upon a time, there was a story. It had a beginning, middle, and end.';
      const analysis = creativeAgent.analyzeContentStructure(content);
      
      expect(analysis).toBeDefined();
      expect(analysis.word_count).toBeGreaterThan(0);
      expect(analysis.sentence_count).toBeGreaterThan(0);
    });

    it('should adapt tone correctly', () => {
      const content = 'This is a neutral message.';
      const adaptedContent = creativeAgent.adaptTone(content, 'inspiring');
      
      expect(adaptedContent).toBeDefined();
      expect(typeof adaptedContent).toBe('string');
    });

    it('should calculate quality metrics', () => {
      const content = 'This is a well-written creative piece with good flow and structure.';
      const metrics = creativeAgent.calculateQualityMetrics(content);
      
      expect(metrics).toBeDefined();
      expect(metrics.creativity_score).toBeGreaterThanOrEqual(0);
      expect(metrics.creativity_score).toBeLessThanOrEqual(1);
      expect(metrics.coherence_score).toBeGreaterThanOrEqual(0);
      expect(metrics.coherence_score).toBeLessThanOrEqual(1);
    });
  });

  describe('Creative Output Processing', () => {
    it('should structure creative output correctly', () => {
      const rawOutput = 'Title: My Story\n\nContent: Once upon a time...';
      const structured = creativeAgent.structureCreativeOutput(rawOutput, 'storytelling');
      
      expect(structured).toBeDefined();
      expect(structured.title).toBeDefined();
      expect(structured.content).toBeDefined();
      expect(structured.type).toBe('storytelling');
    });

    it('should enhance creative content', () => {
      const content = 'A simple story.';
      const enhanced = creativeAgent.enhanceCreativeContent(content, 'storytelling');
      
      expect(enhanced).toBeDefined();
      expect(typeof enhanced).toBe('string');
      expect(enhanced.length).toBeGreaterThanOrEqual(content.length);
    });
  });

  describe('Creative Types', () => {
    it('should handle storytelling creative type', async () => {
      const storyInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          creative_type: 'storytelling'
        }
      };
      
      const result = await creativeAgent.executeCreative(storyInput);
      expect(result.creative_type).toBe('storytelling');
    });

    it('should handle poetry creative type', async () => {
      const poetryInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          creative_type: 'poetry'
        }
      };
      
      const result = await creativeAgent.executeCreative(poetryInput);
      expect(result.creative_type).toBe('poetry');
    });

    it('should handle marketing creative type', async () => {
      const marketingInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          creative_type: 'marketing'
        }
      };
      
      const result = await creativeAgent.executeCreative(marketingInput);
      expect(result.creative_type).toBe('marketing');
    });
  });

  describe('Error Handling', () => {
    it('should handle creative generation errors gracefully', async () => {
      const errorInput = {
        sessionId: 'test-session',
        task: {
          prompt: null // This should cause an error
        }
      };
      
      const result = await creativeAgent.executeCreative(errorInput);
      
      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });

    it('should log errors appropriately', async () => {
      const errorInput = {
        sessionId: 'test-session',
        task: {
          prompt: '' // Empty prompt should cause validation error
        }
      };
      
      await creativeAgent.executeCreative(errorInput);
      
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should complete creative task within reasonable time', async () => {
      const startTime = Date.now();
      await creativeAgent.executeCreative(mockInputData);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds in test mode
    });
  });

  describe('Content Validation', () => {
    it('should validate creative content appropriately', () => {
      const validContent = 'This is a well-structured creative piece with proper flow.';
      const isValid = creativeAgent.validateCreativeContent(validContent);
      
      expect(isValid).toBe(true);
    });

    it('should reject inappropriate content', () => {
      const invalidContent = '';
      const isValid = creativeAgent.validateCreativeContent(invalidContent);
      
      expect(isValid).toBe(false);
    });
  });
});
