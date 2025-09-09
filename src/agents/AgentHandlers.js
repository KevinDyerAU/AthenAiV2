// Agent Handlers - Agent Lifecycle Management and Coordination
const { ChatOpenAI } = require('@langchain/openai');
const { logger } = require('../utils/logger');
const { databaseService } = require('../services/database');

class AgentHandlers {
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4',
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY,
      tags: ['agent-handlers', 'athenai']
    });
    
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
      const agentInfo = {
        id: agentId,
        instance: agentInstance,
        config,
        registeredAt: new Date().toISOString(),
        status: 'active',
        lastHealthCheck: new Date().toISOString(),
        executionCount: 0,
        errorCount: 0
      };

      this.agents.set(agentId, agentInfo);
      this.agentStatus.set(agentId, 'active');
      this.agentMetrics.set(agentId, {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        lastExecutionTime: null
      });

      logger.info('Agent registered', { agentId, config });
      
      // Store in knowledge graph
      await databaseService.createKnowledgeNode(
        'system',
        agentId,
        'Agent',
        {
          agent_id: agentId,
          status: 'registered',
          registered_at: agentInfo.registeredAt
        }
      );

      return { success: true, agentId, status: 'registered' };
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
        throw new Error(`Agent ${agentId} not registered`);
      }

      if (this.agentStatus.get(agentId) !== 'active') {
        throw new Error(`Agent ${agentId} is not active`);
      }

      logger.info('Executing agent', { agentId, executionId });

      // Update status to executing
      this.agentStatus.set(agentId, 'executing');

      // Execute the agent with retry logic
      let result;
      let attempts = 0;
      let lastError;

      while (attempts < this.maxRetries) {
        try {
          attempts++;
          result = await this.executeAgentWithTimeout(agentInfo.instance, inputData, options);
          break;
        } catch (error) {
          lastError = error;
          logger.warn('Agent execution attempt failed', { 
            agentId, 
            executionId, 
            attempt: attempts, 
            error: error.message 
          });

          if (attempts < this.maxRetries) {
            await this.delay(1000 * attempts); // Exponential backoff
          }
        }
      }

      if (!result) {
        throw lastError || new Error('Agent execution failed after retries');
      }

      const executionTime = Date.now() - startTime;

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
        success: true,
        agentId,
        executionId,
        result,
        executionTime,
        attempts
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
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
        success: false,
        agentId,
        executionId,
        error: error.message,
        executionTime
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
      
      if (agentInstance.executeDevelopment) {
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

    // Update average execution time
    const totalTime = (metrics.averageExecutionTime * (metrics.totalExecutions - 1)) + executionTime;
    metrics.averageExecutionTime = totalTime / metrics.totalExecutions;

    this.agentMetrics.set(agentId, metrics);
  }

  getAgentMetrics(agentId = null) {
    if (agentId) {
      return {
        agentId,
        metrics: this.agentMetrics.get(agentId),
        status: this.agentStatus.get(agentId),
        info: this.agents.get(agentId)
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
  async coordinateAgents(orchestrationPlan) {
    const coordinationId = `coord_${Date.now()}`;
    const results = [];

    try {
      logger.info('Starting agent coordination', { coordinationId, orchestrationPlan });

      // Parse orchestration plan
      const steps = orchestrationPlan.steps || [];
      
      for (const step of steps) {
        const stepResult = await this.executeCoordinationStep(step, coordinationId);
        results.push(stepResult);

        // Check if step failed and should stop coordination
        if (!stepResult.success && step.stopOnFailure !== false) {
          throw new Error(`Coordination stopped at step: ${step.name || step.agentId}`);
        }
      }

      logger.info('Agent coordination completed', { coordinationId });

      return {
        success: true,
        coordinationId,
        results,
        totalSteps: steps.length,
        successfulSteps: results.filter(r => r.success).length
      };

    } catch (error) {
      logger.error('Agent coordination failed', { coordinationId, error: error.message });

      return {
        success: false,
        coordinationId,
        error: error.message,
        results
      };
    }
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
