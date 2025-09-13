# AthenAI V2 Implementation Guide - Complete MLOps Integration

## 🚀 Implementation Overview

This comprehensive guide covers the complete implementation of AthenAI V2, including:
- **Phase 1**: Foundation Setup (Supabase, Neo4j Aura, Email Service)
- **Phase 2**: Advanced Data Pipeline and Agent Orchestration  
- **Phase 3**: PyTorch Integration and MLOps Pipeline ✅ **COMPLETED**

## 📋 Current Implementation Status

### ✅ Phase 1 - Foundation Setup (COMPLETED)
- **Cloud Infrastructure**: Supabase PostgreSQL with pgvector, Neo4j Aura
- **Email Service**: Gmail API integration with AI-powered processing
- **Agent System**: 8 specialized AI agents with intelligent routing
- **Knowledge Substrate**: Vector embeddings and graph relationships

### ✅ Phase 2 - Advanced Data Pipeline (COMPLETED)  
- **Unified Data Ingestion**: BaseProcessor with intelligent chunking and entity extraction
- **Specialized Processors**: DocumentProcessor, EmailProcessor, AttachmentProcessor
- **Agent Registry System**: Capability-based agent selection and performance tracking
- **Enhanced MasterOrchestrator**: Role-based routing with AgentRegistry integration
- **Knowledge-First Search**: BaseKnowledgeAgent with vector similarity and graph search

### ✅ Phase 3 - PyTorch Integration and MLOps (COMPLETED)
- **ML Service Infrastructure**: FastAPI service with PyTorch and PyTorch Geometric
- **Graph Neural Networks**: Link prediction, node classification, and expertise recommendation models
- **Data Pipeline**: Neo4j to PyTorch Geometric data loading with Supabase enrichment
- **Training Orchestration**: MLflow integration with experiment tracking and model management
- **Model Evaluation**: Comprehensive metrics framework for GNN models
- **Real-time Inference**: Knowledge-first prediction with ML fallback
- **Batch Processing**: Scalable batch prediction service with job management
- **Model Monitoring**: Data drift detection, performance monitoring, and alerting
- **Automated Retraining**: Intelligent retraining triggers based on performance and drift
- **Docker Integration**: Complete containerization with MLflow tracking server

## 🔧 Phase 3: PyTorch Integration and MLOps Deployment

### 1. ML Service Database Setup

