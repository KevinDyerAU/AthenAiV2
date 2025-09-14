-- Healing Insights Schema for Self-Healing Agent Knowledge Integration
-- This schema stores healing events, outcomes, and patterns for intelligent recovery

-- Create healing_insights table for storing healing events and outcomes
CREATE TABLE IF NOT EXISTS healing_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_healing_insights_issue_type ON healing_insights(issue_type);
CREATE INDEX IF NOT EXISTS idx_healing_insights_success ON healing_insights(success);
CREATE INDEX IF NOT EXISTS idx_healing_insights_created_at ON healing_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_healing_insights_context_hash ON healing_insights(context_hash);
CREATE INDEX IF NOT EXISTS idx_healing_insights_event_id ON healing_insights(event_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_healing_insights_type_success ON healing_insights(issue_type, success);
CREATE INDEX IF NOT EXISTS idx_healing_insights_type_created ON healing_insights(issue_type, created_at DESC);

-- GIN index for JSONB fields for efficient JSON queries
CREATE INDEX IF NOT EXISTS idx_healing_insights_actions_gin ON healing_insights USING GIN(actions_taken);
CREATE INDEX IF NOT EXISTS idx_healing_insights_metrics_gin ON healing_insights USING GIN(system_metrics);
CREATE INDEX IF NOT EXISTS idx_healing_insights_metadata_gin ON healing_insights USING GIN(metadata);

-- Create healing_patterns table for storing successful healing patterns
CREATE TABLE IF NOT EXISTS healing_patterns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    issue_type VARCHAR(100) NOT NULL,
    pattern_signature TEXT NOT NULL,
    success_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
    total_occurrences INTEGER NOT NULL DEFAULT 0,
    successful_occurrences INTEGER NOT NULL DEFAULT 0,
    average_duration_ms INTEGER,
    common_actions JSONB DEFAULT '[]'::jsonb,
    context_patterns JSONB DEFAULT '{}'::jsonb,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for healing_patterns
CREATE INDEX IF NOT EXISTS idx_healing_patterns_issue_type ON healing_patterns(issue_type);
CREATE INDEX IF NOT EXISTS idx_healing_patterns_success_rate ON healing_patterns(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_healing_patterns_signature ON healing_patterns(pattern_signature);

-- Create healing_predictions table for storing predictive patterns
CREATE TABLE IF NOT EXISTS healing_predictions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pattern_type VARCHAR(100) NOT NULL,
    risk_indicators JSONB NOT NULL DEFAULT '{}'::jsonb,
    predicted_issue VARCHAR(100) NOT NULL,
    confidence_score DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
    historical_accuracy DECIMAL(5,4) DEFAULT 0.0000,
    trigger_count INTEGER DEFAULT 0,
    correct_predictions INTEGER DEFAULT 0,
    false_positives INTEGER DEFAULT 0,
    last_triggered TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for healing_predictions
CREATE INDEX IF NOT EXISTS idx_healing_predictions_pattern_type ON healing_predictions(pattern_type);
CREATE INDEX IF NOT EXISTS idx_healing_predictions_predicted_issue ON healing_predictions(predicted_issue);
CREATE INDEX IF NOT EXISTS idx_healing_predictions_confidence ON healing_predictions(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_healing_predictions_accuracy ON healing_predictions(historical_accuracy DESC);

-- Create function to update healing patterns automatically
CREATE OR REPLACE FUNCTION update_healing_patterns()
RETURNS TRIGGER AS $$
BEGIN
    -- Update or insert healing pattern
    INSERT INTO healing_patterns (
        issue_type,
        pattern_signature,
        success_rate,
        total_occurrences,
        successful_occurrences,
        average_duration_ms,
        common_actions,
        context_patterns,
        last_updated
    )
    VALUES (
        NEW.issue_type,
        NEW.context_signature,
        CASE WHEN NEW.success THEN 1.0000 ELSE 0.0000 END,
        1,
        CASE WHEN NEW.success THEN 1 ELSE 0 END,
        NEW.duration_ms,
        NEW.actions_taken,
        NEW.metadata,
        NOW()
    )
    ON CONFLICT (issue_type, pattern_signature) DO UPDATE SET
        total_occurrences = healing_patterns.total_occurrences + 1,
        successful_occurrences = healing_patterns.successful_occurrences + 
            CASE WHEN NEW.success THEN 1 ELSE 0 END,
        success_rate = (healing_patterns.successful_occurrences + 
            CASE WHEN NEW.success THEN 1 ELSE 0 END)::DECIMAL / 
            (healing_patterns.total_occurrences + 1),
        average_duration_ms = (
            COALESCE(healing_patterns.average_duration_ms * healing_patterns.total_occurrences, 0) + 
            COALESCE(NEW.duration_ms, 0)
        ) / (healing_patterns.total_occurrences + 1),
        common_actions = NEW.actions_taken,
        context_patterns = NEW.metadata,
        last_updated = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update patterns
DROP TRIGGER IF EXISTS trigger_update_healing_patterns ON healing_insights;
CREATE TRIGGER trigger_update_healing_patterns
    AFTER INSERT ON healing_insights
    FOR EACH ROW
    EXECUTE FUNCTION update_healing_patterns();

-- Add unique constraint for pattern signatures (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'healing_patterns_issue_pattern_unique'
    ) THEN
        ALTER TABLE healing_patterns 
        ADD CONSTRAINT healing_patterns_issue_pattern_unique 
        UNIQUE (issue_type, pattern_signature);
    END IF;
END $$;

-- Create function to get successful healing patterns
CREATE OR REPLACE FUNCTION get_successful_healing_patterns(p_issue_type VARCHAR)
RETURNS TABLE (
    pattern_signature TEXT,
    success_rate DECIMAL,
    total_occurrences INTEGER,
    common_actions JSONB,
    average_duration_ms INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        hp.pattern_signature,
        hp.success_rate,
        hp.total_occurrences,
        hp.common_actions,
        hp.average_duration_ms
    FROM healing_patterns hp
    WHERE hp.issue_type = p_issue_type
        AND hp.success_rate > 0.5
        AND hp.total_occurrences >= 2
    ORDER BY hp.success_rate DESC, hp.total_occurrences DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Create function to get healing insights for similarity analysis
CREATE OR REPLACE FUNCTION get_healing_insights_for_similarity(p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
    id UUID,
    event_id VARCHAR,
    issue_type VARCHAR,
    context_signature TEXT,
    context_hash VARCHAR,
    actions_taken JSONB,
    success BOOLEAN,
    duration_ms INTEGER,
    system_metrics JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        hi.id,
        hi.event_id,
        hi.issue_type,
        hi.context_signature,
        hi.context_hash,
        hi.actions_taken,
        hi.success,
        hi.duration_ms,
        hi.system_metrics,
        hi.metadata,
        hi.created_at
    FROM healing_insights hi
    ORDER BY hi.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Create function to get recent healing insights
CREATE OR REPLACE FUNCTION get_recent_healing_insights(p_hours_back INTEGER DEFAULT 24)
RETURNS TABLE (
    id UUID,
    event_id VARCHAR,
    issue_type VARCHAR,
    context_signature TEXT,
    context_hash VARCHAR,
    actions_taken JSONB,
    success BOOLEAN,
    duration_ms INTEGER,
    system_metrics JSONB,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        hi.id,
        hi.event_id,
        hi.issue_type,
        hi.context_signature,
        hi.context_hash,
        hi.actions_taken,
        hi.success,
        hi.duration_ms,
        hi.system_metrics,
        hi.metadata,
        hi.created_at
    FROM healing_insights hi
    WHERE hi.created_at >= NOW() - (p_hours_back || ' hours')::INTERVAL
    ORDER BY hi.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to analyze healing effectiveness
CREATE OR REPLACE FUNCTION analyze_healing_effectiveness()
RETURNS TABLE (
    issue_type VARCHAR,
    total_incidents INTEGER,
    successful_healings INTEGER,
    success_rate DECIMAL,
    avg_duration_ms INTEGER,
    most_effective_action TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH healing_stats AS (
        SELECT 
            hi.issue_type,
            COUNT(*) as total_incidents,
            COUNT(*) FILTER (WHERE hi.success = true) as successful_healings,
            AVG(hi.duration_ms) as avg_duration_ms,
            MODE() WITHIN GROUP (ORDER BY action_item) as most_effective_action
        FROM healing_insights hi,
        LATERAL jsonb_array_elements_text(hi.actions_taken) as action_item
        WHERE hi.success = true
        GROUP BY hi.issue_type
    )
    SELECT 
        hs.issue_type,
        hs.total_incidents,
        hs.successful_healings,
        ROUND(hs.successful_healings::DECIMAL / hs.total_incidents, 4) as success_rate,
        ROUND(hs.avg_duration_ms)::INTEGER as avg_duration_ms,
        hs.most_effective_action
    FROM healing_stats hs
    ORDER BY success_rate DESC, total_incidents DESC;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE healing_insights IS 'Stores all healing events, actions taken, and outcomes for learning and pattern analysis';
COMMENT ON TABLE healing_patterns IS 'Aggregated patterns of successful healing strategies for different issue types';
COMMENT ON TABLE healing_predictions IS 'Predictive patterns and risk indicators for proactive healing';

COMMENT ON COLUMN healing_insights.event_id IS 'Unique identifier for the healing event from the logging system';
COMMENT ON COLUMN healing_insights.context_signature IS 'Normalized string representation of the system context for similarity matching';
COMMENT ON COLUMN healing_insights.context_hash IS 'MD5 hash of the context for exact matching and deduplication';
COMMENT ON COLUMN healing_insights.actions_taken IS 'JSON array of healing actions that were executed';
COMMENT ON COLUMN healing_insights.system_metrics IS 'System metrics at the time of healing for pattern analysis';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON healing_insights TO authenticated;
-- GRANT SELECT, INSERT, UPDATE ON healing_patterns TO authenticated;
-- GRANT SELECT, INSERT, UPDATE ON healing_predictions TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_successful_healing_patterns TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_healing_insights_for_similarity TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_recent_healing_insights TO authenticated;
-- GRANT EXECUTE ON FUNCTION analyze_healing_effectiveness TO authenticated;
