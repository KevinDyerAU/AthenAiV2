# Self-Healing Agent Knowledge Integration Guide

## Overview

The AthenAI self-healing agent has been enhanced with comprehensive knowledge substrate integration, enabling intelligent, context-aware recovery actions based on historical patterns and predictive analysis. This guide covers the implementation, configuration, and usage of the knowledge-integrated self-healing system.

## Architecture

### Core Components

1. **Self-Healing Agent** (`src/utils/selfHealingAgent.js`)
   - Enhanced with knowledge substrate integration
   - Semantic similarity matching for context-aware healing
   - Predictive analysis and preventive healing
   - Learning system for continuous improvement

2. **Database Integration** (`src/services/database.js`)
   - Healing insights storage and retrieval
   - Pattern analysis and similarity matching
   - Historical data management

3. **Database Schema** (`db/supabase/healing_insights_schema.sql`)
   - `healing_insights` - Stores all healing events and outcomes
   - `healing_patterns` - Aggregated successful healing strategies
   - `healing_predictions` - Predictive patterns and risk indicators

## Key Features

### 1. Historical Healing Pattern Analysis

The system stores and analyzes all healing events to identify successful patterns:

```javascript
// Automatic pattern storage after each healing event
await this.storeHealingOutcome(eventId, issueType, context, result);

// Query successful patterns for similar issues
const successfulPatterns = await this.getSuccessfulHealingPatterns(issueType);
```

**Benefits:**
- Learns from past successes and failures
- Prioritizes actions based on historical success rates
- Builds institutional knowledge across system restarts

### 2. Predictive Healing Using Knowledge Patterns

The system performs predictive analysis every 5 minutes to identify risk patterns:

```javascript
// Predictive analysis identifies risk patterns
const riskPatterns = await this.identifyRiskPatterns(currentMetrics);

// Proactive healing before issues escalate
if (pattern.riskScore > 0.8) {
  await this.triggerPreventiveHealing(pattern);
}
```

**Risk Pattern Detection:**
- Memory usage trending upward (>70%)
- Error rate increasing (>5%)
- Response time degradation (>5 seconds P95)

### 3. Context-Aware Recovery with Semantic Similarity

Uses semantic similarity to find relevant historical incidents:

```javascript
// Find similar past incidents using semantic similarity
const similarIncidents = await this.findSimilarHealingIncidents(contextSignature);

// Context signature includes system metrics and issue characteristics
const contextSignature = this.createContextSignature(issueType, context);
```

**Similarity Matching:**
- Combines Jaccard, Cosine, and Levenshtein similarity algorithms
- Configurable similarity threshold (default: 0.75)
- Returns top 5 most similar incidents for decision making

### 4. Learning System for Strategy Improvement

The system continuously improves healing strategies through:

```javascript
// Prioritize actions based on knowledge from similar incidents
const prioritizedActions = this.prioritizeActionsFromKnowledge(similarIncidents, defaultActions);

// Update knowledge cache with recent learnings
await this.updateKnowledgeCache();
```

**Learning Mechanisms:**
- Action success rate calculation from historical data
- Dynamic action prioritization based on past effectiveness
- Knowledge cache management for performance optimization

## Configuration

### Environment Variables

```bash
# Self-healing configuration
SELF_HEALING_ENABLED=true
SELF_HEALING_PREDICTION_THRESHOLD=0.75
SELF_HEALING_LEARNING_ENABLED=true

# Knowledge substrate integration
KNOWLEDGE_SUBSTRATE_ENABLED=true
SEMANTIC_SIMILARITY_THRESHOLD=0.75
```

### Health Check Thresholds

```javascript
this.healthThresholds = {
  errorRate: 0.15,        // 15% error rate triggers healing
  responseTime: 10000,    // 10 seconds
  memoryUsage: 0.85,      // 85% memory usage
  agentFailureRate: 0.2,  // 20% agent failure rate
  dbConnectionFailures: 5, // 5 consecutive DB failures
  wsConnectionDrops: 10,   // 10 WebSocket drops per minute
  aiApiFailures: 3        // 3 consecutive AI API failures
};
```

## Database Schema

### Healing Insights Table

Stores all healing events and outcomes:

```sql
CREATE TABLE healing_insights (
    id UUID PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL,
    issue_type VARCHAR(100) NOT NULL,
    context_signature TEXT NOT NULL,
    context_hash VARCHAR(64) NOT NULL,
    actions_taken JSONB DEFAULT '[]'::jsonb,
    success BOOLEAN NOT NULL DEFAULT false,
    duration_ms INTEGER,
    error_message TEXT,
    system_metrics JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Healing Patterns Table

Aggregated successful healing strategies:

```sql
CREATE TABLE healing_patterns (
    id UUID PRIMARY KEY,
    issue_type VARCHAR(100) NOT NULL,
    pattern_signature TEXT NOT NULL,
    success_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
    total_occurrences INTEGER NOT NULL DEFAULT 0,
    successful_occurrences INTEGER NOT NULL DEFAULT 0,
    common_actions JSONB DEFAULT '[]'::jsonb,
    context_patterns JSONB DEFAULT '{}'::jsonb
);
```

## Usage Examples

### 1. Querying Healing Status

```javascript
const status = selfHealingAgent.getHealingStatus();
console.log('Recent healing actions:', status.recentActions);
console.log('Knowledge cache size:', status.knowledgeSubstrate.cacheSize);
```

### 2. Manual Healing Trigger

```javascript
await selfHealingAgent.triggerHealing('high_error_rate', 'critical', {
  currentErrorRate: 0.25,
  p95ResponseTime: 8000,
  currentMemoryUsage: 0.78
});
```

### 3. Analyzing Healing Effectiveness

```sql
SELECT * FROM analyze_healing_effectiveness();
```

## Monitoring and Observability

### Logging

All healing events are logged with structured data:

```javascript
// Healing trigger logging
advancedLogger.logHealingTrigger(source, system, issueType, severity, context);

