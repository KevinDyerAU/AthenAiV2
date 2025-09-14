// src/utils/selfHealingAgent.js
const { advancedLogger } = require('./advancedLogger');
const { monitoringCollector } = require('./monitoringCollector');
const { ErrorHandler } = require('./errorHandler');

class SelfHealingAgent {
  constructor() {
    this.healingActions = new Map();
    this.healthThresholds = {
      errorRate: 0.15, // 15% error rate triggers healing
      responseTime: 10000, // 10 seconds
      memoryUsage: 0.85, // 85% memory usage
      agentFailureRate: 0.2, // 20% agent failure rate
      dbConnectionFailures: 5, // 5 consecutive DB failures
      websocketDisconnections: 10 // 10 disconnections per minute
    };
    
    this.healingStrategies = {
      'high_error_rate': this.handleHighErrorRate.bind(this),
      'slow_response': this.handleSlowResponse.bind(this),
      'memory_pressure': this.handleMemoryPressure.bind(this),
      'agent_failures': this.handleAgentFailures.bind(this),
      'database_issues': this.handleDatabaseIssues.bind(this),
      'websocket_issues': this.handleWebSocketIssues.bind(this),
      'ai_api_failures': this.handleAIAPIFailures.bind(this)
    };
    
    this.cooldownPeriods = new Map(); // Prevent rapid repeated healing actions
    this.healingHistory = [];
    
    this.startHealthMonitoring();
  }

  startHealthMonitoring() {
    // Monitor system health every 30 seconds
    setInterval(() => {
      this.performHealthCheck();
    }, 30000);
    
    // Clean up old healing history every hour
    setInterval(() => {
      this.cleanupHealingHistory();
    }, 3600000);
  }

  async performHealthCheck() {
    try {
      const metrics = monitoringCollector.getMetrics();
      const health = monitoringCollector.performHealthCheck();
      
      advancedLogger.logHealthCheck('system', health.status, metrics);
      
      // Check each health metric and trigger healing if needed
      await this.checkErrorRate(metrics);
      await this.checkResponseTimes(metrics);
      await this.checkMemoryUsage(metrics);
      await this.checkAgentPerformance(metrics);
      await this.checkDatabaseHealth(metrics);
      await this.checkWebSocketHealth(metrics);
      
    } catch (error) {
      advancedLogger.error('Health check failed', error, { component: 'self_healing_agent' });
    }
  }

  async checkErrorRate(metrics) {
    const errorRate = metrics.gauges.errorRate || 0;
    
    if (errorRate > this.healthThresholds.errorRate) {
      await this.triggerHealing('high_error_rate', 'critical', {
        currentErrorRate: errorRate,
        threshold: this.healthThresholds.errorRate,
        totalErrors: metrics.counters.errors,
        totalRequests: metrics.counters.requests
      });
    }
  }

  async checkResponseTimes(metrics) {
    const responseTimeStats = metrics.histograms.responseTime;
    
    if (responseTimeStats && responseTimeStats.p95 > this.healthThresholds.responseTime) {
      await this.triggerHealing('slow_response', 'warning', {
        p95ResponseTime: responseTimeStats.p95,
        threshold: this.healthThresholds.responseTime,
        avgResponseTime: responseTimeStats.avg
      });
    }
  }

  async checkMemoryUsage(metrics) {
    const memoryUsage = metrics.gauges.memoryUsage || 0;
    
    if (memoryUsage > this.healthThresholds.memoryUsage) {
      await this.triggerHealing('memory_pressure', 'warning', {
        currentMemoryUsage: memoryUsage,
        threshold: this.healthThresholds.memoryUsage,
        heapUsed: metrics.gauges.memoryHeapUsed,
        heapTotal: metrics.gauges.memoryHeapTotal
      });
    }
  }

  async checkAgentPerformance(metrics) {
    const agentStats = metrics.histograms.agentExecutionTime;
    
    if (agentStats && agentStats.count > 10) {
      // Calculate agent failure rate from recent executions
      const recentFailures = this.getRecentAgentFailures();
      const failureRate = recentFailures / agentStats.count;
      
      if (failureRate > this.healthThresholds.agentFailureRate) {
        await this.triggerHealing('agent_failures', 'high', {
          failureRate,
          threshold: this.healthThresholds.agentFailureRate,
          recentFailures,
          totalExecutions: agentStats.count
        });
      }
    }
  }

  async checkDatabaseHealth(metrics) {
    const dbStats = metrics.histograms.dbQueryTime;
    
    if (dbStats && dbStats.p95 > 5000) { // 5 second DB queries
      await this.triggerHealing('database_issues', 'high', {
        p95QueryTime: dbStats.p95,
        avgQueryTime: dbStats.avg,
        slowQueries: dbStats.count
      });
    }
  }

