// AnalysisAgent Test Suite
const { AnalysisAgent } = require('../../src/agents/AnalysisAgent');
const { logger } = require('../../src/utils/logger');

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/progressBroadcaster');
jest.mock('../../src/services/database');
jest.mock('../../src/utils/knowledgeSubstrateHelper');

describe('AnalysisAgent', () => {
  let analysisAgent;
  let mockInputData;

  beforeEach(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_API_KEY = 'test-key';
    
    analysisAgent = new AnalysisAgent();
    
    mockInputData = {
      sessionId: 'test-session-123',
      orchestrationId: 'test-orchestration-456',
      task: {
        data: 'Sample data for analysis: [1,2,3,4,5]',
        analysis_type: 'statistical',
        depth: 'comprehensive'
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize AnalysisAgent with correct properties', () => {
      expect(analysisAgent).toBeDefined();
      expect(analysisAgent.llm).toBeDefined();
      expect(analysisAgent.knowledgeHelper).toBeDefined();
      expect(analysisAgent.reasoning).toBeDefined();
      expect(analysisAgent.name).toBe('AnalysisAgent');
      expect(analysisAgent.capabilities).toContain('statistical-analysis');
      expect(analysisAgent.capabilities).toContain('pattern-detection');
    });

    it('should use OpenRouter when configured', () => {
      process.env.USE_OPENROUTER = 'true';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      
      const agent = new AnalysisAgent();
      expect(agent.llm).toBeDefined();
    });
  });

  describe('Knowledge Substrate Integration', () => {
    it('should retrieve knowledge context successfully', async () => {
      const mockContext = {
        domain: 'analysis',
        similarResults: [],
        knowledgeEntities: [],
        queryHash: 'test-hash'
      };
      
      analysisAgent.knowledgeHelper.retrieveKnowledgeContext = jest.fn().mockResolvedValue(mockContext);
      
      const result = await analysisAgent.retrieveKnowledgeContext('Statistical analysis', 'test-session');
      
      expect(result).toEqual(mockContext);
      expect(analysisAgent.knowledgeHelper.retrieveKnowledgeContext).toHaveBeenCalledWith(
        'Statistical analysis',
        'analysis',
        {
          complexity: 'medium',
          filters: { session_id: 'test-session' }
        }
      );
    });

    it('should store analysis insights successfully', async () => {
      analysisAgent.knowledgeHelper.storeKnowledgeResults = jest.fn().mockResolvedValue(true);
      
      const result = await analysisAgent.storeAnalysisInsights(
        'Data analysis',
        'Analysis results showing trends',
        'test-session'
      );
      
      expect(result).toBe(true);
      expect(analysisAgent.knowledgeHelper.storeKnowledgeResults).toHaveBeenCalled();
    });

    it('should extract analysis insights correctly', () => {
      const results = 'Analysis shows patterns in data. Statistical significance found. Trends indicate growth.';
      const insights = analysisAgent.extractAnalysisInsights(results);
      
      expect(insights).toHaveLength(3);
      expect(insights[0]).toEqual({ type: 'analysis_pattern', content: 'Analysis shows patterns in data.' });
      expect(insights[1]).toEqual({ type: 'analysis_pattern', content: 'Statistical significance found.' });
      expect(insights[2]).toEqual({ type: 'analysis_pattern', content: 'Trends indicate growth.' });
    });
  });

  describe('executeAnalysis', () => {
    it('should execute analysis task successfully in test environment', async () => {
      const result = await analysisAgent.executeAnalysis(mockInputData);
      
      expect(result).toBeDefined();
      expect(result.session_id).toBe('test-session-123');
      expect(result.orchestration_id).toBe('test-orchestration-456');
      expect(result.data).toBe('Sample data for analysis: [1,2,3,4,5]');
      expect(result.analysis_type).toBe('statistical');
      expect(result.status).toBe('completed');
      expect(result.result).toContain('Analysis completed');
      expect(typeof result.analysis_time_ms).toBe('number');
    });

    it('should handle missing data gracefully', async () => {
      const invalidInput = {
        sessionId: 'test-session',
        task: {}
      };
      
      const result = await analysisAgent.executeAnalysis(invalidInput);
      
      expect(result.status).toBe('error');
      expect(result.error).toContain('Analysis data is required');
    });

    it('should include strategy plan and evaluation in results', async () => {
      const result = await analysisAgent.executeAnalysis(mockInputData);
      
      expect(result.strategy_plan).toBeDefined();
      expect(result.self_evaluation).toBeDefined();
      expect(result.confidence_score).toBeGreaterThanOrEqual(0);
      expect(result.confidence_score).toBeLessThanOrEqual(1);
      expect(result.reasoning_logs).toBeDefined();
    });
  });

  describe('Analysis Tools', () => {
    it('should initialize analysis tools correctly', () => {
      const tools = analysisAgent.initializeAnalysisTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('statistical_analysis');
      expect(toolNames).toContain('pattern_detection');
      expect(toolNames).toContain('think');
    });
  });

  describe('Statistical Analysis Methods', () => {
    it('should calculate mean correctly', () => {
      const data = [1, 2, 3, 4, 5];
      const mean = analysisAgent.calculateMean(data);
      expect(mean).toBe(3);
    });

    it('should calculate standard deviation correctly', () => {
      const data = [1, 2, 3, 4, 5];
      const stdDev = analysisAgent.calculateStandardDeviation(data);
      expect(stdDev).toBeCloseTo(1.58, 2);
    });

    it('should detect patterns in data', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const patterns = analysisAgent.detectPatterns(data);
      expect(patterns).toBeDefined();
      expect(patterns.trend).toBe('increasing');
    });

    it('should calculate correlation between datasets', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      const correlation = analysisAgent.calculateCorrelation(x, y);
      expect(correlation).toBeCloseTo(1, 2);
    });
  });

  describe('GitHub Analysis', () => {
    it('should analyze GitHub repository data', async () => {
      const mockRepoData = {
        name: 'test-repo',
        stars: 100,
        forks: 50,
        issues: 10
      };
      
      analysisAgent.fetchGitHubData = jest.fn().mockResolvedValue(mockRepoData);
      
      const analysis = await analysisAgent.analyzeGitHubRepo('owner/repo');
      
      expect(analysis).toBeDefined();
      expect(analysis.name).toBe('test-repo');
      expect(analysis.popularity_score).toBeDefined();
    });
  });

  describe('Result Extraction', () => {
    it('should extract executive summary', () => {
      const results = 'Executive Summary: Data shows positive trends. Key findings include growth patterns.';
      const summary = analysisAgent.extractExecutiveSummary(results);
      
      expect(summary).toContain('Data shows positive trends');
    });

    it('should extract key findings', () => {
      const results = 'Key findings: 1. Growth rate is 15%. 2. User engagement increased.';
      const findings = analysisAgent.extractKeyFindings(results);
      
      expect(findings).toHaveLength(2);
      expect(findings[0]).toContain('Growth rate is 15%');
    });

    it('should extract recommendations', () => {
      const results = 'Recommendations: 1. Increase marketing budget. 2. Improve user experience.';
      const recommendations = analysisAgent.extractRecommendations(results);
      
      expect(recommendations).toHaveLength(2);
      expect(recommendations[0]).toContain('Increase marketing budget');
    });
  });

  describe('Error Handling', () => {
    it('should handle analysis errors gracefully', async () => {
      const errorInput = {
        sessionId: 'test-session',
        task: {
          data: null // This should cause an error
        }
      };
      
      const result = await analysisAgent.executeAnalysis(errorInput);
      
      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });

    it('should create error responses for failed analysis', () => {
      const error = new Error('Analysis failed');
      const errorResponse = analysisAgent.createErrorResponse('test-session', 'test-orchestration', error);
      
      expect(errorResponse.status).toBe('error');
      expect(errorResponse.error).toContain('Analysis failed');
      expect(errorResponse.session_id).toBe('test-session');
    });
  });

  describe('Performance', () => {
    it('should complete analysis within reasonable time', async () => {
      const startTime = Date.now();
      await analysisAgent.executeAnalysis(mockInputData);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds in test mode
    });
  });
});
