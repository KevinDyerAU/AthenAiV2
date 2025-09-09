// Unit Tests for Execution Agent
const { ExecutionAgent } = require('../../src/agents/ExecutionAgent');
const { databaseService } = require('../../src/services/database');
const { exec } = require('child_process');
const axios = require('axios');

// Mock dependencies
jest.mock('../../src/services/database');
jest.mock('../../src/utils/logger');
jest.mock('child_process');
jest.mock('axios');

describe('ExecutionAgent', () => {
  let executionAgent;

  beforeEach(() => {
    executionAgent = new ExecutionAgent();
    jest.clearAllMocks();
  });

  describe('executeTask', () => {
    it('should execute task successfully', async () => {
      const inputData = {
        task: {
          execution_plan: 'Run deployment script',
          execution_type: 'command',
          environment: 'staging'
        },
        sessionId: 'test_session',
        orchestrationId: 'test_orchestration'
      };

      databaseService.createKnowledgeNode.mockResolvedValue({ success: true });
      databaseService.cacheSet.mockResolvedValue({ success: true });

      const result = await executionAgent.executeTask(inputData);

      expect(result).toBeDefined();
      expect(result.session_id).toBe('test_session');
      expect(result.orchestration_id).toBe('test_orchestration');
      expect(result.status).toBe('completed');
      expect(result.execution_type).toBe('command');
      expect(result.environment).toBe('staging');
    });

    it('should handle missing execution plan', async () => {
      const inputData = {
        task: {},
        sessionId: 'test_session'
      };

      const result = await executionAgent.executeTask(inputData);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Execution plan is required');
    });

    it('should use default values when not provided', async () => {
      const inputData = {
        task: {
          execution_plan: 'Simple task'
        }
      };

      databaseService.createKnowledgeNode.mockResolvedValue({ success: true });
      databaseService.cacheSet.mockResolvedValue({ success: true });

      const result = await executionAgent.executeTask(inputData);

      expect(result.execution_type).toBe('workflow');
      expect(result.environment).toBe('development');
      expect(result.session_id).toMatch(/^exec_session_\d+$/);
    });
  });

  describe('executeCommand', () => {
    it('should execute command successfully', async () => {
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      exec.mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: 'Command executed successfully', stderr: '' });
      });

      const command = 'echo "Hello World"';
      const workingDir = '/tmp';
      const timeout = 5000;

      const result = await executionAgent.executeCommand(command, workingDir, timeout);

      expect(result.command).toBe(command);
      expect(result.working_dir).toBe(workingDir);
      expect(result.status).toBe('success');
      expect(result.exit_code).toBe(0);
    });

    it('should handle command execution failure', async () => {
      exec.mockImplementation((cmd, options, callback) => {
        const error = new Error('Command failed');
        error.code = 1;
        error.stdout = '';
        error.stderr = 'Command not found';
        callback(error);
      });

      const command = 'invalid-command';

      const result = await executionAgent.executeCommand(command);

      expect(result.command).toBe(command);
      expect(result.status).toBe('failed');
      expect(result.exit_code).toBe(1);
      expect(result.stderr).toContain('Command not found');
    });
  });

  describe('executeWorkflow', () => {
    it('should execute workflow with multiple steps', async () => {
      const workflow = {
        steps: [
          { type: 'command', command: 'echo "step 1"', name: 'Step 1' },
          { type: 'command', command: 'echo "step 2"', name: 'Step 2' }
        ]
      };

      exec.mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: 'Step executed', stderr: '' });
      });

      const result = await executionAgent.executeWorkflow(workflow);

      expect(result.workflow_id).toMatch(/^workflow_\d+$/);
      expect(result.total_steps).toBe(2);
      expect(result.completed_steps).toBe(2);
      expect(result.failed_steps).toBe(0);
      expect(result.status).toBe('completed');
      expect(result.results).toHaveLength(2);
    });

    it('should handle workflow step failure', async () => {
      const workflow = {
        steps: [
          { type: 'command', command: 'echo "step 1"', name: 'Step 1' },
          { type: 'command', command: 'invalid-command', name: 'Step 2', stop_on_failure: true }
        ]
      };

      exec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('invalid-command')) {
          callback(new Error('Command failed'));
        } else {
          callback(null, { stdout: 'Step executed', stderr: '' });
        }
      });

      const result = await executionAgent.executeWorkflow(workflow);

      expect(result.status).toBe('failed');
      expect(result.results).toHaveLength(2);
      expect(result.results[0].status).toBe('completed');
      expect(result.results[1].status).toBe('failed');
    });

    it('should continue workflow when stop_on_failure is false', async () => {
      const workflow = {
        steps: [
          { type: 'command', command: 'invalid-command', name: 'Step 1', stop_on_failure: false },
          { type: 'command', command: 'echo "step 2"', name: 'Step 2' }
        ]
      };

      exec.mockImplementation((cmd, options, callback) => {
        if (cmd.includes('invalid-command')) {
          callback(new Error('Command failed'));
        } else {
          callback(null, { stdout: 'Step executed', stderr: '' });
        }
      });

      const result = await executionAgent.executeWorkflow(workflow);

      expect(result.status).toBe('completed');
      expect(result.results).toHaveLength(2);
      expect(result.results[0].status).toBe('failed');
      expect(result.results[1].status).toBe('completed');
    });
  });

  describe('executeApiCall', () => {
    it('should execute API call successfully', async () => {
      const mockResponse = {
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: { message: 'Success' }
      };

      axios.mockResolvedValue(mockResponse);

      const url = 'https://api.example.com/test';
      const method = 'GET';
      const headers = { 'Authorization': 'Bearer token' };

      const result = await executionAgent.executeApiCall(url, method, headers);

      expect(result.url).toBe(url);
      expect(result.method).toBe(method);
      expect(result.status_code).toBe(200);
      expect(result.status).toBe('success');
      expect(result.data).toEqual({ message: 'Success' });
    });

    it('should handle API call failure', async () => {
      const error = new Error('Network error');
      error.response = {
        status: 500,
        data: { error: 'Internal server error' }
      };

      axios.mockRejectedValue(error);

      const url = 'https://api.example.com/test';
      const method = 'POST';

      const result = await executionAgent.executeApiCall(url, method);

      expect(result.url).toBe(url);
      expect(result.method).toBe(method);
      expect(result.status_code).toBe(500);
      expect(result.status).toBe('failed');
      expect(result.error).toBe('Network error');
    });
  });

  describe('executeFileOperations', () => {
    it('should execute file operations successfully', async () => {
      const fs = require('fs').promises;
      jest.spyOn(fs, 'readFile').mockResolvedValue('file content');
      jest.spyOn(fs, 'writeFile').mockResolvedValue();
      jest.spyOn(fs, 'copyFile').mockResolvedValue();
      jest.spyOn(fs, 'unlink').mockResolvedValue();
      jest.spyOn(fs, 'mkdir').mockResolvedValue();

      const operations = [
        { type: 'read', path: '/tmp/test.txt' },
        { type: 'write', path: '/tmp/output.txt', content: 'Hello World' },
        { type: 'copy', source: '/tmp/source.txt', destination: '/tmp/dest.txt' },
        { type: 'delete', path: '/tmp/old.txt' },
        { type: 'mkdir', path: '/tmp/newdir', recursive: true }
      ];

      const result = await executionAgent.executeFileOperations(operations);

      expect(result.total_operations).toBe(5);
      expect(result.successful_operations).toBe(5);
      expect(result.failed_operations).toBe(0);
      expect(result.results).toHaveLength(5);
    });

    it('should handle file operation failures', async () => {
      const fs = require('fs').promises;
      jest.spyOn(fs, 'readFile').mockRejectedValue(new Error('File not found'));

      const operations = [
        { type: 'read', path: '/nonexistent/file.txt' }
      ];

      const result = await executionAgent.executeFileOperations(operations);

      expect(result.total_operations).toBe(1);
      expect(result.successful_operations).toBe(0);
      expect(result.failed_operations).toBe(1);
      expect(result.results[0].status).toBe('failed');
      expect(result.results[0].error).toBe('File not found');
    });
  });

  describe('manageTaskQueue', () => {
    it('should add task to queue', async () => {
      const result = await executionAgent.manageTaskQueue('add', 'task-123', 'high');

      expect(result.action).toBe('add');
      expect(result.task_id).toBe('task-123');
      expect(result.queue_length).toBe(1);
    });

    it('should remove task from queue', async () => {
      await executionAgent.manageTaskQueue('add', 'task-123', 'normal');
      const result = await executionAgent.manageTaskQueue('remove', 'task-123');

      expect(result.action).toBe('remove');
      expect(result.task_id).toBe('task-123');
      expect(result.queue_length).toBe(0);
    });

    it('should list queue contents', async () => {
      await executionAgent.manageTaskQueue('add', 'task-1', 'high');
      await executionAgent.manageTaskQueue('add', 'task-2', 'normal');

      const result = await executionAgent.manageTaskQueue('list');

      expect(result.queue_length).toBe(2);
      expect(result.running_tasks).toBe(0);
      expect(result.queue).toHaveLength(2);
      expect(result.queue[0].priority).toBe('high'); // High priority first
    });

    it('should clear queue', async () => {
      await executionAgent.manageTaskQueue('add', 'task-1', 'normal');
      await executionAgent.manageTaskQueue('add', 'task-2', 'normal');

      const result = await executionAgent.manageTaskQueue('clear');

      expect(result.action).toBe('clear');
      expect(result.queue_length).toBe(0);
    });
  });

  describe('monitorProgress', () => {
    it('should return not found for non-existent task', async () => {
      const result = await executionAgent.monitorProgress('non-existent-task');

      expect(result.task_id).toBe('non-existent-task');
      expect(result.status).toBe('not_found');
    });

    it('should return task progress when task exists', async () => {
      const taskId = 'test-task';
      const mockTask = {
        status: 'running',
        progress: 50,
        start_time: Date.now() - 10000,
        checkpoints: ['started', 'halfway']
      };

      executionAgent.runningTasks.set(taskId, mockTask);

      const result = await executionAgent.monitorProgress(taskId);

      expect(result.task_id).toBe(taskId);
      expect(result.status).toBe('running');
      expect(result.progress).toBe(50);
      expect(result.checkpoints).toEqual(['started', 'halfway']);
      expect(result.elapsed_time).toBeGreaterThan(0);
    });
  });

  describe('handleErrorRecovery', () => {
    it('should attempt error recovery with retries', async () => {
      const error = 'timeout error occurred';
      const context = { operation: 'api_call' };
      const retryStrategy = { max_retries: 2, retry_delay: 100 };

      jest.spyOn(executionAgent, 'recoverFromTimeout').mockResolvedValue({ recovery_type: 'timeout', action: 'increased_timeout' });

      const result = await executionAgent.handleErrorRecovery(error, context, retryStrategy);

      expect(result.error).toBe(error);
      expect(result.recovery_attempt).toBe(1);
      expect(result.status).toBe('recovered');
    });

    it('should fail after max retries', async () => {
      const error = 'persistent error';
      const context = {};
      const retryStrategy = { max_retries: 1, retry_delay: 10 };

      jest.spyOn(executionAgent, 'genericErrorRecovery').mockRejectedValue(new Error('Recovery failed'));

      const result = await executionAgent.handleErrorRecovery(error, context, retryStrategy);

      expect(result.error).toBe(error);
      expect(result.recovery_attempts).toBe(1);
      expect(result.status).toBe('failed');
    });
  });

  describe('manageResources', () => {
    it('should manage memory resources', async () => {
      const result = await executionAgent.manageResources('memory', 'check');

      expect(result.resource_type).toBe('memory');
      expect(result.action).toBe('check');
      expect(result.current_usage).toBeDefined();
    });

    it('should manage CPU resources', async () => {
      const result = await executionAgent.manageResources('cpu', 'monitor');

      expect(result.resource_type).toBe('cpu');
      expect(result.action).toBe('monitor');
      expect(result.current_load).toBeDefined();
    });

    it('should handle unknown resource types', async () => {
      const result = await executionAgent.manageResources('unknown', 'check');

      expect(result.resource_type).toBe('unknown');
      expect(result.error).toContain('Unknown resource type');
    });
  });
});
