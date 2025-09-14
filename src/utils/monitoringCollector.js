// src/utils/monitoringCollector.js
const { advancedLogger } = require('./advancedLogger');
const os = require('os');
const { performance } = require('perf_hooks');

class MonitoringCollector {
  constructor() {
    this.metrics = new Map();
    this.alerts = [];
    this.thresholds = {
      responseTime: 5000, // 5 seconds
      errorRate: 0.1, // 10%
      memoryUsage: 0.8, // 80%
      cpuUsage: 0.8, // 80%
      dbConnectionTime: 2000, // 2 seconds
      agentExecutionTime: 30000, // 30 seconds
      websocketConnections: 1000
    };
    
    this.counters = {
      requests: 0,
      errors: 0,
      agentExecutions: 0,
      dbQueries: 0,
      websocketMessages: 0,
      healingActions: 0
    };

    this.gauges = {
      activeConnections: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      dbConnectionPool: 0,
      activeAgents: 0
    };

    this.histograms = {
      responseTime: [],
      dbQueryTime: [],
      agentExecutionTime: [],
      messageProcessingTime: []
    };

    // Start periodic collection
    this.startPeriodicCollection();
  }

  // Counter methods
  incrementCounter(name, value = 1, labels = {}) {
    if (this.counters.hasOwnProperty(name)) {
      this.counters[name] += value;
    }
    
    const metricKey = `${name}_${JSON.stringify(labels)}`;
    const existing = this.metrics.get(metricKey) || { value: 0, labels, type: 'counter' };
    existing.value += value;
    existing.lastUpdated = new Date().toISOString();
    this.metrics.set(metricKey, existing);

    advancedLogger.debug('Counter incremented', { name, value, labels, total: existing.value });
  }

  // Gauge methods
  setGauge(name, value, labels = {}) {
    if (this.gauges.hasOwnProperty(name)) {
      this.gauges[name] = value;
    }
    
    const metricKey = `${name}_${JSON.stringify(labels)}`;
    this.metrics.set(metricKey, {
      value,
      labels,
      type: 'gauge',
      lastUpdated: new Date().toISOString()
    });

    advancedLogger.debug('Gauge updated', { name, value, labels });
  }

  // Histogram methods
  recordHistogram(name, value, labels = {}) {
    if (this.histograms.hasOwnProperty(name)) {
      this.histograms[name].push(value);
      // Keep only last 1000 values
      if (this.histograms[name].length > 1000) {
        this.histograms[name] = this.histograms[name].slice(-1000);
      }
    }

    const metricKey = `${name}_${JSON.stringify(labels)}`;
    const existing = this.metrics.get(metricKey) || { 
      values: [], 
      labels, 
      type: 'histogram',
      stats: {}
    };
    
    existing.values.push(value);
    if (existing.values.length > 1000) {
      existing.values = existing.values.slice(-1000);
    }
    
    // Calculate statistics
    existing.stats = this.calculateHistogramStats(existing.values);
    existing.lastUpdated = new Date().toISOString();
    this.metrics.set(metricKey, existing);

    advancedLogger.debug('Histogram recorded', { name, value, labels, stats: existing.stats });
  }

