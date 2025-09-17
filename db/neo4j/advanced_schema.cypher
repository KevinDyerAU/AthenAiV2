// Advanced Neo4j Schema for AthenAI V2 Knowledge Graph
// Enhanced schema supporting the advanced data pipeline and agent orchestration

// Create constraints for unique identifiers
CREATE CONSTRAINT entity_name_type IF NOT EXISTS FOR (e:Entity) REQUIRE (e.name, e.type) IS UNIQUE;
CREATE CONSTRAINT document_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE;
CREATE CONSTRAINT chunk_id IF NOT EXISTS FOR (c:Chunk) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT processing_id IF NOT EXISTS FOR (p:Processing) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT agent_session_id IF NOT EXISTS FOR (s:AgentSession) REQUIRE s.id IS UNIQUE;

// Create indexes for performance optimization
CREATE INDEX entity_name_index IF NOT EXISTS FOR (e:Entity) ON (e.name);
CREATE INDEX entity_type_index IF NOT EXISTS FOR (e:Entity) ON (e.type);
CREATE INDEX entity_confidence_index IF NOT EXISTS FOR (e:Entity) ON (e.confidence);
CREATE INDEX document_source_type_index IF NOT EXISTS FOR (d:Document) ON (d.source_type);
CREATE INDEX document_created_at_index IF NOT EXISTS FOR (d:Document) ON (d.created_at);
CREATE INDEX chunk_content_index IF NOT EXISTS FOR (c:Chunk) ON (c.content);
CREATE INDEX relationship_type_index IF NOT EXISTS FOR ()-[r:RELATED_TO]-() ON (r.type);
CREATE INDEX relationship_confidence_index IF NOT EXISTS FOR ()-[r:RELATED_TO]-() ON (r.confidence);

// Create full-text search indexes for content discovery
// Using modern Neo4j 5.x syntax for full-text indexes
CREATE FULLTEXT INDEX entitySearch FOR (e:Entity) ON EACH [e.name, e.description];
CREATE FULLTEXT INDEX documentSearch FOR (d:Document|Chunk) ON EACH [d.content, d.title];
CREATE FULLTEXT INDEX knowledgeSearch FOR (n:Entity|Document|Chunk) ON EACH [n.name, n.content, n.title, n.description];

// Enhanced Entity node structure
// Entities represent people, organizations, concepts, technologies, etc.
// Properties:
// - name: The entity name
// - type: Entity type (PERSON, ORGANIZATION, TECHNOLOGY, CONCEPT, etc.)
// - confidence: Confidence score of entity extraction (0.0-1.0)
// - description: Optional description
// - aliases: Alternative names for the entity
// - metadata: Additional structured data
// - created_at: When the entity was first identified
// - last_seen: When the entity was last mentioned
// - mention_count: How many times this entity has been mentioned
// - importance_score: Calculated importance based on connections and mentions

// Enhanced Document node structure
// Documents represent processed content from various sources
// Properties:
// - id: Unique processing ID
// - source_type: Type of source (email, document, attachment, web, etc.)
// - title: Document title if available
// - content_length: Length of original content
// - chunk_count: Number of chunks created
// - entity_count: Number of entities extracted
// - relationship_count: Number of relationships found
// - processing_agent: Which agent processed this document
// - created_at: Processing timestamp
// - metadata: Source-specific metadata (file path, email headers, etc.)
// - quality_score: Assessed quality of the document
// - language: Detected language
// - summary: AI-generated summary

// Enhanced Chunk node structure
// Chunks represent segments of processed documents
// Properties:
// - id: Unique chunk identifier (Supabase knowledge_entities.id)
// - content: The actual text content
// - chunk_index: Position within the document
// - chunk_type: Type of chunk (paragraph, header, list, code, etc.)
// - embedding_id: Reference to vector embedding
// - entity_count: Number of entities in this chunk
// - word_count: Number of words
// - language: Detected language
// - quality_score: Content quality assessment
// - created_at: Processing timestamp

