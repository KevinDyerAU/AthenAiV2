// ML Service Schema Extensions for AthenAI V2 Neo4j Knowledge Graph
// This schema supports Graph Neural Networks, ML predictions, and MLOps pipeline

// Create constraints for ML-specific nodes
CREATE CONSTRAINT ml_prediction_id IF NOT EXISTS FOR (p:MLPrediction) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT ml_training_run_id IF NOT EXISTS FOR (t:MLTrainingRun) REQUIRE t.id IS UNIQUE;
CREATE CONSTRAINT ml_model_id IF NOT EXISTS FOR (m:MLModel) REQUIRE m.id IS UNIQUE;
CREATE CONSTRAINT ml_batch_job_id IF NOT EXISTS FOR (b:MLBatchJob) REQUIRE b.id IS UNIQUE;
CREATE CONSTRAINT ml_alert_id IF NOT EXISTS FOR (a:MLAlert) REQUIRE a.id IS UNIQUE;

// Create indexes for ML performance optimization
CREATE INDEX ml_prediction_model_type_index IF NOT EXISTS FOR (p:MLPrediction) ON (p.model_type);
CREATE INDEX ml_prediction_confidence_index IF NOT EXISTS FOR (p:MLPrediction) ON (p.confidence);
CREATE INDEX ml_prediction_created_at_index IF NOT EXISTS FOR (p:MLPrediction) ON (p.created_at);
CREATE INDEX ml_prediction_knowledge_used_index IF NOT EXISTS FOR (p:MLPrediction) ON (p.knowledge_used);

CREATE INDEX ml_training_run_model_type_index IF NOT EXISTS FOR (t:MLTrainingRun) ON (t.model_type);
CREATE INDEX ml_training_run_status_index IF NOT EXISTS FOR (t:MLTrainingRun) ON (t.status);
CREATE INDEX ml_training_run_created_at_index IF NOT EXISTS FOR (t:MLTrainingRun) ON (t.created_at);

CREATE INDEX ml_model_name_version_index IF NOT EXISTS FOR (m:MLModel) ON (m.model_name, m.version);
CREATE INDEX ml_model_status_index IF NOT EXISTS FOR (m:MLModel) ON (m.status);
CREATE INDEX ml_model_type_index IF NOT EXISTS FOR (m:MLModel) ON (m.model_type);

CREATE INDEX ml_batch_job_status_index IF NOT EXISTS FOR (b:MLBatchJob) ON (b.status);
CREATE INDEX ml_batch_job_type_index IF NOT EXISTS FOR (b:MLBatchJob) ON (b.job_type);
CREATE INDEX ml_batch_job_created_at_index IF NOT EXISTS FOR (b:MLBatchJob) ON (b.created_at);

CREATE INDEX ml_alert_severity_index IF NOT EXISTS FOR (a:MLAlert) ON (a.severity);
CREATE INDEX ml_alert_status_index IF NOT EXISTS FOR (a:MLAlert) ON (a.status);
CREATE INDEX ml_alert_type_index IF NOT EXISTS FOR (a:MLAlert) ON (a.alert_type);

// MLPrediction node structure
// Represents ML model predictions stored in the knowledge graph
// Properties:
// - id: Unique prediction identifier (matches Supabase ml_model_predictions.id)
// - model_type: Type of ML model used (link_prediction, node_classification, expertise_recommendation)
// - prediction_type: Specific prediction type (entity_link, document_classification, expert_ranking)
// - confidence: Prediction confidence score (0.0-1.0)
// - knowledge_used: Whether knowledge substrate was used first
// - processing_time_ms: Inference time in milliseconds
// - model_version: Version of the model used
// - created_at: Prediction timestamp
// - input_hash: Hash of input data for deduplication
// - session_id: Associated session identifier
// - prediction_data: Serialized prediction results