  calculateHistogramStats(values) {
    if (values.length === 0) return {};
    
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    
    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  // Agent monitoring
  recordAgentExecution(agentType, duration, success, metadata = {}) {
    this.incrementCounter('agentExecutions', 1, { agentType, success: success.toString() });
    this.recordHistogram('agentExecutionTime', duration, { agentType });
    
    if (duration > this.thresholds.agentExecutionTime) {
      this.createAlert('agent_slow_execution', 'warning', {
        agentType,
        duration,
        threshold: this.thresholds.agentExecutionTime,
        metadata
      });
    }

    if (!success) {
      this.incrementCounter('errors', 1, { type: 'agent_execution', agentType });
    }
  }

  recordAgentStart(agentType) {
    this.setGauge('activeAgents', this.gauges.activeAgents + 1, { agentType });
  }

  recordAgentEnd(agentType) {
    this.setGauge('activeAgents', Math.max(0, this.gauges.activeAgents - 1), { agentType });
  }

  // Database monitoring
  recordDbQuery(operation, table, duration, success, metadata = {}) {
    this.incrementCounter('dbQueries', 1, { operation, table, success: success.toString() });
    this.recordHistogram('dbQueryTime', duration, { operation, table });
    
    if (duration > this.thresholds.dbConnectionTime) {
      this.createAlert('db_slow_query', 'warning', {
        operation,
        table,
        duration,
        threshold: this.thresholds.dbConnectionTime,
        metadata
      });
    }

    if (!success) {
      this.incrementCounter('errors', 1, { type: 'database', operation, table });
    }
  }

  recordDbConnection(pool, active, idle) {
    this.setGauge('dbConnectionPool', active + idle, { pool, active, idle });
  }

  // WebSocket monitoring
  recordWebSocketConnection(connect = true) {
    const current = this.gauges.activeConnections;
    const newValue = connect ? current + 1 : Math.max(0, current - 1);
    this.setGauge('activeConnections', newValue);
    
    if (newValue > this.thresholds.websocketConnections) {
      this.createAlert('websocket_connection_limit', 'warning', {
        activeConnections: newValue,
        threshold: this.thresholds.websocketConnections
      });
    }
  }

  recordWebSocketMessage(direction, event, processingTime, success = true) {
    this.incrementCounter('websocketMessages', 1, { direction, event, success: success.toString() });
    this.recordHistogram('messageProcessingTime', processingTime, { direction, event });
    
    if (!success) {
      this.incrementCounter('errors', 1, { type: 'websocket', event });
    }
  }

  // HTTP request monitoring
  recordHttpRequest(method, path, statusCode, duration) {
    const success = statusCode < 400;
    this.incrementCounter('requests', 1, { method, path, statusCode: statusCode.toString() });
    this.recordHistogram('responseTime', duration, { method, path });
    
    if (duration > this.thresholds.responseTime) {
      this.createAlert('http_slow_response', 'warning', {
        method,
        path,
        duration,
        statusCode,
        threshold: this.thresholds.responseTime
      });
    }

    if (!success) {
      this.incrementCounter('errors', 1, { type: 'http', method, path, statusCode });
    }
  }

  // System monitoring
  recordSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Memory metrics
    const memoryUsagePercent = memUsage.heapUsed / memUsage.heapTotal;
    this.setGauge('memoryUsage', memoryUsagePercent);
    this.setGauge('memoryHeapUsed', memUsage.heapUsed);
    this.setGauge('memoryHeapTotal', memUsage.heapTotal);
    this.setGauge('memoryExternal', memUsage.external);
    
    // CPU metrics (approximation)
    const totalCpuTime = cpuUsage.user + cpuUsage.system;
    this.setGauge('cpuUsage', totalCpuTime);
    
    // System load
    const loadAvg = os.loadavg();
    this.setGauge('systemLoad1m', loadAvg[0]);
    this.setGauge('systemLoad5m', loadAvg[1]);
    this.setGauge('systemLoad15m', loadAvg[2]);
    
    // Process metrics
    this.setGauge('processUptime', process.uptime());
    this.setGauge('processPid', process.pid);
    
    // Check thresholds
    if (memoryUsagePercent > this.thresholds.memoryUsage) {
      this.createAlert('high_memory_usage', 'warning', {
        memoryUsagePercent,
        threshold: this.thresholds.memoryUsage,
        memUsage
      });
    }

    advancedLogger.logSystemMetrics({
      memory: memUsage,
      cpu: cpuUsage,
      load: loadAvg,
      uptime: process.uptime()
    });
  }

  // Error rate monitoring
  calculateErrorRate(timeWindow = 300000) { // 5 minutes default
    const now = Date.now();
    const windowStart = now - timeWindow;
    
    // This is a simplified calculation - in production, you'd want to use time-series data
    const totalRequests = this.counters.requests;
    const totalErrors = this.counters.errors;
    
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
    
    this.setGauge('errorRate', errorRate);
    
    if (errorRate > this.thresholds.errorRate) {
      this.createAlert('high_error_rate', 'critical', {
        errorRate,
        threshold: this.thresholds.errorRate,
        totalRequests,
        totalErrors,
        timeWindow
      });
    }
    
    return errorRate;
  }

