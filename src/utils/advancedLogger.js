// src/utils/advancedLogger.js
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const path = require('path');

class AdvancedLogger {
  constructor() {
    this.correlationId = null;
    this.sessionId = null;
    this.userId = null;
    this.agentType = null;
    this.operationStack = [];
    
    // Performance tracking
    this.performanceMetrics = new Map();
    this.operationTimers = new Map();
    
    // Self-healing tracking
    this.healingEvents = [];
    this.systemHealth = {
      agents: {},
      services: {},
      connections: {}
    };
    
    this.initializeLogger();
  }

  initializeLogger() {
    // Create multiple specialized loggers
    this.mainLogger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(info => {
          return JSON.stringify({
            timestamp: info.timestamp,
            level: info.level,
            message: info.message,
            correlationId: this.correlationId,
            sessionId: this.sessionId,
            userId: this.userId,
            agentType: this.agentType,
            operationStack: this.operationStack,
            hostname: os.hostname(),
            pid: process.pid,
            ...info
          });
        })
      ),
      transports: [
        new winston.transports.File({ 
          filename: 'logs/athenai-main.log',
          maxsize: 50 * 1024 * 1024, // 50MB
          maxFiles: 10,
          tailable: true
        }),
        new winston.transports.File({ 
          filename: 'logs/athenai-error.log', 
          level: 'error',
          maxsize: 50 * 1024 * 1024,
          maxFiles: 5
        })
      ]
    });

    // Performance logger
    this.performanceLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ 
          filename: 'logs/athenai-performance.log',
          maxsize: 100 * 1024 * 1024, // 100MB
          maxFiles: 5
        })
      ]
    });

    // Agent execution logger
    this.agentLogger = winston.createLogger({
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ 
          filename: 'logs/athenai-agents.log',
          maxsize: 100 * 1024 * 1024,
          maxFiles: 10
        })
      ]
    });

    // Database operations logger
    this.dbLogger = winston.createLogger({
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ 
          filename: 'logs/athenai-database.log',
          maxsize: 50 * 1024 * 1024,
          maxFiles: 5
        })
      ]
    });

    // WebSocket logger
    this.wsLogger = winston.createLogger({
      level: 'debug',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ 
          filename: 'logs/athenai-websocket.log',
          maxsize: 50 * 1024 * 1024,
          maxFiles: 5
        })
      ]
    });

    // Self-healing logger
    this.healingLogger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ 
          filename: 'logs/athenai-self-healing.log',
          maxsize: 25 * 1024 * 1024,
          maxFiles: 10
        })
      ]
    });

    // Add console transport for development
    if (process.env.NODE_ENV !== 'production') {
      const consoleTransport = new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(info => {
            const correlationInfo = this.correlationId ? `[${this.correlationId.substring(0, 8)}]` : '';
            const agentInfo = this.agentType ? `[${this.agentType}]` : '';
            return `${info.timestamp} ${info.level}: ${correlationInfo}${agentInfo} ${info.message}`;
          })
        )
      });
      
      this.mainLogger.add(consoleTransport);
    }
  }

  // Context management
  setContext({ correlationId, sessionId, userId, agentType }) {
    if (correlationId) this.correlationId = correlationId;
    if (sessionId) this.sessionId = sessionId;
    if (userId) this.userId = userId;
    if (agentType) this.agentType = agentType;
  }

  generateCorrelationId() {
    this.correlationId = uuidv4();
    return this.correlationId;
  }

  pushOperation(operation) {
    this.operationStack.push({
      operation,
      timestamp: new Date().toISOString(),
      id: uuidv4().substring(0, 8)
    });
  }

  popOperation() {
    return this.operationStack.pop();
  }

  clearOperationStack() {
    this.operationStack = [];
  }

  // Performance tracking
  startTimer(operationName, metadata = {}) {
    const timerId = uuidv4();
    this.operationTimers.set(timerId, {
      name: operationName,
      startTime: process.hrtime.bigint(),
      startTimestamp: new Date().toISOString(),
      metadata
    });
    
    this.performanceLogger.info('Operation started', {
      operationName,
      timerId,
      correlationId: this.correlationId,
      sessionId: this.sessionId,
      agentType: this.agentType,
      metadata
    });
    
    return timerId;
  }

  endTimer(timerId, additionalMetadata = {}) {
    const timer = this.operationTimers.get(timerId);
    if (!timer) {
      this.mainLogger.warn('Timer not found', { timerId });
      return null;
    }

    const endTime = process.hrtime.bigint();
    const durationNs = endTime - timer.startTime;
    const durationMs = Number(durationNs) / 1000000;

    const performanceData = {
      operationName: timer.name,
      timerId,
      durationMs,
      durationNs: Number(durationNs),
      startTime: timer.startTimestamp,
      endTime: new Date().toISOString(),
      correlationId: this.correlationId,
      sessionId: this.sessionId,
      agentType: this.agentType,
      metadata: { ...timer.metadata, ...additionalMetadata }
    };

    this.performanceLogger.info('Operation completed', performanceData);
    this.operationTimers.delete(timerId);

    // Store in performance metrics for analysis
    if (!this.performanceMetrics.has(timer.name)) {
      this.performanceMetrics.set(timer.name, []);
    }
    this.performanceMetrics.get(timer.name).push(performanceData);

    return performanceData;
  }

  // Agent execution logging
  logAgentStart(agentType, input, context = {}) {
    this.agentLogger.info('Agent execution started', {
      agentType,
      input: typeof input === 'string' ? input.substring(0, 500) : input,
      correlationId: this.correlationId,
      sessionId: this.sessionId,
      userId: this.userId,
      context,
      timestamp: new Date().toISOString()
    });
  }

  logAgentStep(agentType, step, data, metadata = {}) {
    this.agentLogger.debug('Agent execution step', {
      agentType,
      step,
      data: typeof data === 'string' ? data.substring(0, 1000) : data,
      correlationId: this.correlationId,
      sessionId: this.sessionId,
      metadata,
      timestamp: new Date().toISOString()
    });
  }

  logAgentEnd(agentType, result, metrics = {}) {
    this.agentLogger.info('Agent execution completed', {
      agentType,
      result: typeof result === 'string' ? result.substring(0, 500) : result,
      correlationId: this.correlationId,
      sessionId: this.sessionId,
      metrics,
      timestamp: new Date().toISOString()
    });
  }

  logAgentError(agentType, error, context = {}) {
    this.agentLogger.error('Agent execution error', {
      agentType,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      correlationId: this.correlationId,
      sessionId: this.sessionId,
      context,
      timestamp: new Date().toISOString()
    });
  }

  // Database operation logging
  logDbOperation(operation, table, query, params = {}, performance = {}) {
    this.dbLogger.debug('Database operation', {
      operation,
      table,
      query: typeof query === 'string' ? query.substring(0, 1000) : query,
      params,
      performance,
      correlationId: this.correlationId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString()
    });
  }

  logDbError(operation, error, context = {}) {
    this.dbLogger.error('Database operation error', {
      operation,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code
      },
      context,
      correlationId: this.correlationId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString()
    });
  }

  // WebSocket logging
  logWsConnection(socketId, userId, metadata = {}) {
    this.wsLogger.info('WebSocket connection established', {
      socketId,
      userId,
      metadata,
      correlationId: this.correlationId,
      timestamp: new Date().toISOString()
    });
  }

  logWsDisconnection(socketId, reason, metadata = {}) {
    this.wsLogger.info('WebSocket connection closed', {
      socketId,
      reason,
      metadata,
      correlationId: this.correlationId,
      timestamp: new Date().toISOString()
    });
  }

  logWsMessage(direction, event, data, socketId, metadata = {}) {
    this.wsLogger.debug('WebSocket message', {
      direction, // 'inbound' or 'outbound'
      event,
      data: typeof data === 'object' ? JSON.stringify(data).substring(0, 1000) : String(data).substring(0, 1000),
      socketId,
      metadata,
      correlationId: this.correlationId,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString()
    });
  }

  logWsError(event, error, socketId, context = {}) {
    this.wsLogger.error('WebSocket error', {
      event,
      error: {
        message: error.message,
        stack: error.stack
      },
      socketId,
      context,
      correlationId: this.correlationId,
      timestamp: new Date().toISOString()
    });
  }

  // Self-healing logging
  logHealthCheck(component, status, metrics = {}, issues = []) {
    const healthData = {
      component,
      status, // 'healthy', 'degraded', 'unhealthy'
      metrics,
      issues,
      correlationId: this.correlationId,
      timestamp: new Date().toISOString()
    };

    this.healingLogger.info('Health check completed', healthData);
    
    // Update system health state
    this.systemHealth[component] = healthData;
    
    return healthData;
  }

  logHealingTrigger(trigger, component, issue, severity, context = {}) {
    const healingEvent = {
      id: uuidv4(),
      trigger, // 'error_threshold', 'performance_degradation', 'manual', etc.
      component,
      issue,
      severity, // 'low', 'medium', 'high', 'critical'
      context,
      correlationId: this.correlationId,
      timestamp: new Date().toISOString()
    };

    this.healingLogger.warn('Self-healing triggered', healingEvent);
    this.healingEvents.push(healingEvent);
    
    return healingEvent;
  }

  logHealingAction(eventId, action, result, metadata = {}) {
    const actionData = {
      eventId,
      action, // 'restart_agent', 'clear_cache', 'reconnect_db', etc.
      result, // 'success', 'failure', 'partial'
      metadata,
      correlationId: this.correlationId,
      timestamp: new Date().toISOString()
    };

    this.healingLogger.info('Self-healing action executed', actionData);
    
    // Update healing event with action result
    const event = this.healingEvents.find(e => e.id === eventId);
    if (event) {
      if (!event.actions) event.actions = [];
      event.actions.push(actionData);
    }
    
    return actionData;
  }

  logSystemMetrics(metrics) {
    this.performanceLogger.info('System metrics', {
      ...metrics,
      correlationId: this.correlationId,
      timestamp: new Date().toISOString(),
      hostname: os.hostname(),
      pid: process.pid,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    });
  }

  // Utility methods for monitoring
  getPerformanceMetrics(operationName = null) {
    if (operationName) {
      return this.performanceMetrics.get(operationName) || [];
    }
    return Object.fromEntries(this.performanceMetrics);
  }

  getSystemHealth() {
    return {
      ...this.systemHealth,
      lastUpdated: new Date().toISOString(),
      healingEvents: this.healingEvents.slice(-10) // Last 10 events
    };
  }

  clearPerformanceMetrics() {
    this.performanceMetrics.clear();
  }

  // Standard logging methods with enhanced context
  debug(message, metadata = {}) {
    this.mainLogger.debug(message, { ...metadata, operationStack: this.operationStack });
  }

  info(message, metadata = {}) {
    this.mainLogger.info(message, { ...metadata, operationStack: this.operationStack });
  }

  warn(message, metadata = {}) {
    this.mainLogger.warn(message, { ...metadata, operationStack: this.operationStack });
  }

  error(message, error = null, metadata = {}) {
    const errorData = error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    } : null;

    this.mainLogger.error(message, { 
      ...metadata, 
      error: errorData,
      operationStack: this.operationStack 
    });
  }
}

// Create singleton instance
const advancedLogger = new AdvancedLogger();

module.exports = { 
  AdvancedLogger, 
  advancedLogger,
  // Convenience methods for quick access
  setLogContext: (context) => advancedLogger.setContext(context),
  generateCorrelationId: () => advancedLogger.generateCorrelationId(),
  startTimer: (name, metadata) => advancedLogger.startTimer(name, metadata),
  endTimer: (timerId, metadata) => advancedLogger.endTimer(timerId, metadata)
};
