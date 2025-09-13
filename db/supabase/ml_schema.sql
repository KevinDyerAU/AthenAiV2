-- ML Service Database Schema for AthenAI V2
-- This schema supports the PyTorch ML service, model monitoring, and MLOps pipeline

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ML Model Predictions Table
-- Stores all ML model predictions with metadata
CREATE TABLE IF NOT EXISTS ml_model_predictions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    model_type TEXT NOT NULL,
    input_data JSONB NOT NULL,
    prediction JSONB NOT NULL,
    confidence FLOAT NOT NULL,
    knowledge_used BOOLEAN DEFAULT false,
    session_id TEXT,
    processing_time_ms INTEGER,
    model_version TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ML Training Runs Table
-- Tracks all model training runs and their results
CREATE TABLE IF NOT EXISTS ml_training_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    model_type TEXT NOT NULL,
    model_config JSONB NOT NULL,
    training_metrics JSONB NOT NULL,
    model_path TEXT NOT NULL,
    mlflow_run_id TEXT,
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    training_duration_seconds INTEGER,
    dataset_size INTEGER,
    validation_metrics JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ML Batch Jobs Table
-- Manages batch prediction jobs
CREATE TABLE IF NOT EXISTS ml_batch_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_type TEXT NOT NULL,
    input_data JSONB NOT NULL,
    config JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    results JSONB,
    error_message TEXT,
    callback_url TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ML Monitoring Alerts Table
-- Stores model monitoring alerts and notifications
CREATE TABLE IF NOT EXISTS ml_monitoring_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    model_type TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ML Data Drift Metrics Table
-- Tracks data drift detection results
CREATE TABLE IF NOT EXISTS ml_data_drift_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    model_type TEXT NOT NULL,
    feature_name TEXT NOT NULL,
    drift_score FLOAT NOT NULL,
    p_value FLOAT,
    is_drifting BOOLEAN DEFAULT false,
    reference_distribution JSONB,
    current_distribution JSONB,
    test_statistic FLOAT,
    test_method TEXT DEFAULT 'ks_test',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ML Model Registry Table
-- Tracks deployed models and their metadata
CREATE TABLE IF NOT EXISTS ml_model_registry (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    model_name TEXT NOT NULL,
    model_type TEXT NOT NULL,
    version TEXT NOT NULL,
    model_path TEXT NOT NULL,
    config JSONB NOT NULL,
    performance_metrics JSONB,
    status TEXT DEFAULT 'staging' CHECK (status IN ('staging', 'production', 'archived')),
    deployed_at TIMESTAMPTZ,
    mlflow_model_uri TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(model_name, version)
);

-- ML Feature Store Table
-- Stores computed features for ML models
CREATE TABLE IF NOT EXISTS ml_feature_store (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    feature_name TEXT NOT NULL,
    feature_value JSONB NOT NULL,
    feature_type TEXT NOT NULL,
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(entity_id, entity_type, feature_name, version)
);

-- ML Retraining Jobs Table
-- Tracks automated retraining jobs
CREATE TABLE IF NOT EXISTS ml_retraining_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    model_type TEXT NOT NULL,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('performance_drop', 'data_drift', 'scheduled', 'manual')),
    trigger_details JSONB DEFAULT '{}'::jsonb,
    config_override JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    training_run_id UUID REFERENCES ml_training_runs(id),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables with updated_at columns
CREATE TRIGGER update_ml_model_predictions_updated_at 
    BEFORE UPDATE ON ml_model_predictions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ml_training_runs_updated_at 
    BEFORE UPDATE ON ml_training_runs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ml_batch_jobs_updated_at 
    BEFORE UPDATE ON ml_batch_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ml_monitoring_alerts_updated_at 
    BEFORE UPDATE ON ml_monitoring_alerts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ml_model_registry_updated_at 
    BEFORE UPDATE ON ml_model_registry 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ml_retraining_jobs_updated_at 
    BEFORE UPDATE ON ml_retraining_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_ml_predictions_model_type_created 