// MLTrainingRun node structure
// Represents model training runs and their results
// Properties:
// - id: Unique training run identifier (matches Supabase ml_training_runs.id)
// - model_type: Type of model trained
// - status: Training status (pending, running, completed, failed)
// - training_duration_seconds: Duration of training
// - dataset_size: Size of training dataset
// - validation_accuracy: Validation accuracy achieved
// - test_accuracy: Test accuracy achieved
// - model_path: Path to saved model
// - mlflow_run_id: MLflow experiment run ID
// - created_at: Training start timestamp
// - completed_at: Training completion timestamp
// - hyperparameters: Training hyperparameters as JSON string
// - training_metrics: Comprehensive training metrics
// - config: Training configuration used

// MLModel node structure
// Represents deployed ML models in the registry
// Properties:
// - id: Unique model identifier
// - model_name: Human-readable model name
// - model_type: Type of ML model (GCN, GAT, GraphSAGE, etc.)
// - version: Model version string
// - status: Deployment status (staging, production, archived)
// - performance_metrics: Model performance metrics as JSON string
// - deployed_at: Deployment timestamp
// - created_at: Model creation timestamp
// - config: Model configuration as JSON string
// - model_path: Path to model files
// - mlflow_model_uri: MLflow model URI

// MLBatchJob node structure
// Represents batch prediction jobs
// Properties:
// - id: Unique batch job identifier (matches Supabase ml_batch_jobs.id)
// - job_type: Type of batch job (expertise_batch, link_prediction_batch, classification_batch)
// - status: Job status (pending, running, completed, failed)
// - progress: Progress percentage (0-100)
// - total_items: Total number of items to process
// - processed_items: Number of items processed
// - created_at: Job creation timestamp
// - started_at: Job start timestamp
// - completed_at: Job completion timestamp
// - config: Job configuration
// - callback_url: Callback URL for notifications

// MLAlert node structure
// Represents ML monitoring alerts
// Properties:
// - id: Unique alert identifier (matches Supabase ml_monitoring_alerts.id)
// - alert_type: Type of alert (performance_drop, data_drift, system_error)
// - severity: Alert severity (low, medium, high, critical)
// - status: Alert status (active, acknowledged, resolved)
// - message: Human-readable alert message
// - details: Alert details as JSON string
// - model_type: Associated model type
// - created_at: Alert creation timestamp
// - acknowledged_at: Alert acknowledgment timestamp
// - resolved_at: Alert resolution timestamp

// ML-specific relationship types for Graph Neural Networks

// Entity -> MLPrediction relationships
// PREDICTED_BY: Entity was subject of ML prediction
// Properties: prediction_rank, confidence, context, prediction_type

// MLPrediction -> Entity relationships
// PREDICTS: ML prediction predicts entity relationship or classification
// RECOMMENDS: ML prediction recommends entity (for expertise recommendation)
// CLASSIFIES: ML prediction classifies entity into category
// Properties: prediction_score, rank, reasoning, feature_importance

// MLPrediction -> Document relationships
// BASED_ON: ML prediction based on document features
// INFLUENCES: ML prediction influences document classification
// Properties: influence_score, feature_importance, document_features_used

// MLTrainingRun -> MLModel relationships
// PRODUCED: Training run produced model
// Properties: training_metrics, validation_results, model_artifacts

// MLModel -> MLPrediction relationships
// GENERATED: Model generated prediction
// Properties: model_version, inference_time, model_confidence

// MLBatchJob -> MLPrediction relationships
// CONTAINS: Batch job contains individual predictions
// Properties: batch_index, processing_order

// MLAlert -> MLModel relationships
// MONITORS: Alert monitors specific model
// Properties: monitoring_metric, threshold_value, actual_value

// Entity -> Entity ML-enhanced relationships (for GNN training and predictions)
// ML_LINK_PREDICTED: Link predicted by GNN model
// ML_SIMILARITY: Similarity computed by ML model
// ML_EXPERTISE_MATCH: Expertise match predicted by recommendation model
// ML_CO_OCCURRENCE: Co-occurrence pattern detected by ML
// Properties: ml_confidence, model_type, prediction_date, human_verified, feature_vector

// Document -> Document ML relationships
// ML_SIMILAR: Documents similar according to ML model
// ML_RELATED: Documents related according to content analysis
// ML_TOPIC_MATCH: Documents share topics according to classification model
// Properties: similarity_score, model_type, feature_vector_distance, topic_overlap