#### Create ML-specific Database Tables
```sql
-- Execute in Supabase SQL Editor
-- ML Model Predictions Table
CREATE TABLE IF NOT EXISTS ml_model_predictions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    model_type TEXT NOT NULL,
    input_data JSONB NOT NULL,
    prediction JSONB NOT NULL,
    confidence FLOAT NOT NULL,
    processing_time_ms INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ML Training Runs Table
CREATE TABLE IF NOT EXISTS ml_training_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    model_type TEXT NOT NULL,
    experiment_id TEXT,
    run_id TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    metrics JSONB,
    parameters JSONB,
    artifacts JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ML Batch Jobs Table
CREATE TABLE IF NOT EXISTS ml_batch_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id TEXT UNIQUE NOT NULL,
    prediction_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    total_entities INTEGER NOT NULL,
    processed_entities INTEGER DEFAULT 0,
    failed_entities INTEGER DEFAULT 0,
    progress FLOAT DEFAULT 0,
    results JSONB,
    callback_url TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ML Retraining Jobs Table
CREATE TABLE IF NOT EXISTS ml_retraining_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id TEXT UNIQUE NOT NULL,
    trigger_type TEXT NOT NULL,
    model_types TEXT[] NOT NULL,
    priority INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    config_overrides JSONB,
    metadata JSONB,
    results JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- ML Alerts Table
CREATE TABLE IF NOT EXISTS ml_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ml_predictions_model_type ON ml_model_predictions(model_type);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_created_at ON ml_model_predictions(created_at);
CREATE INDEX IF NOT EXISTS idx_ml_training_runs_model_type ON ml_training_runs(model_type);
CREATE INDEX IF NOT EXISTS idx_ml_batch_jobs_status ON ml_batch_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ml_retraining_jobs_status ON ml_retraining_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ml_alerts_severity ON ml_alerts(severity);
```
#### Deploy Neo4j ML Schema Extensions
```cypher
// Execute in Neo4j Browser or cypher-shell
// ML Prediction Storage
CREATE CONSTRAINT ml_prediction_id IF NOT EXISTS FOR (p:MLPrediction) REQUIRE p.id IS UNIQUE;
CREATE INDEX ml_prediction_type IF NOT EXISTS FOR (p:MLPrediction) ON (p.prediction_type);
CREATE INDEX ml_prediction_confidence IF NOT EXISTS FOR (p:MLPrediction) ON (p.confidence);

// Enhanced Person nodes for expertise prediction
CREATE INDEX person_expertise IF NOT EXISTS FOR (p:Person) ON (p.expertise_areas);
CREATE INDEX person_confidence IF NOT EXISTS FOR (p:Person) ON (p.expertise_confidence);

// Topic nodes for expertise modeling
CREATE CONSTRAINT topic_name IF NOT EXISTS FOR (t:Topic) REQUIRE t.name IS UNIQUE;
CREATE INDEX topic_category IF NOT EXISTS FOR (t:Topic) ON (t.category);

// ML Training metadata
CREATE CONSTRAINT training_run_id IF NOT EXISTS FOR (tr:TrainingRun) REQUIRE tr.run_id IS UNIQUE;
CREATE INDEX training_run_model_type IF NOT EXISTS FOR (tr:TrainingRun) ON (tr.model_type);

// Verify ML schema
CALL db.indexes() YIELD name, type, entityType, labelsOrTypes, properties
WHERE name CONTAINS 'ml_' OR name CONTAINS 'person_' OR name CONTAINS 'topic_'
RETURN name, type, entityType, labelsOrTypes, properties;
```

### 3. Deploy ML Service Infrastructure

#### Build and Deploy ML Service
```bash
# Navigate to ML service directory
cd services/ml-service

# Build Docker image
docker build -t athenai-ml-service .

# Start ML service with docker-compose
docker-compose up -d ml-service mlflow

# Verify services are running
curl http://localhost:8000/health
curl http://localhost:5000/health

# Check ML service logs
docker-compose logs ml-service

# Test basic functionality
curl -X POST http://localhost:8000/predict/expertise \
  -H "Content-Type: application/json" \
  -d '{"topic": "machine learning", "max_experts": 3}'
```

#### Initialize ML Models
```bash
# Connect to ML service container
docker-compose exec ml-service bash

# Run initial training (optional - can be done later)
python -c "
from training.trainer import MLTrainingOrchestrator
import asyncio

async def init_training():
    trainer = MLTrainingOrchestrator()
    print('Starting initial model training...')
    
    # Train link prediction model
    result = await trainer.train_link_prediction()
    print(f'Link prediction training: {result}')
    
    # Train expertise recommendation model  
    result = await trainer.train_expertise_recommendation()
    print(f'Expertise training: {result}')

asyncio.run(init_training())
"
```

#### Configure Model Monitoring
```bash
# Start monitoring service
curl -X POST http://localhost:8000/model/status

# Check Prometheus metrics
curl http://localhost:8000/metrics/prometheus

# View MLflow experiments
# Open browser to http://localhost:5000
```

### 4. Integration Testing

#### Test End-to-End ML Pipeline
```bash
# Test expertise prediction
curl -X POST http://localhost:8000/predict/expertise \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "artificial intelligence",
    "max_experts": 5,
    "confidence_threshold": 0.7
  }'

# Test link prediction
curl -X POST http://localhost:8000/predict/link \
  -H "Content-Type: application/json" \
  -d '{
    "source_entity": "John Doe",
    "target_entity": "Machine Learning",
    "relationship_type": "HAS_EXPERTISE"
  }'

# Test batch prediction
curl -X POST http://localhost:8000/predict/batch \
  -H "Content-Type: application/json" \
  -d '{
    "prediction_type": "expertise_batch",
    "entities": [
      {"id": "1", "topic": "deep learning", "max_experts": 3},
      {"id": "2", "topic": "natural language processing", "max_experts": 3}
    ]
  }'
```

