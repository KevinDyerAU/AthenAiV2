-- Knowledge Substrate Initialization Script
-- This script creates the complete knowledge substrate schema for AthenAI

-- =====================
-- Knowledge Management Tables
-- =====================

-- Main knowledge entities table
CREATE TABLE IF NOT EXISTS knowledge_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(255) UNIQUE,
  content TEXT NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  domain VARCHAR(100) DEFAULT 'general',
  query_hash VARCHAR(64),
  created_by UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  version INTEGER DEFAULT 1,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}'::jsonb,
  confidence_score FLOAT DEFAULT 0.0,
  source_type VARCHAR(50) DEFAULT 'agent_generated'
);

-- Knowledge provenance tracking
CREATE TABLE IF NOT EXISTS knowledge_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES knowledge_entities(id) ON DELETE CASCADE,
  source VARCHAR(255) NOT NULL,
  evidence TEXT,
  actor_type VARCHAR(50) DEFAULT 'agent',
  actor_id VARCHAR(255),
  session_id VARCHAR(255),
  orchestration_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Knowledge conflicts and resolution
CREATE TABLE IF NOT EXISTS knowledge_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES knowledge_entities(id) ON DELETE CASCADE,
  field VARCHAR(100) NOT NULL,
  proposed_value JSONB NOT NULL,
  current_value JSONB,
  status VARCHAR(30) DEFAULT 'open',
  priority VARCHAR(20) DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),
  resolution_note TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Research insights and patterns
CREATE TABLE IF NOT EXISTS research_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES knowledge_entities(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  query_hash VARCHAR(64) NOT NULL,
  domain VARCHAR(100) DEFAULT 'general',
  patterns JSONB DEFAULT '[]'::jsonb,
  search_results JSONB DEFAULT '{}'::jsonb,
  session_id VARCHAR(255),
  orchestration_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Web search cache for efficiency
CREATE TABLE IF NOT EXISTS web_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash VARCHAR(64) NOT NULL,
  query_text TEXT NOT NULL,
  domain VARCHAR(100) DEFAULT 'general',
  results JSONB NOT NULL,
  cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
  hit_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Quality assurance insights
CREATE TABLE IF NOT EXISTS qa_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES knowledge_entities(id) ON DELETE CASCADE,
  content_hash VARCHAR(64) NOT NULL,
  qa_type VARCHAR(100) NOT NULL,
  quality_metrics JSONB DEFAULT '{}'::jsonb,
  improvement_patterns JSONB DEFAULT '[]'::jsonb,
  session_id VARCHAR(255),
  orchestration_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- =====================
-- Indexes for Performance
-- =====================

-- Knowledge entities indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_type ON knowledge_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_domain ON knowledge_entities(domain);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_query_hash ON knowledge_entities(query_hash);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_created_at ON knowledge_entities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_updated_at ON knowledge_entities(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_source_type ON knowledge_entities(source_type);

-- Vector similarity index for embeddings
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_embedding 
ON knowledge_entities USING ivfflat (embedding vector_cosine_ops) WITH (lists=100);

-- Provenance indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_provenance_entity_id ON knowledge_provenance(entity_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_provenance_session_id ON knowledge_provenance(session_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_provenance_actor_type ON knowledge_provenance(actor_type);

-- Research insights indexes
CREATE INDEX IF NOT EXISTS idx_research_insights_query_hash ON research_insights(query_hash);
CREATE INDEX IF NOT EXISTS idx_research_insights_domain ON research_insights(domain);
CREATE INDEX IF NOT EXISTS idx_research_insights_session_id ON research_insights(session_id);

-- Web search cache indexes
CREATE INDEX IF NOT EXISTS idx_web_search_cache_query_hash ON web_search_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_web_search_cache_domain ON web_search_cache(domain);
CREATE INDEX IF NOT EXISTS idx_web_search_cache_expires_at ON web_search_cache(expires_at);

-- QA insights indexes
CREATE INDEX IF NOT EXISTS idx_qa_insights_content_hash ON qa_insights(content_hash);
CREATE INDEX IF NOT EXISTS idx_qa_insights_qa_type ON qa_insights(qa_type);
CREATE INDEX IF NOT EXISTS idx_qa_insights_session_id ON qa_insights(session_id);

-- =====================
-- Utility Functions
-- =====================

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM web_search_cache WHERE expires_at < CURRENT_TIMESTAMP;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update knowledge entity timestamps
CREATE OR REPLACE FUNCTION update_knowledge_entity_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update timestamps
DROP TRIGGER IF EXISTS trg_knowledge_entities_updated_at ON knowledge_entities;
CREATE TRIGGER trg_knowledge_entities_updated_at
  BEFORE UPDATE ON knowledge_entities
  FOR EACH ROW EXECUTE FUNCTION update_knowledge_entity_timestamp();

-- =====================
-- Sample Data for Testing
-- =====================

-- Insert sample knowledge entities for testing
INSERT INTO knowledge_entities (external_id, content, entity_type, domain, metadata) VALUES
('test_entity_1', 'Sample research finding about AI capabilities', 'research_finding', 'ai', '{"confidence": 0.85, "source": "research_agent"}'),
('test_entity_2', 'Code analysis patterns for JavaScript applications', 'analysis_pattern', 'software', '{"confidence": 0.92, "source": "quality_assurance_agent"}'),
('test_entity_3', 'Security best practices for API development', 'best_practice', 'security', '{"confidence": 0.88, "source": "research_agent"}')
ON CONFLICT (external_id) DO NOTHING;

-- Insert sample provenance
INSERT INTO knowledge_provenance (entity_id, source, evidence, actor_type, actor_id) 
SELECT id, 'AthenAI Research Agent', 'Generated during research session', 'agent', 'research_agent'
FROM knowledge_entities WHERE external_id = 'test_entity_1'
ON CONFLICT DO NOTHING;

COMMIT;