// Document -> Entity ML relationships
// ML_MENTIONS: ML-detected entity mentions in document
// ML_TOPIC_CLASSIFIED: Document classified into entity topic
// ML_EXPERTISE_SOURCE: Document is source of expertise for entity
// Properties: mention_confidence, classification_confidence, expertise_score

// Training data relationships for GNN models
// Entity -> Entity relationships for training
// TRAINING_POSITIVE: Positive training example for link prediction
// TRAINING_NEGATIVE: Negative training example for link prediction
// VALIDATION_LINK: Validation set link for model evaluation
// TEST_LINK: Test set link for model evaluation
// Properties: split_type, edge_weight, training_epoch, label

// Sample ML queries for Graph Neural Networks and MLOps:

// Find high-confidence link predictions between entities
// MATCH (e1:Entity)-[r:ML_LINK_PREDICTED]->(e2:Entity)
// WHERE r.ml_confidence > 0.9 AND r.model_type = 'GraphSAGE'
// RETURN e1.name, e2.name, r.ml_confidence, r.prediction_date
// ORDER BY r.ml_confidence DESC;

// Find expertise recommendations with human verification
// MATCH (expert:Entity)-[r:ML_EXPERTISE_MATCH]->(domain:Entity)
// WHERE r.ml_confidence > 0.8 AND expert.type = 'PERSON' AND r.human_verified = true
// RETURN expert.name, domain.name, r.ml_confidence, r.human_verified
// ORDER BY r.ml_confidence DESC;

// Find documents classified by GNN models
// MATCH (d:Document)<-[:CLASSIFIES]-(p:MLPrediction)
// WHERE p.model_type = 'node_classification' AND p.confidence > 0.85
// RETURN d.title, p.prediction_type, p.confidence, p.model_version
// ORDER BY p.confidence DESC;

// Find ML model performance trends
// MATCH (m:MLModel)-[:GENERATED]->(p:MLPrediction)
// WHERE p.created_at > datetime() - duration('P7D')
// WITH m, avg(p.confidence) as avg_confidence, count(p) as prediction_count,
//      avg(p.processing_time_ms) as avg_processing_time
// RETURN m.model_name, m.version, avg_confidence, prediction_count, avg_processing_time
// ORDER BY avg_confidence DESC;

// Find entities frequently appearing in high-confidence predictions
// MATCH (e:Entity)<-[:PREDICTS]-(p:MLPrediction)
// WHERE p.confidence > 0.9
// WITH e, count(p) as high_confidence_predictions, avg(p.confidence) as avg_confidence,
//      collect(DISTINCT p.model_type) as model_types
// WHERE high_confidence_predictions > 10
// RETURN e.name, e.type, high_confidence_predictions, avg_confidence, model_types
// ORDER BY high_confidence_predictions DESC;

// Find training runs that produced best performing models
// MATCH (t:MLTrainingRun)-[:PRODUCED]->(m:MLModel)
// WHERE t.status = 'completed' AND m.status = 'production'
// RETURN t.model_type, t.validation_accuracy, t.test_accuracy, 
//        t.training_duration_seconds, m.version, m.deployed_at
// ORDER BY t.test_accuracy DESC;

// Find batch jobs with high success rates
// MATCH (b:MLBatchJob)
// WHERE b.status = 'completed' AND b.total_items > 100
// WITH b, (b.processed_items * 1.0 / b.total_items) as success_rate
// WHERE success_rate > 0.95
// RETURN b.job_type, b.total_items, b.processed_items, success_rate,
//        duration.between(b.started_at, b.completed_at) as processing_time
// ORDER BY b.total_items DESC;

// Find active alerts by severity and model
// MATCH (a:MLAlert)-[:MONITORS]->(m:MLModel)
// WHERE a.status = 'active'
// RETURN a.alert_type, a.severity, a.message, m.model_name, m.version, a.created_at
// ORDER BY 
//   CASE a.severity 
//     WHEN 'critical' THEN 1 
//     WHEN 'high' THEN 2 
//     WHEN 'medium' THEN 3 
//     WHEN 'low' THEN 4 
//   END, a.created_at DESC;

