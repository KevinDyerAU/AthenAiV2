// Neo4j Knowledge Substrate Initialization Script
// This script creates the complete Neo4j schema for AthenAI knowledge substrate

// =====================
// Clear existing data (in reverse dependency order)
// =====================

// Remove all relationships first
MATCH ()-[r]-() DELETE r;

// Remove all nodes
MATCH (n) DELETE n;

// Drop existing constraints and indexes
DROP CONSTRAINT knowledge_entity_id IF EXISTS;
DROP CONSTRAINT provenance_id IF EXISTS;
DROP CONSTRAINT conflict_id IF EXISTS;
DROP CONSTRAINT user_id IF EXISTS;
DROP CONSTRAINT session_id IF EXISTS;
DROP CONSTRAINT orchestration_id IF EXISTS;
DROP CONSTRAINT research_insights_id IF EXISTS;
DROP CONSTRAINT qa_insights_id IF EXISTS;

DROP INDEX knowledge_entity_type IF EXISTS;
DROP INDEX knowledge_domain IF EXISTS;
DROP INDEX knowledge_updated_at IF EXISTS;
DROP INDEX knowledge_created_at IF EXISTS;
DROP INDEX research_insights_query_hash IF EXISTS;
DROP INDEX research_insights_domain IF EXISTS;
DROP INDEX qa_insights_content_hash IF EXISTS;
DROP INDEX session_created_at IF EXISTS;
DROP INDEX knowledge_content_fts IF EXISTS;
DROP INDEX knowledge_embeddings IF EXISTS;

// =====================
// Constraints & Indexes
// =====================
CREATE CONSTRAINT knowledge_entity_id IF NOT EXISTS
FOR (n:KnowledgeEntity) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT provenance_id IF NOT EXISTS
FOR (n:Provenance) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT conflict_id IF NOT EXISTS
FOR (n:Conflict) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT user_id IF NOT EXISTS
FOR (n:User) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT session_id IF NOT EXISTS
FOR (n:Session) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT orchestration_id IF NOT EXISTS
FOR (n:Orchestration) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT research_insights_id IF NOT EXISTS
FOR (n:ResearchInsights) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT qa_insights_id IF NOT EXISTS
FOR (n:QAInsights) REQUIRE n.id IS UNIQUE;

// Helpful lookup indexes
CREATE INDEX knowledge_entity_type IF NOT EXISTS
FOR (n:KnowledgeEntity) ON (n.entity_type);

CREATE INDEX knowledge_domain IF NOT EXISTS
FOR (n:KnowledgeEntity) ON (n.domain);

CREATE INDEX knowledge_updated_at IF NOT EXISTS
FOR (n:KnowledgeEntity) ON (n.updated_at);

CREATE INDEX knowledge_created_at IF NOT EXISTS
FOR (n:KnowledgeEntity) ON (n.created_at);

CREATE INDEX research_insights_query_hash IF NOT EXISTS
FOR (n:ResearchInsights) ON (n.query_hash);

CREATE INDEX research_insights_domain IF NOT EXISTS
FOR (n:ResearchInsights) ON (n.domain);

CREATE INDEX qa_insights_content_hash IF NOT EXISTS
FOR (n:QAInsights) ON (n.content_hash);

CREATE INDEX session_created_at IF NOT EXISTS
FOR (n:Session) ON (n.created_at);

// Fulltext index for content search
CREATE FULLTEXT INDEX knowledge_content_fts IF NOT EXISTS
FOR (n:KnowledgeEntity|ResearchInsights|QAInsights) ON EACH [n.content, n.query, n.domain];

// Vector index for semantic similarity (Neo4j 5.11+)
CREATE VECTOR INDEX knowledge_embeddings IF NOT EXISTS
FOR (n:KnowledgeEntity) ON (n.embedding)
OPTIONS {
  indexConfig: {
    `vector.dimensions`: 1536,
    `vector.similarity_function`: 'cosine'
  }
};

// =====================
// Sample Data Creation
// =====================

// Create sample sessions and orchestrations
MERGE (s1:Session {
  id: 'sample_session_1',
  created_at: datetime(),
  session_type: 'research_session',
  agent: 'ResearchAgent'
})

MERGE (s2:Session {
  id: 'sample_session_2', 
  created_at: datetime(),
  session_type: 'qa_session',
  agent: 'QualityAssuranceAgent'
})

MERGE (o1:Orchestration {
  id: 'sample_orchestration_1',
  created_at: datetime(),
  session_id: 'sample_session_1',
  agent_type: 'ResearchAgent'
})

MERGE (o2:Orchestration {
  id: 'sample_orchestration_2',
  created_at: datetime(), 
  session_id: 'sample_session_2',
  agent_type: 'QualityAssuranceAgent'
})

// Create sample knowledge entities
MERGE (ke1:KnowledgeEntity {
  id: 'knowledge_entity_1',
  external_id: 'research_ai_capabilities_001',
  content: 'AI systems demonstrate emergent capabilities in reasoning, code generation, and complex problem solving when scaled appropriately.',
  entity_type: 'research_finding',
  domain: 'ai',
  created_at: datetime(),
  updated_at: datetime(),
  version: 1,
  confidence_score: 0.85,
  source_type: 'research_agent',
  patterns: ['emergent_capabilities', 'scaling_laws']
})

