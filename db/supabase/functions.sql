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
  RETURN QUERY
  SELECT 
    COUNT(*) as total_processed,
    COUNT(*) FILTER (WHERE status = 'completed') as successful,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    COALESCE(SUM(chunks_processed), 0) as total_chunks,
    COALESCE(SUM(entities_extracted), 0) as total_entities,
    COALESCE(SUM(relationships_found), 0) as total_relationships,
    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_processing_time,
    jsonb_object_agg(
      COALESCE(source_type, 'unknown'), 
      COUNT(*)
    ) as by_source_type
  FROM processing_logs
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
  entity_type text DEFAULT NULL,
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
  WHERE (entity_type IS NULL OR ke.entity_type = get_knowledge_recommendations.entity_type)
    AND similarity(ke.content, content_text) > 0.1
  ORDER BY similarity(ke.content, content_text) DESC
  LIMIT limit_count;
END;
$$;

-- Function: Clean up old processing logs
CREATE OR REPLACE FUNCTION cleanup_old_processing_logs(
  retention_period interval DEFAULT '30 days'::interval
)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM processing_logs 
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

-- Function: Get agent performance metrics
CREATE OR REPLACE FUNCTION get_agent_performance_metrics(
  agent_id text DEFAULT NULL,
  time_period interval DEFAULT '24 hours'::interval
)
RETURNS TABLE (
  agent_id text,
  total_sessions bigint,
  successful_sessions bigint,
  failed_sessions bigint,
  avg_duration float,
  success_rate float
)
LANGUAGE plpgsql
AS $$
DECLARE
  start_time timestamptz := NOW() - time_period;
BEGIN
  RETURN QUERY
  SELECT 
    ags.agent_id,
    COUNT(*) as total_sessions,
    COUNT(*) FILTER (WHERE ags.status = 'completed') as successful_sessions,
    COUNT(*) FILTER (WHERE ags.status = 'failed') as failed_sessions,
    AVG(EXTRACT(EPOCH FROM (ags.updated_at - ags.created_at))) as avg_duration,
    (COUNT(*) FILTER (WHERE ags.status = 'completed')::float / COUNT(*)::float) as success_rate
  FROM agent_sessions ags
  WHERE ags.created_at >= start_time
    AND (get_agent_performance_metrics.agent_id IS NULL OR ags.agent_id = get_agent_performance_metrics.agent_id)
  GROUP BY ags.agent_id;
END;
$$;