#### Test Model Retraining
```bash
# Trigger manual retraining
curl -X POST http://localhost:8000/model/retrain \
  -H "Content-Type: application/json" \
  -d '{
    "model_types": ["link_prediction"],
    "config_overrides": {"epochs": 50}
  }'

# Check retraining status
curl http://localhost:8000/training/status
```

### 5. Production Deployment

#### Environment Configuration
```bash
# Update production .env file
cat >> .env << EOF
# ML Service Production Settings
ML_SERVICE_HOST=0.0.0.0
ML_SERVICE_PORT=8000
MLFLOW_PORT=5000
MLFLOW_TRACKING_URI=http://mlflow:5000

# Model Configuration
ML_MODEL_CACHE_SIZE=1000
ML_BATCH_SIZE=100
ML_MAX_CONCURRENT_JOBS=5

# Monitoring Configuration
ML_MONITORING_INTERVAL=300
ML_DRIFT_DETECTION_WINDOW=24
ML_PERFORMANCE_WINDOW=1

# Retraining Configuration
ML_AUTO_RETRAIN_ENABLED=true
ML_PERFORMANCE_DROP_THRESHOLD=0.05
ML_DRIFT_SCORE_THRESHOLD=0.3
EOF
```

#### Deploy to Production
```bash
# Deploy full stack with ML service
docker-compose -f docker-compose.yml up -d

# Verify all services are healthy
docker-compose ps
docker-compose logs --tail=50 ml-service
docker-compose logs --tail=50 mlflow

# Run health checks
curl http://localhost:8000/health
curl http://localhost:5000/health
curl http://localhost:3000  # Grafana
curl http://localhost:9090  # Prometheus
```

### 6. Monitoring and Maintenance

#### Set Up Monitoring Dashboards
```bash
# Import ML monitoring dashboards to Grafana
# 1. Open Grafana at http://localhost:3000
# 2. Login with admin credentials
# 3. Import dashboard for ML service metrics
# 4. Configure alerts for model performance degradation

# Key metrics to monitor:
# - Model prediction accuracy
# - Inference latency
# - Data drift scores
# - Retraining job status
# - System resource usage
```

#### Regular Maintenance Tasks
```bash
# Weekly model performance review
curl http://localhost:8000/model/status

# Monthly model retraining (if not automated)
curl -X POST http://localhost:8000/model/retrain \
  -H "Content-Type: application/json" \
  -d '{"model_types": ["link_prediction", "expertise_recommendation", "node_classification"]}'

# Cleanup old batch jobs and predictions
curl -X DELETE http://localhost:8000/batch/cleanup?max_age_days=30

# Review monitoring alerts
curl http://localhost:8000/monitoring/alerts
```

## 🎯 Next Steps and Future Enhancements

### Immediate Next Steps (Week 1-2)
1. **Deploy ML Service**: Follow the deployment guide above
2. **Initialize Models**: Train initial GNN models with existing data
3. **Test Integration**: Verify ML service works with existing agents
4. **Monitor Performance**: Set up monitoring dashboards and alerts

### Short-term Enhancements (Month 1-2)
1. **Advanced Models**: Implement more sophisticated GNN architectures
2. **Feature Engineering**: Add more node and edge features for better predictions
3. **Model Ensemble**: Combine multiple models for improved accuracy
4. **Real-time Learning**: Implement online learning for model updates

### Long-term Vision (Month 3-6)
1. **Multi-modal Learning**: Integrate text, graph, and numerical data
2. **Federated Learning**: Distribute training across multiple data sources
3. **Explainable AI**: Add model interpretability and explanation features
4. **AutoML Pipeline**: Automated model selection and hyperparameter tuning

## 📊 Success Metrics

