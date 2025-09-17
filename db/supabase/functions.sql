-- Advanced Data Pipeline Database Functions for AthenAI V2
-- These functions support the enhanced ingestion service and knowledge-first search

-- Function: Search similar content using vector embeddings
CREATE OR REPLACE FUNCTION search_similar_content(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id bigint,
  content text,
  similarity float,
  source_type text,
  source_metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ke.id,
    ke.content,
    (ke.embedding <=> query_embedding) * -1 + 1 as similarity,
    ke.source_type,
    ke.source_metadata,
    ke.created_at
  FROM knowledge_entities ke
  WHERE ke.embedding IS NOT NULL
    AND (ke.embedding <=> query_embedding) * -1 + 1 >= similarity_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function: Get processing statistics for a time period
CREATE OR REPLACE FUNCTION get_processing_stats(
  time_period interval DEFAULT '24 hours'::interval
)
RETURNS TABLE (
  total_processed bigint,
  successful bigint,
  failed bigint,
  total_chunks bigint,
  total_entities bigint,
  total_relationships bigint,
  avg_processing_time float,
  by_source_type jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
  start_time timestamptz := NOW() - time_period;
BEGIN
  -- Return basic knowledge entity statistics
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_processed,
    COUNT(*)::bigint as successful,
    0::bigint as failed,
    0::bigint as total_chunks,
    COUNT(*)::bigint as total_entities,
    0::bigint as total_relationships,
    0::float as avg_processing_time,
    jsonb_object_agg(
      COALESCE(source_type, 'unknown'), 
      COUNT(*)
    ) as by_source_type
  FROM knowledge_entities
  WHERE created_at >= start_time;
END;
$$;

-- Function: Find related entities in knowledge graph
CREATE OR REPLACE FUNCTION find_related_entities(
  entity_names text[],
  max_depth int DEFAULT 2,
  min_confidence float DEFAULT 0.5
)
RETURNS TABLE (
  entity_name text,
  related_entity text,
  relationship_type text,
  confidence float,
  path_length int
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- This function would work with Neo4j data if we had a foreign data wrapper
  -- For now, return empty results as this is primarily handled by Neo4j
  RETURN;
END;
$$;

-- Function: Get knowledge entity recommendations based on content similarity
CREATE OR REPLACE FUNCTION get_knowledge_recommendations(
  content_text text,
  filter_entity_type text DEFAULT NULL,
  limit_count int DEFAULT 5
)
RETURNS TABLE (
  id bigint,
  content text,
  entity_type text,
  similarity_score float,
  source_metadata jsonb
)
LANGUAGE plpgsql
AS $$
DECLARE
  content_embedding vector(1536);
BEGIN
  -- Generate embedding for the input content (this would need to be done externally)
  -- For now, we'll use a simple text similarity approach
  
  RETURN QUERY
  SELECT 
    ke.id,
    ke.content,
    ke.entity_type,
    -- Simple text similarity using trigram similarity
    similarity(ke.content, content_text) as similarity_score,
    ke.source_metadata
  FROM knowledge_entities ke
  WHERE (filter_entity_type IS NULL OR ke.entity_type = filter_entity_type)
    AND similarity(ke.content, content_text) > 0.1
  ORDER BY similarity(ke.content, content_text) DESC
  LIMIT limit_count;
END;
$$;

-- Function: Clean up old knowledge entities
CREATE OR REPLACE FUNCTION cleanup_old_knowledge_entities(
  retention_period interval DEFAULT '30 days'::interval
)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM knowledge_entities 
  WHERE created_at < NOW() - retention_period;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Function: Update entity embeddings in batch
CREATE OR REPLACE FUNCTION update_entity_embeddings(
  entity_ids bigint[],
  embeddings vector(1536)[]
)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count int := 0;
  i int;
BEGIN
  -- Update embeddings for the provided entity IDs
  FOR i IN 1..array_length(entity_ids, 1) LOOP
    UPDATE knowledge_entities 
    SET embedding = embeddings[i], updated_at = NOW()
    WHERE id = entity_ids[i];
    
    IF FOUND THEN
      updated_count := updated_count + 1;
    END IF;
  END LOOP;
  
  RETURN updated_count;
END;
$$;

-- Removed get_agent_performance_metrics function as agent_sessions table doesn't exist

-- Function: Search knowledge entities by content
CREATE OR REPLACE FUNCTION search_knowledge_content(
  search_query text,
  from_date timestamptz DEFAULT NULL,
  to_date timestamptz DEFAULT NULL,
  limit_count integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  entity_type text,
  content text,
  source_type text,
  created_at timestamptz,
  content_preview text,
  similarity_score real
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ke.id,
    ke.entity_type,
    ke.content,
    ke.source_type,
    ke.created_at,
    LEFT(ke.content, 200) as content_preview,
    similarity(ke.content, search_query) as similarity_score
  FROM knowledge_entities ke
  WHERE (from_date IS NULL OR ke.created_at >= from_date)
    AND (to_date IS NULL OR ke.created_at <= to_date)
    AND similarity(ke.content, search_query) > 0.1
  ORDER BY similarity(ke.content, search_query) DESC
  LIMIT limit_count;
END;
$$;

-- Removed search_emails function as email_logs table doesn't exist

-- Function: Get knowledge entity statistics
CREATE OR REPLACE FUNCTION get_knowledge_stats()
RETURNS TABLE (
  total_entities bigint,
  by_entity_type jsonb,
  by_source_type jsonb,
  with_embeddings bigint,
  avg_content_length float,
  created_today bigint,
  created_this_week bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_entities,
    jsonb_object_agg(
      COALESCE(entity_type, 'unknown'), 
      COUNT(*)
    ) as by_entity_type,
    jsonb_object_agg(
      COALESCE(source_type, 'unknown'), 
      COUNT(*)
    ) as by_source_type,
    COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embeddings,
    AVG(LENGTH(content)) as avg_content_length,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as created_today,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as created_this_week
  FROM knowledge_entities;
END;
$$;

-- Function: Batch insert knowledge entities with conflict resolution
CREATE OR REPLACE FUNCTION batch_insert_knowledge_entities(
  entities jsonb
)
RETURNS TABLE (
  inserted_count int,
  updated_count int,
  error_count int
)
LANGUAGE plpgsql
AS $$
DECLARE
  entity jsonb;
  inserted int := 0;
  updated int := 0;
  errors int := 0;
BEGIN
  FOR entity IN SELECT jsonb_array_elements(entities) LOOP
    BEGIN
      INSERT INTO knowledge_entities (
        external_id,
        content,
        entity_type,
        embedding,
        source_type,
        source_metadata
      ) VALUES (
        (entity->>'external_id')::text,
        (entity->>'content')::text,
        (entity->>'entity_type')::text,
        (entity->>'embedding')::vector(1536),
        (entity->>'source_type')::text,
        (entity->'source_metadata')::jsonb
      )
      ON CONFLICT (external_id) DO UPDATE SET
        content = EXCLUDED.content,
        entity_type = EXCLUDED.entity_type,
        embedding = EXCLUDED.embedding,
        source_metadata = EXCLUDED.source_metadata,
        updated_at = NOW();
      
      IF FOUND THEN
        updated := updated + 1;
      ELSE
        inserted := inserted + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      errors := errors + 1;
    END;
  END LOOP;
  
  RETURN QUERY SELECT inserted, updated, errors;
END;
$$;

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_embedding 
ON knowledge_entities USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_knowledge_entities_source_type 
ON knowledge_entities (source_type);

CREATE INDEX IF NOT EXISTS idx_knowledge_entities_entity_type 
ON knowledge_entities (entity_type);

CREATE INDEX IF NOT EXISTS idx_knowledge_entities_created_at 
ON knowledge_entities (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_entities_external_id 
ON knowledge_entities (external_id);

-- Removed processing_logs indexes as table doesn't exist

-- Removed email_logs and contacts indexes as tables don't exist
-- Knowledge entities already have appropriate indexes

-- Removed agent_sessions indexes as table doesn't exist

-- Enable trigram similarity extension for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create trigram indexes for content search
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_content_gin 
ON knowledge_entities USING gin (content gin_trgm_ops);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_type_created 
ON knowledge_entities (entity_type, created_at DESC);

-- Removed processing_logs composite index as table doesn't exist



-- Removed ML indexes as ML tables are in separate ml_schema.sql file

-- Grant necessary permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
