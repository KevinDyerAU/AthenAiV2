// tests/unit/agents.test.js
const { MasterOrchestrator } = require('../../src/agents/MasterOrchestrator');
const { ResearchAgent } = require('../../src/agents/ResearchAgent');

describe('Agent Unit Tests', () => {
  let orchestrator;
  let researchAgent;

  beforeEach(() => {
    orchestrator = new MasterOrchestrator();
    researchAgent = new ResearchAgent();
  });

  describe('MasterOrchestrator', () => {
    test('Should analyze task complexity correctly', () => {
      const simpleTask = 'Hello';
      const complexTask = 'Research the latest developments in quantum computing and provide a comprehensive analysis';

      const simpleComplexity = orchestrator.analyzeTaskComplexity(simpleTask);
      const complexComplexity = orchestrator.analyzeTaskComplexity(complexTask);

      expect(simpleComplexity.level).toBe('low');
      expect(complexComplexity.level).toBe('high');
    });

    test('Should determine agent routing based on message content', () => {
      const researchQuery = 'Research AI trends';
      const generalQuery = 'Hello there';

      const researchRouting = orchestrator.determineAgentRouting(researchQuery, { level: 'medium' });
      const generalRouting = orchestrator.determineAgentRouting(generalQuery, { level: 'low' });

      expect(researchRouting.primary).toBe('research');
      expect(generalRouting.primary).toBe('general');
    });

    test('Should generate unique session and orchestration IDs', () => {
      const sessionId1 = orchestrator.generateSessionId();
      const sessionId2 = orchestrator.generateSessionId();
      const orchId1 = orchestrator.generateOrchestrationId();
      const orchId2 = orchestrator.generateOrchestrationId();

      expect(sessionId1).not.toBe(sessionId2);
      expect(orchId1).not.toBe(orchId2);
      expect(sessionId1).toMatch(/^session_/);
      expect(orchId1).toMatch(/^orch_/);
    });

    test('Should create execution plan with proper structure', () => {
      const message = 'Research quantum computing';
      const complexity = { level: 'high', factors: ['research', 'technical'] };
      const routing = { primary: 'research', secondary: [] };

      const plan = orchestrator.createExecutionPlan(message, complexity, routing);

      expect(plan).toHaveProperty('steps');
      expect(plan).toHaveProperty('estimated_duration');
      expect(plan).toHaveProperty('resource_requirements');
      expect(Array.isArray(plan.steps)).toBe(true);
    });
  });

  describe('ResearchAgent', () => {
    test('Should initialize with proper configuration', () => {
      expect(researchAgent).toHaveProperty('llm');
      expect(researchAgent).toHaveProperty('tools');
    });

    test('Should generate research plan for query', () => {
      const query = 'AI developments 2024';
      const plan = researchAgent.generateResearchPlan(query);

      expect(plan).toHaveProperty('query');
      expect(plan).toHaveProperty('steps');
      expect(plan).toHaveProperty('tools_needed');
      expect(plan.query).toBe(query);
    });

    test('Should validate research query format', () => {
      const validQuery = 'Machine learning trends';
      const invalidQuery = '';

      const validResult = researchAgent.validateQuery(validQuery);
      const invalidResult = researchAgent.validateQuery(invalidQuery);

      expect(validResult.is_valid).toBe(true);
      expect(validResult.validation_issues).toEqual([]);
      expect(invalidResult.is_valid).toBe(false);
      expect(invalidResult.validation_issues.length).toBeGreaterThan(0);
    });

    test('Should format research results properly', () => {
      const mockResults = {
        web_search: ['Result 1', 'Result 2'],
        analysis: 'Test analysis'
      };

      const formatted = researchAgent.formatResults(mockResults);

      expect(formatted).toHaveProperty('summary');
      expect(formatted).toHaveProperty('sources');
      expect(formatted).toHaveProperty('analysis');
    });
  });
});
