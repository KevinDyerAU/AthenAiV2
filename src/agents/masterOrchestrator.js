const { ChatOpenAI } = require('@langchain/openai');
const { logger } = require('../utils/logger');

class MasterOrchestrator {
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4',
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY,
      tags: ['master-orchestrator', 'athenai']
    });
    
    this.name = 'MasterOrchestrator';
    this.capabilities = ['task-analysis', 'agent-routing', 'orchestration'];
    this.agents = new Map();
    this.executionPlans = new Map();
  }

  analyzeTaskComplexity(task) {
    try {
      // Ensure task is a string
      const taskString = typeof task === 'string' ? task : JSON.stringify(task);
      
      const complexity = {
        level: 'medium',
        factors: ['multi-step', 'research-required'],
        estimatedTime: 300,
        requiredAgents: ['research', 'analysis']
      };

      if (taskString.length < 20) complexity.level = 'low';
      else if (taskString.length > 50) complexity.level = 'high';
      
      if (taskString.includes('research') || taskString.includes('analyze')) {
        complexity.factors.push('research-intensive');
      }

      return {
        level: complexity.level,
        factors: complexity.factors,
        estimated_time: complexity.estimatedTime,
        required_agents: complexity.requiredAgents
      };
    } catch (error) {
      logger.error('Task complexity analysis failed', { error: error.message });
      throw error;
    }
  }

  determineAgentRouting(task) {
    try {
      // Ensure task is a string
      const taskString = typeof task === 'string' ? task : JSON.stringify(task);
      
      const routing = {
        primary: 'research',
        secondary: ['analysis'],
        execution_order: ['research', 'analysis'],
        parallel_execution: false
      };

      const taskLower = taskString.toLowerCase();
      if (taskLower.includes('research') || taskLower.includes('analyze')) {
        routing.primary = 'research';
      } else if (taskLower.includes('creative') || taskLower.includes('design')) {
        routing.primary = 'creative';
      } else if (taskLower.includes('code') || taskLower.includes('development')) {
        routing.primary = 'development';
      } else {
        routing.primary = 'general';
      }

      return routing;
    } catch (error) {
      logger.error('Agent routing determination failed', { error: error.message });
      throw error;
    }
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateOrchestrationId() {
    return `orch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  createExecutionPlan(task, complexity, routing) {
    try {
      const planId = `plan_${Date.now()}`;
      const steps = [
        {
          step: 1,
          agent: routing.primary || 'research',
          action: 'analyze_and_research',
          input: task,
          expected_output: 'research_results'
        },
        {
          step: 2,
          agent: (routing.secondary && routing.secondary[0]) || 'analysis',
          action: 'synthesize_results',
          input: 'research_results',
          expected_output: 'final_analysis'
        }
      ];

      const plan = {
        id: planId,
        task,
        complexity,
        routing,
        steps,
        estimated_duration: complexity.estimated_time || 300,
        resource_requirements: ['llm_access', 'web_search'],
        created_at: new Date().toISOString()
      };

      this.executionPlans.set(planId, plan);
      
      return plan;
    } catch (error) {
      logger.error('Execution plan creation failed', { error: error.message });
      throw error;
    }
  }

  async executeOrchestration(inputData) {
    try {
      const sessionId = await this.generateSessionId();
      const complexity = await this.analyzeTaskComplexity(inputData.task || inputData);
      const routing = await this.determineAgentRouting(inputData.task || inputData);
      const plan = await this.createExecutionPlan(inputData.task || inputData, complexity, routing);

      return {
        session_id: sessionId,
        orchestration_result: {
          complexity,
          routing,
          execution_plan: plan
        },
        status: 'completed',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Orchestration execution failed', { error: error.message });
      throw error;
    }
  }

  async healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      capabilities: this.capabilities
    };
  }

  async shutdown() {
    logger.info('MasterOrchestrator shutting down');
    this.executionPlans.clear();
  }
}

module.exports = { MasterOrchestrator };