// Processing node for tracking ingestion workflows
// Properties:
// - id: Processing session ID
// - agent_id: Which agent handled the processing
// - status: Processing status (in_progress, completed, failed)
// - start_time: When processing started
// - end_time: When processing completed
// - duration: Processing duration in seconds
// - input_size: Size of input content
// - output_chunks: Number of chunks created
// - output_entities: Number of entities extracted
// - output_relationships: Number of relationships found
// - error_message: Error details if failed
// - performance_metrics: Processing performance data

// AgentSession node for tracking agent interactions
// Properties:
// - id: Session identifier
// - agent_id: Which agent was used
// - task_type: Type of task performed
// - complexity_level: Assessed task complexity
// - start_time: Session start time
// - end_time: Session end time
// - duration: Session duration
// - status: Session status (active, completed, failed)
// - input_query: Original user query
// - output_summary: Summary of results
// - confidence_score: Agent's confidence in results
// - knowledge_sources_used: Which knowledge sources were accessed
// - web_sources_used: Which web sources were accessed
// - performance_metrics: Session performance data

// Enhanced relationship types for richer knowledge representation

// Document relationships
// Document -> Chunk relationships
// HAS_CHUNK: Document contains chunk
// Properties: chunk_index, chunk_type

// Document -> Entity relationships  
// MENTIONS: Document mentions entity
// Properties: mention_count, confidence, context, first_mention_position

// Document -> Document relationships
// REFERENCES: Document references another document
// SIMILAR_TO: Documents are similar in content
// PART_OF: Document is part of a larger document set
// RESPONDS_TO: Document is a response to another (emails)
// Properties: similarity_score, relationship_type, confidence

// Entity relationships
// RELATED_TO: Generic relationship between entities
// Properties: type (specific relationship), confidence, context, source_document

// Specific entity relationship types:
// WORKS_FOR: Person works for organization
// MANAGES: Person manages another person/organization
// OWNS: Entity owns another entity
// USES: Entity uses technology/tool
// DEPENDS_ON: Entity depends on another entity
// IMPLEMENTS: Technology implements another technology
// INTEGRATES_WITH: Technology integrates with another
// COMPETES_WITH: Organizations compete
// PARTNERS_WITH: Organizations partner
// ACQUIRED: Organization acquired another
// FOUNDED: Person founded organization
// LOCATED_IN: Entity located in place
// MEMBER_OF: Person member of organization
// SPECIALIZES_IN: Entity specializes in domain
// INFLUENCES: Entity influences another
// COLLABORATES_WITH: Entities collaborate

// Processing relationships
// Processing -> Document relationships
// PROCESSED: Processing session processed document
// Properties: processing_time, success, error_details

// Processing -> Agent relationships  
// EXECUTED_BY: Processing executed by agent
// Properties: agent_version, performance_metrics

// AgentSession relationships
// AgentSession -> Entity relationships
// SEARCHED_FOR: Agent session searched for entity
// DISCOVERED: Agent session discovered new entity
// Properties: search_method, confidence, relevance_score

// AgentSession -> Document relationships
// ACCESSED: Agent session accessed document
// CREATED: Agent session created document
// Properties: access_method, relevance_score, usage_context

// Temporal relationships for tracking evolution
// EVOLVED_FROM: Entity evolved from another entity
// SUPERSEDED_BY: Entity superseded by another
// VERSION_OF: Entity is version of another
// Properties: version_number, change_description, evolution_date

// Sample queries for the enhanced schema:

// Find all entities related to a specific technology with high confidence
// MATCH (tech:Entity {name: 'Docker', type: 'TECHNOLOGY'})-[r:RELATED_TO]-(related:Entity)
// WHERE r.confidence > 0.8
// RETURN tech, r, related
// ORDER BY r.confidence DESC;