// Find knowledge-first vs ML-only prediction patterns
// MATCH (p:MLPrediction)
// WHERE p.created_at > datetime() - duration('P1D')
// WITH p.model_type, p.knowledge_used, count(p) as prediction_count, avg(p.confidence) as avg_confidence
// RETURN p.model_type, p.knowledge_used, prediction_count, avg_confidence
// ORDER BY p.model_type, p.knowledge_used;

// Find ML model drift indicators
// MATCH (m:MLModel)-[:GENERATED]->(recent:MLPrediction)
// WHERE recent.created_at > datetime() - duration('P1D')
// WITH m, avg(recent.confidence) as recent_avg_confidence, count(recent) as recent_count
// MATCH (m)-[:GENERATED]->(historical:MLPrediction)
// WHERE historical.created_at < datetime() - duration('P7D') 
//   AND historical.created_at > datetime() - duration('P14D')
// WITH m, recent_avg_confidence, recent_count, avg(historical.confidence) as historical_avg_confidence
// WHERE abs(recent_avg_confidence - historical_avg_confidence) > 0.1 AND recent_count > 10
// RETURN m.model_name, m.version, recent_avg_confidence, historical_avg_confidence,
//        (recent_avg_confidence - historical_avg_confidence) as confidence_drift,
//        recent_count
// ORDER BY abs(confidence_drift) DESC;

// Find entities with inconsistent ML predictions across models
// MATCH (e:Entity)<-[:PREDICTS]-(p:MLPrediction)
// WHERE p.created_at > datetime() - duration('P7D')
// WITH e, collect(DISTINCT p.model_type) as model_types, 
//      avg(p.confidence) as avg_confidence, stdDev(p.confidence) as confidence_stddev
// WHERE size(model_types) > 1 AND confidence_stddev > 0.2
// RETURN e.name, e.type, model_types, avg_confidence, confidence_stddev
// ORDER BY confidence_stddev DESC;

// Find documents that are good training sources (high entity density)
// MATCH (d:Document)-[:MENTIONS]->(e:Entity)
// WITH d, count(e) as entity_count, d.content_length
// WHERE entity_count > 5 AND d.content_length > 1000
// WITH d, entity_count, (entity_count * 1.0 / d.content_length * 1000) as entity_density
// WHERE entity_density > 10  // More than 10 entities per 1000 characters
// RETURN d.title, d.source_type, entity_count, d.content_length, entity_density
// ORDER BY entity_density DESC;

// Performance optimization procedures for ML operations

// Procedure to update ML prediction statistics
// CALL {
//   MATCH (m:MLModel)-[:GENERATED]->(p:MLPrediction)
//   WHERE p.created_at > datetime() - duration('P1D')
//   WITH m, avg(p.confidence) as avg_confidence, count(p) as prediction_count,
//        avg(p.processing_time_ms) as avg_processing_time
//   SET m.daily_avg_confidence = avg_confidence,
//       m.daily_prediction_count = prediction_count,
//       m.daily_avg_processing_time = avg_processing_time,
//       m.stats_updated_at = datetime()
// } IN TRANSACTIONS OF 100 ROWS;

// Procedure to clean up old ML predictions (keep only high-confidence or recent)
// CALL {
//   MATCH (p:MLPrediction)
//   WHERE p.created_at < datetime() - duration('P90D') 
//     AND p.confidence < 0.8
//   DETACH DELETE p
// } IN TRANSACTIONS OF 1000 ROWS;

// Procedure to identify potential training data from high-confidence predictions
// CALL {
//   MATCH (e1:Entity)-[r:ML_LINK_PREDICTED]->(e2:Entity)
//   WHERE r.ml_confidence > 0.95 AND r.human_verified IS NULL
//   SET r.training_candidate = true, r.candidate_marked_at = datetime()
// } IN TRANSACTIONS OF 500 ROWS;
