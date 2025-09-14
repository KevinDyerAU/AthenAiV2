// src/utils/selfHealingAgent.js
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { advancedLogger } = require('./advancedLogger');
const monitoringCollector = require('./monitoringCollector');
const databaseService = require('../services/database');
const SemanticSimilarity = require('./semanticSimilarity');
const { ChatOpenAI } = require('@langchain/openai');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');

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
    
    // Knowledge substrate integration
    this.semanticSimilarity = new SemanticSimilarity();
    this.knowledgeCache = new Map();
    this.learningEnabled = true;
    this.predictionThreshold = 0.75; // Similarity threshold for pattern matching
    
    // Initialize AI reasoning capabilities
    this.llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENROUTER_API_KEY,
      modelName: process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
      temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE) || 0.1,
      configuration: {
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://athenai.dev',
          'X-Title': 'AthenAI Self-Healing Agent'
        }
      }
    });
    
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
    
    // Predictive analysis every 5 minutes
    setInterval(() => {
      this.performPredictiveAnalysis();
    }, 300000);
    
    // Knowledge substrate sync every 10 minutes
    setInterval(() => {
      this.syncKnowledgeSubstrate();
    }, 600000);
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

    // Use AI reasoning to analyze the situation before healing
    const aiAnalysis = await this.thinkAboutHealing(issueType, severity, context);
    
    // Query knowledge substrate for similar incidents and successful strategies
    const knowledgeContext = await this.queryHealingKnowledge(issueType, context);
    const enhancedContext = { ...context, knowledgeContext, aiAnalysis };

    // Log the healing trigger with knowledge context
    const healingEvent = advancedLogger.logHealingTrigger(
      'automated_monitoring', 
      'system', 
      issueType, 
      severity, 
      enhancedContext
    );

    // Execute healing strategy with knowledge-informed decisions
    const strategy = this.healingStrategies[issueType];
    if (strategy) {
      try {
        const result = await strategy(enhancedContext, healingEvent.id);
        
        advancedLogger.logHealingAction(healingEvent.id, issueType, result.success ? 'success' : 'failure', {
          actions: result.actions,
          duration: result.duration,
          context: enhancedContext,
          knowledgeUsed: knowledgeContext.similarIncidents?.length || 0
        });
        
        // Store healing outcome in knowledge substrate for future learning
        await this.storeHealingOutcome(healingEvent.id, issueType, context, result);
        
        // Set cooldown period
        this.cooldownPeriods.set(cooldownKey, now);
        
        // Record healing history
        this.healingHistory.push({
          ...healingEvent,
          result,
          knowledgeContext,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        advancedLogger.logHealingAction(healingEvent.id, issueType, 'failure', {
          error: error.message,
          context: enhancedContext
        });
        
        // Store failure for learning
        await this.storeHealingOutcome(healingEvent.id, issueType, context, { 
          success: false, 
          error: error.message 
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
      // Use knowledge context to inform healing decisions
      const knowledgeContext = context.knowledgeContext || {};
      const similarIncidents = knowledgeContext.similarIncidents || [];
      
      // Prioritize actions based on past success rates
      const prioritizedActions = this.prioritizeActionsFromKnowledge(similarIncidents, [
        'clear_cache', 'restart_agents', 'reset_metrics', 'increase_logging'
      ]);
      
      for (const action of prioritizedActions) {
        actions.push(action);
        
        switch (action) {
          case 'clear_cache':
            await this.clearSystemCaches();
            break;
          case 'restart_agents':
            await this.restartAgents();
            break;
          case 'reset_metrics':
            monitoringCollector.reset();
            break;
          case 'increase_logging':
            await this.temporaryVerboseLogging();
            break;
        }
        
        // Check if error rate improved after each action
        const currentMetrics = monitoringCollector.getMetrics();
        if (currentMetrics.gauges.errorRate < context.currentErrorRate * 0.8) {
          advancedLogger.info('Error rate improved, stopping healing actions', {
            action,
            newErrorRate: currentMetrics.gauges.errorRate,
            originalErrorRate: context.currentErrorRate
          });
          break;
        }
      }
      
      return {
        success: true,
        actions,
        duration: Date.now() - startTime,
        knowledgeInformed: similarIncidents.length > 0
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

  // AI reasoning tool for intelligent healing decisions
  async thinkAboutHealing(issueType, severity, context) {
    try {
      const prompt = PromptTemplate.fromTemplate(`
        You are an expert system administrator analyzing a critical system issue that requires healing action.
        
        ISSUE DETAILS:
        - Issue Type: {issueType}
        - Severity: {severity}
        - System Context: {context}
        
        CURRENT SYSTEM METRICS:
        - Error Rate: {errorRate}%
        - Response Time P95: {responseTime}ms
        - Memory Usage: {memoryUsage}%
        - Active Connections: {connections}
        
        Please analyze this situation step-by-step:
        
        1. ROOT CAUSE ANALYSIS: What are the most likely root causes of this {issueType} issue?
        
        2. IMPACT ASSESSMENT: How severe is this issue and what systems/users are affected?
        
        3. HEALING STRATEGY: What healing actions should be prioritized and why?
        
        4. RISK EVALUATION: What are the risks of each potential healing action?
        
        5. SUCCESS CRITERIA: How will we know if the healing actions are successful?
        
        6. MONITORING FOCUS: What specific metrics should we monitor during and after healing?
        
        Provide a concise but thorough analysis focusing on actionable insights for automated healing.
      `);

      const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
      
      const systemMetrics = monitoringCollector.getMetrics();
      
      const analysis = await chain.invoke({
        issueType,
        severity,
        context: JSON.stringify(context, null, 2),
        errorRate: ((systemMetrics.gauges?.errorRate || 0) * 100).toFixed(2),
        responseTime: systemMetrics.histograms?.responseTime?.p95 || 0,
        memoryUsage: ((systemMetrics.gauges?.memoryUsage || 0) * 100).toFixed(2),
        connections: systemMetrics.gauges?.activeConnections || 0
      });

      advancedLogger.info('AI healing analysis completed', {
        issueType,
        severity,
        analysisLength: analysis.length
      });

      return {
        analysis,
        timestamp: new Date().toISOString(),
        confidence: 'high' // Could be enhanced with confidence scoring
      };

    } catch (error) {
      advancedLogger.error('AI healing analysis failed', error, {
        issueType,
        severity
      });
      
      // Fallback to basic analysis
      return {
        analysis: `Basic analysis for ${issueType} (${severity}): System requires immediate attention based on current metrics.`,
        timestamp: new Date().toISOString(),
        confidence: 'low',
        fallback: true
      };
    }
  }

  // Knowledge substrate integration methods
  async queryHealingKnowledge(issueType, context) {
    try {
      // Create a context signature for similarity matching
      const contextSignature = this.createContextSignature(issueType, context);
      
      // Query knowledge substrate for similar healing incidents
      const similarIncidents = await this.findSimilarHealingIncidents(contextSignature);
      
      // Get successful healing patterns for this issue type
      const successfulPatterns = await this.getSuccessfulHealingPatterns(issueType);
      
      // Get predictive indicators
      const predictiveIndicators = await this.getPredictiveIndicators(issueType, context);
      
      return {
        similarIncidents,
        successfulPatterns,
        predictiveIndicators,
        contextSignature
      };
    } catch (error) {
      advancedLogger.error('Failed to query healing knowledge', error, { issueType });
      return { similarIncidents: [], successfulPatterns: [], predictiveIndicators: [] };
    }
  }

  async storeHealingOutcome(eventId, issueType, context, result) {
    try {
      const healingData = {
        event_id: eventId,
        issue_type: issueType,
        context_signature: this.createContextSignature(issueType, context),
        context_hash: this.hashContext(context),
        actions_taken: result.actions || [],
        success: result.success,
        duration_ms: result.duration,
        error_message: result.error,
        system_metrics: monitoringCollector.getMetrics(),
        timestamp: new Date().toISOString(),
        metadata: {
          knowledgeInformed: result.knowledgeInformed || false,
          originalContext: context,
          healingStrategy: issueType
        }
      };

      // Store in knowledge substrate
      await databaseService.storeHealingInsights(healingData);
      
      advancedLogger.info('Stored healing outcome in knowledge substrate', {
        eventId,
        issueType,
        success: result.success
      });
      
    } catch (error) {
      advancedLogger.error('Failed to store healing outcome', error, { eventId, issueType });
    }
  }

  async findSimilarHealingIncidents(contextSignature) {
    try {
      // Use semantic similarity to find similar past incidents
      const recentIncidents = await databaseService.getHealingInsightsForSimilarity('system', 20);
      
      if (recentIncidents.length === 0) return [];
      
      const similarities = recentIncidents.map(incident => {
        const similarity = this.semanticSimilarity.calculateSimilarity(
          contextSignature,
          incident.context_signature || ''
        );
        
        return {
          ...incident,
          similarity_score: similarity
        };
      });
      
      // Return incidents above similarity threshold, sorted by similarity
      return similarities
        .filter(incident => incident.similarity_score >= this.predictionThreshold)
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, 5); // Top 5 most similar incidents
        
    } catch (error) {
      advancedLogger.error('Failed to find similar healing incidents', error);
      return [];
    }
  }

  async getSuccessfulHealingPatterns(issueType) {
    try {
      // Query for successful healing patterns for this issue type
      const successfulIncidents = await databaseService.getSuccessfulHealingPatterns(issueType);
      
      // Analyze patterns in successful actions
      const actionSuccessRates = {};
      successfulIncidents.forEach(incident => {
        if (incident.actions_taken && Array.isArray(incident.actions_taken)) {
          incident.actions_taken.forEach(action => {
            if (!actionSuccessRates[action]) {
              actionSuccessRates[action] = { successes: 0, total: 0 };
            }
            actionSuccessRates[action].successes++;
            actionSuccessRates[action].total++;
          });
        }
      });
      
      // Calculate success rates
      const patterns = Object.entries(actionSuccessRates).map(([action, stats]) => ({
        action,
        successRate: stats.successes / stats.total,
        totalOccurrences: stats.total
      })).sort((a, b) => b.successRate - a.successRate);
      
      return patterns;
      
    } catch (error) {
      advancedLogger.error('Failed to get successful healing patterns', error, { issueType });
      return [];
    }
  }

  async getPredictiveIndicators(issueType, context) {
    try {
      // Look for patterns that preceded similar issues
      const precedingPatterns = await databaseService.getHealingPrecedingPatterns(issueType);
      
      // Check if current context matches any predictive patterns
      const matchingIndicators = precedingPatterns.filter(pattern => {
        return this.contextMatchesPattern(context, pattern);
      });
      
      return matchingIndicators;
      
    } catch (error) {
      advancedLogger.error('Failed to get predictive indicators', error, { issueType });
      return [];
    }
  }

  async performPredictiveAnalysis() {
    try {
      const currentMetrics = monitoringCollector.getMetrics();
      
      // Check for patterns that historically led to issues
      const riskPatterns = await this.identifyRiskPatterns(currentMetrics);
      
      for (const pattern of riskPatterns) {
        if (pattern.riskScore > 0.8) {
          advancedLogger.warn('Predictive analysis detected high risk pattern', {
            pattern: pattern.type,
            riskScore: pattern.riskScore,
            predictedIssue: pattern.predictedIssue
          });
          
          // Proactively trigger preventive healing
          await this.triggerPreventiveHealing(pattern);
        }
      }
      
    } catch (error) {
      advancedLogger.error('Predictive analysis failed', error);
    }
  }

  async syncKnowledgeSubstrate() {
    try {
      // Sync local healing history with knowledge substrate
      const unsyncedEvents = this.healingHistory.filter(event => !event.synced);
      
      for (const event of unsyncedEvents) {
        await this.storeHealingOutcome(
          event.id,
          event.issue,
          event.context,
          event.result
        );
        event.synced = true;
      }
      
      // Update knowledge cache with recent learnings
      await this.updateKnowledgeCache();
      
      advancedLogger.debug('Knowledge substrate sync completed', {
        syncedEvents: unsyncedEvents.length
      });
      
    } catch (error) {
      advancedLogger.error('Knowledge substrate sync failed', error);
    }
  }

  prioritizeActionsFromKnowledge(similarIncidents, defaultActions) {
    if (similarIncidents.length === 0) return defaultActions;
    
    // Calculate action success rates from similar incidents
    const actionStats = {};
    
    similarIncidents.forEach(incident => {
      if (incident.actions_taken && incident.success) {
        incident.actions_taken.forEach(action => {
          if (!actionStats[action]) {
            actionStats[action] = { successes: 0, total: 0 };
          }
          actionStats[action].successes++;
          actionStats[action].total++;
        });
      }
    });
    
    // Sort actions by success rate, fallback to default order
    const prioritized = defaultActions.sort((a, b) => {
      const aRate = actionStats[a] ? actionStats[a].successes / actionStats[a].total : 0;
      const bRate = actionStats[b] ? actionStats[b].successes / actionStats[b].total : 0;
      return bRate - aRate;
    });
    
    return prioritized;
  }

  createContextSignature(issueType, context) {
    // Create a normalized string representation of the context for similarity matching
    const signature = [
      issueType,
      context.currentErrorRate?.toFixed(2) || '0',
      context.p95ResponseTime?.toString() || '0',
      context.currentMemoryUsage?.toFixed(2) || '0',
      context.failureRate?.toFixed(2) || '0',
      Object.keys(context).sort().join(',')
    ].join('|');
    
    return signature;
  }

  hashContext(context) {
    return crypto.createHash('md5')
      .update(JSON.stringify(context, Object.keys(context).sort()))
      .digest('hex');
  }

  contextMatchesPattern(context, pattern) {
    // Simple pattern matching - could be enhanced with ML
    const contextStr = JSON.stringify(context).toLowerCase();
    const patternStr = JSON.stringify(pattern).toLowerCase();
    
    return this.semanticSimilarity.calculateSimilarity(contextStr, patternStr) > 0.7;
  }

  async identifyRiskPatterns(metrics) {
    // Analyze current metrics for patterns that historically led to issues
    const riskPatterns = [];
    
    // Memory usage trending upward
    if (metrics.gauges.memoryUsage > 0.7) {
      riskPatterns.push({
        type: 'memory_trend',
        riskScore: metrics.gauges.memoryUsage,
        predictedIssue: 'memory_pressure'
      });
    }
    
    // Error rate increasing
    if (metrics.gauges.errorRate > 0.05) {
      riskPatterns.push({
        type: 'error_trend',
        riskScore: metrics.gauges.errorRate * 10, // Scale to 0-1
        predictedIssue: 'high_error_rate'
      });
    }
    
    // Response time degradation
    const responseTimeP95 = metrics.histograms.responseTime?.p95 || 0;
    if (responseTimeP95 > 5000) {
      riskPatterns.push({
        type: 'performance_trend',
        riskScore: Math.min(responseTimeP95 / 10000, 1), // Scale to 0-1
        predictedIssue: 'slow_response'
      });
    }
    
    return riskPatterns;
  }

  async triggerPreventiveHealing(pattern) {
    advancedLogger.info('Triggering preventive healing', {
      pattern: pattern.type,
      predictedIssue: pattern.predictedIssue,
      riskScore: pattern.riskScore
    });
    
    // Trigger healing with preventive context
    await this.triggerHealing(pattern.predictedIssue, 'warning', {
      preventive: true,
      riskPattern: pattern,
      currentMetrics: monitoringCollector.getMetrics()
    });
  }

  async updateKnowledgeCache() {
    // Update local cache with recent knowledge substrate learnings
    try {
      const recentLearnings = await databaseService.getRecentHealingInsights(24); // Last 24 hours
      
      recentLearnings.forEach(learning => {
        this.knowledgeCache.set(learning.context_hash, {
          actions: learning.actions_taken,
          success: learning.success,
          timestamp: learning.timestamp
        });
      });
      
      // Limit cache size
      if (this.knowledgeCache.size > 1000) {
        const entries = Array.from(this.knowledgeCache.entries());
        entries.sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));
        this.knowledgeCache.clear();
        entries.slice(0, 500).forEach(([key, value]) => {
          this.knowledgeCache.set(key, value);
        });
      }
      
    } catch (error) {
      advancedLogger.error('Failed to update knowledge cache', error);
    }
  }

  getHealingStatus() {
    return {
      recentActions: this.healingHistory.slice(-10),
      activeCooldowns: Array.from(this.cooldownPeriods.entries()).map(([key, time]) => ({
        action: key,
        cooldownUntil: new Date(time + this.getCooldownTime('medium')).toISOString()
      })),
      healthThresholds: this.healthThresholds,
      availableStrategies: Object.keys(this.healingStrategies),
      knowledgeSubstrate: {
        cacheSize: this.knowledgeCache.size,
        learningEnabled: this.learningEnabled,
        predictionThreshold: this.predictionThreshold
      }
    };
  }
}

// Create singleton instance
const selfHealingAgent = new SelfHealingAgent();

module.exports = { SelfHealingAgent, selfHealingAgent };