// Find documents processed by a specific agent in the last 24 hours
// MATCH (p:Processing)-[:EXECUTED_BY]->(agent:Agent {id: 'research_agent'})
// MATCH (p)-[:PROCESSED]->(doc:Document)
// WHERE p.start_time > datetime() - duration('P1D')
// RETURN doc, p
// ORDER BY p.start_time DESC;

// Find the most connected entities (knowledge hubs)
// MATCH (e:Entity)-[r:RELATED_TO]-()
// WITH e, count(r) as connection_count
// WHERE connection_count > 5
// RETURN e.name, e.type, connection_count
// ORDER BY connection_count DESC
// LIMIT 20;

// Find documents that mention multiple specific entities (intersection search)
// MATCH (d:Document)-[:MENTIONS]->(e1:Entity {name: 'JavaScript'})
// MATCH (d)-[:MENTIONS]->(e2:Entity {name: 'React'})
// MATCH (d)-[:MENTIONS]->(e3:Entity {name: 'Node.js'})
// RETURN d, collect(DISTINCT [e1.name, e2.name, e3.name]) as mentioned_entities;

// Find knowledge evolution paths
// MATCH path = (start:Entity)-[:EVOLVED_FROM|SUPERSEDED_BY*1..3]-(end:Entity)
// WHERE start.name = 'JavaScript'
// RETURN path;

// Find the most productive processing sessions
// MATCH (p:Processing)
// WHERE p.status = 'completed' AND p.end_time > datetime() - duration('P7D')
// WITH p, (p.output_entities + p.output_relationships + p.output_chunks) as productivity_score
// RETURN p.id, p.agent_id, productivity_score, p.duration
// ORDER BY productivity_score DESC
// LIMIT 10;

// Find entities that frequently co-occur in documents
// MATCH (e1:Entity)<-[:MENTIONS]-(d:Document)-[:MENTIONS]->(e2:Entity)
// WHERE e1.name < e2.name  // Avoid duplicates
// WITH e1, e2, count(d) as co_occurrence_count
// WHERE co_occurrence_count > 3
// RETURN e1.name, e2.name, co_occurrence_count
// ORDER BY co_occurrence_count DESC;

// Find knowledge gaps (entities with few connections)
// MATCH (e:Entity)
// OPTIONAL MATCH (e)-[r:RELATED_TO]-()
// WITH e, count(r) as connection_count
// WHERE connection_count < 2
// RETURN e.name, e.type, connection_count
// ORDER BY e.last_seen DESC;

// Performance optimization procedures

// Procedure to update entity importance scores
// CREATE OR REPLACE PROCEDURE updateEntityImportanceScores()
// CALL {
//   MATCH (e:Entity)
//   OPTIONAL MATCH (e)-[r:RELATED_TO]-()
//   OPTIONAL MATCH (d:Document)-[:MENTIONS]->(e)
//   WITH e, count(DISTINCT r) as relationship_count, count(DISTINCT d) as mention_count
//   SET e.importance_score = (relationship_count * 0.6) + (mention_count * 0.4)
// } IN TRANSACTIONS OF 1000 ROWS;

// Procedure to clean up low-confidence relationships
// CREATE OR REPLACE PROCEDURE cleanupLowConfidenceRelationships(confidence_threshold FLOAT)
// CALL {
//   MATCH ()-[r:RELATED_TO]-()
//   WHERE r.confidence < confidence_threshold
//   DELETE r
// } IN TRANSACTIONS OF 1000 ROWS;

// Procedure to merge duplicate entities
// CREATE OR REPLACE PROCEDURE mergeDuplicateEntities()
// CALL {
//   MATCH (e1:Entity), (e2:Entity)
//   WHERE e1.name = e2.name AND e1.type = e2.type AND id(e1) < id(e2)
//   CALL apoc.refactor.mergeNodes([e1, e2], {properties: 'combine'})
//   YIELD node
//   RETURN count(node) as merged_count
// } IN TRANSACTIONS OF 100 ROWS;

// ML Service Extensions for AthenAI V2
// These extensions support Graph Neural Networks and ML predictions

