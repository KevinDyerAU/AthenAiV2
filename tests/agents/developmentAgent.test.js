// DevelopmentAgent Test Suite
const { DevelopmentAgent } = require('../../src/agents/DevelopmentAgent');
const { logger } = require('../../src/utils/logger');

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/progressBroadcaster');
jest.mock('../../src/services/database');
jest.mock('../../src/utils/knowledgeSubstrateHelper');

describe('DevelopmentAgent', () => {
  let developmentAgent;
  let mockInputData;

  beforeEach(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_API_KEY = 'test-key';
    
    developmentAgent = new DevelopmentAgent();
    
    mockInputData = {
      sessionId: 'test-session-123',
      orchestrationId: 'test-orchestration-456',
      task: {
        requirements: 'Create a simple Node.js REST API with user authentication',
        project_type: 'web-api',
        language: 'javascript'
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize DevelopmentAgent with correct properties', () => {
      expect(developmentAgent).toBeDefined();
      expect(developmentAgent.llm).toBeDefined();
      expect(developmentAgent.knowledgeHelper).toBeDefined();
      expect(developmentAgent.reasoning).toBeDefined();
      expect(developmentAgent.workspaceRoot).toBeDefined();
      expect(developmentAgent.supportedLanguages).toContain('javascript');
      expect(developmentAgent.supportedLanguages).toContain('python');
    });

    it('should use OpenRouter when configured', () => {
      process.env.USE_OPENROUTER = 'true';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      
      const agent = new DevelopmentAgent();
      expect(agent.llm).toBeDefined();
    });
  });

  describe('Knowledge Substrate Integration', () => {
    it('should retrieve knowledge context successfully', async () => {
      const mockContext = {
        domain: 'development',
        similarResults: [],
        knowledgeEntities: [],
        queryHash: 'test-hash'
      };
      
      developmentAgent.knowledgeHelper.retrieveKnowledgeContext = jest.fn().mockResolvedValue(mockContext);
      
      const result = await developmentAgent.retrieveKnowledgeContext('Node.js API development', 'test-session');
      
      expect(result).toEqual(mockContext);
      expect(developmentAgent.knowledgeHelper.retrieveKnowledgeContext).toHaveBeenCalledWith(
        'Node.js API development',
        'development',
        {
          complexity: 'medium',
          filters: { session_id: 'test-session' }
        }
      );
    });

    it('should store development insights successfully', async () => {
      developmentAgent.knowledgeHelper.storeKnowledgeResults = jest.fn().mockResolvedValue(true);
      
      const result = await developmentAgent.storeDevelopmentInsights(
        'API development',
        'Created REST API with authentication',
        'test-session'
      );
      
      expect(result).toBe(true);
      expect(developmentAgent.knowledgeHelper.storeKnowledgeResults).toHaveBeenCalled();
    });

    it('should extract development insights correctly', () => {
      const results = 'Created function getUserById(). Implemented class UserService. Added authentication middleware.';
      const insights = developmentAgent.extractDevelopmentInsights(results);
      
      expect(insights).toHaveLength(3);
      expect(insights[0]).toEqual({ type: 'code_pattern', content: 'Created function getUserById().' });
      expect(insights[1]).toEqual({ type: 'code_pattern', content: 'Implemented class UserService.' });
      expect(insights[2]).toEqual({ type: 'code_pattern', content: 'Added authentication middleware.' });
    });
  });

  describe('executeDevelopment', () => {
    it('should execute development task successfully in test environment', async () => {
      const result = await developmentAgent.executeDevelopment(mockInputData);
      
      expect(result).toBeDefined();
      expect(result.session_id).toBe('test-session-123');
      expect(result.orchestration_id).toBe('test-orchestration-456');
      expect(result.requirements).toBe('Create a simple Node.js REST API with user authentication');
      expect(result.project_type).toBe('web-api');
      expect(result.language).toBe('javascript');
      expect(result.status).toBe('completed');
      expect(result.result).toContain('Development task completed');
      expect(typeof result.development_time_ms).toBe('number');
    });

    it('should handle missing requirements gracefully', async () => {
      const invalidInput = {
        sessionId: 'test-session',
        task: {}
      };
      
      const result = await developmentAgent.executeDevelopment(invalidInput);
      
      expect(result.status).toBe('error');
      expect(result.error).toContain('Development requirements are required');
    });

    it('should include strategy plan and evaluation in results', async () => {
      const result = await developmentAgent.executeDevelopment(mockInputData);
      
      expect(result.strategy_plan).toBeDefined();
      expect(result.self_evaluation).toBeDefined();
      expect(result.confidence_score).toBeGreaterThanOrEqual(0);
      expect(result.confidence_score).toBeLessThanOrEqual(1);
      expect(result.reasoning_logs).toBeDefined();
    });
  });

  describe('Development Tools', () => {
    it('should initialize development tools correctly', () => {
      const tools = developmentAgent.initializeDevelopmentTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('code_generator');
      expect(toolNames).toContain('file_manager');
      expect(toolNames).toContain('think');
    });
  });

  describe('Repository Validation', () => {
    it('should validate GitHub repository URLs', async () => {
      const requirements = 'Clone and modify https://github.com/user/repo';
      const validation = await developmentAgent.validateRepositoryRequest(requirements);
      
      expect(validation).toBeDefined();
      expect(typeof validation.isInvalid).toBe('boolean');
    });

    it('should reject invalid repository URLs', async () => {
      const requirements = 'Clone and modify invalid-url';
      const validation = await developmentAgent.validateRepositoryRequest(requirements);
      
      expect(validation.isInvalid).toBe(true);
      expect(validation.message).toBeDefined();
    });
  });

  describe('Code Generation', () => {
    it('should generate code for different languages', () => {
      const spec = {
        language: 'javascript',
        type: 'function',
        name: 'calculateSum',
        parameters: ['a', 'b']
      };
      
      const code = developmentAgent.generateCode(spec);
      
      expect(code).toBeDefined();
      expect(typeof code).toBe('string');
      expect(code).toContain('calculateSum');
    });

    it('should create project structure', () => {
      const projectSpec = {
        type: 'web-api',
        language: 'javascript',
        features: ['authentication', 'database']
      };
      
      const structure = developmentAgent.createProjectStructure(projectSpec);
      
      expect(structure).toBeDefined();
      expect(Array.isArray(structure.files)).toBe(true);
      expect(structure.files.length).toBeGreaterThan(0);
    });
  });

  describe('File Operations', () => {
    it('should handle file creation operations', async () => {
      const fileSpec = {
        path: 'src/app.js',
        content: 'console.log("Hello World");'
      };
      
      // Mock file operations for testing
      developmentAgent.createFile = jest.fn().mockResolvedValue(true);
      
      const result = await developmentAgent.createFile(fileSpec.path, fileSpec.content);
      
      expect(result).toBe(true);
      expect(developmentAgent.createFile).toHaveBeenCalledWith(fileSpec.path, fileSpec.content);
    });

    it('should handle file modification operations', async () => {
      const modification = {
        path: 'src/app.js',
        changes: 'Add new function'
      };
      
      // Mock file operations for testing
      developmentAgent.modifyFile = jest.fn().mockResolvedValue(true);
      
      const result = await developmentAgent.modifyFile(modification.path, modification.changes);
      
      expect(result).toBe(true);
      expect(developmentAgent.modifyFile).toHaveBeenCalledWith(modification.path, modification.changes);
    });
  });

  describe('Project Types', () => {
    it('should handle web-api project type', async () => {
      const apiInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          project_type: 'web-api'
        }
      };
      
      const result = await developmentAgent.executeDevelopment(apiInput);
      expect(result.project_type).toBe('web-api');
    });

    it('should handle mobile-app project type', async () => {
      const mobileInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          project_type: 'mobile-app'
        }
      };
      
      const result = await developmentAgent.executeDevelopment(mobileInput);
      expect(result.project_type).toBe('mobile-app');
    });

    it('should handle desktop-app project type', async () => {
      const desktopInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          project_type: 'desktop-app'
        }
      };
      
      const result = await developmentAgent.executeDevelopment(desktopInput);
      expect(result.project_type).toBe('desktop-app');
    });
  });

  describe('Error Handling', () => {
    it('should handle development errors gracefully', async () => {
      const errorInput = {
        sessionId: 'test-session',
        task: {
          requirements: null // This should cause an error
        }
      };
      
      const result = await developmentAgent.executeDevelopment(errorInput);
      
      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });

    it('should log errors appropriately', async () => {
      const errorInput = {
        sessionId: 'test-session',
        task: {
          requirements: '' // Empty requirements should cause validation error
        }
      };
      
      await developmentAgent.executeDevelopment(errorInput);
      
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should complete development task within reasonable time', async () => {
      const startTime = Date.now();
      await developmentAgent.executeDevelopment(mockInputData);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds in test mode
    });
  });

  describe('Language Support', () => {
    it('should support JavaScript development', async () => {
      const jsInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          language: 'javascript'
        }
      };
      
      const result = await developmentAgent.executeDevelopment(jsInput);
      expect(result.language).toBe('javascript');
    });

    it('should support Python development', async () => {
      const pythonInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          language: 'python'
        }
      };
      
      const result = await developmentAgent.executeDevelopment(pythonInput);
      expect(result.language).toBe('python');
    });

    it('should support TypeScript development', async () => {
      const tsInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          language: 'typescript'
        }
      };
      
      const result = await developmentAgent.executeDevelopment(tsInput);
      expect(result.language).toBe('typescript');
    });
  });
});
