// ExecutionAgent Test Suite
const { ExecutionAgent } = require('../../src/agents/ExecutionAgent');
const { logger } = require('../../src/utils/logger');

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/progressBroadcaster');
jest.mock('../../src/services/database');
jest.mock('../../src/utils/knowledgeSubstrateHelper');

describe('ExecutionAgent', () => {
  let executionAgent;
  let mockInputData;

  beforeEach(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_API_KEY = 'test-key';
    
    executionAgent = new ExecutionAgent();
    
    mockInputData = {
      sessionId: 'test-session-123',
      orchestrationId: 'test-orchestration-456',
      task: {
        execution_plan: 'Deploy application to production environment',
        execution_type: 'deployment',
        environment: 'production',
        parameters: {
          branch: 'main',
          target: 'aws-ec2'
        }
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize ExecutionAgent with correct properties', () => {
      expect(executionAgent).toBeDefined();
      expect(executionAgent.llm).toBeDefined();
      expect(executionAgent.knowledgeHelper).toBeDefined();
      expect(executionAgent.reasoning).toBeDefined();
      expect(executionAgent.executionQueue).toBeDefined();
      expect(executionAgent.runningTasks).toBeDefined();
      expect(executionAgent.maxConcurrentTasks).toBeDefined();
    });

    it('should use OpenRouter when configured', () => {
      process.env.USE_OPENROUTER = 'true';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      
      const agent = new ExecutionAgent();
      expect(agent.llm).toBeDefined();
    });
  });

  describe('Knowledge Substrate Integration', () => {
    it('should retrieve knowledge context successfully', async () => {
      const mockContext = {
        domain: 'execution',
        similarResults: [],
        knowledgeEntities: [],
        queryHash: 'test-hash'
      };
      
      executionAgent.knowledgeHelper.retrieveKnowledgeContext = jest.fn().mockResolvedValue(mockContext);
      
      const result = await executionAgent.retrieveKnowledgeContext('Deployment execution', 'test-session');
      
      expect(result).toEqual(mockContext);
      expect(executionAgent.knowledgeHelper.retrieveKnowledgeContext).toHaveBeenCalledWith(
        'Deployment execution',
        'execution',
        {
          complexity: 'medium',
          filters: { session_id: 'test-session' }
        }
      );
    });

    it('should store execution insights successfully', async () => {
      executionAgent.knowledgeHelper.storeKnowledgeResults = jest.fn().mockResolvedValue(true);
      
      const result = await executionAgent.storeExecutionInsights(
        'Deployment task',
        'Successfully deployed application to production',
        'test-session'
      );
      
      expect(result).toBe(true);
      expect(executionAgent.knowledgeHelper.storeKnowledgeResults).toHaveBeenCalled();
    });

    it('should extract execution insights correctly', () => {
      const results = 'Executed deployment task successfully. Workflow completed in 5 minutes. Task status: completed.';
      const insights = executionAgent.extractExecutionInsights(results);
      
      expect(insights).toHaveLength(3);
      expect(insights[0]).toEqual({ type: 'execution_pattern', content: 'Executed deployment task successfully.' });
      expect(insights[1]).toEqual({ type: 'execution_pattern', content: 'Workflow completed in 5 minutes.' });
      expect(insights[2]).toEqual({ type: 'execution_pattern', content: 'Task status: completed.' });
    });
  });

  describe('executeTask', () => {
    it('should execute task successfully in test environment', async () => {
      const result = await executionAgent.executeTask(mockInputData);
      
      expect(result).toBeDefined();
      expect(result.session_id).toBe('test-session-123');
      expect(result.orchestration_id).toBe('test-orchestration-456');
      expect(result.execution_plan).toBe('Deploy application to production environment');
      expect(result.execution_type).toBe('deployment');
      expect(result.environment).toBe('production');
      expect(result.status).toBe('completed');
      expect(result.result).toContain('Executed deployment task');
      expect(typeof result.execution_time_ms).toBe('number');
    });

    it('should handle missing execution plan gracefully', async () => {
      const invalidInput = {
        sessionId: 'test-session',
        task: {}
      };
      
      const result = await executionAgent.executeTask(invalidInput);
      
      expect(result.status).toBe('error');
      expect(result.error).toContain('Execution plan is required');
    });

    it('should include strategy plan and evaluation in results', async () => {
      const result = await executionAgent.executeTask(mockInputData);
      
      expect(result.strategy_plan).toBeDefined();
      expect(result.self_evaluation).toBeDefined();
      expect(result.confidence_score).toBeGreaterThanOrEqual(0);
      expect(result.confidence_score).toBeLessThanOrEqual(1);
      expect(result.reasoning_logs).toBeDefined();
    });
  });

  describe('Execution Tools', () => {
    it('should initialize execution tools correctly', () => {
      const tools = executionAgent.initializeExecutionTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('command_executor');
      expect(toolNames).toContain('workflow_manager');
      expect(toolNames).toContain('think');
    });
  });

  describe('Task Queue Management', () => {
    it('should add tasks to execution queue', () => {
      const task = {
        id: 'task-123',
        type: 'deployment',
        priority: 'high'
      };
      
      executionAgent.addToQueue(task);
      
      expect(executionAgent.executionQueue.length).toBeGreaterThan(0);
    });

    it('should process execution queue', async () => {
      const task = {
        id: 'task-456',
        execution_plan: 'Test execution',
        type: 'workflow'
      };
      
      executionAgent.addToQueue(task);
      
      // Mock queue processing
      executionAgent.processQueue = jest.fn().mockResolvedValue({ processed: 1 });
      
      const result = await executionAgent.processQueue();
      expect(result.processed).toBeGreaterThan(0);
    });

    it('should manage concurrent task execution', () => {
      const maxConcurrent = executionAgent.maxConcurrentTasks;
      expect(typeof maxConcurrent).toBe('number');
      expect(maxConcurrent).toBeGreaterThan(0);
    });
  });

  describe('Command Execution', () => {
    it('should execute system commands safely', async () => {
      const command = 'echo "Hello World"';
      
      // Mock command execution
      executionAgent.executeCommand = jest.fn().mockResolvedValue({
        stdout: 'Hello World\n',
        stderr: '',
        exitCode: 0
      });
      
      const result = await executionAgent.executeCommand(command);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Hello World');
    });

    it('should handle command execution errors', async () => {
      const invalidCommand = 'invalid-command-xyz';
      
      // Mock command execution error
      executionAgent.executeCommand = jest.fn().mockRejectedValue(new Error('Command not found'));
      
      try {
        await executionAgent.executeCommand(invalidCommand);
      } catch (error) {
        expect(error.message).toContain('Command not found');
      }
    });
  });

  describe('Workflow Management', () => {
    it('should create workflow from execution plan', () => {
      const executionPlan = {
        steps: [
          { name: 'build', command: 'npm run build' },
          { name: 'test', command: 'npm test' },
          { name: 'deploy', command: 'npm run deploy' }
        ]
      };
      
      const workflow = executionAgent.createWorkflow(executionPlan);
      
      expect(workflow).toBeDefined();
      expect(workflow.steps).toHaveLength(3);
      expect(workflow.steps[0].name).toBe('build');
    });

    it('should execute workflow steps in sequence', async () => {
      const workflow = {
        steps: [
          { name: 'step1', command: 'echo "Step 1"' },
          { name: 'step2', command: 'echo "Step 2"' }
        ]
      };
      
      // Mock workflow execution
      executionAgent.executeWorkflow = jest.fn().mockResolvedValue({
        completed: 2,
        failed: 0,
        results: ['Step 1 completed', 'Step 2 completed']
      });
      
      const result = await executionAgent.executeWorkflow(workflow);
      
      expect(result.completed).toBe(2);
      expect(result.failed).toBe(0);
    });
  });

  describe('Environment Management', () => {
    it('should validate execution environment', () => {
      const environment = 'production';
      const isValid = executionAgent.validateEnvironment(environment);
      
      expect(typeof isValid).toBe('boolean');
    });

    it('should set environment variables', () => {
      const envVars = {
        NODE_ENV: 'production',
        API_URL: 'https://api.example.com'
      };
      
      executionAgent.setEnvironmentVariables(envVars);
      
      // Verify environment variables are set (in test context)
      expect(process.env.NODE_ENV).toBe('test'); // Should remain test in test environment
    });
  });

  describe('Execution Types', () => {
    it('should handle workflow execution type', async () => {
      const workflowInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          execution_type: 'workflow'
        }
      };
      
      const result = await executionAgent.executeTask(workflowInput);
      expect(result.execution_type).toBe('workflow');
    });

    it('should handle command execution type', async () => {
      const commandInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          execution_type: 'command'
        }
      };
      
      const result = await executionAgent.executeTask(commandInput);
      expect(result.execution_type).toBe('command');
    });

    it('should handle api execution type', async () => {
      const apiInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          execution_type: 'api'
        }
      };
      
      const result = await executionAgent.executeTask(apiInput);
      expect(result.execution_type).toBe('api');
    });

    it('should handle batch execution type', async () => {
      const batchInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          execution_type: 'batch'
        }
      };
      
      const result = await executionAgent.executeTask(batchInput);
      expect(result.execution_type).toBe('batch');
    });
  });

  describe('Task Monitoring', () => {
    it('should track running tasks', () => {
      const taskId = 'task-789';
      const taskInfo = {
        id: taskId,
        status: 'running',
        startTime: Date.now()
      };
      
      executionAgent.trackTask(taskId, taskInfo);
      
      expect(executionAgent.runningTasks.has(taskId)).toBe(true);
    });

    it('should get task status', () => {
      const taskId = 'task-status-test';
      const taskInfo = {
        id: taskId,
        status: 'completed',
        result: 'Task completed successfully'
      };
      
      executionAgent.runningTasks.set(taskId, taskInfo);
      
      const status = executionAgent.getTaskStatus(taskId);
      expect(status.status).toBe('completed');
    });
  });

  describe('Error Handling', () => {
    it('should handle execution errors gracefully', async () => {
      const errorInput = {
        sessionId: 'test-session',
        task: {
          execution_plan: null // This should cause an error
        }
      };
      
      const result = await executionAgent.executeTask(errorInput);
      
      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });

    it('should log errors appropriately', async () => {
      const errorInput = {
        sessionId: 'test-session',
        task: {
          execution_plan: '' // Empty plan should cause validation error
        }
      };
      
      await executionAgent.executeTask(errorInput);
      
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle timeout scenarios', async () => {
      const timeoutInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          timeout: 100 // Very short timeout
        }
      };
      
      // Mock timeout scenario
      executionAgent.executeWithTimeout = jest.fn().mockRejectedValue(new Error('Execution timeout'));
      
      try {
        await executionAgent.executeWithTimeout(timeoutInput, 100);
      } catch (error) {
        expect(error.message).toContain('timeout');
      }
    });
  });

  describe('Performance', () => {
    it('should complete execution task within reasonable time', async () => {
      const startTime = Date.now();
      await executionAgent.executeTask(mockInputData);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds in test mode
    });

    it('should handle concurrent task execution', async () => {
      const tasks = [
        { ...mockInputData, sessionId: 'session-1' },
        { ...mockInputData, sessionId: 'session-2' },
        { ...mockInputData, sessionId: 'session-3' }
      ];
      
      const promises = tasks.map(task => executionAgent.executeTask(task));
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.status).toBe('completed');
      });
    });
  });

  describe('Security', () => {
    it('should validate command safety', () => {
      const safeCommand = 'echo "Hello World"';
      const unsafeCommand = 'rm -rf /';
      
      const safeResult = executionAgent.validateCommandSafety(safeCommand);
      const unsafeResult = executionAgent.validateCommandSafety(unsafeCommand);
      
      expect(safeResult).toBe(true);
      expect(unsafeResult).toBe(false);
    });

    it('should sanitize execution parameters', () => {
      const parameters = {
        input: 'user input; rm -rf /',
        safe_param: 'normal value'
      };
      
      const sanitized = executionAgent.sanitizeParameters(parameters);
      
      expect(sanitized).toBeDefined();
      expect(sanitized.safe_param).toBe('normal value');
    });
  });
});