// Create constraints for ML-specific nodes
CREATE CONSTRAINT ml_prediction_id IF NOT EXISTS FOR (p:MLPrediction) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT ml_training_run_id IF NOT EXISTS FOR (t:MLTrainingRun) REQUIRE t.id IS UNIQUE;
CREATE CONSTRAINT ml_model_id IF NOT EXISTS FOR (m:MLModel) REQUIRE m.id IS UNIQUE;

// Create indexes for ML performance
CREATE INDEX ml_prediction_model_type_index IF NOT EXISTS FOR (p:MLPrediction) ON (p.model_type);
CREATE INDEX ml_prediction_confidence_index IF NOT EXISTS FOR (p:MLPrediction) ON (p.confidence);
CREATE INDEX ml_prediction_created_at_index IF NOT EXISTS FOR (p:MLPrediction) ON (p.created_at);
CREATE INDEX ml_training_run_model_type_index IF NOT EXISTS FOR (t:MLTrainingRun) ON (t.model_type);
CREATE INDEX ml_training_run_status_index IF NOT EXISTS FOR (t:MLTrainingRun) ON (t.status);
CREATE INDEX ml_model_version_index IF NOT EXISTS FOR (m:MLModel) ON (m.version);

// MLPrediction node structure
// Represents ML model predictions stored in the knowledge graph
// Properties:
// - id: Unique prediction identifier (matches Supabase ml_model_predictions.id)
// - model_type: Type of ML model used (link_prediction, node_classification, expertise_recommendation)
// - prediction_type: Specific prediction type (entity_link, document_classification, expert_ranking)
// - confidence: Prediction confidence score (0.0-1.0)
// - knowledge_used: Whether knowledge substrate was used
// - processing_time_ms: Inference time in milliseconds
// - model_version: Version of the model used
// - created_at: Prediction timestamp
// - input_hash: Hash of input data for deduplication
// - session_id: Associated session identifier

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

// MLModel node structure
// Represents deployed ML models in the registry
// Properties:
// - id: Unique model identifier
// - model_name: Human-readable model name
// - model_type: Type of ML model
// - version: Model version string
// - status: Deployment status (staging, production, archived)
// - performance_metrics: Model performance metrics as JSON string
// - deployed_at: Deployment timestamp
// - created_at: Model creation timestamp
// - config: Model configuration as JSON string

// ML-specific relationship types

// Entity -> MLPrediction relationships
// PREDICTED_BY: Entity was predicted by ML model
// Properties: prediction_rank, confidence, context

// MLPrediction -> Entity relationships
// PREDICTS: ML prediction predicts entity relationship
// RECOMMENDS: ML prediction recommends entity
// CLASSIFIES: ML prediction classifies entity
// Properties: prediction_score, rank, reasoning

// MLPrediction -> Document relationships
// BASED_ON: ML prediction based on document
// INFLUENCES: ML prediction influences document classification
// Properties: influence_score, feature_importance

// MLTrainingRun -> MLModel relationships
// PRODUCED: Training run produced model
// Properties: training_metrics, validation_results

// MLModel -> MLPrediction relationships
// GENERATED: Model generated prediction
// Properties: model_version, inference_time

// Entity -> Entity ML-enhanced relationships
// ML_LINK_PREDICTED: Link predicted by ML model
// ML_SIMILARITY: Similarity computed by ML model
// ML_EXPERTISE_MATCH: Expertise match predicted by ML model
// Properties: ml_confidence, model_type, prediction_date, human_verified

// Document -> Document ML relationships
// ML_SIMILAR: Documents similar according to ML model
// ML_RELATED: Documents related according to ML model
// Properties: similarity_score, model_type, feature_vector_distance

// Sample ML queries for the enhanced schema:

// Find high-confidence ML predictions for a specific entity
// MATCH (e:Entity {name: 'React'})<-[:PREDICTS]-(p:MLPrediction)
// WHERE p.confidence > 0.9
// RETURN e, p
// ORDER BY p.confidence DESC, p.created_at DESC;