ON ml_model_predictions (model_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_predictions_confidence 
ON ml_model_predictions (confidence);

CREATE INDEX IF NOT EXISTS idx_ml_predictions_knowledge_used 
ON ml_model_predictions (knowledge_used);

CREATE INDEX IF NOT EXISTS idx_ml_predictions_session_id 
ON ml_model_predictions (session_id);

CREATE INDEX IF NOT EXISTS idx_ml_training_runs_model_type_status 
ON ml_training_runs (model_type, status);

CREATE INDEX IF NOT EXISTS idx_ml_training_runs_mlflow_run_id 
ON ml_training_runs (mlflow_run_id);

CREATE INDEX IF NOT EXISTS idx_ml_batch_jobs_status_created 
ON ml_batch_jobs (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_batch_jobs_job_type 
ON ml_batch_jobs (job_type);

CREATE INDEX IF NOT EXISTS idx_ml_alerts_status_severity 
ON ml_monitoring_alerts (status, severity);

CREATE INDEX IF NOT EXISTS idx_ml_alerts_model_type_created 
ON ml_monitoring_alerts (model_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_drift_metrics_model_feature 
ON ml_data_drift_metrics (model_type, feature_name);

CREATE INDEX IF NOT EXISTS idx_ml_drift_metrics_is_drifting 
ON ml_data_drift_metrics (is_drifting, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_model_registry_name_version 
ON ml_model_registry (model_name, version);

CREATE INDEX IF NOT EXISTS idx_ml_model_registry_status 
ON ml_model_registry (status);

CREATE INDEX IF NOT EXISTS idx_ml_feature_store_entity 
ON ml_feature_store (entity_id, entity_type);

CREATE INDEX IF NOT EXISTS idx_ml_feature_store_feature_name 
ON ml_feature_store (feature_name);

CREATE INDEX IF NOT EXISTS idx_ml_feature_store_expires_at 
ON ml_feature_store (expires_at);

CREATE INDEX IF NOT EXISTS idx_ml_retraining_jobs_status_priority 
ON ml_retraining_jobs (status, priority DESC);

CREATE INDEX IF NOT EXISTS idx_ml_retraining_jobs_model_type 
ON ml_retraining_jobs (model_type);

CREATE INDEX IF NOT EXISTS idx_ml_retraining_jobs_trigger_type 
ON ml_retraining_jobs (trigger_type);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_ml_predictions_type_confidence_created 
ON ml_model_predictions (model_type, confidence, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_alerts_type_status_severity 
ON ml_monitoring_alerts (alert_type, status, severity);

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE ml_model_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_training_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_batch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_monitoring_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_data_drift_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_model_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_feature_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_retraining_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for service role access
CREATE POLICY "Service role can manage ml_model_predictions" ON ml_model_predictions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage ml_training_runs" ON ml_training_runs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage ml_batch_jobs" ON ml_batch_jobs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage ml_monitoring_alerts" ON ml_monitoring_alerts
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage ml_data_drift_metrics" ON ml_data_drift_metrics
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage ml_model_registry" ON ml_model_registry
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage ml_feature_store" ON ml_feature_store
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can manage ml_retraining_jobs" ON ml_retraining_jobs
    FOR ALL USING (auth.role() = 'service_role');

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Create views for common queries
CREATE OR REPLACE VIEW ml_model_performance_summary AS
SELECT 
    model_type,
    COUNT(*) as total_predictions,
    AVG(confidence) as avg_confidence,
    COUNT(*) FILTER (WHERE knowledge_used = true) as knowledge_used_count,
    COUNT(*) FILTER (WHERE confidence < 0.7) as low_confidence_count,
    DATE_TRUNC('hour', created_at) as hour_bucket
FROM ml_model_predictions
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY model_type, DATE_TRUNC('hour', created_at)
ORDER BY hour_bucket DESC;

CREATE OR REPLACE VIEW ml_active_alerts_summary AS
SELECT 
    alert_type,
    severity,
    model_type,
    COUNT(*) as alert_count,
    MIN(created_at) as oldest_alert,
    MAX(created_at) as newest_alert
FROM ml_monitoring_alerts
WHERE status = 'active'
GROUP BY alert_type, severity, model_type
ORDER BY severity DESC, alert_count DESC;

CREATE OR REPLACE VIEW ml_drift_status_summary AS
SELECT 
    model_type,
    COUNT(*) as total_features,
    COUNT(*) FILTER (WHERE is_drifting = true) as drifting_features,
    AVG(drift_score) as avg_drift_score,
    MAX(created_at) as last_check
FROM ml_data_drift_metrics
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY model_type
ORDER BY drifting_features DESC, avg_drift_score DESC;

-- Grant permissions on views
GRANT SELECT ON ml_model_performance_summary TO service_role;
GRANT SELECT ON ml_active_alerts_summary TO service_role;
GRANT SELECT ON ml_drift_status_summary TO service_role;

-- Add comments for documentation
COMMENT ON TABLE ml_model_predictions IS 'Stores all ML model predictions with metadata and performance tracking';
COMMENT ON TABLE ml_training_runs IS 'Tracks model training runs, metrics, and MLflow integration';
COMMENT ON TABLE ml_batch_jobs IS 'Manages batch prediction jobs with progress tracking';
COMMENT ON TABLE ml_monitoring_alerts IS 'Stores model monitoring alerts and notifications';
COMMENT ON TABLE ml_data_drift_metrics IS 'Tracks data drift detection results and statistics';
COMMENT ON TABLE ml_model_registry IS 'Registry of deployed models with versioning and metadata';
COMMENT ON TABLE ml_feature_store IS 'Stores computed features for ML models with versioning';
COMMENT ON TABLE ml_retraining_jobs IS 'Tracks automated retraining jobs and triggers';
