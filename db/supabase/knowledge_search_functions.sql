-- Knowledge Substrate Search Functions for Supabase
-- Implements vector similarity search and supporting functions

-- Function for vector similarity search
CREATE OR REPLACE FUNCTION match_knowledge_entities(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  entity_type varchar,
  source_type varchar,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    knowledge_entities.id,
    knowledge_entities.content,
    knowledge_entities.entity_type,
    knowledge_entities.source_type,
    1 - (knowledge_entities.embedding <=> query_embedding) as similarity
  FROM knowledge_entities
  WHERE 1 - (knowledge_entities.embedding <=> query_embedding) > match_threshold
  ORDER BY knowledge_entities.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function for hybrid search (vector + text)
CREATE OR REPLACE FUNCTION hybrid_search_knowledge(
  query_text text,
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  text_weight float DEFAULT 0.3,
  vector_weight float DEFAULT 0.7
)
RETURNS TABLE (
  id uuid,
  content text,
  entity_type varchar,
  source_type varchar,
  similarity float,
  text_rank float,
  combined_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ke.id,
    ke.content,
    ke.entity_type,
    ke.source_type,
    (1 - (ke.embedding <=> query_embedding)) as similarity,
    ts_rank(to_tsvector('english', ke.content), plainto_tsquery('english', query_text)) as text_rank,
    (
      (1 - (ke.embedding <=> query_embedding)) * vector_weight +
      ts_rank(to_tsvector('english', ke.content), plainto_tsquery('english', query_text)) * text_weight
    ) as combined_score
  FROM knowledge_entities ke
  WHERE 
    (1 - (ke.embedding <=> query_embedding)) > match_threshold
    OR to_tsvector('english', ke.content) @@ plainto_tsquery('english', query_text)
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- Function for domain-specific knowledge search
CREATE OR REPLACE FUNCTION search_knowledge_by_domain(
  query_embedding vector(1536),
  domain_filter text,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  content text,
  entity_type varchar,
  source_type varchar,
  domain varchar,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ke.id,
    ke.content,
    ke.entity_type,
    ke.source_type,
    (ke.source_metadata->>'domain')::varchar as domain,
    1 - (ke.embedding <=> query_embedding) as similarity
  FROM knowledge_entities ke
  WHERE 
    1 - (ke.embedding <=> query_embedding) > match_threshold
    AND (
      ke.source_metadata->>'domain' = domain_filter
      OR domain_filter = 'all'
    )
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function for expertise search
CREATE OR REPLACE FUNCTION search_expertise_knowledge(
  topic_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content text,
  expert_name varchar,
  expert_email varchar,
  confidence float,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ke.id,
    ke.content,
    (ke.source_metadata->>'expert_name')::varchar as expert_name,
    (ke.source_metadata->>'expert_email')::varchar as expert_email,
    COALESCE((ke.source_metadata->>'confidence')::float, 0.5) as confidence,
    1 - (ke.embedding <=> topic_embedding) as similarity
  FROM knowledge_entities ke
  WHERE 
    ke.entity_type = 'expertise'
    AND 1 - (ke.embedding <=> topic_embedding) > match_threshold
  ORDER BY 
    COALESCE((ke.source_metadata->>'confidence')::float, 0.5) DESC,
    ke.embedding <=> topic_embedding
  LIMIT match_count;
END;
$$;

-- Function for temporal knowledge search
CREATE OR REPLACE FUNCTION search_recent_knowledge(
  query_embedding vector(1536),
  days_back int DEFAULT 30,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  content text,
  entity_type varchar,
  source_type varchar,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ke.id,
    ke.content,
    ke.entity_type,
    ke.source_type,
    ke.created_at,
    1 - (ke.embedding <=> query_embedding) as similarity
  FROM knowledge_entities ke
  WHERE 
    ke.created_at >= NOW() - INTERVAL '1 day' * days_back
    AND 1 - (ke.embedding <=> query_embedding) > match_threshold
  ORDER BY 
    ke.created_at DESC,
    ke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function for knowledge graph relationship search
CREATE OR REPLACE FUNCTION search_related_knowledge(
  entity_id uuid,
  relationship_types text[] DEFAULT ARRAY['RELATED_TO', 'MENTIONS', 'AUTHORED'],
  max_depth int DEFAULT 2,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  content text,
  entity_type varchar,
  relationship_path text,
  depth int
)
LANGUAGE plpgsql
AS $$
DECLARE
  current_depth int := 1;
  found_entities uuid[];
BEGIN
  -- This is a simplified version - in practice, you'd use recursive CTEs
  -- or integrate with Neo4j for complex graph traversal
  
  RETURN QUERY
  SELECT
    ke.id,
    ke.content,
    ke.entity_type,
    'direct' as relationship_path,
    1 as depth
  FROM knowledge_entities ke
  WHERE ke.id != entity_id
  ORDER BY random() -- Simplified - would use actual relationship data
  LIMIT match_count;
END;
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_embedding 
ON knowledge_entities USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_knowledge_entities_content_fts 
ON knowledge_entities USING gin (to_tsvector('english', content));

CREATE INDEX IF NOT EXISTS idx_knowledge_entities_entity_type 
ON knowledge_entities (entity_type);

CREATE INDEX IF NOT EXISTS idx_knowledge_entities_source_type 
ON knowledge_entities (source_type);

CREATE INDEX IF NOT EXISTS idx_knowledge_entities_created_at 
ON knowledge_entities (created_at DESC);

-- Create composite index for domain filtering
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_domain 
ON knowledge_entities USING gin ((source_metadata->>'domain'));

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION match_knowledge_entities TO authenticated;
GRANT EXECUTE ON FUNCTION hybrid_search_knowledge TO authenticated;
GRANT EXECUTE ON FUNCTION search_knowledge_by_domain TO authenticated;
GRANT EXECUTE ON FUNCTION search_expertise_knowledge TO authenticated;
GRANT EXECUTE ON FUNCTION search_recent_knowledge TO authenticated;
GRANT EXECUTE ON FUNCTION search_related_knowledge TO authenticated;
