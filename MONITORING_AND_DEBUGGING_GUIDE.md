# AthenAI Monitoring and Debugging Guide

## Overview

AthenAI implements comprehensive logging, monitoring, and self-healing capabilities designed for production-grade observability and autonomous system recovery. This guide covers the complete monitoring architecture, debugging procedures, and self-healing mechanisms.

## Architecture Components

### 1. Advanced Logger (`src/utils/advancedLogger.js`)
- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Multiple Log Streams**: Separate logs for performance, agents, database, WebSocket, and self-healing
- **Context Management**: Automatic correlation ID propagation across operations
- **Performance Tracking**: Built-in timing and metrics collection

### 2. Monitoring Collector (`src/utils/monitoringCollector.js`)
- **Metrics Collection**: Counters, gauges, and histograms for all system operations
- **Health Checks**: Automated system health assessment
- **Alert Management**: Threshold-based alerting with severity levels
- **Prometheus Export**: Ready for Prometheus/Grafana integration

### 3. Self-Healing Agent (`src/utils/selfHealingAgent.js`)
- **Automated Recovery**: Intelligent response to system issues
- **Healing Strategies**: Specific recovery actions for different failure types
- **Cooldown Management**: Prevents rapid repeated healing actions
- **Decision Tracking**: Complete audit trail of healing decisions

## Logging Architecture

### Log Files Structure
```
logs/
├── athenai-main.log          # Main application logs
├── athenai-error.log         # Error-only logs
├── athenai-performance.log   # Performance metrics
├── athenai-agents.log        # Agent execution traces
├── athenai-database.log      # Database operations
├── athenai-websocket.log     # WebSocket communications
└── athenai-self-healing.log  # Self-healing decisions
```

### Log Rotation
- **File Size**: 50MB for main logs, 100MB for performance/agent logs
- **Retention**: 5-10 files per log type
- **Compression**: Automatic compression of rotated files

### Correlation IDs
Every operation gets a unique correlation ID that flows through:
- WebSocket connections
- Agent executions
- Database operations
- Error handling
- Self-healing actions

## Monitoring Metrics

### System Metrics
- **Memory Usage**: Heap usage, external memory, garbage collection
- **CPU Usage**: Process CPU time and system load averages
- **Process Metrics**: Uptime, PID, memory statistics

### Application Metrics
- **Request Metrics**: Total requests, response times, error rates
- **Agent Metrics**: Execution times, success/failure rates, active agents
- **Database Metrics**: Query times, connection pool status, operation counts
- **WebSocket Metrics**: Active connections, message processing times

### Performance Histograms
- **Response Times**: P50, P90, P95, P99 percentiles
- **Agent Execution**: Duration distribution by agent type
- **Database Queries**: Query performance by operation type
- **Message Processing**: WebSocket message handling times

## Health Monitoring

### Health Check Components
1. **Memory Usage**: Monitors heap usage against thresholds
2. **Error Rate**: Tracks application error percentage
3. **Response Times**: Monitors API response performance
4. **Agent Performance**: Tracks AI agent execution success
5. **Database Health**: Monitors query performance and connections
6. **WebSocket Health**: Tracks connection stability and message flow

### Health Thresholds
```javascript
{
  responseTime: 5000,        // 5 seconds
  errorRate: 0.1,           // 10%
  memoryUsage: 0.8,         // 80%
  cpuUsage: 0.8,            // 80%
  dbConnectionTime: 2000,   // 2 seconds
  agentExecutionTime: 30000, // 30 seconds
  websocketConnections: 1000
}
```

## Self-Healing Capabilities

### Healing Triggers
- **High Error Rate**: >15% error rate triggers cache clearing and agent restart
- **Slow Response**: >10s response times trigger optimization actions
- **Memory Pressure**: >85% memory usage triggers cleanup actions
- **Agent Failures**: >20% failure rate triggers fallback strategies
- **Database Issues**: Slow queries trigger connection optimization
- **WebSocket Issues**: Connection problems trigger server restart

### Healing Strategies

#### High Error Rate Recovery
1. Clear system caches
2. Restart problematic agents
3. Reset error counters
4. Enable verbose logging temporarily

#### Performance Recovery
1. Clear response caches
2. Optimize database connections
3. Reduce agent complexity
4. Implement request throttling

#### Memory Recovery
1. Force garbage collection
2. Clear large caches
3. Reduce concurrent operations
4. Clean up old data

#### Agent Recovery
1. Reset agent states
2. Switch to fallback models
3. Simplify agent tasks
4. Implement exponential backoff

### Cooldown Periods
- **Critical**: 1 minute cooldown
- **High**: 5 minutes cooldown
- **Warning**: 10 minutes cooldown
- **Medium**: 15 minutes cooldown

## Debugging Procedures

### 1. Performance Issues

#### Slow Response Times
```bash
# Check performance logs
tail -f logs/athenai-performance.log | grep "responseTime"

# Monitor agent execution times
grep "agent_execution" logs/athenai-agents.log | tail -20

# Check database query performance
grep "db_query" logs/athenai-database.log | grep -E "duration.*[5-9][0-9]{3}"
```

#### High Memory Usage
```bash
# Monitor memory metrics
grep "memoryUsage" logs/athenai-main.log | tail -10

# Check for memory leaks in agents
grep "Agent execution" logs/athenai-agents.log | grep -E "duration.*[1-9][0-9]{4}"
```

