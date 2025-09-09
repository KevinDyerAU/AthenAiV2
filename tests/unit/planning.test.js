// Unit Tests for Planning Agent
const { PlanningAgent } = require('../../src/agents/PlanningAgent');
const { databaseService } = require('../../src/services/database');

// Mock dependencies
jest.mock('../../src/services/database');
jest.mock('../../src/utils/logger');

describe('PlanningAgent', () => {
  let planningAgent;

  beforeEach(() => {
    planningAgent = new PlanningAgent();
    jest.clearAllMocks();
  });

  describe('executePlanning', () => {
    it('should execute planning task successfully', async () => {
      const inputData = {
        task: {
          objective: 'Build a web application',
          planning_type: 'project',
          constraints: { budget: 10000, timeline: '3 months' },
          resources: { developers: 2, designers: 1 }
        },
        sessionId: 'test_session',
        orchestrationId: 'test_orchestration'
      };

      databaseService.createKnowledgeNode.mockResolvedValue({ success: true });
      databaseService.cacheSet.mockResolvedValue({ success: true });

      const result = await planningAgent.executePlanning(inputData);

      expect(result).toBeDefined();
      expect(result.session_id).toBe('test_session');
      expect(result.orchestration_id).toBe('test_orchestration');
      expect(result.status).toBe('completed');
      expect(result.objective).toBe('Build a web application');
      expect(result.planning_type).toBe('project');
    });

    it('should handle missing objective', async () => {
      const inputData = {
        task: {},
        sessionId: 'test_session'
      };

      const result = await planningAgent.executePlanning(inputData);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Planning objective is required');
    });

    it('should use default values when not provided', async () => {
      const inputData = {
        task: {
          objective: 'Create a mobile app'
        }
      };

      databaseService.createKnowledgeNode.mockResolvedValue({ success: true });
      databaseService.cacheSet.mockResolvedValue({ success: true });

      const result = await planningAgent.executePlanning(inputData);

      expect(result.planning_type).toBe('project');
      expect(result.timeline).toBe('flexible');
      expect(result.session_id).toMatch(/^plan_session_\d+$/);
    });
  });

  describe('breakDownTasks', () => {
    it('should break down complex objective into tasks', async () => {
      const objective = 'Develop an e-commerce website';
      const complexity = 'high';
      const granularity = 'detailed';

      const result = await planningAgent.breakDownTasks(objective, complexity, granularity);

      expect(result.objective).toBe(objective);
      expect(result.complexity).toBe(complexity);
      expect(result.granularity).toBe(granularity);
      expect(result.breakdown).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should use default complexity and granularity', async () => {
      const objective = 'Create a blog website';

      const result = await planningAgent.breakDownTasks(objective);

      expect(result.complexity).toBe('medium');
      expect(result.granularity).toBe('detailed');
    });
  });

  describe('createTimeline', () => {
    it('should create timeline with tasks and constraints', async () => {
      const tasks = [
        { name: 'Design UI', duration: '2 weeks' },
        { name: 'Develop backend', duration: '4 weeks' }
      ];
      const constraints = { deadline: '2024-06-01' };
      const resources = { developers: 2 };

      const result = await planningAgent.createTimeline(tasks, constraints, resources);

      expect(result.tasks).toEqual(tasks);
      expect(result.constraints).toEqual(constraints);
      expect(result.resources).toEqual(resources);
      expect(result.timeline).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should handle empty constraints and resources', async () => {
      const tasks = [{ name: 'Simple task', duration: '1 week' }];

      const result = await planningAgent.createTimeline(tasks);

      expect(result.constraints).toEqual({});
      expect(result.resources).toEqual({});
    });
  });

  describe('planResources', () => {
    it('should plan resource allocation', async () => {
      const tasks = [
        { name: 'Frontend development', skills: ['React', 'CSS'] },
        { name: 'Backend development', skills: ['Node.js', 'Database'] }
      ];
      const availableResources = {
        developers: [
          { name: 'John', skills: ['React', 'Node.js'] },
          { name: 'Jane', skills: ['CSS', 'Database'] }
        ]
      };
      const budget = 50000;

      const result = await planningAgent.planResources(tasks, availableResources, budget);

      expect(result.tasks).toEqual(tasks);
      expect(result.available_resources).toEqual(availableResources);
      expect(result.budget).toBe(budget);
      expect(result.resource_plan).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should handle null budget', async () => {
      const tasks = [{ name: 'Task 1' }];
      const availableResources = {};

      const result = await planningAgent.planResources(tasks, availableResources, null);

      expect(result.budget).toBeNull();
    });
  });

  describe('assessRisks', () => {
    it('should assess project risks', async () => {
      const plan = { phases: ['Design', 'Development', 'Testing'] };
      const context = { industry: 'fintech', complexity: 'high' };
      const riskTolerance = 'low';

      const result = await planningAgent.assessRisks(plan, context, riskTolerance);

      expect(result.plan).toEqual(plan);
      expect(result.context).toEqual(context);
      expect(result.risk_tolerance).toBe(riskTolerance);
      expect(result.risk_assessment).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should use default risk tolerance', async () => {
      const plan = { tasks: ['Task 1'] };

      const result = await planningAgent.assessRisks(plan);

      expect(result.risk_tolerance).toBe('medium');
      expect(result.context).toEqual({});
    });
  });

  describe('analyzeCriticalPath', () => {
    it('should analyze critical path', async () => {
      const tasks = [
        { id: 1, name: 'Task A', duration: 5 },
        { id: 2, name: 'Task B', duration: 3 }
      ];
      const dependencies = [{ from: 1, to: 2 }];
      const timeline = { start: '2024-01-01', end: '2024-03-01' };

      const result = await planningAgent.analyzeCriticalPath(tasks, dependencies, timeline);

      expect(result.tasks).toEqual(tasks);
      expect(result.dependencies).toEqual(dependencies);
      expect(result.timeline).toEqual(timeline);
      expect(result.critical_path_analysis).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('createMilestones', () => {
    it('should create project milestones', async () => {
      const objective = 'Launch mobile app';
      const timeline = { duration: '6 months' };
      const stakeholders = ['Product Manager', 'Development Team', 'QA Team'];

      const result = await planningAgent.createMilestones(objective, timeline, stakeholders);

      expect(result.objective).toBe(objective);
      expect(result.timeline).toEqual(timeline);
      expect(result.stakeholders).toEqual(stakeholders);
      expect(result.milestones).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should handle empty stakeholders', async () => {
      const objective = 'Complete project';
      const timeline = { duration: '3 months' };

      const result = await planningAgent.createMilestones(objective, timeline);

      expect(result.stakeholders).toEqual([]);
    });
  });

  describe('createContingencyPlans', () => {
    it('should create contingency plans', async () => {
      const plan = { phases: ['Phase 1', 'Phase 2'] };
      const risks = [
        { type: 'technical', probability: 'medium', impact: 'high' },
        { type: 'resource', probability: 'low', impact: 'medium' }
      ];
      const scenarios = ['Best case', 'Worst case', 'Most likely'];

      const result = await planningAgent.createContingencyPlans(plan, risks, scenarios);

      expect(result.main_plan).toEqual(plan);
      expect(result.risks).toEqual(risks);
      expect(result.scenarios).toEqual(scenarios);
      expect(result.contingency_plans).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should handle empty scenarios', async () => {
      const plan = { tasks: ['Task 1'] };
      const risks = [{ type: 'budget', impact: 'high' }];

      const result = await planningAgent.createContingencyPlans(plan, risks);

      expect(result.scenarios).toEqual([]);
    });
  });

  describe('setupProgressTracking', () => {
    it('should setup progress tracking system', async () => {
      const plan = { milestones: ['M1', 'M2', 'M3'] };
      const metrics = ['completion_rate', 'budget_utilization', 'quality_score'];
      const reportingFrequency = 'daily';

      const result = await planningAgent.setupProgressTracking(plan, metrics, reportingFrequency);

      expect(result.plan).toEqual(plan);
      expect(result.metrics).toEqual(metrics);
      expect(result.reporting_frequency).toBe(reportingFrequency);
      expect(result.tracking_system).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should use default reporting frequency', async () => {
      const plan = { tasks: ['Task 1'] };
      const metrics = ['progress'];

      const result = await planningAgent.setupProgressTracking(plan, metrics);

      expect(result.reporting_frequency).toBe('weekly');
    });

    it('should handle empty metrics', async () => {
      const plan = { phases: ['Phase 1'] };

      const result = await planningAgent.setupProgressTracking(plan);

      expect(result.metrics).toEqual([]);
    });
  });
});
