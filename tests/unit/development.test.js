// Unit Tests for Development Agent
const { DevelopmentAgent } = require('../../src/agents/DevelopmentAgent');
const { databaseService } = require('../../src/services/database');

// Mock dependencies
jest.mock('../../src/services/database');
jest.mock('../../src/utils/logger');

describe('DevelopmentAgent', () => {
  let developmentAgent;

  beforeEach(() => {
    developmentAgent = new DevelopmentAgent();
    jest.clearAllMocks();
  });

  describe('executeDevelopment', () => {
    it('should execute development task successfully', async () => {
      const inputData = {
        task: {
          requirements: 'Create a simple Node.js API',
          project_type: 'api',
          language: 'javascript'
        },
        sessionId: 'test_session',
        orchestrationId: 'test_orchestration'
      };

      databaseService.createKnowledgeNode.mockResolvedValue({ success: true });
      databaseService.cacheSet.mockResolvedValue({ success: true });

      const result = await developmentAgent.executeDevelopment(inputData);

      expect(result).toBeDefined();
      expect(result.session_id).toBe('test_session');
      expect(result.orchestration_id).toBe('test_orchestration');
      expect(result.status).toBe('completed');
      expect(result.requirements).toBe('Create a simple Node.js API');
      expect(result.project_type).toBe('api');
      expect(result.language).toBe('javascript');
    });

    it('should handle missing requirements', async () => {
      const inputData = {
        task: {},
        sessionId: 'test_session'
      };

      const result = await developmentAgent.executeDevelopment(inputData);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Development requirements are required');
    });

    it('should generate session ID if not provided', async () => {
      const inputData = {
        task: {
          requirements: 'Create a simple web app'
        }
      };

      databaseService.createKnowledgeNode.mockResolvedValue({ success: true });
      databaseService.cacheSet.mockResolvedValue({ success: true });

      const result = await developmentAgent.executeDevelopment(inputData);

      expect(result.session_id).toMatch(/^dev_session_\d+$/);
      expect(result.orchestration_id).toMatch(/^dev_orchestration_\d+$/);
    });
  });

  describe('saveCodeToFile', () => {
    it('should save code to file successfully', async () => {
      const filename = 'test.js';
      const code = 'console.log("Hello World");';
      const language = 'javascript';

      // Mock fs operations
      const fs = require('fs').promises;
      jest.spyOn(fs, 'mkdir').mockResolvedValue();
      jest.spyOn(fs, 'writeFile').mockResolvedValue();

      const result = await developmentAgent.saveCodeToFile(filename, code, language);

      expect(result).toContain('generated');
      expect(result).toContain(filename);
    });
  });

  describe('createProjectStructure', () => {
    it('should create project structure for web app', async () => {
      const projectName = 'test-project';
      const projectType = 'web_app';
      const language = 'javascript';

      // Mock fs operations
      const fs = require('fs').promises;
      jest.spyOn(fs, 'mkdir').mockResolvedValue();
      jest.spyOn(fs, 'writeFile').mockResolvedValue();
      jest.spyOn(developmentAgent, 'fileExists').mockResolvedValue(false);

      const result = await developmentAgent.createProjectStructure(projectName, projectType, language);

      expect(result.project_name).toBe(projectName);
      expect(result.project_type).toBe(projectType);
      expect(result.language).toBe(language);
      expect(result.status).toBe('created');
      expect(result.structure).toContain('src/');
      expect(result.structure).toContain('package.json');
    });
  });

  describe('analyzeCode', () => {
    it('should analyze code quality', async () => {
      const code = 'function test() { return "hello"; }';
      const language = 'javascript';

      const result = await developmentAgent.analyzeCode(code, language);

      expect(result.language).toBe(language);
      expect(result.analysis).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('generateTests', () => {
    it('should generate unit tests', async () => {
      const code = 'function add(a, b) { return a + b; }';
      const language = 'javascript';
      const testFramework = 'jest';

      const result = await developmentAgent.generateTests(code, language, testFramework);

      expect(result.language).toBe(language);
      expect(result.test_framework).toBe(testFramework);
      expect(result.tests).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('generateDocumentation', () => {
    it('should generate API documentation', async () => {
      const code = 'function calculateSum(numbers) { return numbers.reduce((a, b) => a + b, 0); }';
      const language = 'javascript';
      const docType = 'api';

      const result = await developmentAgent.generateDocumentation(code, language, docType);

      expect(result.language).toBe(language);
      expect(result.doc_type).toBe(docType);
      expect(result.documentation).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('executeCodeSafely', () => {
    it('should execute JavaScript code safely', async () => {
      const code = 'console.log("test");';
      const language = 'javascript';

      // Mock exec
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      jest.spyOn(require('child_process'), 'exec').mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: 'test\n', stderr: '' });
      });

      const fs = require('fs').promises;
      jest.spyOn(fs, 'mkdir').mockResolvedValue();
      jest.spyOn(fs, 'writeFile').mockResolvedValue();
      jest.spyOn(fs, 'unlink').mockResolvedValue();

      const result = await developmentAgent.executeCodeSafely(code, language);

      expect(result.language).toBe(language);
      expect(result.status).toBe('success');
    });

    it('should handle unsupported languages', async () => {
      const code = 'print("test")';
      const language = 'ruby';

      const result = await developmentAgent.executeCodeSafely(code, language);

      expect(result.language).toBe(language);
      expect(result.status).toBe('unsupported');
      expect(result.error).toContain('Execution not supported for ruby');
    });
  });

  describe('getTemplateContent', () => {
    it('should return package.json template', () => {
      const filename = 'package.json';
      const projectName = 'test-project';
      const language = 'javascript';

      const content = developmentAgent.getTemplateContent(filename, projectName, language);

      expect(content).toContain(projectName);
      expect(content).toContain('"name"');
      expect(content).toContain('"version"');
    });

    it('should return README.md template', () => {
      const filename = 'README.md';
      const projectName = 'test-project';
      const language = 'javascript';

      const content = developmentAgent.getTemplateContent(filename, projectName, language);

      expect(content).toContain(projectName);
      expect(content).toContain('# test-project');
      expect(content).toContain('Generated by AthenAI');
    });

    it('should return empty string for unknown files', () => {
      const filename = 'unknown.txt';
      const projectName = 'test-project';
      const language = 'javascript';

      const content = developmentAgent.getTemplateContent(filename, projectName, language);

      expect(content).toBe('');
    });
  });
});
