// PlanningAgent Test Suite
const { PlanningAgent } = require('../../src/agents/PlanningAgent');
const { logger } = require('../../src/utils/logger');

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/progressBroadcaster');
jest.mock('../../src/services/database');
jest.mock('../../src/utils/knowledgeSubstrateHelper');
jest.mock('../../src/agents/AgentRegistry');

describe('PlanningAgent', () => {
  let planningAgent;
  let mockInputData;

  beforeEach(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_API_KEY = 'test-key';
    
    planningAgent = new PlanningAgent();
    
    mockInputData = {
      sessionId: 'test-session-123',
      orchestrationId: 'test-orchestration-456',
      objective: 'Create a comprehensive project plan for developing a new AI-powered customer service chatbot',
      complexity: { level: 'high', score: 8.5 },
      planning_type: 'project',
      conversation_context: []
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize PlanningAgent with correct properties', () => {
      expect(planningAgent).toBeDefined();
      expect(planningAgent.llm).toBeDefined();
      expect(planningAgent.knowledgeHelper).toBeDefined();
      expect(planningAgent.reasoning).toBeDefined();
      expect(planningAgent.name).toBe('PlanningAgent');
      expect(planningAgent.capabilities).toContain('strategic-planning');
      expect(planningAgent.capabilities).toContain('project-management');
    });

    it('should use OpenRouter when configured', () => {
      process.env.USE_OPENROUTER = 'true';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      
      const agent = new PlanningAgent();
      expect(agent.llm).toBeDefined();
    });
  });

  describe('Knowledge Substrate Integration', () => {
    it('should retrieve planning context successfully', async () => {
      const mockContext = {
        relevant_plans: [
          {
            title: 'AI Chatbot Development Plan',
            objective: 'Develop customer service chatbot',
            methodology: 'agile',
            complexity_level: 'high',
            similarity_score: 0.85
          }
        ],
        planning_patterns: [
          {
            name: 'AI Development Pattern',
            context: 'Machine learning project planning',
            applicable_complexity: 'high',
            similarity_score: 0.78
          }
        ],
        domain: 'ai',
        search_query: 'AI chatbot development planning',
        retrieved_at: new Date().toISOString()
      };
      
      planningAgent.retrievePlanningContext = jest.fn().mockResolvedValue(mockContext);
      
      const result = await planningAgent.retrievePlanningContext('AI chatbot development', 'project', 'high');
      
      expect(result).toEqual(mockContext);
      expect(result.relevant_plans).toHaveLength(1);
      expect(result.planning_patterns).toHaveLength(1);
      expect(result.domain).toBe('ai');
    });

    it('should store planning results successfully', async () => {
      const planningResult = {
        output: 'Comprehensive project plan with phases and deliverables',
        metadata: {
          complexity: 'high',
          estimated_duration: '12 weeks',
          methodology: 'agile'
        }
      };
      
      const context = {
        objective: 'AI chatbot development',
        planningType: 'project',
        complexity: 'high',
        sessionId: 'test-session'
      };
      
      planningAgent.storePlanningResults = jest.fn().mockResolvedValue(true);
      
      const result = await planningAgent.storePlanningResults(planningResult, context);
      
      expect(result).toBe(true);
      expect(planningAgent.storePlanningResults).toHaveBeenCalledWith(planningResult, context);
    });

    it('should extract planning insights correctly', () => {
      const results = 'Project planning completed successfully. Agile methodology recommended. Risk mitigation strategies identified.';
      const insights = planningAgent.extractPlanningInsights(results);
      
      expect(insights).toHaveLength(3);
      expect(insights[0]).toEqual({ type: 'planning_pattern', content: 'Project planning completed successfully.' });
      expect(insights[1]).toEqual({ type: 'planning_pattern', content: 'Agile methodology recommended.' });
      expect(insights[2]).toEqual({ type: 'planning_pattern', content: 'Risk mitigation strategies identified.' });
    });
  });

  describe('executePlanning', () => {
    it('should execute planning task successfully in test environment', async () => {
      const result = await planningAgent.executePlanning(mockInputData);
      
      expect(result).toBeDefined();
      expect(result.session_id).toBe('test-session-123');
      expect(result.orchestration_id).toBe('test-orchestration-456');
      expect(result.objective).toBe('Create a comprehensive project plan for developing a new AI-powered customer service chatbot');
      expect(result.planning_type).toBe('project');
      expect(result.complexity).toEqual({ level: 'high', score: 8.5 });
      expect(result.success).toBe(true);
      expect(result.output).toContain('Planning completed');
      expect(typeof result.planning_time_ms).toBe('number');
    });

    it('should handle missing objective gracefully', async () => {
      const invalidInput = {
        sessionId: 'test-session',
        planning_type: 'project'
      };
      
      const result = await planningAgent.executePlanning(invalidInput);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Objective is required');
    });

    it('should include strategy plan and evaluation in results', async () => {
      const result = await planningAgent.executePlanning(mockInputData);
      
      expect(result.strategy_plan).toBeDefined();
      expect(result.self_evaluation).toBeDefined();
      expect(result.confidence_score).toBeGreaterThanOrEqual(0);
      expect(result.confidence_score).toBeLessThanOrEqual(1);
      expect(result.reasoning_logs).toBeDefined();
    });
  });

  describe('Planning Tools', () => {
    it('should initialize planning tools correctly', () => {
      const tools = planningAgent.initializePlanningTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('strategic_planner');
      expect(toolNames).toContain('project_manager');
      expect(toolNames).toContain('think');
    });
  });

  describe('Planning Types', () => {
    it('should handle strategic planning', async () => {
      const strategicInput = {
        ...mockInputData,
        planning_type: 'strategic',
        objective: 'Develop 5-year AI strategy for the organization'
      };
      
      const result = await planningAgent.executePlanning(strategicInput);
      expect(result.planning_type).toBe('strategic');
    });

    it('should handle project planning', async () => {
      const projectInput = {
        ...mockInputData,
        planning_type: 'project',
        objective: 'Plan software development project'
      };
      
      const result = await planningAgent.executePlanning(projectInput);
      expect(result.planning_type).toBe('project');
    });

    it('should handle operational planning', async () => {
      const operationalInput = {
        ...mockInputData,
        planning_type: 'operational',
        objective: 'Plan daily operations workflow'
      };
      
      const result = await planningAgent.executePlanning(operationalInput);
      expect(result.planning_type).toBe('operational');
    });

    it('should handle orchestration planning', async () => {
      const orchestrationInput = {
        ...mockInputData,
        planning_type: 'orchestration',
        objective: 'Plan multi-agent workflow coordination'
      };
      
      const result = await planningAgent.executePlanning(orchestrationInput);
      expect(result.planning_type).toBe('orchestration');
    });
  });

  describe('Complexity Handling', () => {
    it('should handle low complexity planning', async () => {
      const lowComplexityInput = {
        ...mockInputData,
        complexity: { level: 'low', score: 2.5 }
      };
      
      const result = await planningAgent.executePlanning(lowComplexityInput);
      expect(result.complexity.level).toBe('low');
    });

    it('should handle high complexity planning', async () => {
      const highComplexityInput = {
        ...mockInputData,
        complexity: { level: 'very_complex', score: 9.5 }
      };
      
      const result = await planningAgent.executePlanning(highComplexityInput);
      expect(result.complexity.level).toBe('very_complex');
    });

    it('should adapt planning approach based on complexity', async () => {
      const simpleTask = {
        ...mockInputData,
        objective: 'Create simple task list',
        complexity: { level: 'low', score: 1.5 }
      };
      
      const complexTask = {
        ...mockInputData,
        objective: 'Design enterprise-wide AI transformation strategy',
        complexity: { level: 'very_complex', score: 9.8 }
      };
      
      const simpleResult = await planningAgent.executePlanning(simpleTask);
      const complexResult = await planningAgent.executePlanning(complexTask);
      
      expect(simpleResult.output.length).toBeLessThan(complexResult.output.length);
    });
  });

  describe('Agent Registry Integration', () => {
    it('should incorporate agent registry information in orchestration planning', async () => {
      const orchestrationInput = {
        ...mockInputData,
        planning_type: 'orchestration',
        agentRegistry: {
          total_agents: 8,
          agents: [
            { name: 'ResearchAgent', capabilities: ['research', 'data-gathering'] },
            { name: 'AnalysisAgent', capabilities: ['analysis', 'insights'] },
            { name: 'CreativeAgent', capabilities: ['content-creation', 'writing'] }
          ]
        }
      };
      
      const result = await planningAgent.executePlanning(orchestrationInput);
      
      expect(result.planning_type).toBe('orchestration');
      expect(result.output).toContain('agent');
    });

    it('should handle missing agent registry gracefully', async () => {
      const orchestrationInput = {
        ...mockInputData,
        planning_type: 'orchestration'
        // No agentRegistry provided
      };
      
      const result = await planningAgent.executePlanning(orchestrationInput);
      
      expect(result.success).toBe(true);
      expect(result.planning_type).toBe('orchestration');
    });
  });

  describe('Conversation Context Integration', () => {
    it('should incorporate conversation context in planning', async () => {
      const contextualInput = {
        ...mockInputData,
        conversation_context: [
          { role: 'user', content: 'We need to improve customer satisfaction' },
          { role: 'assistant', content: 'I can help you plan improvements' },
          { role: 'user', content: 'Focus on response time and accuracy' }
        ]
      };
      
      const result = await planningAgent.executePlanning(contextualInput);
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('customer satisfaction');
    });

    it('should handle empty conversation context', async () => {
      const noContextInput = {
        ...mockInputData,
        conversation_context: []
      };
      
      const result = await planningAgent.executePlanning(noContextInput);
      
      expect(result.success).toBe(true);
    });
  });

  describe('Work Breakdown Structure', () => {
    it('should generate structured work breakdown', () => {
      const objective = 'Develop mobile application';
      const wbs = planningAgent.generateWorkBreakdown(objective, 'high');
      
      expect(wbs).toBeDefined();
      expect(Array.isArray(wbs)).toBe(true);
      expect(wbs.length).toBeGreaterThan(0);
      
      wbs.forEach(item => {
        expect(item).toHaveProperty('phase');
        expect(item).toHaveProperty('tasks');
        expect(item).toHaveProperty('duration');
      });
    });

    it('should adapt breakdown to complexity level', () => {
      const objective = 'Simple website update';
      const lowComplexityWBS = planningAgent.generateWorkBreakdown(objective, 'low');
      const highComplexityWBS = planningAgent.generateWorkBreakdown(objective, 'high');
      
      expect(lowComplexityWBS.length).toBeLessThanOrEqual(highComplexityWBS.length);
    });
  });

  describe('Risk Assessment', () => {
    it('should identify project risks', () => {
      const objective = 'Launch new AI product';
      const complexity = 'high';
      const risks = planningAgent.assessRisks(objective, complexity);
      
      expect(risks).toBeDefined();
      expect(Array.isArray(risks)).toBe(true);
      expect(risks.length).toBeGreaterThan(0);
      
      risks.forEach(risk => {
        expect(risk).toHaveProperty('category');
        expect(risk).toHaveProperty('description');
        expect(risk).toHaveProperty('impact');
        expect(risk).toHaveProperty('probability');
      });
    });

    it('should provide risk mitigation strategies', () => {
      const risks = [
        { category: 'technical', description: 'API integration failure', impact: 'high', probability: 'medium' }
      ];
      
      const mitigations = planningAgent.generateMitigationStrategies(risks);
      
      expect(mitigations).toBeDefined();
      expect(Array.isArray(mitigations)).toBe(true);
      expect(mitigations.length).toBeGreaterThan(0);
    });
  });

  describe('Success Metrics', () => {
    it('should define success metrics for planning objectives', () => {
      const objective = 'Improve customer service efficiency';
      const planningType = 'operational';
      const metrics = planningAgent.defineSuccessMetrics(objective, planningType);
      
      expect(metrics).toBeDefined();
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);
      
      metrics.forEach(metric => {
        expect(metric).toHaveProperty('name');
        expect(metric).toHaveProperty('target');
        expect(metric).toHaveProperty('measurement');
      });
    });

    it('should adapt metrics to planning type', () => {
      const objective = 'Digital transformation';
      const strategicMetrics = planningAgent.defineSuccessMetrics(objective, 'strategic');
      const projectMetrics = planningAgent.defineSuccessMetrics(objective, 'project');
      
      expect(strategicMetrics).not.toEqual(projectMetrics);
    });
  });

  describe('Timeline Estimation', () => {
    it('should estimate project timeline', () => {
      const workBreakdown = [
        { phase: 'Planning', tasks: ['Requirements', 'Design'], duration: '2 weeks' },
        { phase: 'Development', tasks: ['Code', 'Test'], duration: '6 weeks' },
        { phase: 'Deployment', tasks: ['Deploy', 'Monitor'], duration: '1 week' }
      ];
      
      const timeline = planningAgent.estimateTimeline(workBreakdown);
      
      expect(timeline).toBeDefined();
      expect(timeline.total_duration).toBeDefined();
      expect(timeline.milestones).toBeDefined();
      expect(Array.isArray(timeline.milestones)).toBe(true);
    });

    it('should handle different time units', () => {
      const mixedWorkBreakdown = [
        { phase: 'Research', tasks: ['Analysis'], duration: '3 days' },
        { phase: 'Implementation', tasks: ['Development'], duration: '2 months' }
      ];
      
      const timeline = planningAgent.estimateTimeline(mixedWorkBreakdown);
      
      expect(timeline.total_duration).toBeDefined();
    });
  });

  describe('Resource Planning', () => {
    it('should identify required resources', () => {
      const objective = 'Build data analytics platform';
      const complexity = 'high';
      const resources = planningAgent.identifyResources(objective, complexity);
      
      expect(resources).toBeDefined();
      expect(resources.human_resources).toBeDefined();
      expect(resources.technical_resources).toBeDefined();
      expect(resources.budget_estimate).toBeDefined();
    });

    it('should scale resources with complexity', () => {
      const objective = 'Software development project';
      const lowResources = planningAgent.identifyResources(objective, 'low');
      const highResources = planningAgent.identifyResources(objective, 'high');
      
      expect(highResources.human_resources.length).toBeGreaterThanOrEqual(lowResources.human_resources.length);
    });
  });

  describe('Error Handling', () => {
    it('should handle planning execution errors gracefully', async () => {
      const errorInput = {
        sessionId: 'test-session',
        objective: null // This should cause an error
      };
      
      const result = await planningAgent.executePlanning(errorInput);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should log errors appropriately', async () => {
      const errorInput = {
        sessionId: 'test-session',
        objective: '' // Empty objective should cause validation error
      };
      
      await planningAgent.executePlanning(errorInput);
      
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle knowledge substrate errors gracefully', async () => {
      planningAgent.retrievePlanningContext = jest.fn().mockRejectedValue(new Error('Database connection failed'));
      
      const result = await planningAgent.executePlanning(mockInputData);
      
      expect(result.success).toBe(true); // Should continue without knowledge context
      expect(result.output).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should complete planning task within reasonable time', async () => {
      const startTime = Date.now();
      await planningAgent.executePlanning(mockInputData);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds in test mode
    });

    it('should handle complex planning efficiently', async () => {
      const complexInput = {
        ...mockInputData,
        objective: 'Design and implement enterprise-wide digital transformation strategy with AI integration, cloud migration, and organizational change management',
        complexity: { level: 'very_complex', score: 9.8 }
      };
      
      const startTime = Date.now();
      await planningAgent.executePlanning(complexInput);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(10000); // Should handle complex planning within 10 seconds
    });
  });

  describe('Integration Features', () => {
    it('should integrate with knowledge substrate for historical planning data', async () => {
      const objective = 'AI implementation planning';
      
      const context = await planningAgent.retrievePlanningContext(objective, 'project', 'high');
      
      expect(context).toBeDefined();
    });

    it('should support collaborative planning with multiple stakeholders', async () => {
      const collaborativeInput = {
        ...mockInputData,
        stakeholders: [
          { role: 'Product Manager', requirements: ['Feature prioritization'] },
          { role: 'Technical Lead', requirements: ['Architecture decisions'] },
          { role: 'Business Analyst', requirements: ['Requirements analysis'] }
        ]
      };
      
      const result = await planningAgent.executePlanning(collaborativeInput);
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('stakeholder');
    });
  });

  describe('Domain-Specific Planning', () => {
    it('should handle AI/ML project planning', async () => {
      const aiInput = {
        ...mockInputData,
        objective: 'Develop machine learning model for predictive analytics',
        domain: 'ai'
      };
      
      const result = await planningAgent.executePlanning(aiInput);
      
      expect(result.success).toBe(true);
      expect(result.output.toLowerCase()).toMatch(/data|model|training|validation/);
    });

    it('should handle software development planning', async () => {
      const devInput = {
        ...mockInputData,
        objective: 'Build web application with microservices architecture',
        domain: 'software'
      };
      
      const result = await planningAgent.executePlanning(devInput);
      
      expect(result.success).toBe(true);
      expect(result.output.toLowerCase()).toMatch(/development|architecture|testing|deployment/);
    });

    it('should handle business strategy planning', async () => {
      const businessInput = {
        ...mockInputData,
        objective: 'Expand market presence in new geographic regions',
        domain: 'business',
        planning_type: 'strategic'
      };
      
      const result = await planningAgent.executePlanning(businessInput);
      
      expect(result.success).toBe(true);
      expect(result.output.toLowerCase()).toMatch(/market|strategy|expansion|revenue/);
    });
  });
});
