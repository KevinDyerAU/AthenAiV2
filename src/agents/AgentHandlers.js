// Agent Handlers - Agent Lifecycle Management and Coordination
const { ChatOpenAI } = require('@langchain/openai');
const { logger } = require('../utils/logger');
const { databaseService } = require('../services/database');

class AgentHandlers {
  constructor() {
    // Primary OpenAI configuration with OpenRouter fallback
    const useOpenRouter = process.env.USE_OPENROUTER === 'true';
    
    if (useOpenRouter) {
      this.llm = new ChatOpenAI({
        modelName: process.env.OPENROUTER_MODEL || 'openai/gpt-4',
        temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE) || 0.1,
        openAIApiKey: process.env.OPENROUTER_API_KEY,
        configuration: {
          baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            'HTTP-Referer': 'https://athenai.local',
            'X-Title': 'AthenAI Agent Handlers'
          }
        },
        tags: ['agent-handlers', 'athenai', 'openrouter']
      });
    } else {
      this.llm = new ChatOpenAI({
        modelName: process.env.OPENAI_MODEL || 'gpt-4',
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.1,
        openAIApiKey: process.env.OPENAI_API_KEY,
        tags: ['agent-handlers', 'athenai', 'openai']
      });
    }
    
    this.agents = new Map();
    this.agentStatus = new Map();
    this.agentMetrics = new Map();
    this.healthCheckInterval = 30000; // 30 seconds
    this.maxRetries = 3;
    
    // Start health monitoring
    this.startHealthMonitoring();
  }

  // Agent Registration and Management
  async registerAgent(agentId, agentInstance, config = {}) {
    try {
      const isUpdate = this.agents.has(agentId);
      
      const agentInfo = {
        id: agentId,
        instance: agentInstance,
        config,
        registeredAt: isUpdate ? this.agents.get(agentId).registeredAt : new Date().toISOString(),
        status: 'active',
        lastHealthCheck: new Date().toISOString(),
        executionCount: 0,
        errorCount: 0
      };

      this.agents.set(agentId, agentInfo);
      this.agentStatus.set(agentId, 'active');
      
      if (!isUpdate) {
        this.agentMetrics.set(agentId, {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          totalExecutionTime: 0,
          averageExecutionTime: 0,
          lastExecutionTime: null
        });
      }

      logger.info('Agent registered', { agentId, config, isUpdate });
      
      // Store in knowledge graph
      try {
        await databaseService.createKnowledgeNode(
          'system',
          agentId,
          'Agent',
          {
            agent_id: agentId,
            status: isUpdate ? 'updated' : 'registered',
            registered_at: agentInfo.registeredAt
          }
        );
      } catch (dbError) {
        logger.warn('Failed to store agent in knowledge graph', { agentId, error: dbError.message });
      }

      return { 
        agent_id: agentId, 
        status: isUpdate ? 'updated' : 'registered', 
        agent_name: agentInstance.name || agentId, 
        capabilities: agentInstance.capabilities || [] 
      };
    } catch (error) {
      logger.error('Agent registration failed', { agentId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  async unregisterAgent(agentId) {
    try {
      if (!this.agents.has(agentId)) {
        throw new Error(`Agent ${agentId} not found`);
      }

      this.agents.delete(agentId);
      this.agentStatus.delete(agentId);
      this.agentMetrics.delete(agentId);

      logger.info('Agent unregistered', { agentId });
      
      return { success: true, agentId, status: 'unregistered' };
    } catch (error) {
      logger.error('Agent unregistration failed', { agentId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  // Agent Execution Management
  async executeAgent(agentId, inputData, options = {}) {
    const startTime = Date.now();
    const executionId = `exec_${agentId}_${Date.now()}`;

    try {
      const agentInfo = this.agents.get(agentId);
      if (!agentInfo) {
        const executionTime = Date.now() - startTime;
        return {
          agent_id: agentId,
          status: 'failed',
          error: 'Agent not found',
          execution_time: executionTime
        };
      }

      if (this.agentStatus.get(agentId) !== 'active') {
        throw new Error(`Agent ${agentId} is not active`);
      }

      logger.info('Executing agent', { agentId, executionId });

      // Update status to executing
      this.agentStatus.set(agentId, 'executing');

      // Execute the agent once (no retry logic here)
      const result = await this.executeAgentWithTimeout(agentInfo.instance, inputData, options);
      
      if (!result) {
        throw new Error('Agent execution failed');
      }

      const executionTime = Math.max(1, Date.now() - startTime);

      // Update metrics
      this.updateAgentMetrics(agentId, executionTime, true);

      // Update status back to active
      this.agentStatus.set(agentId, 'active');

      logger.info('Agent execution completed', { 
        agentId, 
        executionId, 
        executionTime 
      });

      return {
        agent_id: agentId,
        status: 'completed',
        result,
        execution_time: executionTime,
        attempts: 1
      };

    } catch (error) {
      const executionTime = Math.max(1, Date.now() - startTime); // Ensure minimum 1ms
      
      // Update metrics for failed execution
      this.updateAgentMetrics(agentId, executionTime, false);

      // Update status back to active (or error if persistent)
      this.agentStatus.set(agentId, 'error');

      logger.error('Agent execution failed', { 
        agentId, 
        executionId, 
        error: error.message,
        executionTime
      });

      return {
        agent_id: agentId,
        status: 'failed',
        error: error.message,
        execution_time: executionTime
      };
    }
  }

  async executeAgentWithTimeout(agentInstance, inputData, options = {}) {
    const timeout = options.timeout || 300000; // 5 minutes default

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Agent execution timeout'));
      }, timeout);

      // Determine which method to call based on agent type
      let executionPromise;
      
      if (typeof agentInstance.execute === 'function') {
        executionPromise = agentInstance.execute(inputData);
      } else if (agentInstance.executeDevelopment) {
        executionPromise = agentInstance.executeDevelopment(inputData);
      } else if (agentInstance.executeCommunication) {
        executionPromise = agentInstance.executeCommunication(inputData);
      } else if (agentInstance.executePlanning) {
        executionPromise = agentInstance.executePlanning(inputData);
      } else if (agentInstance.executeTask) {
        executionPromise = agentInstance.executeTask(inputData);
      } else if (agentInstance.executeQualityAssurance) {
        executionPromise = agentInstance.executeQualityAssurance(inputData);
      } else if (agentInstance.executeResearch) {
        executionPromise = agentInstance.executeResearch(inputData);
      } else if (agentInstance.executeAnalysis) {
        executionPromise = agentInstance.executeAnalysis(inputData);
      } else if (agentInstance.executeCreative) {
        executionPromise = agentInstance.executeCreative(inputData);
      } else if (agentInstance.executeOrchestration) {
        executionPromise = agentInstance.executeOrchestration(inputData);
      } else {
        clearTimeout(timer);
        reject(new Error('Agent does not have a recognized execution method'));
        return;
      }

      executionPromise
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  // Agent Health Monitoring
  startHealthMonitoring() {
    setInterval(() => {
      this.performHealthChecks();
    }, this.healthCheckInterval);
  }

  async performHealthChecks() {
    for (const [agentId, agentInfo] of this.agents.entries()) {
      try {
        const isHealthy = await this.checkAgentHealth(agentId, agentInfo);
        
        if (!isHealthy) {
          logger.warn('Agent health check failed', { agentId });
          this.agentStatus.set(agentId, 'unhealthy');
        } else {
          if (this.agentStatus.get(agentId) === 'unhealthy') {
            logger.info('Agent recovered', { agentId });
            this.agentStatus.set(agentId, 'active');
          }
        }

        agentInfo.lastHealthCheck = new Date().toISOString();
      } catch (error) {
        logger.error('Health check error', { agentId, error: error.message });
        this.agentStatus.set(agentId, 'error');
      }
    }
  }

  async checkAgentHealth(agentId, agentInfo) {
    try {
      // Basic health check - ensure agent instance exists and is responsive
      if (!agentInfo.instance) {
        return false;
      }

      // Check if agent has been executing for too long
      const status = this.agentStatus.get(agentId);
      if (status === 'executing') {
        const metrics = this.agentMetrics.get(agentId);
        if (metrics.lastExecutionTime) {
          const executionDuration = Date.now() - new Date(metrics.lastExecutionTime).getTime();
          if (executionDuration > 600000) { // 10 minutes
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // Agent Metrics and Monitoring
  updateAgentMetrics(agentId, executionTime, success) {
    const metrics = this.agentMetrics.get(agentId);
    if (!metrics) return;

    metrics.totalExecutions++;
    metrics.lastExecutionTime = new Date().toISOString();

    if (success) {
      metrics.successfulExecutions++;
    } else {
      metrics.failedExecutions++;
    }

    // Update total and average execution time
    metrics.totalExecutionTime = (metrics.totalExecutionTime || 0) + executionTime;
    metrics.averageExecutionTime = metrics.totalExecutionTime / metrics.totalExecutions;

    this.agentMetrics.set(agentId, metrics);
  }

  getAgentMetrics(agentId = null) {
    if (agentId) {
      const metrics = this.agentMetrics.get(agentId);
      if (!metrics) {
        return {
          agent_id: agentId,
          error: 'Agent not found',
          total_executions: 0,
          successful_executions: 0,
          failed_executions: 0,
          average_execution_time: 0
        };
      }
      
      return {
        agent_id: agentId,
        total_executions: metrics.totalExecutions,
        successful_executions: metrics.successfulExecutions,
        failed_executions: metrics.failedExecutions,
        average_execution_time: metrics.averageExecutionTime,
        last_execution: metrics.lastExecutionTime
      };
    }

    // Return all agent metrics
    const allMetrics = {};
    for (const [id, metrics] of this.agentMetrics.entries()) {
      allMetrics[id] = {
        metrics,
        status: this.agentStatus.get(id),
        info: this.agents.get(id)
      };
    }

    return allMetrics;
  }

  // Agent Coordination
  async coordinateAgents(coordinationData) {
    const { agents, execution_mode = 'parallel', executionMode = 'parallel', inputData } = coordinationData;
    const mode = execution_mode || executionMode;
    const coordinationId = `coord_${Date.now()}`;
    const results = [];

    logger.info('Starting agent coordination', { 
      coordinationId, 
      agentCount: agents.length, 
      executionMode: mode 
    });

    if (mode === 'parallel') {
      // Execute all agents in parallel
      const promises = agents.map(async (agentId) => {
        const result = await this.executeAgent(agentId, inputData);
        if (result.status === 'failed') {
          return { agent_id: agentId, status: 'failed', error: result.error };
        } else {
          return { agent_id: agentId, status: 'completed', result };
        }
      });

      const parallelResults = await Promise.allSettled(promises);
      results.push(...parallelResults.map(r => r.value));

    } else if (mode === 'sequential') {
      // Execute agents one by one
      for (const agentId of agents) {
        try {
          const result = await this.executeAgent(agentId, inputData);
          results.push({ agent_id: agentId, status: 'completed', result });
        } catch (error) {
          logger.error('Agent execution failed in coordination', { agentId, error: error.message });
          results.push({ agent_id: agentId, status: 'failed', error: error.message });
          break; // Stop on first failure in sequential mode
        }
      }
    }

    const successCount = results.filter(r => r.status === 'completed').length;
    const failureCount = results.filter(r => r.status === 'failed').length;
    
    let overallStatus = 'completed';
    if (failureCount > 0 && successCount > 0) {
      overallStatus = 'partial_failure';
    } else if (failureCount > 0) {
      overallStatus = 'failed';
    }

    logger.info('Agent coordination completed', { 
      coordinationId, 
      successCount, 
      failureCount 
    });

    return {
      coordination_id: coordinationId,
      execution_mode: mode,
      agents_count: agents.length,
      results,
      status: overallStatus,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount
      }
    };
  }

  async executeCoordinationStep(step, coordinationId) {
    try {
      const { agentId, inputData, options = {} } = step;
      
      logger.info('Executing coordination step', { coordinationId, agentId, step: step.name });

      const result = await this.executeAgent(agentId, inputData, options);
      
      return {
        stepName: step.name || agentId,
        agentId,
        success: result.success,
        result: result.result,
        executionTime: result.executionTime
      };

    } catch (error) {
      return {
        stepName: step.name || step.agentId,
        agentId: step.agentId,
        success: false,
        error: error.message
      };
    }
  }

  // Agent Load Balancing
  async getOptimalAgent(agentType, criteria = {}) {
    const availableAgents = [];

    for (const [agentId, agentInfo] of this.agents.entries()) {
      if (agentInfo.config.type === agentType && this.agentStatus.get(agentId) === 'active') {
        const metrics = this.agentMetrics.get(agentId);
        availableAgents.push({
          agentId,
          metrics,
          score: this.calculateAgentScore(metrics, criteria)
        });
      }
    }

    if (availableAgents.length === 0) {
      return null;
    }

    // Sort by score (higher is better)
    availableAgents.sort((a, b) => b.score - a.score);
    
    return availableAgents[0].agentId;
  }

  calculateAgentScore(metrics, criteria) {
    let score = 100; // Base score

    // Factor in success rate
    const successRate = metrics.totalExecutions > 0 
      ? metrics.successfulExecutions / metrics.totalExecutions 
      : 1;
    score *= successRate;

    // Factor in average execution time (lower is better)
    if (metrics.averageExecutionTime > 0) {
      const timeScore = Math.max(0, 1 - (metrics.averageExecutionTime / 300000)); // Normalize to 5 minutes
      score *= timeScore;
    }

    // Apply criteria-specific adjustments
    if (criteria.preferFast && metrics.averageExecutionTime > 0) {
      score *= (1 + (1 / (metrics.averageExecutionTime / 1000))); // Boost fast agents
    }

    if (criteria.preferReliable) {
      score *= (1 + successRate); // Boost reliable agents
    }

    return score;
  }

  // Utility Methods
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async executeAgentWithRetry(agentId, inputData, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0 && this.agents.has(agentId)) {
          this.agentStatus.set(agentId, 'active');
        }
        
        const result = await this.executeAgent(agentId, inputData, options);
        
        if (result.status === 'completed') {
          return {
            ...result,
            retry_count: attempt
          };
        }
        
        lastError = new Error(result.error || 'Execution failed');
        if (attempt < maxRetries) {
          await this.delay(retryDelay * (attempt + 1));
        }
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          await this.delay(retryDelay * (attempt + 1));
        }
      }
    }
    
    return {
      agent_id: agentId,
      status: 'failed',
      error: lastError?.message || 'Max retries exceeded',
      retry_count: maxRetries
    };
  }

  async monitorAgentHealth(agentId) {
    const agentInfo = this.agents.get(agentId);
    if (!agentInfo) {
      return {
        agent_id: agentId,
        health_status: 'not_found'
      };
    }

    let healthStatus = 'unknown';
    if (agentInfo.instance.healthCheck) {
      try {
        const health = await agentInfo.instance.healthCheck();
        healthStatus = health.status || 'healthy';
      } catch (error) {
        healthStatus = 'unhealthy';
      }
    }

    return {
      agent_id: agentId,
      health_status: healthStatus,
      last_execution: agentInfo.lastHealthCheck,
      metrics: this.agentMetrics.get(agentId)
    };
  }

  async balanceLoad(tasks, availableAgents, strategy = 'round_robin') {
    const assignments = [];
    
    if (strategy === 'round_robin') {
      tasks.forEach((task, index) => {
        const agentIndex = index % availableAgents.length;
        assignments.push({
          task,
          agent: availableAgents[agentIndex]
        });
      });
    } else if (strategy === 'priority') {
      const sortedTasks = [...tasks].sort((a, b) => {
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        return (priorityOrder[b.priority] || 1) - (priorityOrder[a.priority] || 1);
      });
      
      sortedTasks.forEach((task, index) => {
        const agentIndex = index % availableAgents.length;
        assignments.push({
          task,
          agent: availableAgents[agentIndex]
        });
      });
    }

    return {
      tasks_count: tasks.length,
      available_agents: availableAgents.length,
      strategy,
      load_distribution: assignments.reduce((acc, assignment) => {
        acc[assignment.agent] = (acc[assignment.agent] || 0) + 1;
        return acc;
      }, {}),
      assignments
    };
  }

  async shutdownAgent(agentId, force = false) {
    const agentInfo = this.agents.get(agentId);
    if (!agentInfo) {
      return {
        agent_id: agentId,
        status: 'not_found'
      };
    }

    let gracefulShutdown = false;
    if (agentInfo.instance.shutdown && !force) {
      try {
        await agentInfo.instance.shutdown();
        gracefulShutdown = true;
      } catch (error) {
        logger.warn('Graceful shutdown failed', { agentId, error: error.message });
      }
    }

    this.agents.delete(agentId);
    this.agentStatus.delete(agentId);
    this.agentMetrics.delete(agentId);

    return {
      agent_id: agentId,
      status: 'shutdown',
      graceful_shutdown: gracefulShutdown
    };
  }

  async listAgents() {
    const agents = [];
    for (const [agentId, agentInfo] of this.agents.entries()) {
      agents.push({
        agent_id: agentId,
        name: agentInfo.instance.name || agentId,
        status: this.agentStatus.get(agentId),
        registered_at: agentInfo.registeredAt,
        config: agentInfo.config
      });
    }

    return {
      total_agents: agents.length,
      agents
    };
  }

  async getSystemStatus() {
    const totalAgents = this.agents.size;
    const activeAgents = Array.from(this.agentStatus.values()).filter(status => status === 'active').length;
    const totalExecutions = Array.from(this.agentMetrics.values()).reduce((sum, metrics) => sum + metrics.totalExecutions, 0);

    return {
      total_agents: totalAgents,
      active_agents: activeAgents,
      total_executions: totalExecutions,
      system_health: activeAgents > 0 ? 'healthy' : 'degraded',
      uptime: process.uptime()
    };
  }

  getRegisteredAgents() {
    const agents = {};
    for (const [agentId, agentInfo] of this.agents.entries()) {
      agents[agentId] = {
        id: agentInfo.id,
        config: agentInfo.config,
        status: this.agentStatus.get(agentId),
        registeredAt: agentInfo.registeredAt,
        lastHealthCheck: agentInfo.lastHealthCheck
      };
    }
    return agents;
  }

  async shutdown() {
    logger.info('Shutting down agent handlers');
    
    // Clear all intervals and cleanup
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Set all agents to inactive
    for (const agentId of this.agents.keys()) {
      this.agentStatus.set(agentId, 'inactive');
    }

    logger.info('Agent handlers shutdown complete');
  }
}

module.exports = { AgentHandlers };