// Healing action logging
advancedLogger.logHealingAction(eventId, issueType, outcome, details);
```

### Metrics

Key metrics tracked:

- Healing success rates by issue type
- Average healing duration
- Predictive accuracy
- Knowledge cache hit rates
- Similarity matching effectiveness

### Health Checks

Automated health monitoring:

- System health checks every 30 seconds
- Predictive analysis every 5 minutes
- Knowledge substrate sync every 10 minutes
- Healing history cleanup every hour

## Healing Strategies

### Available Strategies

1. **High Error Rate**
   - Clear system caches
   - Restart problematic agents
   - Reset error counters
   - Increase logging verbosity

2. **Slow Response**
   - Scale up resources
   - Clear caches
   - Restart services
   - Enable performance profiling

3. **Memory Pressure**
   - Trigger garbage collection
   - Clear caches
   - Restart memory-intensive processes
   - Scale resources

4. **Agent Failures**
   - Restart failed agents
   - Clear agent state
   - Reset agent registry
   - Fallback to backup agents

5. **Database Issues**
   - Reconnect to database
   - Clear connection pools
   - Switch to read replicas
   - Enable query optimization

6. **WebSocket Issues**
   - Restart WebSocket server
   - Clear connection state
   - Reset message queues
   - Enable connection debugging

7. **AI API Failures**
   - Switch to backup API endpoints
   - Adjust rate limits
   - Clear API caches
   - Enable fallback models

### Knowledge-Enhanced Decision Making

Each strategy now incorporates knowledge from similar past incidents:

```javascript
// Use knowledge context to inform healing decisions
const knowledgeContext = context.knowledgeContext || {};
const similarIncidents = knowledgeContext.similarIncidents || [];

// Prioritize actions based on past success rates
const prioritizedActions = this.prioritizeActionsFromKnowledge(similarIncidents, defaultActions);
```

## Performance Optimization

### Knowledge Cache Management

- Local cache of recent healing insights (max 1000 entries)
- Automatic cache cleanup based on timestamp
- Efficient similarity matching using pre-computed signatures

### Database Optimization

- Indexed queries for fast pattern retrieval
- Automatic pattern aggregation via database triggers
- Efficient JSON queries using GIN indexes

### Predictive Analysis Optimization

- Risk pattern analysis limited to key metrics
- Configurable prediction thresholds
- Cooldown periods to prevent analysis thrashing

## Troubleshooting

### Common Issues

1. **Knowledge Substrate Connection Failures**
   - Check database connectivity
   - Verify schema installation
   - Review connection pool settings

2. **Semantic Similarity Performance**
   - Adjust similarity thresholds
   - Limit historical data scope
   - Optimize context signatures

3. **Predictive Analysis False Positives**
   - Tune risk pattern thresholds
   - Increase prediction confidence requirements
   - Review historical accuracy metrics

### Debug Commands

```javascript
// Check healing agent status
console.log(selfHealingAgent.getHealingStatus());

// Review recent healing history
const recentEvents = await databaseService.getRecentHealingInsights(24);

// Analyze healing effectiveness
const effectiveness = await databaseService.query('SELECT * FROM analyze_healing_effectiveness()');
```

## Best Practices

1. **Threshold Tuning**
   - Start with conservative thresholds
   - Monitor false positive rates
   - Adjust based on system characteristics

2. **Knowledge Management**
   - Regular cleanup of old healing data
   - Monitor knowledge cache performance
   - Review pattern accuracy periodically

3. **Monitoring Integration**
   - Set up alerts for healing failures
   - Track healing success rates
   - Monitor predictive accuracy

4. **Testing**
   - Simulate failure scenarios
   - Test healing strategies in staging
   - Validate knowledge integration

## Future Enhancements

1. **Machine Learning Integration**
   - Advanced pattern recognition
   - Automated threshold optimization
   - Predictive model training

2. **Multi-System Learning**
   - Cross-system knowledge sharing
   - Distributed healing coordination
   - Global pattern recognition

3. **Advanced Analytics**
   - Healing trend analysis
   - Performance correlation studies
   - Automated strategy optimization

## Conclusion

The knowledge-integrated self-healing system provides AthenAI with intelligent, adaptive recovery capabilities that improve over time. By leveraging historical patterns, predictive analysis, and semantic similarity matching, the system can make informed healing decisions and continuously optimize its strategies for maximum effectiveness.

For additional support or questions, refer to the main monitoring and debugging guide or contact the development team.