  // Alert management
  createAlert(type, severity, data) {
    const alert = {
      id: `${type}_${Date.now()}`,
      type,
      severity, // 'info', 'warning', 'critical'
      data,
      timestamp: new Date().toISOString(),
      resolved: false
    };
    
    this.alerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
    
    advancedLogger.warn('Monitoring alert created', alert);
    
    // Log to healing logger for self-healing triggers
    advancedLogger.logHealingTrigger('monitoring_alert', type, data, severity, { alertId: alert.id });
    
    return alert;
  }

  resolveAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();
      advancedLogger.info('Monitoring alert resolved', { alertId, alert });
    }
  }

  getActiveAlerts() {
    return this.alerts.filter(a => !a.resolved);
  }

  // Health check
  performHealthCheck() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {}
    };
    
    // Memory check
    const memoryUsage = this.gauges.memoryUsage;
    health.checks.memory = {
      status: memoryUsage < this.thresholds.memoryUsage ? 'healthy' : 'unhealthy',
      value: memoryUsage,
      threshold: this.thresholds.memoryUsage
    };
    
    // Error rate check
    const errorRate = this.calculateErrorRate();
    health.checks.errorRate = {
      status: errorRate < this.thresholds.errorRate ? 'healthy' : 'unhealthy',
      value: errorRate,
      threshold: this.thresholds.errorRate
    };
    
    // Active connections check
    const activeConnections = this.gauges.activeConnections;
    health.checks.connections = {
      status: activeConnections < this.thresholds.websocketConnections ? 'healthy' : 'unhealthy',
      value: activeConnections,
      threshold: this.thresholds.websocketConnections
    };
    
    // Overall status
    const unhealthyChecks = Object.values(health.checks).filter(c => c.status === 'unhealthy');
    if (unhealthyChecks.length > 0) {
      health.status = 'unhealthy';
    }
    
    advancedLogger.logHealthCheck('system', health.status, health.checks);
    
    return health;
  }

  // Periodic collection
  startPeriodicCollection() {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      this.recordSystemMetrics();
      this.calculateErrorRate();
      this.performHealthCheck();
    }, 30000);
    
    // Clean up old histogram data every 5 minutes
    setInterval(() => {
      this.cleanupHistograms();
    }, 300000);
  }

  cleanupHistograms() {
    for (const [key, metric] of this.metrics.entries()) {
      if (metric.type === 'histogram' && metric.values.length > 1000) {
        metric.values = metric.values.slice(-1000);
        metric.stats = this.calculateHistogramStats(metric.values);
      }
    }
  }

  // Export methods for monitoring dashboards
  getMetrics() {
    return {
      counters: this.counters,
      gauges: this.gauges,
      histograms: Object.fromEntries(
        Object.entries(this.histograms).map(([key, values]) => [
          key, 
          this.calculateHistogramStats(values)
        ])
      ),
      alerts: this.alerts,
      timestamp: new Date().toISOString()
    };
  }

  getMetricsForPrometheus() {
    const lines = [];
    
    // Counters
    for (const [name, value] of Object.entries(this.counters)) {
      lines.push(`athenai_${name}_total ${value}`);
    }
    
    // Gauges
    for (const [name, value] of Object.entries(this.gauges)) {
      lines.push(`athenai_${name} ${value}`);
    }
    
    // Histograms
    for (const [name, values] of Object.entries(this.histograms)) {
      const stats = this.calculateHistogramStats(values);
      if (stats.count > 0) {
        lines.push(`athenai_${name}_count ${stats.count}`);
        lines.push(`athenai_${name}_sum ${stats.sum}`);
        lines.push(`athenai_${name}_avg ${stats.avg}`);
        lines.push(`athenai_${name}_p50 ${stats.p50}`);
        lines.push(`athenai_${name}_p90 ${stats.p90}`);
        lines.push(`athenai_${name}_p95 ${stats.p95}`);
        lines.push(`athenai_${name}_p99 ${stats.p99}`);
      }
    }
    
    return lines.join('\n');
  }

  reset() {
    this.counters = {
      requests: 0,
      errors: 0,
      agentExecutions: 0,
      dbQueries: 0,
      websocketMessages: 0,
      healingActions: 0
    };
    this.histograms = {
      responseTime: [],
      dbQueryTime: [],
      agentExecutionTime: [],
      messageProcessingTime: []
    };
    this.alerts = [];
    this.metrics.clear();
  }
}

// Create singleton instance
const monitoringCollector = new MonitoringCollector();

module.exports = { MonitoringCollector, monitoringCollector };