// Find entities with ML-predicted expertise relationships
// MATCH (expert:Entity)-[r:ML_EXPERTISE_MATCH]->(domain:Entity)
// WHERE r.ml_confidence > 0.8 AND expert.type = 'PERSON'
// RETURN expert.name, domain.name, r.ml_confidence
// ORDER BY r.ml_confidence DESC;

// Find documents classified by ML models with high confidence
// MATCH (d:Document)<-[:CLASSIFIES]-(p:MLPrediction)
// WHERE p.model_type = 'document_classification' AND p.confidence > 0.85
// RETURN d.title, p.prediction_type, p.confidence
// ORDER BY p.confidence DESC;

// Find ML model performance over time
// MATCH (m:MLModel)-[:GENERATED]->(p:MLPrediction)
// WHERE p.created_at > datetime() - duration('P7D')
// WITH m, avg(p.confidence) as avg_confidence, count(p) as prediction_count
// RETURN m.model_name, m.version, avg_confidence, prediction_count
// ORDER BY avg_confidence DESC;

// Find entities that frequently appear in high-confidence ML predictions
// MATCH (e:Entity)<-[:PREDICTS]-(p:MLPrediction)
// WHERE p.confidence > 0.9
// WITH e, count(p) as high_confidence_predictions, avg(p.confidence) as avg_confidence
// WHERE high_confidence_predictions > 10
// RETURN e.name, e.type, high_confidence_predictions, avg_confidence
// ORDER BY high_confidence_predictions DESC;

// Find ML-predicted links that were later verified by humans
// MATCH (e1:Entity)-[r:ML_LINK_PREDICTED]->(e2:Entity)
// WHERE r.human_verified = true
// RETURN e1.name, e2.name, r.ml_confidence, r.prediction_date
// ORDER BY r.ml_confidence DESC;

// Find training runs that produced the best performing models
// MATCH (t:MLTrainingRun)-[:PRODUCED]->(m:MLModel)
// WHERE t.status = 'completed' AND m.status = 'production'
// RETURN t.model_type, t.validation_accuracy, t.training_duration_seconds, m.version
// ORDER BY t.validation_accuracy DESC;

// Find documents that influenced multiple ML predictions
// MATCH (d:Document)<-[:BASED_ON]-(p:MLPrediction)
// WITH d, count(p) as prediction_count, collect(DISTINCT p.model_type) as model_types
// WHERE prediction_count > 5
// RETURN d.title, prediction_count, model_types
// ORDER BY prediction_count DESC;

// Find knowledge gaps where ML predictions have low confidence
// MATCH (e:Entity)<-[:PREDICTS]-(p:MLPrediction)
// WHERE p.confidence < 0.6
// WITH e, avg(p.confidence) as avg_confidence, count(p) as low_confidence_predictions
// WHERE low_confidence_predictions > 3
// RETURN e.name, e.type, avg_confidence, low_confidence_predictions
// ORDER BY low_confidence_predictions DESC;

// Find ML model drift by comparing recent vs historical performance
// MATCH (m:MLModel)-[:GENERATED]->(recent:MLPrediction)
// WHERE recent.created_at > datetime() - duration('P1D')
// WITH m, avg(recent.confidence) as recent_avg_confidence
// MATCH (m)-[:GENERATED]->(historical:MLPrediction)
// WHERE historical.created_at < datetime() - duration('P7D') 
//   AND historical.created_at > datetime() - duration('P14D')
// WITH m, recent_avg_confidence, avg(historical.confidence) as historical_avg_confidence
// WHERE abs(recent_avg_confidence - historical_avg_confidence) > 0.1
// RETURN m.model_name, m.version, recent_avg_confidence, historical_avg_confidence,
//        (recent_avg_confidence - historical_avg_confidence) as confidence_drift
// ORDER BY abs(confidence_drift) DESC;