### Technical Metrics
- **Model Performance**: AUC > 0.85 for link prediction, NDCG@5 > 0.75 for expertise recommendation
- **System Performance**: < 100ms inference latency, > 99% uptime
- **Data Quality**: < 5% drift score, > 95% data completeness

### Business Metrics
- **User Engagement**: Increased usage of AI-powered features
- **Accuracy Improvement**: Better expert recommendations and relationship predictions
- **Operational Efficiency**: Reduced manual curation, automated insights

## 🔧 Troubleshooting Guide

### Common Issues

#### ML Service Won't Start
```bash
# Check Docker logs
docker-compose logs ml-service

# Common fixes:
# 1. Verify environment variables are set
# 2. Check database connections (Neo4j, Supabase)
# 3. Ensure sufficient memory allocation
# 4. Verify PyTorch installation
```

#### Model Training Fails
```bash
# Check training logs
curl http://localhost:8000/training/status

# Common fixes:
# 1. Verify sufficient training data exists
# 2. Check Neo4j graph connectivity
# 3. Ensure MLflow server is running
# 4. Verify GPU availability (if configured)
```

#### Poor Model Performance
```bash
# Check model metrics
curl http://localhost:8000/model/status

# Improvement strategies:
# 1. Increase training data volume
# 2. Tune hyperparameters
# 3. Add more node/edge features
# 4. Implement data augmentation
```

### 2. Deploy Previous Components (Phase 2)

#### Build and Deploy Ingestion Service
```bash
# Navigate to ingestion service directory
cd services/ingestion-service

# Install dependencies
npm install

# Build Docker image
docker build -t athenai-ingestion-service .

# Test service locally
npm run dev

# Verify all processors are working
node -e "
const BaseProcessor = require('./processors/BaseProcessor');
const DocumentProcessor = require('./processors/DocumentProcessor');
const EmailProcessor = require('./processors/EmailProcessor');
const AttachmentProcessor = require('./processors/AttachmentProcessor');

console.log('✅ All processors loaded successfully');
"
```

#### Configure Processing Queues
```bash
# Update docker-compose.cloud.yml to include ingestion service
# Add ingestion-service configuration:
#   ingestion-service:
#     build: ./services/ingestion-service
#     environment:
#       - SUPABASE_URL=${SUPABASE_URL}
#       - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
#       - NEO4J_URI=${NEO4J_URI}
#       - NEO4J_USER=${NEO4J_USER}
#       - NEO4J_PASSWORD=${NEO4J_PASSWORD}
#       - OPENAI_API_KEY=${OPENAI_API_KEY}
#       - RABBITMQ_URL=amqp://rabbitmq:5672
#     depends_on:
#       - rabbitmq
#       - supabase (external)

# Create processing queues
docker-compose -f docker-compose.cloud.yml exec rabbitmq rabbitmqctl add_queue document_processing_queue
docker-compose -f docker-compose.cloud.yml exec rabbitmq rabbitmqctl add_queue email_processing_queue
docker-compose -f docker-compose.cloud.yml exec rabbitmq rabbitmqctl add_queue attachment_processing_queue
```

### 3. Update Agent System with Registry Integration

#### Deploy Enhanced MasterOrchestrator
```bash
# The MasterOrchestrator has been updated to use AgentRegistry
# Verify the integration is working:
node -e "
const { MasterOrchestrator } = require('./src/agents/MasterOrchestrator');
const { agentRegistry } = require('./src/agents/AgentRegistry');

const orchestrator = new MasterOrchestrator();
console.log('✅ MasterOrchestrator with AgentRegistry loaded');
console.log('Available agents:', agentRegistry.getAllAgents().map(a => a.id));
"
```

#### Test Knowledge-First Search
```bash
# Test the BaseKnowledgeAgent functionality
node -e "
const BaseKnowledgeAgent = require('./src/agents/BaseKnowledgeAgent');

const agent = new BaseKnowledgeAgent({
  id: 'test_agent',
  confidence_threshold: 0.7,
  completeness_threshold: 0.6
});

console.log('✅ BaseKnowledgeAgent initialized');
console.log('Search strategy:', agent.searchStrategy);
"
```