-- Function: Search emails by content and metadata
CREATE OR REPLACE FUNCTION search_emails(
  search_query text,
  from_date timestamptz DEFAULT NULL,
  to_date timestamptz DEFAULT NULL,
  from_address text DEFAULT NULL,
  limit_count int DEFAULT 20
)
RETURNS TABLE (
  processing_id uuid,
  message_id text,
  subject text,
  from_address text,
  to_addresses text[],
  date_sent timestamptz,
  content_preview text,
  has_attachments boolean,
  similarity_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    el.processing_id,
    el.message_id,
    el.subject,
    el.from_address,
    el.to_addresses,
    el.date_sent,
    LEFT(ke.content, 200) as content_preview,
    el.has_attachments,
    similarity(ke.content, search_query) as similarity_score
  FROM email_logs el
  JOIN processing_logs pl ON el.processing_id = pl.processing_id
  JOIN knowledge_entities ke ON pl.processing_id::text = ke.external_id
  WHERE (from_date IS NULL OR el.date_sent >= from_date)
    AND (to_date IS NULL OR el.date_sent <= to_date)
    AND (search_emails.from_address IS NULL OR el.from_address ILIKE '%' || search_emails.from_address || '%')
    AND (ke.content ILIKE '%' || search_query || '%' OR el.subject ILIKE '%' || search_query || '%')
  ORDER BY similarity(ke.content, search_query) DESC, el.date_sent DESC
  LIMIT limit_count;
END;
$$;

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

CREATE INDEX IF NOT EXISTS idx_processing_logs_status 
ON processing_logs (status);

CREATE INDEX IF NOT EXISTS idx_processing_logs_created_at 
ON processing_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_processing_logs_source_type 
ON processing_logs (source_type);

CREATE INDEX IF NOT EXISTS idx_email_logs_processing_id 
ON email_logs (processing_id);

CREATE INDEX IF NOT EXISTS idx_email_logs_from_address 
ON email_logs (from_address);

CREATE INDEX IF NOT EXISTS idx_email_logs_date_sent 
ON email_logs (date_sent DESC);

CREATE INDEX IF NOT EXISTS idx_email_logs_subject_gin 
ON email_logs USING gin (to_tsvector('english', subject));

CREATE INDEX IF NOT EXISTS idx_contacts_email 
ON contacts (email);

CREATE INDEX IF NOT EXISTS idx_contacts_last_seen 
ON contacts (last_seen DESC);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_id 
ON agent_sessions (agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_status 
ON agent_sessions (status);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_created_at 
ON agent_sessions (created_at DESC);

-- Enable trigram similarity extension for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create trigram indexes for content search
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_content_gin 
ON knowledge_entities USING gin (content gin_trgm_ops);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_type_created 
ON knowledge_entities (entity_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_processing_logs_type_status_created 
ON processing_logs (source_type, status, created_at DESC);

-- ML Service Functions for AthenAI V2
-- These functions support the ML service, model monitoring, and MLOps pipeline

-- Function: Store ML model predictions
CREATE OR REPLACE FUNCTION store_ml_prediction(
  model_type text,
  input_data jsonb,
  prediction jsonb,
  confidence float,
  knowledge_used boolean DEFAULT false,
  session_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  prediction_id uuid;
BEGIN
  INSERT INTO ml_model_predictions (
    model_type,
    input_data,
    prediction,
    confidence,
    knowledge_used,
    session_id
  ) VALUES (
    model_type,
    input_data,
    prediction,
    confidence,
    knowledge_used,
    session_id
  ) RETURNING id INTO prediction_id;
  
  RETURN prediction_id;
END;
$$;

-- Function: Get model performance metrics
CREATE OR REPLACE FUNCTION get_model_performance_metrics(
  model_type text DEFAULT NULL,
  time_period interval DEFAULT '24 hours'::interval
)
RETURNS TABLE (
  model_type text,
  total_predictions bigint,
  avg_confidence float,
  knowledge_usage_rate float,
  predictions_per_hour float,
  low_confidence_rate float
)
LANGUAGE plpgsql
AS $$
DECLARE
  start_time timestamptz := NOW() - time_period;
BEGIN
  RETURN QUERY
  SELECT 
    mp.model_type,
    COUNT(*) as total_predictions,
    AVG(mp.confidence) as avg_confidence,
    (COUNT(*) FILTER (WHERE mp.knowledge_used = true)::float / COUNT(*)::float) as knowledge_usage_rate,
    (COUNT(*)::float / EXTRACT(EPOCH FROM time_period) * 3600) as predictions_per_hour,
    (COUNT(*) FILTER (WHERE mp.confidence < 0.7)::float / COUNT(*)::float) as low_confidence_rate
  FROM ml_model_predictions mp
  WHERE mp.created_at >= start_time
    AND (get_model_performance_metrics.model_type IS NULL OR mp.model_type = get_model_performance_metrics.model_type)
  GROUP BY mp.model_type;
END;
$$;

-- Function: Store training run results
CREATE OR REPLACE FUNCTION store_training_run(
  model_type text,
  model_config jsonb,
  training_metrics jsonb,
  model_path text,
  mlflow_run_id text DEFAULT NULL,
  status text DEFAULT 'completed'
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  run_id uuid;
BEGIN
  INSERT INTO ml_training_runs (
    model_type,
    model_config,
    training_metrics,
    model_path,
    mlflow_run_id,
    status
  ) VALUES (
    model_type,
    model_config,
    training_metrics,
    model_path,
    mlflow_run_id,
    status
  ) RETURNING id INTO run_id;
  
  RETURN run_id;
END;
$$;

-- Function: Submit batch prediction job
CREATE OR REPLACE FUNCTION submit_batch_job(
  job_type text,
  input_data jsonb,
  config jsonb DEFAULT '{}'::jsonb,
  callback_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  job_id uuid;
BEGIN
  INSERT INTO ml_batch_jobs (
    job_type,
    input_data,
    config,
    callback_url,
    status
  ) VALUES (
    job_type,
    input_data,
    config,
    callback_url,
    'pending'
  ) RETURNING id INTO job_id;
  
  RETURN job_id;
END;
$$;

-- Function: Update batch job status
CREATE OR REPLACE FUNCTION update_batch_job_status(
  job_id uuid,
  new_status text,
  progress_percentage int DEFAULT NULL,
  results jsonb DEFAULT NULL,
  error_message text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE ml_batch_jobs 
  SET 
    status = new_status,
    progress = COALESCE(progress_percentage, progress),
    results = COALESCE(results, ml_batch_jobs.results),
    error_message = COALESCE(update_batch_job_status.error_message, ml_batch_jobs.error_message),
    updated_at = NOW()
  WHERE id = job_id;
  
  RETURN FOUND;
END;
$$;

-- Function: Store model monitoring alert
CREATE OR REPLACE FUNCTION store_monitoring_alert(
  alert_type text,
  severity text,
  message text,
  details jsonb DEFAULT '{}'::jsonb,
  model_type text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  alert_id uuid;
BEGIN
  INSERT INTO ml_monitoring_alerts (
    alert_type,
    severity,
    message,
    details,
    model_type,
    status
  ) VALUES (
    alert_type,
    severity,
    message,
    details,
    model_type,
    'active'
  ) RETURNING id INTO alert_id;
  
  RETURN alert_id;
END;
$$;

-- Function: Get data drift metrics
CREATE OR REPLACE FUNCTION get_data_drift_metrics(
  model_type text DEFAULT NULL,
  time_period interval DEFAULT '24 hours'::interval
)
RETURNS TABLE (
  model_type text,
  feature_name text,
  drift_score float,
  p_value float,
  is_drifting boolean,
  last_checked timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  start_time timestamptz := NOW() - time_period;
BEGIN
  RETURN QUERY
  SELECT 
    ddm.model_type,
    ddm.feature_name,
    ddm.drift_score,
    ddm.p_value,
    ddm.is_drifting,
    ddm.created_at as last_checked
  FROM ml_data_drift_metrics ddm
  WHERE ddm.created_at >= start_time
    AND (get_data_drift_metrics.model_type IS NULL OR ddm.model_type = get_data_drift_metrics.model_type)
  ORDER BY ddm.created_at DESC;
END;
$$;

-- Function: Clean up old ML data
CREATE OR REPLACE FUNCTION cleanup_old_ml_data(
  predictions_retention interval DEFAULT '90 days'::interval,
  training_runs_retention interval DEFAULT '1 year'::interval,
  batch_jobs_retention interval DEFAULT '30 days'::interval,
  alerts_retention interval DEFAULT '90 days'::interval
)
RETURNS TABLE (
  predictions_deleted int,
  training_runs_deleted int,
  batch_jobs_deleted int,
  alerts_deleted int
)
LANGUAGE plpgsql
AS $$
DECLARE
  pred_count int;
  train_count int;
  batch_count int;
  alert_count int;
BEGIN
  -- Clean up old predictions
  DELETE FROM ml_model_predictions 
  WHERE created_at < NOW() - predictions_retention;
  GET DIAGNOSTICS pred_count = ROW_COUNT;
  
  -- Clean up old training runs
  DELETE FROM ml_training_runs 
  WHERE created_at < NOW() - training_runs_retention;
  GET DIAGNOSTICS train_count = ROW_COUNT;
  
  -- Clean up old batch jobs
  DELETE FROM ml_batch_jobs 
  WHERE created_at < NOW() - batch_jobs_retention
    AND status IN ('completed', 'failed');
  GET DIAGNOSTICS batch_count = ROW_COUNT;
  
  -- Clean up old resolved alerts
  DELETE FROM ml_monitoring_alerts 
  WHERE created_at < NOW() - alerts_retention
    AND status = 'resolved';
  GET DIAGNOSTICS alert_count = ROW_COUNT;
  
  RETURN QUERY SELECT pred_count, train_count, batch_count, alert_count;
END;
$$;

-- Create ML-specific indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_ml_predictions_model_type 
ON ml_model_predictions (model_type);

CREATE INDEX IF NOT EXISTS idx_ml_predictions_created_at 
ON ml_model_predictions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_predictions_confidence 
ON ml_model_predictions (confidence);

CREATE INDEX IF NOT EXISTS idx_ml_predictions_knowledge_used 
ON ml_model_predictions (knowledge_used);

CREATE INDEX IF NOT EXISTS idx_ml_training_runs_model_type 
ON ml_training_runs (model_type);

CREATE INDEX IF NOT EXISTS idx_ml_training_runs_status 
ON ml_training_runs (status);

CREATE INDEX IF NOT EXISTS idx_ml_training_runs_created_at 
ON ml_training_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_batch_jobs_status 
ON ml_batch_jobs (status);

CREATE INDEX IF NOT EXISTS idx_ml_batch_jobs_job_type 
ON ml_batch_jobs (job_type);

CREATE INDEX IF NOT EXISTS idx_ml_batch_jobs_created_at 
ON ml_batch_jobs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_alerts_status 
ON ml_monitoring_alerts (status);

CREATE INDEX IF NOT EXISTS idx_ml_alerts_severity 
ON ml_monitoring_alerts (severity);

CREATE INDEX IF NOT EXISTS idx_ml_alerts_model_type 
ON ml_monitoring_alerts (model_type);

CREATE INDEX IF NOT EXISTS idx_ml_alerts_created_at 
ON ml_monitoring_alerts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_drift_metrics_model_type 
ON ml_data_drift_metrics (model_type);

CREATE INDEX IF NOT EXISTS idx_ml_drift_metrics_is_drifting 
ON ml_data_drift_metrics (is_drifting);

CREATE INDEX IF NOT EXISTS idx_ml_drift_metrics_created_at 
ON ml_data_drift_metrics (created_at DESC);

-- Grant necessary permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
