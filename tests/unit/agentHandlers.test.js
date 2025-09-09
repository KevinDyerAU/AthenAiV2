// Unit Tests for Agent Handlers
const { AgentHandlers } = require('../../src/agents/AgentHandlers');
const { databaseService } = require('../../src/services/database');

// Mock dependencies
jest.mock('../../src/services/database');
jest.mock('../../src/utils/logger');

describe('AgentHandlers', () => {
  let agentHandlers;

  beforeEach(() => {
    agentHandlers = new AgentHandlers();
    jest.clearAllMocks();
  });

  describe('registerAgent', () => {
    it('should register agent successfully', async () => {
      const mockAgent = {
        name: 'TestAgent',
        version: '1.0.0',
        capabilities: ['test', 'mock'],
        execute: jest.fn()
      };

      const result = await agentHandlers.registerAgent('test-agent', mockAgent);

      expect(result.agent_id).toBe('test-agent');
      expect(result.status).toBe('registered');
      expect(result.agent_name).toBe('TestAgent');
      expect(result.capabilities).toEqual(['test', 'mock']);
      expect(agentHandlers.agents.has('test-agent')).toBe(true);
    });

    it('should handle agent registration with minimal info', async () => {
      const mockAgent = {
        execute: jest.fn()
      };

      const result = await agentHandlers.registerAgent('simple-agent', mockAgent);

      expect(result.agent_id).toBe('simple-agent');
      expect(result.status).toBe('registered');
      expect(result.agent_name).toBe('simple-agent');
      expect(result.capabilities).toEqual([]);
    });

    it('should update existing agent registration', async () => {
      const mockAgent1 = { name: 'Agent1', execute: jest.fn() };
      const mockAgent2 = { name: 'Agent2', execute: jest.fn() };

      await agentHandlers.registerAgent('test-agent', mockAgent1);
      const result = await agentHandlers.registerAgent('test-agent', mockAgent2);

      expect(result.status).toBe('updated');
      expect(result.agent_name).toBe('Agent2');
    });
  });

  describe('executeAgent', () => {
    it('should execute agent successfully', async () => {
      const mockAgent = {
        name: 'TestAgent',
        execute: jest.fn().mockResolvedValue({ status: 'success', result: 'test result' })
      };

      await agentHandlers.registerAgent('test-agent', mockAgent);

      const inputData = { task: 'test task', sessionId: 'test-session' };
      const result = await agentHandlers.executeAgent('test-agent', inputData);

      expect(result.agent_id).toBe('test-agent');
      expect(result.status).toBe('completed');
      expect(result.result).toEqual({ status: 'success', result: 'test result' });
      expect(result.execution_time).toBeGreaterThan(0);
      expect(mockAgent.execute).toHaveBeenCalledWith(inputData);
    });

    it('should handle non-existent agent', async () => {
      const inputData = { task: 'test task' };
      const result = await agentHandlers.executeAgent('non-existent', inputData);

      expect(result.agent_id).toBe('non-existent');
      expect(result.status).toBe('failed');
      expect(result.error).toContain('Agent not found');
    });

    it('should handle agent execution failure', async () => {
      const mockAgent = {
        name: 'FailingAgent',
        execute: jest.fn().mockRejectedValue(new Error('Agent execution failed'))
      };

      await agentHandlers.registerAgent('failing-agent', mockAgent);

      const inputData = { task: 'test task' };
      const result = await agentHandlers.executeAgent('failing-agent', inputData);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Agent execution failed');
    });
  });

  describe('executeAgentWithRetry', () => {
    it('should execute agent with retry on failure', async () => {
      let callCount = 0;
      const mockAgent = {
        name: 'RetryAgent',
        execute: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount < 3) {
            throw new Error('Temporary failure');
          }
          return Promise.resolve({ status: 'success', result: 'retry success' });
        })
      };

      await agentHandlers.registerAgent('retry-agent', mockAgent);

      const inputData = { task: 'retry task' };
      const options = { maxRetries: 3, retryDelay: 10 };
      const result = await agentHandlers.executeAgentWithRetry('retry-agent', inputData, options);

      expect(result.status).toBe('completed');
      expect(result.retry_count).toBe(2);
      expect(result.result).toEqual({ status: 'success', result: 'retry success' });
      expect(mockAgent.execute).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const mockAgent = {
        name: 'AlwaysFailingAgent',
        execute: jest.fn().mockRejectedValue(new Error('Persistent failure'))
      };

      await agentHandlers.registerAgent('always-failing', mockAgent);

      const inputData = { task: 'failing task' };
      const options = { maxRetries: 2, retryDelay: 10 };
      const result = await agentHandlers.executeAgentWithRetry('always-failing', inputData, options);

      expect(result.status).toBe('failed');
      expect(result.retry_count).toBe(2);
      expect(result.error).toBe('Persistent failure');
      expect(mockAgent.execute).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('monitorAgentHealth', () => {
    it('should monitor healthy agent', async () => {
      const mockAgent = {
        name: 'HealthyAgent',
        execute: jest.fn().mockResolvedValue({ status: 'success' }),
        healthCheck: jest.fn().mockResolvedValue({ status: 'healthy' })
      };

      await agentHandlers.registerAgent('healthy-agent', mockAgent);

      const result = await agentHandlers.monitorAgentHealth('healthy-agent');

      expect(result.agent_id).toBe('healthy-agent');
      expect(result.health_status).toBe('healthy');
      expect(result.last_execution).toBeDefined();
      expect(result.metrics).toBeDefined();
    });

    it('should handle agent without health check', async () => {
      const mockAgent = {
        name: 'BasicAgent',
        execute: jest.fn()
      };

      await agentHandlers.registerAgent('basic-agent', mockAgent);

      const result = await agentHandlers.monitorAgentHealth('basic-agent');

      expect(result.agent_id).toBe('basic-agent');
      expect(result.health_status).toBe('unknown');
    });

    it('should handle non-existent agent health check', async () => {
      const result = await agentHandlers.monitorAgentHealth('non-existent');

      expect(result.agent_id).toBe('non-existent');
      expect(result.health_status).toBe('not_found');
    });
  });

  describe('getAgentMetrics', () => {
    it('should return agent metrics', async () => {
      const mockAgent = {
        name: 'MetricsAgent',
        execute: jest.fn().mockResolvedValue({ status: 'success' })
      };

      await agentHandlers.registerAgent('metrics-agent', mockAgent);

      // Execute agent a few times to generate metrics
      await agentHandlers.executeAgent('metrics-agent', { task: 'test1' });
      await agentHandlers.executeAgent('metrics-agent', { task: 'test2' });

      const result = await agentHandlers.getAgentMetrics('metrics-agent');

      expect(result.agent_id).toBe('metrics-agent');
      expect(result.total_executions).toBe(2);
      expect(result.successful_executions).toBe(2);
      expect(result.failed_executions).toBe(0);
      expect(result.average_execution_time).toBeGreaterThan(0);
    });

    it('should handle metrics for non-existent agent', async () => {
      const result = await agentHandlers.getAgentMetrics('non-existent');

      expect(result.agent_id).toBe('non-existent');
      expect(result.error).toContain('Agent not found');
    });
  });

  describe('coordinateAgents', () => {
    it('should coordinate multiple agents', async () => {
      const mockAgent1 = {
        name: 'Agent1',
        execute: jest.fn().mockResolvedValue({ status: 'success', data: 'result1' })
      };
      const mockAgent2 = {
        name: 'Agent2',
        execute: jest.fn().mockResolvedValue({ status: 'success', data: 'result2' })
      };

      await agentHandlers.registerAgent('agent1', mockAgent1);
      await agentHandlers.registerAgent('agent2', mockAgent2);

      const coordination = {
        agents: ['agent1', 'agent2'],
        execution_mode: 'parallel',
        shared_context: { project: 'test-project' }
      };

      const result = await agentHandlers.coordinateAgents(coordination);

      expect(result.coordination_id).toMatch(/^coord_\d+$/);
      expect(result.execution_mode).toBe('parallel');
      expect(result.agents_count).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.status).toBe('completed');
    });

    it('should coordinate agents in sequential mode', async () => {
      const mockAgent1 = {
        name: 'Agent1',
        execute: jest.fn().mockResolvedValue({ status: 'success', data: 'result1' })
      };
      const mockAgent2 = {
        name: 'Agent2',
        execute: jest.fn().mockResolvedValue({ status: 'success', data: 'result2' })
      };

      await agentHandlers.registerAgent('agent1', mockAgent1);
      await agentHandlers.registerAgent('agent2', mockAgent2);

      const coordination = {
        agents: ['agent1', 'agent2'],
        execution_mode: 'sequential'
      };

      const result = await agentHandlers.coordinateAgents(coordination);

      expect(result.execution_mode).toBe('sequential');
      expect(result.results).toHaveLength(2);
      expect(result.status).toBe('completed');
    });

    it('should handle coordination with failing agent', async () => {
      const mockAgent1 = {
        name: 'Agent1',
        execute: jest.fn().mockResolvedValue({ status: 'success' })
      };
      const mockAgent2 = {
        name: 'Agent2',
        execute: jest.fn().mockRejectedValue(new Error('Agent2 failed'))
      };

      await agentHandlers.registerAgent('agent1', mockAgent1);
      await agentHandlers.registerAgent('agent2', mockAgent2);

      const coordination = {
        agents: ['agent1', 'agent2'],
        execution_mode: 'parallel'
      };

      const result = await agentHandlers.coordinateAgents(coordination);

      expect(result.status).toBe('partial_failure');
      expect(result.results).toHaveLength(2);
      expect(result.results[0].status).toBe('completed');
      expect(result.results[1].status).toBe('failed');
    });
  });

  describe('balanceLoad', () => {
    it('should balance load across agents', async () => {
      const tasks = [
        { id: 'task1', agent_type: 'worker', priority: 'high' },
        { id: 'task2', agent_type: 'worker', priority: 'normal' },
        { id: 'task3', agent_type: 'worker', priority: 'low' }
      ];

      const availableAgents = ['worker1', 'worker2'];
      const strategy = 'round_robin';

      const result = await agentHandlers.balanceLoad(tasks, availableAgents, strategy);

      expect(result.tasks_count).toBe(3);
      expect(result.available_agents).toBe(2);
      expect(result.strategy).toBe(strategy);
      expect(result.load_distribution).toBeDefined();
      expect(result.assignments).toHaveLength(3);
    });

    it('should handle priority-based load balancing', async () => {
      const tasks = [
        { id: 'task1', priority: 'high' },
        { id: 'task2', priority: 'low' }
      ];

      const availableAgents = ['agent1', 'agent2'];
      const strategy = 'priority';

      const result = await agentHandlers.balanceLoad(tasks, availableAgents, strategy);

      expect(result.strategy).toBe(strategy);
      expect(result.assignments[0].task.priority).toBe('high'); // High priority first
    });
  });

  describe('shutdownAgent', () => {
    it('should shutdown agent gracefully', async () => {
      const mockAgent = {
        name: 'ShutdownAgent',
        execute: jest.fn(),
        shutdown: jest.fn().mockResolvedValue({ status: 'shutdown_complete' })
      };

      await agentHandlers.registerAgent('shutdown-agent', mockAgent);

      const result = await agentHandlers.shutdownAgent('shutdown-agent');

      expect(result.agent_id).toBe('shutdown-agent');
      expect(result.status).toBe('shutdown');
      expect(result.graceful_shutdown).toBe(true);
      expect(agentHandlers.agents.has('shutdown-agent')).toBe(false);
      expect(mockAgent.shutdown).toHaveBeenCalled();
    });

    it('should force shutdown agent without shutdown method', async () => {
      const mockAgent = {
        name: 'BasicAgent',
        execute: jest.fn()
      };

      await agentHandlers.registerAgent('basic-agent', mockAgent);

      const result = await agentHandlers.shutdownAgent('basic-agent', true);

      expect(result.agent_id).toBe('basic-agent');
      expect(result.status).toBe('shutdown');
      expect(result.graceful_shutdown).toBe(false);
      expect(agentHandlers.agents.has('basic-agent')).toBe(false);
    });

    it('should handle shutdown of non-existent agent', async () => {
      const result = await agentHandlers.shutdownAgent('non-existent');

      expect(result.agent_id).toBe('non-existent');
      expect(result.status).toBe('not_found');
    });
  });

  describe('listAgents', () => {
    it('should list all registered agents', async () => {
      const mockAgent1 = { name: 'Agent1', execute: jest.fn() };
      const mockAgent2 = { name: 'Agent2', execute: jest.fn() };

      await agentHandlers.registerAgent('agent1', mockAgent1);
      await agentHandlers.registerAgent('agent2', mockAgent2);

      const result = await agentHandlers.listAgents();

      expect(result.total_agents).toBe(2);
      expect(result.agents).toHaveLength(2);
      expect(result.agents[0].agent_id).toBe('agent1');
      expect(result.agents[1].agent_id).toBe('agent2');
    });

    it('should return empty list when no agents registered', async () => {
      const result = await agentHandlers.listAgents();

      expect(result.total_agents).toBe(0);
      expect(result.agents).toHaveLength(0);
    });
  });

  describe('getSystemStatus', () => {
    it('should return system status', async () => {
      const mockAgent = {
        name: 'TestAgent',
        execute: jest.fn().mockResolvedValue({ status: 'success' })
      };

      await agentHandlers.registerAgent('test-agent', mockAgent);
      await agentHandlers.executeAgent('test-agent', { task: 'test' });

      const result = await agentHandlers.getSystemStatus();

      expect(result.total_agents).toBe(1);
      expect(result.active_agents).toBe(1);
      expect(result.total_executions).toBe(1);
      expect(result.system_health).toBe('healthy');
      expect(result.uptime).toBeGreaterThan(0);
    });
  });
});