## 🔧 Phase 2B: Integration Testing and Validation (Week 8)

### 1. Test Advanced Data Pipeline

#### Test Document Processing
```bash
# Test document processor with sample file
node -e "
const DocumentProcessor = require('./services/ingestion-service/processors/DocumentProcessor');
const processor = new DocumentProcessor();

// Test with a sample document (create test.txt first)
echo 'This is a test document for AthenAI processing. It contains information about JavaScript and React development.' > test.txt

processor.processDocument('./test.txt', {
  source: 'test',
  author: 'system'
}).then(result => {
  console.log('✅ Document processing result:', result);
}).catch(console.error);
"
```

#### Test Email Processing
```bash
# Test email processor with sample email data
node -e "
const EmailProcessor = require('./services/ingestion-service/processors/EmailProcessor');
const processor = new EmailProcessor();

const sampleEmail = {
  messageId: 'test-123',
  subject: 'Test Email for AthenAI',
  from: { address: 'test@example.com' },
  to: [{ address: 'athenai@example.com' }],
  text: 'This is a test email containing information about project management and software development.',
  date: new Date()
};

processor.processEmail(sampleEmail, {
  source: 'test'
}).then(result => {
  console.log('✅ Email processing result:', result);
}).catch(console.error);
"
```

#### Test Vector Similarity Search
```bash
# Test the enhanced search functionality
node -e "
const { createClient } = require('@supabase/supabase-js');
const { generateEmbedding } = require('./services/ingestion-service/utils/embeddings');

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testVectorSearch() {
  try {
    const queryEmbedding = await generateEmbedding('JavaScript development');
    const { data, error } = await client.rpc('search_similar_content', {
      query_embedding: queryEmbedding,
      similarity_threshold: 0.7,
      match_count: 5
    });
    
    if (error) throw error;
    console.log('✅ Vector search results:', data?.length || 0, 'matches found');
  } catch (error) {
    console.error('❌ Vector search failed:', error.message);
  }
}

testVectorSearch();
"
```

### 2. Test Agent Registry System

#### Test Agent Selection Logic
```bash
# Test the AgentRegistry selection algorithm
node -e "
const { agentRegistry } = require('./src/agents/AgentRegistry');

const testQueries = [
  'Analyze the performance metrics of our application',
  'Create a creative marketing campaign for our product',
  'Research the latest trends in AI development',
  'Plan a software development project timeline',
  'Review and test the quality of our code'
];

testQueries.forEach(query => {
  const selectedAgent = agentRegistry.findBestAgentForTask(query);
  console.log(\`Query: \${query.substring(0, 50)}...\`);
  console.log(\`Selected: \${selectedAgent.name} (\${selectedAgent.id})\`);
  console.log('---');
});
"
```

#### Test MasterOrchestrator Integration
```bash
# Test the enhanced MasterOrchestrator
node -e "
const { MasterOrchestrator } = require('./src/agents/MasterOrchestrator');

const orchestrator = new MasterOrchestrator();

orchestrator.determineAgentRouting('Analyze the GitHub repository for security vulnerabilities')
  .then(routing => {
    console.log('✅ Agent routing result:', routing);
  })
  .catch(error => {
    console.log('❌ Routing failed:', error.message);
  });
"
```

### 3. Test Knowledge-First Search

#### Test BaseKnowledgeAgent Search
```bash
# Test knowledge-first search functionality
node -e "
const BaseKnowledgeAgent = require('./src/agents/BaseKnowledgeAgent');

const agent = new BaseKnowledgeAgent({
  id: 'test_knowledge_agent',
  confidence_threshold: 0.7,
  completeness_threshold: 0.6
});

agent.search('JavaScript React development best practices')
  .then(results => {
    console.log('✅ Knowledge search completed');
    console.log('Source:', results.source);
    console.log('Confidence:', results.confidence);
    console.log('Results count:', results.results?.length || 0);
  })
  .catch(error => {
    console.log('❌ Knowledge search failed:', error.message);
  })
  .finally(() => {
    agent.close();
  });
"
```