### 2. Agent Issues

#### Agent Execution Failures
```bash
# Check agent error logs
grep "Agent execution error" logs/athenai-agents.log

# Monitor agent performance by type
grep "research.*completed" logs/athenai-agents.log | tail -10
grep "analysis.*completed" logs/athenai-agents.log | tail -10
```

#### AI API Issues
```bash
# Check for API rate limits
grep "AI_API_RATE_LIMIT" logs/athenai-error.log

# Monitor API response times
grep "AI API" logs/athenai-performance.log | tail -20
```

### 3. Database Issues

#### Connection Problems
```bash
# Check database connection errors
grep "Database.*error" logs/athenai-database.log

# Monitor connection pool status
grep "dbConnectionPool" logs/athenai-main.log | tail -5
```

#### Slow Queries
```bash
# Find slow database operations
grep "Database operation" logs/athenai-database.log | grep -E "duration.*[2-9][0-9]{3}"

# Check specific table performance
grep "conversations.*duration" logs/athenai-database.log
```

### 4. WebSocket Issues

#### Connection Problems
```bash
# Monitor WebSocket connections
grep "WebSocket connection" logs/athenai-websocket.log | tail -20

# Check message processing times
grep "WebSocket message" logs/athenai-websocket.log | grep -E "duration.*[1-9][0-9]{3}"
```

### 5. Self-Healing Analysis

#### Healing Actions
```bash
# Check recent healing events
grep "Self-healing triggered" logs/athenai-self-healing.log | tail -10

# Monitor healing action results
grep "Self-healing action executed" logs/athenai-self-healing.log | tail -10
```

## Monitoring Dashboard Integration

### Prometheus Metrics Endpoint
```javascript
// Get metrics in Prometheus format
GET /api/metrics

// Example output:
athenai_requests_total 1234
athenai_errors_total 45
athenai_response_time_p95 2500
athenai_memory_usage 0.75
athenai_active_agents 3
```

### Grafana Dashboard Queries
```promql
# Error rate over time
rate(athenai_errors_total[5m]) / rate(athenai_requests_total[5m])

# Response time percentiles
histogram_quantile(0.95, rate(athenai_response_time_bucket[5m]))

# Agent execution success rate
rate(athenai_agent_executions_success_total[5m]) / rate(athenai_agent_executions_total[5m])

# Memory usage trend
athenai_memory_usage

# Active connections
athenai_active_connections
```

## Alert Configuration

### Critical Alerts
- **Error Rate > 20%**: Immediate notification
- **Response Time > 15s**: Immediate notification
- **Memory Usage > 90%**: Immediate notification
- **All Agents Failing**: Immediate notification

### Warning Alerts
- **Error Rate > 10%**: 5-minute notification
- **Response Time > 8s**: 5-minute notification
- **Memory Usage > 80%**: 10-minute notification
- **Database Slow Queries**: 15-minute notification

### Info Alerts
- **Self-Healing Triggered**: Notification for audit
- **Agent Performance Degradation**: 30-minute notification
- **High WebSocket Disconnections**: 30-minute notification

## Troubleshooting Common Issues

### 1. High Error Rates
1. Check recent deployments or configuration changes
2. Review agent execution logs for patterns
3. Verify AI API key validity and quotas
4. Check database connectivity
5. Monitor self-healing actions

### 2. Performance Degradation
1. Check system resource usage (CPU, memory)
2. Analyze database query performance
3. Review agent execution times
4. Check for memory leaks
5. Verify network connectivity to external APIs

### 3. Agent Failures
1. Check AI API status and quotas
2. Verify agent configuration
3. Review input validation
4. Check knowledge substrate connectivity
5. Monitor agent state consistency

### 4. Database Issues
1. Check connection pool status
2. Monitor query performance
3. Verify database server health
4. Check for lock contention
5. Review migration status

### 5. WebSocket Problems
1. Check connection limits
2. Monitor message queue sizes
3. Verify client-side connection handling
4. Check for memory leaks in connection handling
5. Review message processing performance

## Production Deployment

### Environment Variables
```bash
# Logging configuration
LOG_LEVEL=info
ERROR_LOG_RETENTION=10
PERFORMANCE_LOG_RETENTION=5

# Monitoring configuration
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30000
PROMETHEUS_PORT=9090

# Self-healing configuration
SELF_HEALING_ENABLED=true
HEALING_COOLDOWN_CRITICAL=60000
HEALING_COOLDOWN_WARNING=600000
```

### Monitoring Stack Setup
1. **Prometheus**: Metrics collection and alerting
2. **Grafana**: Visualization and dashboards
3. **AlertManager**: Alert routing and notification
4. **ELK Stack**: Log aggregation and analysis (optional)

### Best Practices
1. **Regular Health Checks**: Monitor system health continuously
2. **Proactive Alerting**: Set up alerts before issues become critical
3. **Log Analysis**: Regular review of error patterns and trends
4. **Performance Baselines**: Establish and monitor performance baselines
5. **Capacity Planning**: Monitor resource usage trends for scaling decisions

This comprehensive monitoring and debugging system ensures AthenAI operates reliably in production with full observability and autonomous recovery capabilities.
