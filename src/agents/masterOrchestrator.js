// src/agents/MasterOrchestrator.js
const { ChatOpenAI } = require('@langchain/openai');
// const { PromptTemplate } = require('@langchain/core/prompts'); // Unused import
const { logger } = require('../utils/logger');
const { databaseService } = require('../services/database');

class MasterOrchestrator {
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4',
      temperature: 0.2,
      openAIApiKey: process.env.OPENAI_API_KEY,
      tags: ['master-orchestrator', 'athenai']
    });
  }

  async executeOrchestration(inputData) {
    const startTime = Date.now();
    const sessionId = inputData.sessionId || this.generateSessionId();
    const orchestrationId = this.generateOrchestrationId();
    
    try {
      logger.info('Starting orchestration', { sessionId, orchestrationId });

      // Analyze task complexity
      const _complexity = this.analyzeTaskComplexity(inputData.message);
      
      // Determine agent routing
      const routing = this.determineAgentRouting(inputData.message, _complexity);
      
      // Create execution plan
      const plan = this.createExecutionPlan(inputData.message, _complexity, routing);
      
      // Cache the orchestration context
      await databaseService.cacheSet(
        `orchestration:${orchestrationId}`,
        {
          sessionId,
          message: inputData.message,
          routing,
          plan,
          status: 'in_progress'
        },
        3600 // 1 hour TTL
      );

      // Store in Neo4j knowledge graph
      await databaseService.createKnowledgeNode(
        sessionId,
        orchestrationId,
        'Orchestration',
        {
          message: inputData.message,
          complexity_level: _complexity.level,
          primary_agent: routing.primary,
          created_at: new Date().toISOString()
        }
      );

      const executionTime = Date.now() - startTime;
      
      logger.info('Orchestration completed', { 
        sessionId, 
        orchestrationId, 
        executionTime,
        primaryAgent: routing.primary 
      });

      return {
        orchestration_id: orchestrationId,
        session_id: sessionId,
        plan,
        routing,
        complexity: _complexity,
        execution_time_ms: executionTime,
        status: 'completed'
      };

    } catch (error) {
      logger.error('Orchestration failed', { 
        sessionId, 
        orchestrationId, 
        error: error.message 
      });
      
      return {
        orchestration_id: orchestrationId,
        session_id: sessionId,
        error: error.message,
        status: 'failed'
      };
    }
  }

  analyzeTaskComplexity(message) {
    const indicators = {
      length: message.length,
      questions: (message.match(/\?/g) || []).length,
      technicalTerms: this.countTechnicalTerms(message),
      requestTypes: this.identifyRequestTypes(message)
    };

    let complexityScore = 0;
    
    if (indicators.length > 200) complexityScore += 2;
    else if (indicators.length > 100) complexityScore += 1;
    
    complexityScore += Math.min(indicators.questions * 0.5, 2);
    complexityScore += Math.min(indicators.technicalTerms * 0.3, 2);
    complexityScore += indicators.requestTypes.complexity;

    let level, estimatedDuration, modelToUse;
    if (complexityScore <= 2) {
      level = 'low';
      estimatedDuration = '15s';
      modelToUse = 'gpt-3.5-turbo'; // Cost optimization
    } else if (complexityScore <= 4) {
      level = 'medium';
      estimatedDuration = '30s';
      modelToUse = 'gpt-4';
    } else {
      level = 'high';
      estimatedDuration = '60s';
      modelToUse = 'gpt-4';
    }

    return {
      score: complexityScore,
      level,
      estimatedDuration,
      modelToUse,
      indicators
    };
  }

  determineAgentRouting(message, complexity) {
    const messageLower = message.toLowerCase();
      const routing = {
        primary: 'research',
      collaborators: [],
      confidence: 0.8
    };

    // Determine primary agent based on message content
    if (messageLower.includes('code') || messageLower.includes('develop') || messageLower.includes('program') || messageLower.includes('build')) {
      routing.primary = 'development';
      routing.confidence = 0.9;
    } else if (messageLower.includes('plan') || messageLower.includes('strategy') || messageLower.includes('roadmap') || messageLower.includes('organize')) {
      routing.primary = 'planning';
      routing.confidence = 0.9;
    } else if (messageLower.includes('execute') || messageLower.includes('run') || messageLower.includes('deploy') || messageLower.includes('implement')) {
      routing.primary = 'execution';
      routing.confidence = 0.9;
    } else if (messageLower.includes('communicate') || messageLower.includes('message') || messageLower.includes('email') || messageLower.includes('notify')) {
      routing.primary = 'communication';
      routing.confidence = 0.9;
    } else if (messageLower.includes('quality') || messageLower.includes('review') || messageLower.includes('validate') || messageLower.includes('check')) {
      routing.primary = 'qa';
      routing.confidence = 0.9;
    } else if (messageLower.includes('research') || messageLower.includes('find') || messageLower.includes('search')) {
        routing.primary = 'research';
      routing.confidence = 0.9;
    } else if (messageLower.includes('analyze') || messageLower.includes('data') || messageLower.includes('insights')) {
      routing.primary = 'analysis';
      routing.confidence = 0.85;
    } else if (messageLower.includes('create') || messageLower.includes('write') || messageLower.includes('generate')) {
        routing.primary = 'creative';
      routing.confidence = 0.8;
    }

    // Add collaborators based on complexity and content
    if (complexity.level === 'high') {
      // For high complexity tasks, add QA agent
      routing.collaborators.push('qa');
      
      // Add relevant supporting agents
      if (routing.primary === 'development') {
        routing.collaborators.push('planning', 'research');
      } else if (routing.primary === 'planning') {
        routing.collaborators.push('research', 'analysis');
      } else if (routing.primary === 'execution') {
        routing.collaborators.push('planning', 'qa');
      } else {
        if (routing.primary !== 'analysis') routing.collaborators.push('analysis');
        if (routing.primary !== 'creative') routing.collaborators.push('creative');
      }
    }

    if (messageLower.includes('comprehensive') || messageLower.includes('detailed')) {
      routing.collaborators.push('research', 'analysis', 'qa');
      }

    // Remove duplicates and primary from collaborators
    routing.collaborators = [...new Set(routing.collaborators)].filter(
      agent => agent !== routing.primary
    );

      return routing;
  }

  createExecutionPlan(message, complexity, routing) {
    const plan = [
      {
        step: 1,
        action: 'analyze_request',
        agent: routing.primary,
        description: `Initial analysis using ${routing.primary} agent`,
        estimated_duration: '10s',
        model: complexity.modelToUse
      }
    ];

    let stepCounter = 2;

    // Add collaborator steps
    routing.collaborators.forEach(agent => {
      plan.push({
        step: stepCounter++,
        action: `execute_${agent}`,
        agent: agent,
        description: `Execute ${agent} agent processing`,
        estimated_duration: '15s',
        model: complexity.modelToUse,
        dependencies: [stepCounter - 2]
      });
    });

    // Final synthesis step
    plan.push({
      step: stepCounter,
      action: 'synthesize_response',
      agent: routing.primary,
      description: 'Synthesize final response',
      estimated_duration: '10s',
      model: complexity.modelToUse,
      dependencies: [stepCounter - 1]
    });

    return plan;
  }

  countTechnicalTerms(text) {
    const technicalTerms = [
      'algorithm', 'api', 'database', 'function', 'variable', 'code', 'programming',
      'software', 'hardware', 'network', 'server', 'client', 'framework', 'library',
      'machine learning', 'artificial intelligence', 'data science', 'analytics'
    ];
    
    const textLower = text.toLowerCase();
    return technicalTerms.filter(term => textLower.includes(term)).length;
  }

  identifyRequestTypes(text) {
    const textLower = text.toLowerCase();
    let _complexity = 0;
    const types = [];

    if (textLower.includes('explain') || textLower.includes('how')) {
      types.push('explanation');
      _complexity += 1;
    }
    
    if (textLower.includes('create') || textLower.includes('generate')) {
      types.push('creation');
      _complexity += 2;
    }
    
    if (textLower.includes('analyze') || textLower.includes('compare')) {
      types.push('analysis');
      _complexity += 2;
    }
    
    if (textLower.includes('solve') || textLower.includes('fix')) {
      types.push('problem_solving');
      _complexity += 3;
    }

    return { types, complexity: _complexity };
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