### Phase 1B: Email Service Implementation (Week 3-4)

#### 1. Gmail API Setup
```bash
# 1. Go to Google Cloud Console (https://console.cloud.google.com/)
# 2. Create a new project or select existing
# 3. Enable Gmail API
# 4. Create OAuth 2.0 credentials
# 5. Download credentials JSON file as gmail_credentials.json
# 6. Place in project root

# Set up Gmail authentication
export GMAIL_CREDENTIALS_PATH=/app/gmail_credentials.json
export GMAIL_TOKEN_PATH=/app/gmail_token.json

# Run OAuth flow (you'll need to implement this separately)
# node setup-gmail-auth.js
```

#### 2. Install Email Service Dependencies
```bash
cd services/email-service
npm install
```

#### 3. Build and Test Email Service
```bash
# Build email service Docker image
docker build -t athenai-email-service services/email-service/

# Test email service locally
cd services/email-service
npm run dev
```

#### 4. Set up RabbitMQ Queues
```bash
# Start RabbitMQ
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management

# Access management interface at http://localhost:15672
# Default credentials: guest/guest

# Queues will be auto-created by the email service
```

### Phase 1C: Integration Testing (Week 5)

#### 1. Deploy Full Stack
```bash
# Deploy using cloud configuration
docker-compose -f docker-compose.cloud.yml up -d

# Check service health
docker-compose -f docker-compose.cloud.yml ps
docker-compose -f docker-compose.cloud.yml logs
```

#### 2. Test Email Processing Workflow
```bash
# Send test message to email processing queue
node -e "
const amqp = require('amqplib');
amqp.connect('amqp://localhost:5672').then(conn => {
  return conn.createChannel().then(ch => {
    const queue = 'email_processing_queue';
    const msg = JSON.stringify({ emailId: 'test-email-id-123' });
    return ch.assertQueue(queue, { durable: true }).then(() => {
      ch.sendToQueue(queue, Buffer.from(msg), { persistent: true });
      console.log('Test message sent to email processing queue');
      return conn.close();
    });
  });
});
"
```

#### 3. Verify Vector Search Functionality
```bash
# Test vector similarity search in Supabase
# Run in Supabase SQL Editor:
SELECT * FROM knowledge_entities 
WHERE embedding IS NOT NULL 
LIMIT 5;

# Test the match_emails function (you'll need to create this)
```

## 📋 Required Supabase Functions

Create these functions in Supabase SQL Editor:

