# AthenAI Knowledge Substrate Implementation

## Overview

The AthenAI Knowledge Substrate is a comprehensive system for storing, retrieving, and leveraging knowledge across AI agent interactions. It combines PostgreSQL (Supabase) for structured data storage with Neo4j for graph-based relationships and Redis for caching.

## Architecture

### Database Components

1. **Supabase PostgreSQL**: Primary storage for knowledge entities, research insights, QA assessments, and web search cache
2. **Neo4j Graph Database**: Relationship mapping, semantic connections, and knowledge graph traversal
3. **Redis**: High-speed caching for frequently accessed knowledge

### Core Tables (Supabase)

#### knowledge_entities
- Primary knowledge storage with vector embeddings
- Supports domains: ai, software, security, performance, data, general
- Includes confidence scoring and provenance tracking

#### research_insights
- Stores research patterns and findings from ResearchAgent
- Links queries to results with domain classification
- Enables knowledge reuse across sessions

#### qa_insights
- Quality assurance patterns and metrics from QualityAssuranceAgent
- Tracks improvement patterns and quality metrics
- Supports content-based similarity matching

#### web_search_cache
- Caches web search results to reduce API calls
- 24-hour expiration with hit count tracking
- Domain-based organization for efficient retrieval

### Knowledge Operations

#### Storage Operations
```javascript
// Create knowledge entity
await databaseService.createKnowledgeEntity({
  external_id: 'unique_identifier',
  content: 'knowledge content',
  entity_type: 'research_finding|best_practice|qa_assessment',
  domain: 'ai|software|security|performance|data|general',
  confidence_score: 0.0-1.0,
  metadata: {}
});

// Store research insights
await databaseService.storeResearchInsights({
  query: 'research query',
  query_hash: 'generated_hash',
  domain: 'domain_classification',
  patterns: ['pattern1', 'pattern2'],
  search_results: {},
  session_id: 'session_identifier',
  orchestration_id: 'orchestration_identifier'
});

// Store QA insights
await databaseService.storeQAInsights({
  content_hash: 'content_hash',
  qa_type: 'code_review|analysis|assessment',
  quality_metrics: {},
  improvement_patterns: [],
  session_id: 'session_identifier',
  orchestration_id: 'orchestration_identifier'
});
```

#### Retrieval Operations
```javascript
// Get knowledge by domain
const entities = await databaseService.getKnowledgeEntitiesByDomain('ai', 10);

// Get research insights by query hash
const insights = await databaseService.getResearchInsightsByQueryHash('hash', 5);

// Get QA insights by content hash
const qaInsights = await databaseService.getQAInsightsByContentHash('hash', 5);

// Check web search cache
const cached = await databaseService.getWebSearchCache('query_hash');
```

## Agent Integration

### ResearchAgent Knowledge Flow

1. **Knowledge Retrieval**: Checks existing research insights and domain entities
2. **Cache Utilization**: Uses cached web search results when available
3. **Enhanced Search**: Combines cached knowledge with fresh web searches
4. **Knowledge Storage**: Stores new insights, patterns, and web search cache

### QualityAssuranceAgent Knowledge Flow

1. **Context Retrieval**: Gets similar QA assessments and domain knowledge
2. **Quality Assessment**: Performs analysis with knowledge context
3. **Insight Storage**: Stores quality metrics, improvement patterns, and assessments
4. **Knowledge Creation**: Creates knowledge entities for significant findings

## Domain Classification

The system automatically classifies content into domains:

- **ai**: AI, machine learning, artificial intelligence topics
- **software**: Code, development, programming, repositories
- **security**: Security, vulnerabilities, authentication, authorization
- **performance**: Optimization, performance, scalability
- **data**: Data analysis, databases, data processing
- **api**: API development, endpoints, web services
- **general**: Default classification for unmatched content

## Pattern Extraction

### Research Patterns
- documentation_research
- educational_content
- code_repository_research
- api_research
- security_research

### QA Improvement Patterns
- error_handling
- documentation
- test_coverage
- code_structure
- performance_optimization

## Setup Instructions

### 1. Initialize Supabase Schema
```bash
# Run the SQL initialization script
psql -h your-supabase-host -U postgres -d postgres -f init-knowledge-substrate.sql
```

### 2. Initialize Neo4j Schema
```bash
# Run the Cypher initialization script
cypher-shell -u neo4j -p password -f init-neo4j-knowledge.cypher
```

### 3. Environment Configuration
```env
# Supabase Configuration
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379
```

### 4. Database Service Initialization
```javascript
const { databaseService } = require('./src/services/database');
await databaseService.initialize();
```

## Performance Considerations

### Indexing Strategy
- Vector indexes for semantic similarity (pgvector)
- Hash-based indexes for quick lookups
- Domain and type indexes for filtered queries
- Temporal indexes for chronological access

### Caching Strategy
- Web search results cached for 24 hours
- Redis caching for frequently accessed entities
- Query hash-based cache keys for consistency

### Optimization Tips
1. Use domain filtering to reduce search space
2. Leverage query hashes for exact match lookups
3. Implement cache warming for common queries
4. Monitor and tune vector index parameters

## Monitoring and Maintenance

### Health Checks
```javascript
// Check database connectivity
const isHealthy = await databaseService.initialized;

// Verify table existence
const tables = await databaseService.supabase.from('knowledge_entities').select('count');
```

### Cache Management
```javascript
// Clean expired cache entries
await databaseService.supabase.rpc('clean_expired_cache');

// Monitor cache hit rates
const cacheStats = await databaseService.supabase
  .from('web_search_cache')
  .select('hit_count, cached_at')
  .order('hit_count', { ascending: false });
```

### Knowledge Quality Metrics
- Confidence score distribution
- Domain coverage analysis
- Pattern frequency tracking
- Agent contribution metrics

## Troubleshooting

### Common Issues

1. **Missing Tables**: Run initialization scripts
2. **Connection Failures**: Check environment variables
3. **Performance Issues**: Review indexing and query patterns
4. **Cache Misses**: Verify hash generation consistency

### Debug Queries
```sql
-- Check knowledge entity distribution
SELECT entity_type, domain, COUNT(*) 
FROM knowledge_entities 
GROUP BY entity_type, domain;

-- Monitor cache effectiveness
SELECT domain, AVG(hit_count) as avg_hits, COUNT(*) as entries
FROM web_search_cache 
WHERE expires_at > NOW()
GROUP BY domain;

-- Quality metrics overview
SELECT qa_type, AVG((quality_metrics->>'confidence')::float) as avg_confidence
FROM qa_insights 
GROUP BY qa_type;
```

## Future Enhancements

1. **Vector Similarity Search**: Implement semantic search using embeddings
2. **Knowledge Graph Expansion**: Enhanced Neo4j relationship modeling
3. **Automated Knowledge Curation**: ML-based quality assessment
4. **Cross-Agent Learning**: Knowledge sharing between agent types
5. **Temporal Knowledge**: Version tracking and knowledge evolution

## API Reference

See the `DatabaseService` class in `src/services/database.js` for complete API documentation and method signatures.