MERGE (ke2:KnowledgeEntity {
  id: 'knowledge_entity_2',
  external_id: 'security_best_practices_001',
  content: 'API security requires proper authentication, input validation, rate limiting, and comprehensive logging for audit trails.',
  entity_type: 'best_practice',
  domain: 'security',
  created_at: datetime(),
  updated_at: datetime(),
  version: 1,
  confidence_score: 0.92,
  source_type: 'research_agent',
  patterns: ['api_security', 'authentication', 'validation']
})

MERGE (ke3:KnowledgeEntity {
  id: 'knowledge_entity_3',
  external_id: 'code_quality_patterns_001',
  content: 'High-quality code exhibits clear naming conventions, proper error handling, comprehensive testing, and maintainable architecture.',
  entity_type: 'quality_pattern',
  domain: 'software',
  created_at: datetime(),
  updated_at: datetime(),
  version: 1,
  confidence_score: 0.88,
  source_type: 'qa_agent',
  patterns: ['code_quality', 'maintainability', 'testing']
})

// Create sample research insights
MERGE (ri1:ResearchInsights {
  id: 'research_insights_1',
  query: 'AI capabilities and limitations in software development',
  query_hash: 'abc123def456',
  domain: 'ai',
  session_id: 'sample_session_1',
  orchestration_id: 'sample_orchestration_1',
  created_at: datetime(),
  search_results: 'Comprehensive analysis of AI capabilities in software development...',
  research_patterns: ['ai_development', 'capability_analysis', 'limitation_assessment'],
  agent_type: 'ResearchAgent',
  result_length: 2500,
  patterns_found: 3
})

// Create sample QA insights
MERGE (qi1:QAInsights {
  id: 'qa_insights_1',
  content_hash: 'def456ghi789',
  qa_type: 'code_review',
  session_id: 'sample_session_2',
  orchestration_id: 'sample_orchestration_2',
  created_at: datetime(),
  qa_insights: 'Code review identified several improvement opportunities...',
  readability: 0.8,
  maintainability: 0.75,
  performance: 0.9,
  security: 0.85,
  improvement_patterns: ['error_handling', 'documentation', 'test_coverage'],
  confidence_score: 0.82,
  agent_type: 'QualityAssuranceAgent',
  domain: 'software'
})

// Create sample provenance
MERGE (p1:Provenance {
  id: 'provenance_1',
  source: 'AthenAI Research Agent',
  evidence: 'Generated during research session analysis',
  actor_id: 'research_agent',
  created_at: datetime(),
  session_id: 'sample_session_1',
  orchestration_id: 'sample_orchestration_1'
})

// =====================
// Create Relationships
// =====================

// Session to Orchestration relationships
MERGE (s1)-[:HAS_ORCHESTRATION]->(o1)
MERGE (s2)-[:HAS_ORCHESTRATION]->(o2)

// Orchestration to Knowledge relationships
MERGE (o1)-[:GENERATED]->(ke1)
MERGE (o1)-[:GENERATED]->(ri1)
MERGE (o2)-[:GENERATED]->(ke3)
MERGE (o2)-[:GENERATED]->(qi1)

// Knowledge Entity relationships
MERGE (ke1)-[:HAS_PROVENANCE]->(p1)
MERGE (ri1)-[:RELATES_TO]->(ke1)
MERGE (qi1)-[:ASSESSES]->(ke3)

// Domain-based similarity relationships
MERGE (ke1)-[:SIMILAR_TO {score: 0.7, basis: 'domain_similarity'}]->(ri1)
MERGE (ke2)-[:SIMILAR_TO {score: 0.6, basis: 'security_domain'}]->(ke3)

// Pattern-based relationships
MERGE (ke1)-[:HAS_PATTERN {pattern: 'ai_capabilities'}]->(ri1)
MERGE (ke3)-[:HAS_PATTERN {pattern: 'code_quality'}]->(qi1);

// =====================
// Utility Procedures
// =====================

// Note: These are example procedures - implement in your application code
/*
// Find similar knowledge entities by domain
CALL {
  MATCH (ke:KnowledgeEntity {domain: $domain})
  RETURN ke
  ORDER BY ke.created_at DESC
  LIMIT $limit
}

// Find research insights by query hash
CALL {
  MATCH (ri:ResearchInsights {query_hash: $queryHash})
  RETURN ri
  ORDER BY ri.created_at DESC
  LIMIT $limit
}

// Create knowledge relationship
CALL {
  MATCH (a:KnowledgeEntity {id: $fromId})
  MATCH (b:KnowledgeEntity {id: $toId})
  MERGE (a)-[r:SIMILAR_TO {score: $score, created_at: datetime()}]->(b)
  RETURN r
}
*/

// Show sample relationships
MATCH (s:Session)-[:HAS_ORCHESTRATION]->(o:Orchestration)-[:GENERATED]->(k)
RETURN s.id as session, o.id as orchestration, labels(k) as knowledge_type, k.id as knowledge_id
LIMIT 10;