### 1. Email Similarity Search Function
```sql
CREATE OR REPLACE FUNCTION match_emails(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  gmail_id varchar,
  subject text,
  from_address varchar,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    el.id,
    el.gmail_id,
    el.subject,
    el.from_address,
    1 - (ke.embedding <=> query_embedding) AS similarity
  FROM email_logs el
  JOIN knowledge_entities ke ON ke.external_id = el.gmail_id
  WHERE ke.embedding IS NOT NULL
    AND 1 - (ke.embedding <=> query_embedding) > match_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### 2. Knowledge Entity Search Function
```sql
CREATE OR REPLACE FUNCTION match_knowledge_entities(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  entity_type varchar,
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
    1 - (ke.embedding <=> query_embedding) AS similarity
  FROM knowledge_entities ke
  WHERE ke.embedding IS NOT NULL
    AND 1 - (ke.embedding <=> query_embedding) > match_threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

## 🔧 Configuration Checklist

### Environment Variables
- [ ] `SUPABASE_URL` - Your Supabase project URL
- [ ] `SUPABASE_ANON_KEY` - Supabase anonymous key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- [ ] `NEO4J_URI` - Neo4j Aura connection string
- [ ] `NEO4J_USER` - Neo4j username (usually 'neo4j')
- [ ] `NEO4J_PASSWORD` - Neo4j Aura password
- [ ] `OPENAI_API_KEY` - OpenAI API key for embeddings
- [ ] `RABBITMQ_DEFAULT_PASS` - Secure password for RabbitMQ

### Gmail API Setup
- [ ] Google Cloud project created
- [ ] Gmail API enabled
- [ ] OAuth 2.0 credentials created
- [ ] `gmail_credentials.json` file downloaded
- [ ] OAuth flow completed (gmail_token.json generated)

### Database Schema
- [ ] Supabase schema executed successfully
- [ ] Vector extension enabled
- [ ] All tables created with proper indexes
- [ ] RLS policies configured
- [ ] Vector similarity functions created

## 🚨 Troubleshooting

### Common Issues

#### 1. Supabase Connection Errors
```bash
# Check if environment variables are set
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY

# Test connection manually
curl -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     "$SUPABASE_URL/rest/v1/knowledge_entities?select=count"
```

#### 2. Neo4j Connection Issues
```bash
# Verify Neo4j Aura instance is running
# Check firewall settings
# Ensure URI format is correct: neo4j+s://...
```

#### 3. Gmail API Authentication
```bash
# Ensure OAuth 2.0 is properly configured
# Check redirect URIs match your setup
# Verify scopes include Gmail read/write permissions
```

#### 4. Vector Search Not Working
```sql
-- Check if vector extension is enabled
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Verify embeddings are being stored
SELECT COUNT(*) FROM knowledge_entities WHERE embedding IS NOT NULL;

-- Test vector operations
SELECT embedding <=> embedding FROM knowledge_entities LIMIT 1;
```

## 📈 Performance Optimization

### Database Tuning
```sql
-- Optimize vector index
CREATE INDEX CONCURRENTLY ON knowledge_entities 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Add indexes for common queries
CREATE INDEX idx_email_logs_processed_at ON email_logs(processed_at);
CREATE INDEX idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX idx_knowledge_entities_created_at ON knowledge_entities(created_at);
```

### RabbitMQ Configuration
```bash
# Set memory limits
docker run -d --name rabbitmq \
  -p 5672:5672 -p 15672:15672 \
  -e RABBITMQ_VM_MEMORY_HIGH_WATERMARK=0.8 \
  -e RABBITMQ_DISK_FREE_LIMIT=2GB \
  rabbitmq:3-management
```

## 🔄 Monitoring and Logging

### Health Checks
```bash
# Check service health
curl http://localhost:3000/health
curl http://localhost:15672/api/overview

# Monitor logs
docker-compose -f docker-compose.cloud.yml logs -f email-service
docker-compose -f docker-compose.cloud.yml logs -f athenai-app
```

### Metrics to Monitor
- Email processing queue depth
- Vector search response times
- Database connection pool usage
- Memory usage of services
- Error rates in logs

## 🎯 Success Criteria

### Phase 1A Complete When:
- [ ] Supabase project created and schema deployed
- [ ] Neo4j Aura instance configured and accessible
- [ ] All environment variables set correctly
- [ ] Database connections tested successfully

### Phase 1B Complete When:
- [ ] Gmail API authentication working
- [ ] Email service builds and runs without errors
- [ ] RabbitMQ queues processing messages
- [ ] Vector embeddings generating correctly

### Phase 1C Complete When:
- [ ] Full stack deploys successfully
- [ ] Email processing workflow completes end-to-end
- [ ] Vector similarity search returns relevant results
- [ ] All services healthy and monitored

## 📚 Next Phase Preparation

After completing this foundation setup, you'll be ready for:

- **Document 2**: Advanced data ingestion pipeline
- **Document 3**: ML model integration
- **Document 4**: Advanced agent orchestration
- **Document 5**: Production deployment and scaling

## 🆘 Support Resources

- **Supabase Documentation**: https://supabase.com/docs
- **Neo4j Aura Documentation**: https://neo4j.com/docs/aura/
- **Gmail API Documentation**: https://developers.google.com/gmail/api
- **RabbitMQ Documentation**: https://www.rabbitmq.com/documentation.html
- **OpenAI API Documentation**: https://platform.openai.com/docs

---

**Note**: This foundation setup provides the infrastructure for advanced AI agent capabilities. Each phase builds upon the previous one, so ensure complete testing before proceeding to the next phase.