  async checkWebSocketHealth(metrics) {
    const wsConnections = metrics.gauges.activeConnections || 0;
    const wsMessageStats = metrics.histograms.messageProcessingTime;
    
    if (wsMessageStats && wsMessageStats.p95 > 3000) { // 3 second message processing
      await this.triggerHealing('websocket_issues', 'medium', {
        p95MessageTime: wsMessageStats.p95,
        activeConnections: wsConnections,
        messageCount: wsMessageStats.count
      });
    }
  }

  async triggerHealing(issueType, severity, context) {
    const cooldownKey = `${issueType}_${severity}`;
    const now = Date.now();
    
    // Check cooldown period to prevent rapid repeated actions
    if (this.cooldownPeriods.has(cooldownKey)) {
      const lastAction = this.cooldownPeriods.get(cooldownKey);
      const cooldownTime = this.getCooldownTime(severity);
      
      if (now - lastAction < cooldownTime) {
        advancedLogger.debug('Healing action in cooldown', { 
          issueType, severity, cooldownRemaining: cooldownTime - (now - lastAction) 
        });
        return;
      }
    }

    // Log the healing trigger
    const healingEvent = advancedLogger.logHealingTrigger(
      'automated_monitoring', 
      'system', 
      issueType, 
      severity, 
      context
    );

    // Execute healing strategy
    const strategy = this.healingStrategies[issueType];
    if (strategy) {
      try {
        const result = await strategy(context, healingEvent.id);
        
        advancedLogger.logHealingAction(healingEvent.id, issueType, result.success ? 'success' : 'failure', {
          actions: result.actions,
          duration: result.duration,
          context
        });
        
        // Set cooldown period
        this.cooldownPeriods.set(cooldownKey, now);
        
        // Record healing history
        this.healingHistory.push({
          ...healingEvent,
          result,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        advancedLogger.logHealingAction(healingEvent.id, issueType, 'failure', {
          error: error.message,
          context
        });
      }
    } else {
      advancedLogger.warn('No healing strategy found', { issueType, severity });
    }
  }

  async handleHighErrorRate(context, eventId) {
    const startTime = Date.now();
    const actions = [];
    
    try {
      // 1. Clear any cached data that might be causing issues
      actions.push('clear_cache');
      await this.clearSystemCaches();
      
      // 2. Restart problematic agents
      actions.push('restart_agents');
      await this.restartAgents();
      
      // 3. Reset error counters to get fresh metrics
      actions.push('reset_metrics');
      monitoringCollector.reset();
      
      // 4. Increase logging verbosity temporarily
      actions.push('increase_logging');
      await this.temporaryVerboseLogging();
      
      return {
        success: true,
        actions,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        actions,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  async handleSlowResponse(context, eventId) {
    const startTime = Date.now();
    const actions = [];
    
    try {
      // 1. Clear response caches
      actions.push('clear_response_cache');
      await this.clearResponseCaches();
      
      // 2. Optimize database connections
      actions.push('optimize_db_connections');
      await this.optimizeDatabaseConnections();
      
      // 3. Reduce agent complexity temporarily
      actions.push('simplify_agents');
      await this.simplifyAgentResponses();
      
      return {
        success: true,
        actions,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        actions,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  async handleMemoryPressure(context, eventId) {
    const startTime = Date.now();
    const actions = [];
    
    try {
      // 1. Force garbage collection
      actions.push('force_gc');
      if (global.gc) {
        global.gc();
      }
      
      // 2. Clear large caches
      actions.push('clear_large_caches');
      await this.clearLargeCaches();
      
      // 3. Reduce concurrent operations
      actions.push('reduce_concurrency');
      await this.reduceConcurrency();
      
      // 4. Clean up old data
      actions.push('cleanup_old_data');
      await this.cleanupOldData();
      
      return {
        success: true,
        actions,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        actions,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  async handleAgentFailures(context, eventId) {
    const startTime = Date.now();
    const actions = [];
    
    try {
      // 1. Reset agent states
      actions.push('reset_agent_states');
      await this.resetAgentStates();
      
      // 2. Switch to fallback models
      actions.push('switch_to_fallback');
      await this.switchToFallbackModels();
      
      // 3. Reduce agent complexity
      actions.push('simplify_agent_tasks');
      await this.simplifyAgentTasks();
      
      return {
        success: true,
        actions,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        actions,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  async handleDatabaseIssues(context, eventId) {
    const startTime = Date.now();
    const actions = [];
    
    try {
      // 1. Restart database connections
      actions.push('restart_db_connections');
      await this.restartDatabaseConnections();
      
      // 2. Clear query caches
      actions.push('clear_query_cache');
      await this.clearQueryCaches();
      
      // 3. Switch to read-only mode temporarily
      actions.push('enable_readonly_mode');
      await this.enableReadOnlyMode();
      
      return {
        success: true,
        actions,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        actions,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  async handleWebSocketIssues(context, eventId) {
    const startTime = Date.now();
    const actions = [];
    
    try {
      // 1. Clear WebSocket message queues
      actions.push('clear_ws_queues');
      await this.clearWebSocketQueues();
      
      // 2. Restart WebSocket server
      actions.push('restart_ws_server');
      await this.restartWebSocketServer();
      
      // 3. Reduce message complexity
      actions.push('simplify_ws_messages');
      await this.simplifyWebSocketMessages();
      
      return {
        success: true,
        actions,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        actions,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  async handleAIAPIFailures(context, eventId) {
    const startTime = Date.now();
    const actions = [];
    
    try {
      // 1. Switch to backup AI provider
      actions.push('switch_ai_provider');
      await this.switchAIProvider();
      
      // 2. Reduce AI request complexity
      actions.push('simplify_ai_requests');
      await this.simplifyAIRequests();
      
      // 3. Implement exponential backoff
      actions.push('implement_backoff');
      await this.implementExponentialBackoff();
      
      return {
        success: true,
        actions,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      return {
        success: false,
        actions,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  // Helper methods for healing actions
  async clearSystemCaches() {
    // Clear various system caches
    advancedLogger.info('Clearing system caches for healing');
    // Implementation would clear Redis, memory caches, etc.
  }

  async restartAgents() {
    advancedLogger.info('Restarting agents for healing');
    // Implementation would reinitialize agent instances
  }

  async temporaryVerboseLogging() {
    advancedLogger.info('Enabling temporary verbose logging');
    // Implementation would increase log levels temporarily
  }

  async clearResponseCaches() {
    advancedLogger.info('Clearing response caches');
    // Implementation would clear response caches
  }

  async optimizeDatabaseConnections() {
    advancedLogger.info('Optimizing database connections');
    // Implementation would optimize DB connection pools
  }

  async simplifyAgentResponses() {
    advancedLogger.info('Simplifying agent responses');
    // Implementation would reduce agent complexity
  }

  async clearLargeCaches() {
    advancedLogger.info('Clearing large caches to free memory');
    // Implementation would clear large memory structures
  }

  async reduceConcurrency() {
    advancedLogger.info('Reducing concurrent operations');
    // Implementation would limit concurrent operations
  }

  async cleanupOldData() {
    advancedLogger.info('Cleaning up old data');
    // Implementation would remove old logs, caches, etc.
  }

  async resetAgentStates() {
    advancedLogger.info('Resetting agent states');
    // Implementation would reset agent internal states
  }

  async switchToFallbackModels() {
    advancedLogger.info('Switching to fallback AI models');
    // Implementation would switch to backup AI providers
  }

  async simplifyAgentTasks() {
    advancedLogger.info('Simplifying agent tasks');
    // Implementation would reduce task complexity
  }

  async restartDatabaseConnections() {
    advancedLogger.info('Restarting database connections');
    // Implementation would restart DB connections
  }

  async clearQueryCaches() {
    advancedLogger.info('Clearing database query caches');
    // Implementation would clear query caches
  }

  async enableReadOnlyMode() {
    advancedLogger.info('Enabling read-only mode');
    // Implementation would switch to read-only operations
  }

  async clearWebSocketQueues() {
    advancedLogger.info('Clearing WebSocket message queues');
    // Implementation would clear WS queues
  }

  async restartWebSocketServer() {
    advancedLogger.info('Restarting WebSocket server');
    // Implementation would restart WS server
  }

  async simplifyWebSocketMessages() {
    advancedLogger.info('Simplifying WebSocket messages');
    // Implementation would reduce message complexity
  }

  async switchAIProvider() {
    advancedLogger.info('Switching AI provider');
    // Implementation would switch between OpenAI/OpenRouter
  }

  async simplifyAIRequests() {
    advancedLogger.info('Simplifying AI requests');
    // Implementation would reduce AI request complexity
  }

  async implementExponentialBackoff() {
    advancedLogger.info('Implementing exponential backoff');
    // Implementation would add backoff logic
  }

  getCooldownTime(severity) {
    switch (severity) {
      case 'critical': return 60000; // 1 minute
      case 'high': return 300000; // 5 minutes
      case 'warning': return 600000; // 10 minutes
      case 'medium': return 900000; // 15 minutes
      default: return 1800000; // 30 minutes
    }
  }

  getRecentAgentFailures() {
    // This would analyze recent agent execution logs
    // For now, return a placeholder
    return 0;
  }

  cleanupHealingHistory() {
    const oneHourAgo = Date.now() - 3600000;
    this.healingHistory = this.healingHistory.filter(
      event => new Date(event.timestamp).getTime() > oneHourAgo
    );
  }

  getHealingStatus() {
    return {
      recentActions: this.healingHistory.slice(-10),
      activeCooldowns: Array.from(this.cooldownPeriods.entries()).map(([key, time]) => ({
        action: key,
        cooldownUntil: new Date(time + this.getCooldownTime('medium')).toISOString()
      })),
      healthThresholds: this.healthThresholds,
      availableStrategies: Object.keys(this.healingStrategies)
    };
  }
}

// Create singleton instance
const selfHealingAgent = new SelfHealingAgent();

module.exports = { SelfHealingAgent, selfHealingAgent };
