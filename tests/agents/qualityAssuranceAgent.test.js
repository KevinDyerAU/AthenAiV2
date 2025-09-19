// QualityAssuranceAgent Test Suite
const { QualityAssuranceAgent } = require('../../src/agents/QualityAssuranceAgent');
const { logger } = require('../../src/utils/logger');

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/progressBroadcaster');
jest.mock('../../src/services/database');
jest.mock('../../src/utils/knowledgeSubstrateHelper');
jest.mock('../../src/utils/semanticSimilarity');

describe('QualityAssuranceAgent', () => {
  let qaAgent;
  let mockInputData;

  beforeEach(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_API_KEY = 'test-key';
    
    qaAgent = new QualityAssuranceAgent();
    
    mockInputData = {
      sessionId: 'test-session-123',
      orchestrationId: 'test-orchestration-456',
      task: {
        content: 'This is sample content for quality assurance testing.',
        qa_type: 'comprehensive',
        standards: {
          accuracy: 0.95,
          completeness: 0.90,
          clarity: 0.85
        }
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize QualityAssuranceAgent with correct properties', () => {
      expect(qaAgent).toBeDefined();
      expect(qaAgent.llm).toBeDefined();
      expect(qaAgent.knowledgeHelper).toBeDefined();
      expect(qaAgent.reasoning).toBeDefined();
      expect(qaAgent.testSuites).toBeDefined();
      expect(qaAgent.qualityMetrics).toBeDefined();
      expect(qaAgent.qualityStandards).toBeDefined();
      expect(qaAgent.qualityStandards.accuracy).toBe(0.95);
    });

    it('should use OpenRouter when configured', () => {
      process.env.USE_OPENROUTER = 'true';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      
      const agent = new QualityAssuranceAgent();
      expect(agent.llm).toBeDefined();
    });
  });

  describe('Knowledge Substrate Integration', () => {
    it('should retrieve knowledge context successfully', async () => {
      const mockContext = {
        domain: 'quality_assurance',
        similarResults: [],
        knowledgeEntities: [],
        queryHash: 'test-hash'
      };
      
      qaAgent.knowledgeHelper.retrieveKnowledgeContext = jest.fn().mockResolvedValue(mockContext);
      
      const result = await qaAgent.retrieveKnowledgeContext('Quality assessment', 'test-session');
      
      expect(result).toEqual(mockContext);
      expect(qaAgent.knowledgeHelper.retrieveKnowledgeContext).toHaveBeenCalledWith(
        'Quality assessment',
        'quality_assurance',
        {
          complexity: 'medium',
          filters: { session_id: 'test-session' }
        }
      );
    });

    it('should store QA insights successfully', async () => {
      qaAgent.knowledgeHelper.storeKnowledgeResults = jest.fn().mockResolvedValue(true);
      
      const result = await qaAgent.storeQAInsights(
        'Quality assessment',
        'Quality check passed with 95% accuracy',
        'test-session'
      );
      
      expect(result).toBe(true);
      expect(qaAgent.knowledgeHelper.storeKnowledgeResults).toHaveBeenCalled();
    });

    it('should extract QA insights correctly', () => {
      const results = 'Quality check shows good validation. Test coverage is adequate. Performance meets standards.';
      const insights = qaAgent.extractQAInsights(results);
      
      expect(insights).toHaveLength(3);
      expect(insights[0]).toEqual({ type: 'qa_pattern', content: 'Quality check shows good validation.' });
      expect(insights[1]).toEqual({ type: 'qa_pattern', content: 'Test coverage is adequate.' });
      expect(insights[2]).toEqual({ type: 'qa_pattern', content: 'Performance meets standards.' });
    });
  });

  describe('executeQualityAssurance', () => {
    it('should execute QA task successfully in test environment', async () => {
      const result = await qaAgent.executeQualityAssurance(mockInputData);
      
      expect(result).toBeDefined();
      expect(result.session_id).toBe('test-session-123');
      expect(result.orchestration_id).toBe('test-orchestration-456');
      expect(result.content).toBe('This is sample content for quality assurance testing.');
      expect(result.qa_type).toBe('comprehensive');
      expect(result.status).toBe('completed');
      expect(result.result).toContain('Quality assurance completed');
      expect(typeof result.qa_time_ms).toBe('number');
    });

    it('should handle missing content gracefully', async () => {
      const invalidInput = {
        sessionId: 'test-session',
        task: {}
      };
      
      const result = await qaAgent.executeQualityAssurance(invalidInput);
      
      expect(result.status).toBe('error');
      expect(result.error).toContain('Content for quality assurance is required');
    });

    it('should include strategy plan and evaluation in results', async () => {
      const result = await qaAgent.executeQualityAssurance(mockInputData);
      
      expect(result.strategy_plan).toBeDefined();
      expect(result.self_evaluation).toBeDefined();
      expect(result.confidence_score).toBeGreaterThanOrEqual(0);
      expect(result.confidence_score).toBeLessThanOrEqual(1);
      expect(result.reasoning_logs).toBeDefined();
    });
  });

  describe('Quality Assessment Tools', () => {
    it('should initialize QA tools correctly', () => {
      const tools = qaAgent.initializeQATools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('content_validator');
      expect(toolNames).toContain('quality_checker');
      expect(toolNames).toContain('think');
    });
  });

  describe('Quality Metrics', () => {
    it('should calculate accuracy score', () => {
      const content = 'This is accurate and well-structured content.';
      const score = qaAgent.calculateAccuracyScore(content);
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should calculate completeness score', () => {
      const content = 'This content covers all required aspects thoroughly.';
      const score = qaAgent.calculateCompletenessScore(content);
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should calculate clarity score', () => {
      const content = 'This content is clear, concise, and easy to understand.';
      const score = qaAgent.calculateClarityScore(content);
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should calculate overall quality score', () => {
      const metrics = {
        accuracy: 0.95,
        completeness: 0.90,
        clarity: 0.85,
        relevance: 0.88,
        consistency: 0.92
      };
      
      const overallScore = qaAgent.calculateOverallQualityScore(metrics);
      
      expect(overallScore).toBeGreaterThanOrEqual(0);
      expect(overallScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Content Validation', () => {
    it('should validate content structure', () => {
      const content = 'Title: Test\n\nContent: This is well-structured content with proper formatting.';
      const validation = qaAgent.validateContentStructure(content);
      
      expect(validation).toBeDefined();
      expect(validation.hasTitle).toBe(true);
      expect(validation.hasContent).toBe(true);
    });

    it('should check grammar and spelling', () => {
      const content = 'This is a well-written sentence with proper grammar.';
      const check = qaAgent.checkGrammarAndSpelling(content);
      
      expect(check).toBeDefined();
      expect(check.grammarScore).toBeGreaterThanOrEqual(0);
      expect(check.spellingScore).toBeGreaterThanOrEqual(0);
    });

    it('should validate content against standards', () => {
      const content = 'High-quality content that meets all standards.';
      const standards = qaAgent.qualityStandards;
      const validation = qaAgent.validateAgainstStandards(content, standards);
      
      expect(validation).toBeDefined();
      expect(validation.passed).toBeDefined();
      expect(validation.scores).toBeDefined();
    });
  });

  describe('Test Suite Management', () => {
    it('should create test suite for content', () => {
      const content = 'Sample content for testing';
      const testSuite = qaAgent.createTestSuite(content, 'comprehensive');
      
      expect(testSuite).toBeDefined();
      expect(Array.isArray(testSuite.tests)).toBe(true);
      expect(testSuite.tests.length).toBeGreaterThan(0);
    });

    it('should run test suite and return results', async () => {
      const testSuite = {
        tests: [
          { name: 'accuracy_test', type: 'accuracy' },
          { name: 'completeness_test', type: 'completeness' }
        ]
      };
      
      const results = await qaAgent.runTestSuite(testSuite, 'sample content');
      
      expect(results).toBeDefined();
      expect(Array.isArray(results.testResults)).toBe(true);
      expect(results.overallScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GitHub Repository Analysis', () => {
    it('should analyze GitHub repository quality', async () => {
      const repoUrl = 'https://github.com/user/repo';
      
      // Mock GitHub data fetching
      qaAgent.fetchGitHubRepoData = jest.fn().mockResolvedValue({
        name: 'test-repo',
        description: 'Test repository',
        readme: 'This is a test README',
        hasTests: true,
        hasDocumentation: true
      });
      
      const analysis = await qaAgent.analyzeGitHubRepo(repoUrl);
      
      expect(analysis).toBeDefined();
      expect(analysis.qualityScore).toBeGreaterThanOrEqual(0);
      expect(analysis.qualityScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Performance Testing', () => {
    it('should measure content processing performance', async () => {
      const content = 'Sample content for performance testing';
      const startTime = Date.now();
      
      await qaAgent.processContent(content);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(1000); // Should process within 1 second
    });
  });

  describe('Error Handling', () => {
    it('should handle QA errors gracefully', async () => {
      const errorInput = {
        sessionId: 'test-session',
        task: {
          content: null // This should cause an error
        }
      };
      
      const result = await qaAgent.executeQualityAssurance(errorInput);
      
      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });

    it('should log errors appropriately', async () => {
      const errorInput = {
        sessionId: 'test-session',
        task: {
          content: '' // Empty content should cause validation error
        }
      };
      
      await qaAgent.executeQualityAssurance(errorInput);
      
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('QA Types', () => {
    it('should handle comprehensive QA type', async () => {
      const comprehensiveInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          qa_type: 'comprehensive'
        }
      };
      
      const result = await qaAgent.executeQualityAssurance(comprehensiveInput);
      expect(result.qa_type).toBe('comprehensive');
    });

    it('should handle basic QA type', async () => {
      const basicInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          qa_type: 'basic'
        }
      };
      
      const result = await qaAgent.executeQualityAssurance(basicInput);
      expect(result.qa_type).toBe('basic');
    });

    it('should handle security QA type', async () => {
      const securityInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          qa_type: 'security'
        }
      };
      
      const result = await qaAgent.executeQualityAssurance(securityInput);
      expect(result.qa_type).toBe('security');
    });
  });

  describe('Performance', () => {
    it('should complete QA task within reasonable time', async () => {
      const startTime = Date.now();
      await qaAgent.executeQualityAssurance(mockInputData);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds in test mode
    });
  });
});
