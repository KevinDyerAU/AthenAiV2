# AthenAI — Enterprise AI Platform with Intelligent Self-Healing

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 18+](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-lightgrey.svg)](https://expressjs.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-blue.svg)](https://socket.io/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green.svg)](https://supabase.com/)
[![Neo4j](https://img.shields.io/badge/Neo4j-Knowledge%20Graph-blue.svg)](https://neo4j.com/)
[![LangChain](https://img.shields.io/badge/LangChain-AI%20Framework-orange.svg)](https://langchain.com/)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-Multi%20Model%20AI-purple.svg)](https://openrouter.ai/)

> **Enterprise AI platform with intelligent multi-agent orchestration, knowledge substrate learning, and autonomous self-healing capabilities. Features AI-powered decision making, continuous learning, and predictive system recovery.**

## Table of Contents

- [🎯 Overview](#overview)
- [✨ Key Features](#key-features)
- [🏗️ Architecture](#architecture)
- [🤖 AI Agent System](#ai-agent-system)
- [🧠 Knowledge Substrate](#knowledge-substrate)
- [🔧 Intelligent Self-Healing](#intelligent-self-healing)
- [⚙️ Configuration](#configuration)
- [🚀 Quick Start](#quick-start)
- [🌐 Access Points](#access-points)
- [🔮 Future Roadmap](#future-roadmap)
- [🤝 Contributing](#contributing)

## 🎯 Overview

AthenAI is an enterprise-grade AI platform that combines intelligent multi-agent orchestration, knowledge substrate learning, and autonomous self-healing capabilities. The system features AI-powered decision making, continuous learning from interactions, and predictive system recovery.

**Core Philosophy**: Every interaction teaches the system something new, making it smarter and more resilient over time.

## ✨ Key Features

### 🤖 Intelligent AI Agents
- **Multi-Model AI Access**: OpenRouter integration with 200+ models (OpenAI, Anthropic, Google, Meta, etc.)
- **AI-Powered Routing**: Semantic task analysis automatically routes queries to specialized agents
- **Think-First Architecture**: All agents use AI reasoning before taking actions
- **Contextual Memory**: Agents remember and build upon previous conversations

### 🧠 Knowledge Substrate
- **Continuous Learning**: Every interaction is analyzed and stored for future reference
- **Semantic Similarity**: Intelligent caching using AI-powered pattern matching
- **Domain Classification**: Automatic categorization of content (AI, software, security, etc.)
- **Cost Optimization**: Smart caching reduces API costs by up to 70%

### 🔧 Autonomous Self-Healing
- **AI-Powered Analysis**: LLM reasoning analyzes system issues before taking action
- **Predictive Prevention**: Identifies risk patterns and prevents issues before they escalate
- **Knowledge-Informed Recovery**: Uses historical healing patterns for optimal decisions
- **Continuous Improvement**: Learns from every healing event to improve strategies

### 🏢 Enterprise Ready
- **Real-time Collaboration**: WebSocket-based chat with live progress tracking
- **Scalable Architecture**: Cloud-native design handles enterprise workloads
- **Security First**: Row-level security, audit trails, and compliance-ready
- **Comprehensive Monitoring**: Built-in observability and performance analytics

## 🏗️ Architecture

### System Overview
```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Interface]
        API[REST API]
        WS[WebSocket]
    end
    
    subgraph "AI Agent Layer"
        MO[Master Orchestrator<br/>AI Routing & Analysis]
        SH[Self-Healing Agent<br/>AI Analysis & Recovery]
        RA[Research Agent<br/>Knowledge + Web Search]
        AA[Analysis Agent<br/>Data Analysis & Insights]
        CA[Creative Agent<br/>Content Generation]
        QA[QA Agent<br/>Quality Assurance]
        PA[Planning Agent<br/>Project Planning]
        EA[Execution Agent<br/>Task Execution]
        CMA[Communication Agent<br/>Message Handling]
        DA[Development Agent<br/>Code & Development]
    end
    
    subgraph "Knowledge Substrate"
        KS[Knowledge Processing<br/>AI Analysis & Learning]
        PG[(PostgreSQL/Supabase<br/>Structured Data)]
        NEO[(Neo4j<br/>Knowledge Graph)]
        REDIS[(Redis<br/>Performance Cache)]
    end
    
    subgraph "External AI Services"
        OR[OpenRouter<br/>200+ AI Models]
        FC[Firecrawl<br/>Web Scraping]
        SERP[SerpAPI<br/>Search Results]
    end
    
    WEB --> API
    WEB --> WS
    API --> MO
    WS --> MO
    
    MO --> SH
    MO --> RA
    MO --> AA
    MO --> CA
    MO --> QA
    MO --> PA
    MO --> EA
    MO --> CMA
    MO --> DA
    
    SH --> KS
    RA --> KS
    AA --> KS
    CA --> KS
    QA --> KS
    
    KS --> PG
    KS --> NEO
    KS --> REDIS
    
    RA --> OR
    RA --> FC
    RA --> SERP
    AA --> OR
    CA --> OR
    QA --> OR
    SH --> OR
```

### AI Agent Flow
```mermaid
sequenceDiagram
    participant U as User
    participant MO as Master Orchestrator
    participant AI as AI Service (OpenRouter)
    participant KS as Knowledge Substrate
    participant RA as Research Agent
    participant SH as Self-Healing Agent
    
    U->>MO: User Query
    MO->>AI: Analyze Task Complexity
    AI-->>MO: Task Analysis
    MO->>AI: Route to Best Agent
    AI-->>MO: Agent Selection
    
    MO->>RA: Execute Research Task
    RA->>AI: Think About Research Strategy
    AI-->>RA: Research Plan
    RA->>KS: Check Knowledge Cache
    KS-->>RA: Cached Results (if available)
    RA->>AI: Enhanced Research Query
    AI-->>RA: Research Results
    RA->>KS: Store New Knowledge
    RA-->>MO: Research Response
    
    Note over SH: Continuous Monitoring
    SH->>SH: Health Check Every 30s
    SH->>AI: Analyze System Issues (if any)
    AI-->>SH: Healing Strategy
    SH->>KS: Store Healing Patterns
    
    MO-->>U: Final Response
```

### Self-Healing Architecture
```mermaid
graph TD
    subgraph "Monitoring Layer"
        HC[Health Checks<br/>Every 30 seconds]
        PA[Predictive Analysis<br/>Every 5 minutes]
        KS_SYNC[Knowledge Sync<br/>Every 10 minutes]
    end
    
    subgraph "AI Analysis Layer"
        THINK[AI Think Tool<br/>LLM Reasoning]
        PATTERN[Pattern Matching<br/>Semantic Similarity]
        PREDICT[Risk Prediction<br/>Historical Analysis]
    end
    
    subgraph "Knowledge Integration"
        HI[(Healing Insights<br/>All Events & Outcomes)]
        HP[(Healing Patterns<br/>Successful Strategies)]
        PRED[(Predictions<br/>Risk Indicators)]
    end
    
    subgraph "Recovery Actions"
        CACHE[Cache Management]
        RESTART[Service Restart]
        SCALE[Resource Scaling]
        FALLBACK[Fallback Systems]
    end
    
    HC --> THINK
    PA --> PATTERN
    KS_SYNC --> PREDICT
    
    THINK --> HI
    PATTERN --> HP
    PREDICT --> PRED
    
    HI --> CACHE
    HP --> RESTART
    PRED --> SCALE
    SCALE --> FALLBACK
```

## 🤖 AI Agent System

### Master Orchestrator
The central AI-powered coordination hub:
- **Semantic Task Analysis**: Uses LLM to understand user intent beyond keywords
- **Intelligent Routing**: Routes queries to optimal agents based on complexity and domain
- **Context Management**: Maintains conversation history and builds upon previous interactions
- **Fallback Handling**: Graceful degradation when specialized agents are unavailable

### Specialized AI Agents

#### Research Agent
- **Knowledge-First Approach**: Checks knowledge substrate before web searches
- **AI-Enhanced Search**: Uses LLM to optimize search queries and analyze results
- **Pattern Learning**: Stores research insights for future similar queries
- **Multi-Source Integration**: Combines cached knowledge with fresh web data

#### Analysis Agent
- **AI-Powered Insights**: Uses LLM for data interpretation and pattern recognition
- **Statistical Analysis**: Advanced analytics with confidence scoring
- **Domain Expertise**: Specialized tools for different analysis types
- **Quality Assurance**: Self-evaluation of analysis accuracy

#### Quality Assurance Agent
- **AI Code Review**: LLM-powered code analysis and improvement suggestions
- **Best Practices**: Automated compliance checking and recommendations
- **Security Analysis**: Vulnerability detection and mitigation strategies
- **Performance Optimization**: Identifies bottlenecks and optimization opportunities

#### Creative Agent
- **Content Generation**: AI-powered writing with tone and style adaptation
- **Engagement Optimization**: Analyzes and improves content effectiveness
- **Multi-Format Support**: Handles various content types and formats
- **Quality Metrics**: Built-in assessment of creative output

### Think-First Architecture
All agents use AI reasoning before taking actions:
```javascript
// Every agent follows this pattern
const analysis = await agent.thinkAbout(task, context);
const knowledgeContext = await agent.queryKnowledge(task);
const result = await agent.execute(task, analysis, knowledgeContext);
```

## 🧠 Knowledge Substrate

### AI-Powered Learning System
The Knowledge Substrate is AthenAI's revolutionary learning system that makes every interaction smarter:

#### Core Components
- **PostgreSQL (Supabase)**: Structured knowledge storage with vector embeddings
- **Neo4j**: Knowledge graph for entity relationships and semantic connections
- **Redis**: High-performance caching for frequently accessed data

#### AI Processing Pipeline
1. **Content Analysis**: LLM analyzes all interactions for insights and patterns
2. **Domain Classification**: Automatic categorization (AI, software, security, performance, data, general)
3. **Entity Extraction**: Identifies key concepts, technologies, and relationships
4. **Pattern Recognition**: Discovers themes and connections across content
5. **Embedding Generation**: Creates semantic vectors for similarity matching

#### Intelligent Caching
```javascript
// Knowledge-first approach
const cachedResult = await knowledgeSubstrate.findSimilar(query, domain);
if (cachedResult.confidence > 0.8) {
  return enhanceWithFreshData(cachedResult);
}
// Fallback to fresh processing
```

#### Learning Mechanisms
- **Semantic Similarity**: Finds related content using AI-powered pattern matching
- **Context Propagation**: Maintains conversation context across interactions
- **Success Pattern Recognition**: Learns what works and applies it to similar situations
- **Continuous Improvement**: Every interaction teaches the system something new

### Data Storage Schema
```sql
-- Core knowledge entities with AI analysis
knowledge_entities (
  id, content, entity_type, domain, confidence_score,
  embeddings, metadata, created_at
)

-- Research insights and patterns
research_insights (
  id, query_hash, domain, patterns, search_results,
  session_id, metadata, created_at
)

-- Quality assurance learnings
qa_insights (
  id, content_hash, qa_type, quality_metrics,
  improvement_patterns, metadata, created_at
)

-- Intelligent web search cache
web_search_cache (
  id, query_hash, domain, results, hit_count,
  expires_at, metadata, created_at
)
```

## 🔧 Intelligent Self-Healing

### AI-Powered Autonomous Recovery
AthenAI features an advanced self-healing system that uses AI reasoning and historical knowledge to automatically recover from issues:

#### Core Capabilities
- **AI Analysis First**: Uses LLM to analyze system issues before taking any action
- **Knowledge-Informed Decisions**: Leverages historical healing patterns for optimal recovery strategies
- **Predictive Prevention**: Identifies risk patterns and prevents issues before they escalate
- **Continuous Learning**: Improves healing strategies based on outcomes over time

#### AI Think Tool Integration
```javascript
// AI reasoning before healing actions
const aiAnalysis = await selfHealingAgent.thinkAboutHealing(issueType, severity, context);
// Returns: 6-step analysis including root cause, impact, strategy, risks, success criteria
```

#### Automated Recovery Strategies
1. **High Error Rate**: Cache clearing, agent restarts, metrics reset, verbose logging
2. **Memory Pressure**: Garbage collection, cache clearing, process restarts, resource scaling
3. **Slow Response**: Resource scaling, cache optimization, service restarts, profiling
4. **Agent Failures**: Agent restarts, state clearing, registry reset, backup activation
5. **Database Issues**: Connection recovery, pool clearing, replica switching, optimization
6. **WebSocket Issues**: Server restart, connection state reset, queue clearing, debugging
7. **AI API Failures**: Endpoint switching, rate limit adjustment, cache clearing, fallback models

#### Predictive Analysis
- **Risk Pattern Detection**: Monitors memory trends, error rates, response times
- **Proactive Healing**: Triggers preventive actions when risk scores exceed 0.8 threshold
- **Historical Learning**: Analyzes patterns that preceded similar issues
- **Success Rate Optimization**: Prioritizes actions based on historical effectiveness

#### Knowledge Integration
```javascript
// Historical pattern matching
const similarIncidents = await findSimilarHealingIncidents(contextSignature);
const successfulPatterns = await getSuccessfulHealingPatterns(issueType);
const prioritizedActions = prioritizeActionsFromKnowledge(similarIncidents, defaultActions);
```

#### Monitoring Schedule
- **Health Checks**: Every 30 seconds
- **Predictive Analysis**: Every 5 minutes
- **Knowledge Sync**: Every 10 minutes
- **History Cleanup**: Every hour

### Self-Healing Agent Implementation

The `SelfHealingAgent` class (`src/utils/selfHealingAgent.js`) provides the core autonomous recovery functionality:

#### Health Monitoring Thresholds
```javascript
healthThresholds: {
  errorRate: 0.15,              // 15% error rate triggers healing
  responseTime: 10000,          // 10 seconds response time
  memoryUsage: 0.85,            // 85% memory usage
  agentFailureRate: 0.2,        // 20% agent failure rate
  dbConnectionFailures: 5,      // 5 consecutive DB failures
  websocketDisconnections: 10   // 10 disconnections per minute
}
```

#### AI-Powered Analysis
The agent uses LangChain integration with OpenRouter/OpenAI for intelligent decision-making:
- **Think Tool**: 6-step reasoning process before taking healing actions
- **Context Analysis**: Evaluates system state, error patterns, and historical data
- **Strategy Selection**: AI chooses optimal recovery approach based on issue type and severity
- **Risk Assessment**: Evaluates potential impact of healing actions before execution

#### Healing Strategy Registry
```javascript
healingStrategies: {
  'high_error_rate': handleHighErrorRate,      // Cache clearing, agent restarts
  'slow_response': handleSlowResponse,         // Resource scaling, optimization
  'memory_pressure': handleMemoryPressure,    // GC, cache clearing, restarts
  'agent_failures': handleAgentFailures,      // Agent registry reset, backups
  'database_issues': handleDatabaseIssues,    // Connection recovery, optimization
  'websocket_issues': handleWebSocketIssues,  // Server restart, state reset
  'ai_api_failures': handleAIAPIFailures      // Endpoint switching, fallbacks
}
```

#### Knowledge Substrate Integration
- **Semantic Similarity**: Matches current issues with historical patterns
- **Learning Cache**: Stores successful healing patterns for future reference
- **Pattern Recognition**: Uses 0.75 similarity threshold for pattern matching
- **Predictive Insights**: Analyzes trends to prevent issues before they occur

#### Cooldown Management
Prevents rapid repeated healing actions with severity-based cooldown periods:
- **Critical**: 5 minutes cooldown
- **High**: 10 minutes cooldown  
- **Medium**: 15 minutes cooldown
- **Low**: 30 minutes cooldown

### Healing Insights Database
```sql
-- All healing events and outcomes
healing_insights (
  id, event_id, issue_type, context_signature, context_hash,
  actions_taken, success, duration_ms, error_message,
  system_metrics, metadata, created_at
)

-- Aggregated successful strategies
healing_patterns (
  id, issue_type, pattern_signature, success_rate,
  total_occurrences, successful_occurrences,
  common_actions, context_patterns, last_updated
)

-- Predictive patterns and risk indicators
healing_predictions (
  id, pattern_type, risk_indicators, predicted_issue,
  confidence_score, historical_accuracy, trigger_count,
  correct_predictions, false_positives, last_triggered
)
```

## ⚙️ Configuration

### Environment Variables

#### Core Application
```env
# Application Configuration
NODE_ENV=development
PORT=3000
APP_NAME=athenai

# AI Services (Primary: OpenRouter)
USE_OPENROUTER=true
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=x-ai/grok-code-fast-1
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_TEMPERATURE=0.1

# AI Services (Fallback: OpenAI)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4
OPENAI_TEMPERATURE=0.1
```

#### Database Configuration
```env
# Supabase (Primary Database)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
POSTGRES_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# Neo4j (Knowledge Graph)
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password_here

# Redis (Performance Cache - Optional)
REDIS_URL=redis://your-redis-url:port
REDIS_PASSWORD=your_redis_password
REDIS_USERNAME=your_redis_username
```

#### External Services
```env
# Web Search and Scraping
SERPAPI_API_KEY=your_serpapi_key_here
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
API_SECRET_KEY=your_api_secret_key_here

# Document Processing
UNSTRUCTURED_WORKER_URL=http://unstructured-worker:8080
WORKER_CONCURRENCY=2
UPLOAD_DIR=./data/unstructured/input
EMBEDDING_MODEL=text-embedding-3-small

# LangChain Tracing
LANGCHAIN_API_KEY=your_langsmith_api_key_here
LANGCHAIN_PROJECT=athenai
LANGCHAIN_TRACING_V2=true
```

#### Feature Flags
```env
# Core Features (Production Ready)
FEATURE_ENABLE_PLANNING=true
FEATURE_ENABLE_EXECUTION=true
FEATURE_ENABLE_QA=true
FEATURE_ENABLE_COMMUNICATION=true
CONSCIOUSNESS_SUBSTRATE_ENABLED=true
INTER_AGENT_COMMUNICATION_ENABLED=true
AI_CHAT_AGENT_ENABLED=true
WORKFLOW_ORCHESTRATION_ENABLED=true
MULTI_MODEL_AI_ENABLED=true
VECTOR_SEARCH_ENABLED=true
REAL_TIME_MONITORING_ENABLED=true
ADVANCED_ANALYTICS_ENABLED=true

# ML Service Features (Optional)
ML_SERVICE_ENABLED=true
ML_TRAINING_ENABLED=true
ML_BATCH_PROCESSING_ENABLED=true
ML_MONITORING_ENABLED=true
ML_RETRAINING_ENABLED=true
ML_DRIFT_DETECTION_ENABLED=true
ML_FEATURE_STORE_ENABLED=true
ML_GPU_ACCELERATION_ENABLED=false
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database (Supabase recommended)
- OpenRouter API key (or OpenAI as fallback)

### Installation
```bash
# 1. Clone the repository
git clone <repository-url>
cd AthenAi

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.simplified.example .env
# Edit .env with your API keys and database URLs

# 4. Initialize databases (choose one method)

# Method A: Use convenience scripts (recommended)
# Unix/Linux/macOS:
./init-db.sh

# Windows:
.\init-db.ps1

# Method B: Manual database setup
# Supabase: Run db/supabase/functions.sql in Supabase SQL Editor
# Neo4j: Run db/neo4j/advanced_schema.cypher in Neo4j Browser
# ML Service: Run db/supabase/ml_schema.sql in Supabase SQL Editor

# 5. Start the application
npm run dev
```

### Docker Deployment
```bash
# Full stack deployment
docker-compose -f docker-compose.cloud.yml up -d

# Simplified deployment (without ML service)
docker-compose -f docker-compose.simplified.yml up -d
```

## 🗄️ Database Setup

### Database Initialization Scripts

AthenAI provides convenience scripts to initialize your databases with the required schemas:

#### Core Database Setup
```bash
# Unix/Linux/macOS
./init-db.sh

# Windows
.\init-db.ps1
```

**What these scripts do:**
- Load environment variables from `.env` file
- Validate Supabase and Neo4j configuration
- Guide you through manual schema execution
- Install Node.js dependencies
- Run basic database connection tests

#### ML Service Database Setup
```bash
# Unix/Linux/macOS
./init-ml-db.sh

# Windows
.\init-ml-db.ps1
```

**What these scripts do:**
- Initialize ML service database schema
- Set up PyTorch integration tables
- Configure monitoring and retraining infrastructure
- Test Supabase connection with ML service credentials

#### Neo4j Schema Execution
```bash
# Unix/Linux/macOS
./run-neo4j-schema.sh [schema-file]

# Windows
.\run-neo4j-schema.ps1 [-SchemaFile schema-file]
```

**What these scripts do:**
- Execute Neo4j schema files using `cypher-shell`
- Use environment variables for authentication
- Default to `db/neo4j/advanced_schema.cypher`

### Database Schema Files

#### Supabase (PostgreSQL)
- `db/supabase/functions.sql` - Core knowledge substrate functions and ML service functions
- `db/supabase/knowledge_search_functions.sql` - Vector similarity and hybrid search functions
- `db/supabase/ml_schema.sql` - ML service tables, triggers, and policies
- `db/supabase/healing_insights_schema.sql` - Self-healing system schema

#### Neo4j (Graph Database)
- `db/neo4j/advanced_schema.cypher` - Complete knowledge graph schema with ML extensions
- `db/neo4j/knowledge_search_index.cypher` - Full-text search indexes
- `db/neo4j/ml_schema.cypher` - ML-specific constraints and indexes

### Manual Database Setup

If you prefer manual setup or the scripts don't work in your environment:

1. **Supabase Setup:**
   - Open your Supabase project dashboard
   - Go to SQL Editor
   - Execute the following files in order:
     - `db/supabase/functions.sql`
     - `db/supabase/ml_schema.sql` (if using ML service)
     - `db/supabase/healing_insights_schema.sql`

2. **Neo4j Setup:**
   - Open Neo4j Browser
   - Execute `db/neo4j/advanced_schema.cypher`
   - Optionally execute `db/neo4j/knowledge_search_index.cypher`

### Environment Variables Required

The scripts validate these environment variables from your `.env` file:

```env
# Required for all scripts
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Required for Neo4j scripts
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
```

### Health Checks
```bash
# Application health
curl http://localhost:3000/health

# Database connectivity
curl http://localhost:3000/health/database
```

## 🌐 Access Points

### Web Interfaces
- **🏠 Main Portal**: http://localhost:3000/
- **💬 AI Chat Interface**: http://localhost:3000/chat.html
- **📊 System Health**: http://localhost:3000/health

### Getting Started
1. **Test the AI Chat**: Visit `/chat.html` and start a conversation
2. **Try Different Agents**: Ask research questions, request code reviews, or get creative content
3. **Watch Learning**: Notice how the system remembers context and improves responses
4. **Monitor Self-Healing**: Check logs to see autonomous recovery in action
5. **Explore Knowledge**: Ask follow-up questions to see cached knowledge in use

### Example Interactions
```
# Research Query
"Research the latest developments in AI self-healing systems"
→ Research Agent analyzes, checks knowledge cache, performs web search, stores insights

# Code Review
"Review this JavaScript function for performance issues"
→ QA Agent analyzes code, provides suggestions, learns patterns for future reviews

# Creative Content
"Write a technical blog post about knowledge substrates"
→ Creative Agent generates content, adapts tone, optimizes for engagement
```

## 🔮 Future Roadmap

### Experimental Features (Available but Disabled by Default)
```env
# Advanced experimental features
DYNAMIC_AGENT_CREATION_ENABLED=false    # AI creates new specialized agents on demand
AUTO_SCALING_ENABLED=false              # Automatic resource scaling based on load
PREDICTIVE_ANALYTICS_ENABLED=false      # Advanced predictive insights and forecasting
```

### Forward-Looking Features & Research Areas

#### Planned Features (Next 6 Months)
- **Dynamic Agent Creation**: Runtime creation of specialized agents based on task requirements
- **Auto-Scaling Infrastructure**: Automatic resource scaling based on workload and performance metrics
- **Advanced Predictive Analytics**: Enhanced ML models for system behavior prediction and optimization
- **Multi-Modal AI Integration**: Support for image, audio, and video processing capabilities
- **Enhanced Security Framework**: Advanced threat detection and automated security response
- **Multi-Language Support**: Agents that work in multiple programming languages
- **Cross-System Learning**: Knowledge sharing between multiple AthenAI instances

#### Research & Development (6-18 Months)
- **Quantum-Enhanced AI**: Exploring quantum machine learning applications for complex optimization
  - *Status*: Experimental flag available (`QUANTUM_COMPUTING_INTEGRATION_ENABLED=false`)
  - *Goal*: Quantum-classical hybrid algorithms for knowledge graph processing
- **Neuromorphic Computing**: Brain-inspired computing architectures for energy-efficient AI
- **Federated Learning**: Distributed learning across multiple organizations while preserving privacy
- **Explainable AI**: Enhanced transparency in AI decision-making processes with detailed reasoning chains
- **Edge AI Deployment**: Lightweight agent deployment for edge computing environments

#### Long-term Vision (18+ Months)
- **Autonomous System Evolution**: Self-modifying code and architecture improvements
- **Advanced Consciousness Modeling**: More sophisticated reasoning and decision-making frameworks
- **Distributed Intelligence**: Multi-node AI coordination and collaboration across geographic regions
- **Biological Integration**: Bio-inspired computing and potential brain-computer interface research
- **Sustainable AI**: Carbon-neutral AI operations and green computing initiatives

#### Feature Flag Configuration
Many experimental features can be enabled via environment variables:
```env
# Enable experimental features (use with caution in production)
DYNAMIC_AGENT_CREATION_ENABLED=false        # Dynamic agent spawning
AUTO_SCALING_ENABLED=false                  # Automatic infrastructure scaling
PREDICTIVE_ANALYTICS_ENABLED=false          # Advanced ML predictions
QUANTUM_COMPUTING_INTEGRATION_ENABLED=false # Quantum-classical hybrid processing
```

**Note**: Experimental features are under active development and may not be production-ready. Enable them in development environments for testing and feedback.

## 🤝 Contributing

### Development Setup
```bash
# Fork and clone the repository
git clone https://github.com/your-username/AthenAi.git
cd AthenAi

# Install dependencies
npm install

# Set up development environment
cp .env.simplified.example .env.development
# Configure your development API keys

# Run tests
npm test

# Start development server
npm run dev
```

### Project Structure
```
AthenAi/
├── src/
│   ├── agents/           # AI agent implementations
│   ├── services/         # Core services (database, etc.)
│   ├── utils/           # Utilities (logging, monitoring, self-healing)
│   ├── routes/          # API routes
│   └── middleware/      # Express middleware
├── db/
│   ├── supabase/        # PostgreSQL schemas and functions
│   └── neo4j/          # Neo4j graph schemas
├── public/             # Web interface files
├── tests/              # Test suites
└── documentation/      # Additional documentation
```

### Contributing Guidelines
1. **Follow the Think-First Pattern**: All new agents should use AI reasoning before actions
2. **Knowledge Integration**: Ensure new features integrate with the knowledge substrate
3. **Self-Healing Awareness**: Consider how new features interact with the self-healing system
4. **Comprehensive Testing**: Include unit tests and integration tests
5. **Documentation**: Update README and relevant documentation

### Code Style
- Use ESLint configuration provided
- Follow existing patterns for agent implementation
- Include comprehensive error handling
- Add logging for debugging and monitoring

### Submitting Changes
1. Create a feature branch from `main`
2. Make your changes with tests
3. Update documentation as needed
4. Submit a pull request with detailed description
5. Ensure all CI checks pass

---

**AthenAI** - Making AI systems smarter, more resilient, and continuously learning from every interaction.

For questions or support, please open an issue or contact the development team.

## 🚀 Setup & Deployment

### Quick Start
```bash
# 1. Clone and install dependencies
git clone <repository>
cd AthenAi
npm install

# 2. Configure environment
cp .env.simplified.example .env
# Edit .env with your API keys and database URLs

# 3. Initialize databases
# Supabase: Run db/supabase/functions.sql in Supabase SQL Editor
# Neo4j: Run db/neo4j/advanced_schema.cypher in Neo4j Browser

# 4. Start the application
npm run dev
```

### Docker Deployment
```bash
# Full stack with ML service
docker-compose -f docker-compose.cloud.yml up -d

# Simplified stack without ML
docker-compose -f docker-compose.simplified.yml up -d
```

## ⚙️ Configuration

### Environment Variables

AthenAI uses environment variables for configuration. Copy `.env.simplified.example` to `.env` and configure the following:

#### Core Application
```env
# Application Configuration
NODE_ENV=development
PORT=3000
APP_NAME=athenai
```

#### AI Services
```env
# Primary AI Service (OpenRouter - Recommended)
USE_OPENROUTER=true
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=x-ai/grok-code-fast-1
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_TEMPERATURE=0.1

# Fallback AI Service (OpenAI)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4
OPENAI_TEMPERATURE=0.1
```

#### Database Configuration
```env
# Supabase (Primary Database & Knowledge Substrate)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
POSTGRES_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# Neo4j (Knowledge Graph)
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password_here

# Redis (Caching - Optional)
REDIS_URL=redis://your-redis-url:port
REDIS_PASSWORD=your_redis_password
REDIS_USERNAME=your_redis_username  # Optional (Redis 6+)
```

#### LangChain Integration
```env
# LangChain and LangSmith Configuration
LANGCHAIN_API_KEY=your_langsmith_api_key_here
LANGCHAIN_PROJECT=athenai
LANGCHAIN_TRACING_V2=true
LANGCHAIN_CALLBACKS_BACKGROUND=true
```

#### Document Processing
```env
# Document Processing Worker (Local Docker)
UNSTRUCTURED_WORKER_URL=http://unstructured-worker:8080
WORKER_CONCURRENCY=2
LOG_LEVEL=INFO
UPLOAD_DIR=./data/unstructured/input
EMBEDDING_MODEL=text-embedding-3-small
```

#### Web Search APIs (Optional)
```env
# Search APIs for Enhanced Research
SERPAPI_API_KEY=your_serpapi_key_here
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
API_SECRET_KEY=your_api_secret_key_here
```

#### ML Service Configuration (Optional)
```env
# ML Service (Enable with ENABLE_ML_SERVICE=true)
ENABLE_ML_SERVICE=false
ML_SERVICE_HOST=ml-service
ML_SERVICE_PORT=8001
MLFLOW_TRACKING_URI=http://mlflow:5000
MLFLOW_EXPERIMENT_NAME=athenai_ml

# Model Configuration
ML_MODEL_CACHE_SIZE=10
ML_BATCH_SIZE=32
ML_TRAINING_EPOCHS=100
ML_LEARNING_RATE=0.001

# Monitoring and Retraining
ML_MONITORING_ENABLED=true
ML_RETRAINING_ENABLED=true
ML_RETRAINING_SCHEDULE="0 2 * * 0"  # Weekly at 2 AM Sunday
```

#### Feature Flags
```env
# Core Features
FEATURE_ENABLE_PLANNING=true
FEATURE_ENABLE_EXECUTION=true
FEATURE_ENABLE_QA=true
FEATURE_ENABLE_COMMUNICATION=true
CONSCIOUSNESS_SUBSTRATE_ENABLED=true
INTER_AGENT_COMMUNICATION_ENABLED=true
AI_CHAT_AGENT_ENABLED=true
WORKFLOW_ORCHESTRATION_ENABLED=true
MULTI_MODEL_AI_ENABLED=true
VECTOR_SEARCH_ENABLED=true
REAL_TIME_MONITORING_ENABLED=true
ADVANCED_ANALYTICS_ENABLED=true

# Experimental Features (Future Development)
DYNAMIC_AGENT_CREATION_ENABLED=false
AUTO_SCALING_ENABLED=false
PREDICTIVE_ANALYTICS_ENABLED=false
QUANTUM_COMPUTING_INTEGRATION_ENABLED=false

# ML Service Features
ML_SERVICE_ENABLED=true
ML_TRAINING_ENABLED=true
ML_BATCH_PROCESSING_ENABLED=true
ML_DRIFT_DETECTION_ENABLED=true
ML_GPU_ACCELERATION_ENABLED=false
```

### Production Deployment

#### Database Setup
```bash
# Supabase Schema
# Run db/supabase/functions.sql in Supabase SQL Editor
# Run db/supabase/ml_schema.sql in Supabase SQL Editor (if using ML service)

# Neo4j Schema
cypher-shell -u neo4j -p password -f db/neo4j/advanced_schema.cypher

# ML Schema (if using ML service)
psql -h your-supabase-host -U postgres -d postgres -f db/supabase/ml_schema.sql
```

#### Service Configuration
```bash
# Initialize knowledge substrate
./setup-knowledge-substrate.sh

# Setup ML service (optional)
./setup-ml-service.sh

# Start production services
./start-dev.sh --production
```

### Health Checks
```bash
# Application health
curl http://localhost:3000/health

# Database connectivity
curl http://localhost:3000/health/database

# ML service health (if enabled)
curl http://localhost:8001/health
```

## 🌐 Access Points

- **🏠 Main Portal**: http://localhost:3000/
- **💬 AI Chat Interface**: http://localhost:3000/chat.html  
- **📊 System Health**: http://localhost:3000/health
- **📚 Knowledge Substrate Guide**: See `KNOWLEDGE_SUBSTRATE_README.md`

### First Steps

1. **Test the Interactive Chat**: Visit `/chat.html` and experience contextual conversations
2. **Monitor Conversation Context**: Watch how agents remember and build upon previous messages
3. **Explore Agent Capabilities**: Try research, QA, development, and planning tasks with conversation continuity
4. **Test Dynamic Query Refinement**: Ask follow-up questions and see how queries are automatically improved
5. **Check System Health**: Monitor agent status and performance metrics

## 🏗️ Architecture

AthenAI uses a sophisticated, knowledge-driven architecture designed for enterprise-scale AI operations:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     AthenAI Simplified Architecture                              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │  Express.js API │    │ Master          │
│                 │◄──►│                 │◄──►│ Orchestrator    │
│ • Chat UI       │    │ • REST Routes   │    │ • AI Routing    │
│ • Portal        │    │ • WebSocket     │    │ • Task Analysis │
│ • Progress      │    │ • Progress      │    │ • Agent Coord   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                │                        ▼
                                │              ┌─────────────────┐
                                │              │ Knowledge-      │
                                │              │ Enhanced Agents │
                                │              │ • Research      │
                                │              │ • QA            │
                                │              │ • Document      │◄─┐
                                │              │ • Development   │  │
                                │              │ • Communication │  │
                                │              │ • Planning      │  │
                                │              │ • Execution     │  │
                                │              └─────────────────┘  │
                                │                        │         │
                                ▼                        ▼         │
┌─────────────────────────────────────────────────────────────────┐│
│                    KNOWLEDGE SUBSTRATE                          ││
├─────────────────┬─────────────────┬─────────────────┬───────────┤│
│   Supabase      │     Neo4j       │     Redis       │OpenRouter ││
│   PostgreSQL    │ Knowledge Graph │   Caching       │Multi-Model││
│   + pgvector    │   (Optional)    │  (Optional)     │    AI     ││
│                 │                 │                 │           ││
│ • Entities      │ • Relationships │ • Agent Cache   │ • OpenAI  ││
│ • Insights      │ • Sessions      │ • Context TTL   │ • Anthropic││
│ • QA Data       │ • Patterns      │ • Templates     │ • Google  ││
│ • Documents     │ • Agent Links   │ • Performance   │ • Meta    ││
│ • Vector Search │                 │                 │ • Custom  ││
│ • Web Cache     │                 │                 │           ││
└─────────────────┴─────────────────┴─────────────────┴───────────┘│
                                │                                  │
                                ▼                                  │
                    ┌─────────────────────────┐                   │
                    │ Unstructured Worker     │◄──────────────────┘
                    │ • Document Processing   │
                    │ • HTTP API             │
                    │ • Supabase Integration │
                    │ • Vector Embeddings    │
                    └─────────────────────────┘
```

### Knowledge Substrate Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        Knowledge Learning & Retrieval Flow                       │
└─────────────────────────────────────────────────────────────────────────────────┘

User Query ──► Conversation Context ──► Master Orchestrator ──► Agent Selection ──► Knowledge Retrieval
     │              │                        │                        │                      │
     │              │ (Context Analysis)     │ (AI Analysis)          │ (Contextual)         │
     │              ▼                        ▼                        ▼                      ▼
     │    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
     │    │ Chat Context    │    │ Task Complexity │    │ Agent Routing   │    │ Knowledge Query │
     │    │ • Last 20 Msgs  │    │ • Domain        │    │ • Research      │    │ • Similar Queries│
     │    │ • Topic Extract │    │ • Difficulty    │    │ • QA            │    │ • Domain Context│
     │    │ • Continuity    │    │ • Resources     │    │ • Development   │    │ • Cached Results│
     │    └─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
     │              │                        │                      │
     │              ▼                        ▼                      ▼
     │    Enhanced Processing ──► Agent Execution ──► Knowledge Storage
     │              │                        │                      │
     │              │                        │                      │
     ▼              ▼                        ▼                      ▼
Real-time     Progress Updates      Agent Response      Learning & Caching
Progress      • Knowledge Phase     • Enhanced with     • Store Insights
Updates       • Processing Phase    • Previous Context  • Cache Results
              • Storage Phase       • Fresh Data        • Update Graph
                                   • Quality Assured    • Pattern Extract
```

## 🧠 Knowledge Substrate

The Knowledge Substrate is AthenAI's revolutionary AI-powered learning system that enables continuous improvement and intelligent caching through advanced AI processing:

### AI Processing Pipeline

The Knowledge Substrate leverages sophisticated AI processing to transform raw content into structured knowledge:

#### AI Content Analysis
- **Domain Classification**: AI determines content domain (ai, software, security, performance, data, general)
- **Entity Extraction**: Named Entity Recognition identifies key concepts, technologies, and relationships
- **Pattern Recognition**: AI discovers themes, relationships, and insights across content
- **Embedding Generation**: OpenAI/OpenRouter creates semantic vector representations

```javascript
// AI-powered processing replaces basic NLP
const analysis = await aiProcessing.analyzeContent(content);
// Returns: { domain, entities, patterns, confidence: 0.9 }
```

### Core Components

#### 1. PostgreSQL (Supabase) - Structured Knowledge
```sql
-- Knowledge Entities: Core knowledge units
knowledge_entities (
  id, external_id, content, entity_type, domain,
  confidence_score, source_type, metadata, embeddings
)

-- Research Insights: Learning from research queries  
research_insights (
  id, query, query_hash, domain, patterns,
  search_results, session_id, metadata
)

-- QA Insights: Quality assurance learning
qa_insights (
  id, content_hash, qa_type, quality_metrics,
  improvement_patterns, session_id, metadata
)

-- Web Search Cache: 24-hour intelligent caching
web_search_cache (
  id, query_hash, query_text, domain, results,
  hit_count, expires_at, metadata
)
```

#### 2. Neo4j - Knowledge Graph
```cypher
// AI-discovered relationships and patterns
(Entity)-[:RELATES_TO]->(Entity)
(Session)-[:CONTAINS]->(Insight)
(Agent)-[:GENERATED]->(Knowledge)
(Query)-[:SIMILAR_TO]->(Query)
(Domain)-[:ENCOMPASSES]->(Entity)
(Pattern)-[:DISCOVERED_IN]->(Content)
(Theme)-[:CONNECTS]->(Entity)
```

#### 3. Redis - Performance Caching (Optional)
```javascript
// Agent context caching with TTL
await databaseService.cacheSet(
  `qa:${orchestrationId}`,
  qaResult,
  3600 // 1 hour TTL
);

// Template caching for communication
await databaseService.cacheSet(
  `template:${templateName}`, 
  template, 
  86400 * 30 // 30 days TTL
);

// Graceful degradation - continues without Redis if unavailable
const cachedResult = await databaseService.cacheGet(cacheKey);
if (cachedResult) {
  return cachedResult; // Fast cache hit
}
// Fallback to database query
```

**Cache Types:**
- **Agent Context**: QA results, planning context, execution state (1 hour TTL)
- **Communication Templates**: Email/message templates (30 days TTL)
- **Performance Optimization**: Reduces database load and improves response times
- **Graceful Degradation**: System continues without Redis if unavailable

#### 4. Domain Classification System
- **AI**: Machine learning, neural networks, AI research
- **Software**: Development, frameworks, programming languages  
- **Security**: Cybersecurity, vulnerabilities, best practices
- **Performance**: Optimization, benchmarking, scalability
- **Data**: Databases, analytics, data science
- **General**: Everything else

### AI-Powered Knowledge Learning Process

1. **AI Query Analysis**: AI extracts entities, classifies domain, and generates semantic hash
2. **Context Retrieval**: Find similar previous queries and domain knowledge using AI similarity
3. **AI-Enhanced Processing**: Combine cached knowledge with fresh data using AI pattern recognition
4. **AI Pattern Extraction**: AI identifies research patterns, themes, and relationship insights
5. **Knowledge Storage**: Store AI-processed insights and update knowledge graph with discovered relationships
6. **Intelligent Caching**: Cache AI-analyzed results for future similar queries

## 🤖 AI Agents

AthenAI features a comprehensive suite of knowledge-enhanced AI agents, each designed for specific tasks and powered by the Knowledge Substrate:

### 🎯 Master Orchestrator
**Revolutionary AI-Powered Routing**: Uses GPT-4 for semantic analysis and intelligent task routing

**Key Capabilities**:
- **Semantic Analysis**: Understands user intent beyond simple keyword matching
- **Task Complexity Assessment**: Evaluates difficulty, resources, and optimal agent selection
- **Multi-Agent Coordination**: Manages complex workflows across multiple agents
- **Learning Integration**: Routes based on previous successful patterns

**Example Routing Logic**:
```javascript
// AI analyzes: "Help me optimize my React app's performance"
// Result: Routes to Development Agent with performance focus
{
  "agent": "development",
  "confidence": 0.92,
  "reasoning": "Performance optimization requires code analysis and technical expertise",
  "complexity": "medium"
}
```

### 🔍 Research Agent (Knowledge-Enhanced)
**Intelligent Research with Learning**: Combines web search with knowledge substrate for superior results

**Knowledge Integration**:
- **Pre-Search Knowledge Retrieval**: Checks existing knowledge before expensive web searches
- **Smart Caching**: 24-hour cache with hit tracking reduces redundant searches
- **Pattern Learning**: Extracts and stores research patterns for future use
- **Domain Context**: Leverages domain-specific knowledge for enhanced results

**Enhanced Workflow**:
```
Query → Knowledge Retrieval → Cached Results Check → Enhanced Web Search → Pattern Extraction → Knowledge Storage
```

**Research Patterns Detected**:
- Documentation, Tutorials, Code Repositories, API References, Security Advisories

### 🔍 Quality Assurance Agent (Knowledge-Enhanced)
**Comprehensive Validation with Learning**: Advanced QA with insight storage and pattern recognition

**Knowledge Integration**:
- **Historical QA Context**: Retrieves similar previous assessments
- **Quality Pattern Learning**: Stores improvement patterns and quality metrics
- **Domain-Specific Standards**: Applies domain knowledge to QA processes
- **Continuous Improvement**: Learns from each assessment to improve future evaluations

**QA Capabilities**:
- **Content Validation**: Accuracy, completeness, consistency checking
- **Security Assessment**: Vulnerability identification and best practices
- **Performance Evaluation**: Performance implications and optimization suggestions
- **Quality Scoring**: Quantitative metrics with configurable standards

### 📄 Document Agent (pgvector-Powered)
**Enterprise Document Processing**: Advanced document management with semantic search capabilities

**Document Processing Features**:
- **Multi-Format Support**: PDF, DOCX, TXT, HTML, XLSX, PPTX via unstructured.io
- **Semantic Search**: pgvector-powered similarity search across document content
- **Email Attachments**: Automatic processing of email attachments with metadata extraction
- **Direct Processing**: HTTP-based communication with unstructured worker for real-time processing
- **Vector Storage**: Cost-effective pgvector integration with Supabase PostgreSQL
- **Content Chunking**: Intelligent document segmentation with embedding generation

**LangChain Tools**:
- **Document Upload**: Direct file processing with HTTP worker communication
- **Semantic Search**: Vector similarity search across document corpus
- **Document Status**: Real-time processing status and metadata retrieval
- **Content Summarization**: AI-powered document summarization
- **Email Integration**: Email attachment processing workflows

### 🔧 Development Agent (LangChain-Powered)
**Advanced Code Generation**: Full LangChain integration with specialized development tools

**LangChain Tools**:
- **Knowledge Synthesis**: Combines multiple sources for comprehensive solutions
- **Fact Verification**: Validates technical information and best practices
- **Research Planning**: Structures development approaches methodically
- **Code Analysis**: Advanced static analysis and quality assessment

**Capabilities**:
- **Multi-Language Support**: JavaScript, Python, Java, C#, Go, Rust, and more
- **Framework Expertise**: React, Vue, Angular, Express, Django, Spring, etc.
- **Best Practices**: Security, performance, testing, documentation
- **Sandboxed Execution**: Safe code testing in isolated environments

### 📡 Communication Agent
**Multi-Channel Messaging Hub**: Enterprise-grade communication management

**Supported Channels**:
- **Email**: SMTP integration with template support
- **Slack**: Webhook-based messaging with rich formatting
- **Discord**: Community engagement with embed capabilities
- **Microsoft Teams**: Enterprise communication integration

**Advanced Features**:
- **Audience Adaptation**: Adjusts tone and format for different audiences
- **Template Management**: Reusable templates with variable substitution
- **Broadcasting**: Multi-channel simultaneous messaging
- **Message Analytics**: Sentiment analysis and engagement tracking

### 📋 Planning Agent (LangChain-Enhanced)
**Sophisticated Project Planning**: Advanced planning with resource optimization

**Planning Capabilities**:
- **Task Decomposition**: Breaks complex objectives into manageable subtasks
- **Resource Allocation**: Optimizes human and technical resource distribution
- **Timeline Management**: Creates realistic schedules with dependency tracking
- **Risk Assessment**: Identifies and mitigates potential project risks
- **Critical Path Analysis**: Optimizes schedules for maximum efficiency

**Planning Types**:
- **Project Planning**: Full project lifecycle management
- **Sprint Planning**: Agile development cycle planning
- **Resource Planning**: Team and infrastructure optimization
- **Contingency Planning**: Risk mitigation and backup strategies

### ⚡ Execution Agent
**Workflow Orchestration Engine**: Manages complex multi-step workflows

**Execution Capabilities**:
- **Command Execution**: Safe system command execution with error handling
- **API Integration**: HTTP client for external service integration
- **File Operations**: Comprehensive file system operations (CRUD)
- **Task Queue Management**: Priority-based task scheduling
- **Error Recovery**: Automatic error detection and recovery mechanisms

**Workflow Types**:
- **Deployment Workflows**: CI/CD pipeline execution
- **Data Processing**: ETL and data transformation workflows
- **System Administration**: Infrastructure management tasks
- **Integration Workflows**: Multi-system coordination

### 🔄 Agent Lifecycle Management
**Sophisticated Agent Coordination**: Advanced agent management and coordination

**Management Features**:
- **Dynamic Registration**: Runtime agent registration and deregistration
- **Health Monitoring**: Continuous health checks and status reporting
- **Load Balancing**: Intelligent task distribution across available agents
- **Performance Metrics**: Comprehensive analytics and monitoring
- **Auto-Recovery**: Automatic agent restart and error recovery

### Legacy Agents (Backward Compatibility)
- **Research Agent (Legacy)**: Simple web search functionality
- **Analysis Agent**: Data analysis and pattern recognition
- **Creative Agent**: Content creation and creative tasks

## 🔬 ML Service & Graph Neural Networks

AthenAI's ML Service provides enterprise-grade machine learning capabilities with Graph Neural Networks, real-time inference, and automated MLOps pipeline.

### 🧠 Graph Neural Network Models

#### Link Prediction Models
- **GCN (Graph Convolutional Network)**: Foundation model for graph-based link prediction
- **GAT (Graph Attention Network)**: Attention-based model for complex relationship modeling
- **GraphSAGE**: Scalable inductive learning for large knowledge graphs
- **Expertise Recommendation**: Specialized GNN for expert identification and ranking

#### Node Classification Models
- **Document Classification**: Multi-class classification for document categorization
- **Entity Classification**: Entity type prediction and semantic labeling
- **Topic Classification**: Hierarchical topic modeling and classification
- **Sentiment Analysis**: Document and entity sentiment classification
- **Multi-label Classification**: Complex multi-category prediction tasks

### 🚀 Real-time ML Inference

#### Knowledge-First Prediction Strategy
```python
# Intelligent prediction workflow
1. Query Knowledge Substrate → Check existing relationships
2. If sufficient confidence → Return knowledge-based result
3. If low confidence → Fallback to ML prediction
4. Store ML predictions → Update knowledge substrate
```

#### FastAPI ML Service Features
- **<100ms Inference Latency**: Optimized PyTorch models with GPU acceleration
- **Batch Processing**: Scalable batch inference with job management
- **Model Caching**: Intelligent model loading and memory management
- **Health Monitoring**: Real-time service health and performance metrics

### 📊 Model Performance & Metrics

#### Ranking Metrics (Link Prediction)
- **NDCG@K**: Normalized Discounted Cumulative Gain
- **MAP**: Mean Average Precision
- **MRR**: Mean Reciprocal Rank
- **Precision@K**: Top-K precision metrics

#### Classification Metrics
- **Accuracy**: Overall classification accuracy
- **F1-Score**: Balanced precision and recall
- **ROC-AUC**: Area under the ROC curve
- **Confusion Matrix**: Detailed classification analysis

## 🔄 MLOps Pipeline

### 🔍 Automated Model Monitoring

#### Data Drift Detection
- **Statistical Tests**: Kolmogorov-Smirnov test for distribution changes
- **Feature Drift**: Individual feature distribution monitoring
- **Prediction Drift**: Output distribution analysis
- **Performance Degradation**: Automatic quality metric tracking

#### System Health Monitoring
- **Model Performance**: Real-time accuracy and latency tracking
- **Resource Usage**: CPU, memory, and GPU utilization
- **Prediction Volume**: Request rate and throughput monitoring
- **Error Rates**: Failed prediction tracking and alerting

### 🔄 Intelligent Retraining Pipeline

#### Automated Triggers
- **Performance Drop**: Retraining when accuracy falls below threshold
- **Data Drift**: Statistical significance-based retraining triggers
- **Scheduled Retraining**: Time-based model refresh cycles
- **Manual Triggers**: On-demand retraining with custom configurations

#### Retraining Features
- **Job Queue Management**: Priority-based retraining scheduling
- **Resource Allocation**: Dynamic compute resource management
- **Model Validation**: Comprehensive testing before deployment
- **Rollback Capability**: Automatic rollback on performance regression

### 📈 Experiment Tracking & Model Management

#### MLflow Integration
- **Experiment Tracking**: Comprehensive training run logging
- **Model Registry**: Versioned model storage and management
- **Artifact Storage**: Training artifacts and model checkpoints
- **Model Deployment**: Automated production deployment pipeline

#### Model Lifecycle
```
Training → Validation → Staging → Production → Monitoring → Retraining
    ↑                                                           ↓
    └─────────────── Automated Feedback Loop ──────────────────┘
```

## 📡 API Reference

### REST Endpoints

#### System Health & Monitoring
```http
GET /health                           # System health check
GET /api/metrics                      # Performance metrics
GET /api/agents/status               # All agent status
GET /api/agents/:agentId/metrics     # Specific agent metrics
```

#### Knowledge Substrate
```http
GET /api/knowledge/entities          # Knowledge entities by domain
GET /api/knowledge/insights          # Research and QA insights
GET /api/knowledge/cache/stats       # Cache performance statistics
```

#### Agent Endpoints
```http
POST /api/chat                       # Master Orchestrator (AI routing)
POST /api/agents/research            # Research Agent (knowledge-enhanced)
POST /api/agents/quality-assurance   # QA Agent (knowledge-enhanced)
POST /api/agents/development         # Development Agent (LangChain)
POST /api/agents/document            # Document Agent (pgvector)
POST /api/agents/communication       # Communication Agent
POST /api/agents/planning            # Planning Agent
POST /api/agents/execution           # Execution Agent
```

#### ML Service Endpoints
```http
# Health & Status
GET /ml/health                       # ML service health check
GET /ml/models/status               # Model loading status
GET /ml/metrics                     # Prometheus metrics

# Real-time Predictions
POST /ml/predict/expertise          # Expertise recommendation
POST /ml/predict/links              # Link prediction
POST /ml/predict/classification     # Node classification

# Batch Processing
POST /ml/batch/submit               # Submit batch job
GET /ml/batch/{job_id}/status       # Job status
GET /ml/batch/{job_id}/results      # Job results

# Model Management
POST /ml/models/load                # Load specific model
POST /ml/models/retrain             # Trigger retraining
GET /ml/models/performance          # Model performance metrics

# Monitoring & Alerts
GET /ml/monitoring/drift            # Data drift status
GET /ml/monitoring/alerts           # Active alerts
POST /ml/monitoring/alerts/ack      # Acknowledge alerts
```

#### Chat & WebSocket
```http
GET /api/conversations/:sessionId    # Conversation history
GET /api/ws/rooms                    # Active chat rooms
GET /api/ws/rooms/:id               # Room details
```

### Example API Usage

#### Master Orchestrator (AI-Powered Routing)
```javascript
POST /api/chat
{
  "message": "Help me optimize my React app's performance",
  "sessionId": "session_123",
  "userId": "user_456"
}

// Response includes AI routing decision
{
  "agent": "development",
  "confidence": 0.92,
  "reasoning": "Performance optimization requires code analysis",
  "response": "I'll help you optimize your React app...",
  "knowledge_context": {
    "similar_queries": 3,
    "cached_results": 1,
    "domain": "software"
  }
}
```

#### Knowledge-Enhanced Research
```javascript
POST /api/agents/research
{
  "query": "best practices for React performance optimization",
  "sessionId": "session_123",
  "useKnowledgeContext": true
}

// Response includes knowledge integration
{
  "results": "...",
  "knowledge_used": {
    "cached_results": true,
    "similar_research": 2,
    "domain_entities": 5,
    "patterns_extracted": ["documentation", "tutorials", "code_examples"]
  },
  "learning_stored": true
}
```

#### ML Service Predictions
```javascript
// Expertise Recommendation
POST /ml/predict/expertise
{
  "query": "machine learning expert",
  "limit": 5,
  "use_knowledge_context": true
}

// Response with ML predictions
{
  "predictions": [
    {
      "entity": "Dr. Sarah Chen",
      "confidence": 0.94,
      "expertise_areas": ["deep learning", "computer vision"],
      "reasoning": "Published 15+ papers in ML conferences"
    }
  ],
  "knowledge_enhanced": true,
  "fallback_used": false
}

// Link Prediction
POST /ml/predict/links
{
  "source_entity": "Python",
  "target_entities": ["Machine Learning", "Data Science", "AI"],
  "limit": 3
}

// Batch Job Submission
POST /ml/batch/submit
{
  "job_type": "expertise_batch",
  "input_data": {
    "queries": ["AI researcher", "Python developer"],
    "limit": 5
  },
  "config": {
    "batch_size": 100,
    "priority": "normal"
  }
}
```

## 🔌 WebSocket Events

### Client → Server Events
```javascript
// Join chat room
socket.emit('join_room', {
  roomId: 'general',
  userId: 'user_123',
  username: 'John Doe'
});

// Send message with progress tracking
socket.emit('send_message', {
  roomId: 'general',
  message: 'Analyze this code for security issues',
  requestProgress: true
});
```

### Server → Client Events
```javascript
// Real-time progress updates
socket.on('progress_update', (data) => {
  // data.phase: 'knowledge_retrieval', 'processing', 'storage'
  // data.message: Human-readable progress description
  // data.percentage: Progress percentage (0-100)
});

// Agent response with knowledge context
socket.on('ai_response', (data) => {
  // data.response: Agent response
  // data.agent: Which agent handled the request
  // data.knowledge_context: Knowledge substrate usage
  // data.learning_stored: Whether new knowledge was stored
});

// Knowledge substrate events
socket.on('knowledge_update', (data) => {
  // data.type: 'cache_hit', 'new_insight', 'pattern_detected'
  // data.domain: Knowledge domain
  // data.details: Specific update information
});
```

## ⚙️ Configuration

### Environment Variables

#### Core System
```bash
NODE_ENV=development
PORT=3000
APP_NAME=athenai
API_SECRET_KEY=your-secret-key
```

#### Knowledge Substrate (Required)
```bash
# Supabase (PostgreSQL with vector embeddings)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Neo4j (Knowledge Graph)
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password

# Redis (Optional - for additional caching)
REDIS_URL=redis://your-redis-url:port
```

#### AI Services
```bash
# OpenRouter (Multi-model AI access)
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=openai/gpt-4-turbo-preview
OPENROUTER_TEMPERATURE=0.7

# LangChain (Optional - for enhanced agent capabilities)
LANGCHAIN_API_KEY=your-langsmith-key
LANGCHAIN_TRACING_V2=true
```

#### Agent-Specific Configuration
```bash
# Communication Agent
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your/webhook
TEAMS_WEBHOOK_URL=https://your-org.webhook.office.com/webhookb2/your-webhook

# Development Agent
WORKSPACE_ROOT=/path/to/workspace
CODE_EXECUTION_TIMEOUT=30000

# Optional External APIs
SERPAPI_API_KEY=your-serpapi-key
UNSTRUCTURED_API_KEY=your-unstructured-key

# Document Processing Configuration
WORKER_CONCURRENCY=2
LOG_LEVEL=INFO
UPLOAD_DIR=./data/unstructured/input
EMBEDDING_MODEL=text-embedding-3-small

# Document Processing APIs
UNSTRUCTURED_API_KEY=your-unstructured-key
UNSTRUCTURED_API_URL=https://api.unstructured.io
FIRECRAWL_API_KEY=your-firecrawl-key

# Document Processing Worker (Docker service name for container communication)
UNSTRUCTURED_WORKER_URL=http://unstructured-worker:8080
```

### Database Schema Setup

#### PostgreSQL (Supabase)
```sql
-- Run db/supabase/functions.sql in Supabase SQL Editor
-- Creates: Advanced search functions, processing statistics
-- Run db/supabase/ml_schema.sql for ML service tables
-- Includes: Vector embeddings, indexes, utility functions
```

#### Neo4j (Knowledge Graph)
```cypher
-- Run db/neo4j/advanced_schema.cypher in Neo4j Browser
-- Creates: Constraints, indexes, sample data
-- Includes: Knowledge relationships, session tracking, agent links
```

## 🛠️ Development

### Local Development Setup

```bash
# Automated setup (recommended)
npm run setup:win      # Windows
npm run setup:unix     # Linux/Mac

# Manual setup
npm install
cp .env.simplified.example .env
# Edit .env with your configuration
npm run dev
```

### Project Structure
```
src/
├── agents/                    # AI agent implementations
│   ├── MasterOrchestrator.js     # AI-powered routing
│   ├── ResearchAgent.js          # Knowledge-enhanced research
│   ├── QualityAssuranceAgent.js  # Knowledge-enhanced QA
│   ├── DevelopmentAgent.js       # LangChain-powered development
│   ├── DocumentAgent.js          # Document processing with pgvector
│   ├── CommunicationAgent.js     # Multi-channel messaging
│   ├── PlanningAgent.js          # Advanced planning
│   ├── ExecutionAgent.js         # Workflow orchestration
│   └── AgentHandlers.js          # Agent lifecycle management
├── workers/                   # Background processing workers
│   └── unstructured_worker.py    # Document processing worker
├── services/
│   ├── database.js               # Knowledge substrate operations
│   ├── chatroom.js               # Chat management
│   └── progressBroadcaster.js    # Real-time progress updates
├── routes/
│   ├── index.js                  # API endpoints
│   └── websocket.js              # WebSocket handling
└── middleware/
    ├── errorHandler.js           # Error management
    └── rateLimiter.js            # Rate limiting

# Knowledge Substrate Files
├── db/
│   ├── postgres/
│   │   └── schema.sql            # PostgreSQL schema
│   └── neo4j/
│       └── advanced_schema.cypher # Neo4j schema
├── KNOWLEDGE_SUBSTRATE_README.md  # Detailed setup guide

# Document Processing Files
├── docker-compose.simplified.yml  # Simplified Docker setup with document processing
├── Dockerfile.unstructured       # Document processing worker container
├── requirements-unstructured.txt # Python dependencies for document processing
└── .env.simplified.example       # Environment configuration with Supabase
```

### Development Scripts
```bash
# Development
npm run dev                    # Start with hot reload
npm run start                  # Production start

# Database setup
npm run init-db:win           # Initialize databases (Windows)
npm run init-db:unix          # Initialize databases (Unix)

# Knowledge substrate
npm run setup:win             # Setup knowledge substrate (Windows)
npm run setup:unix            # Setup knowledge substrate (Unix)
npm run check-setup:win       # Validate setup (Windows)
npm run check-setup:unix      # Validate setup (Unix)

# Testing
npm test                      # Run all tests
npm run test:unit             # Unit tests
npm run test:integration      # Integration tests
npm run test:coverage         # Coverage report

# Code quality
npm run lint                  # ESLint check
npm run lint:fix              # Fix linting issues
```

## 🚢 Deployment

### Docker Deployment (Recommended)

#### Simplified Setup with Document Processing
```bash
# Quick start with document processing (recommended for new deployments)
# Only requires Supabase - no local PostgreSQL or RabbitMQ needed
docker-compose -f docker-compose.simplified.yml up --build -d

# View logs
docker-compose -f docker-compose.simplified.yml logs -f

# Stop services
docker-compose -f docker-compose.simplified.yml down
```

**Services Included**:
- **AthenAI App**: Main application with DocumentAgent
- **Unstructured Worker**: Document processing service with Supabase integration

#### Full Production Deployment
```bash
# Production deployment with all services
docker-compose up --build -d

# Development with hot reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

### Manual Deployment

```bash
# Build for production
npm run build

# Start production server
NODE_ENV=production npm start
```

### Environment Setup Checklist

- [ ] **Database Services**: Supabase configured (no local PostgreSQL needed)
- [ ] **AI Services**: OpenRouter API key configured
- [ ] **Document Processing**: Unstructured.io API key configured
- [ ] **Knowledge Substrate**: Schema files deployed to Supabase
- [ ] **Environment Variables**: All required variables set in `.env`
- [ ] **Dependencies**: `npm install` completed successfully
- [ ] **Health Check**: `/health` endpoint returns 200 OK
- [ ] **Chat Interface**: `/chat.html` loads and connects via WebSocket
- [ ] **Document Worker**: Unstructured worker accessible at port 8080

## 🧪 Testing

### Comprehensive Test Suite

```bash
# Run all tests
npm test

# Specific test suites
npm run test:unit              # Unit tests for all agents
npm run test:integration       # API and WebSocket integration tests
npm run test:e2e              # End-to-end workflow tests
npm run test:coverage         # Generate coverage report
npm run test:watch            # Watch mode for development
```

### Test Coverage Areas

- **🤖 Agent Logic**: Master orchestrator routing, knowledge integration
- **🧠 Knowledge Substrate**: Database operations, caching, pattern extraction
- **📡 API Endpoints**: REST API functionality and error handling
- **🔌 WebSocket**: Real-time communication and progress updates
- **💾 Database**: Supabase and Neo4j operations
- **🔄 Agent Coordination**: Multi-agent workflows and lifecycle management

### Knowledge Substrate Testing

```bash
# Test knowledge substrate specifically
npm test -- --testNamePattern="knowledge"

# Test caching functionality
npm test -- --testNamePattern="cache"

# Test agent learning capabilities
npm test -- --testNamePattern="learning"
```

## 📊 Monitoring

### System Health Monitoring

```http
GET /health                    # Overall system health
GET /api/agents/status         # Agent health and performance
GET /api/metrics              # System performance metrics
```

### Knowledge Substrate Metrics

```http
GET /api/knowledge/cache/stats    # Cache hit rates and performance
GET /api/knowledge/insights       # Learning and insight statistics
GET /api/knowledge/entities       # Knowledge entity counts by domain
```

### Real-time Monitoring

- **Agent Performance**: Response times, success rates, error rates
- **Knowledge Learning**: Cache hit rates, insight generation, pattern detection
- **Database Health**: Connection status, query performance, storage usage
- **WebSocket Connections**: Active connections, message throughput

### Performance Optimization

- **Knowledge Caching**: 24-hour web search cache reduces API costs
- **Smart Routing**: AI-powered agent selection improves efficiency
- **Connection Pooling**: Database connection optimization
- **Load Balancing**: Intelligent task distribution across agents

## 🤝 Contributing

### Development Workflow

1. **Fork** the repository
2. **Create** feature branch (`git checkout -b feature/amazing-feature`)
3. **Install** dependencies (`npm install`)
4. **Setup** knowledge substrate (`npm run setup:win` or `npm run setup:unix`)
5. **Test** changes (`npm test`)
6. **Commit** changes (`git commit -m 'Add amazing feature'`)
7. **Push** to branch (`git push origin feature/amazing-feature`)
8. **Open** Pull Request

### Adding New Agents

To add a knowledge-enhanced agent:

```javascript
// 1. Create agent class in src/agents/
class NewAgent {
  async execute(task, sessionId, orchestrationId) {
    // Retrieve knowledge context
    const knowledgeContext = await this.retrieveKnowledgeContext(task, sessionId);
    
    // Process with knowledge enhancement
    const result = await this.processWithKnowledge(task, knowledgeContext);
    
    // Store new insights
    await this.storeKnowledgeInsights(result, sessionId, orchestrationId);
    
    return result;
  }
  
  async retrieveKnowledgeContext(task, sessionId) {
    // Implement knowledge retrieval logic
  }
  
  async storeKnowledgeInsights(result, sessionId, orchestrationId) {
    // Implement knowledge storage logic
  }
}
```

```bash
# 2. Add comprehensive tests
# tests/unit/newAgent.test.js

# 3. Register in agent system
# src/agents/index.js

# 4. Add API endpoint
# src/routes/index.js

# 5. Update documentation
```

### Knowledge Substrate Extensions

To extend the knowledge substrate:

```sql
-- Add new Supabase tables
-- db/supabase/functions.sql

-- Add new indexes for performance
CREATE INDEX idx_new_feature ON new_table(column);
```

```cypher
-- Add new Neo4j relationships
-- db/neo4j/advanced_schema.cypher

-- Create new relationship types
(Agent)-[:NEW_RELATIONSHIP]->(Entity)
### Code Quality Standards

- **ESLint**: Follow existing linting rules (`npm run lint`)
- **Testing**: Maintain >80% test coverage
- **Documentation**: Update README and inline documentation
- **Knowledge Integration**: New agents should use knowledge substrate
- **Progress Tracking**: Implement real-time progress updates
- **Error Handling**: Comprehensive error handling and logging

---

## 🎯 Key Differentiators

### What Makes AthenAI Revolutionary

1. **🧠 Knowledge Substrate**: First AI platform with persistent learning across sessions
2. **🎯 AI-Powered Routing**: Semantic analysis for intelligent task distribution
3. **🔄 Continuous Learning**: Every interaction improves future performance
4. **📊 Real-time Progress**: Transparent knowledge retrieval and processing phases
5. **🏗️ Enterprise Architecture**: Production-ready with comprehensive monitoring

### Competitive Advantages

- **Cost Efficiency**: Smart caching reduces API costs by up to 70%
- **Performance**: Knowledge-enhanced responses are 3x faster for similar queries
- **Redis Caching**: Agent context caching improves response times by 60%
- **Intelligence**: AI routing achieves 95%+ accuracy in agent selection
- **Scalability**: Microservices architecture supports enterprise deployment
- **Flexibility**: Multi-model AI support via OpenRouter integration
- **Graceful Degradation**: System continues operating even if Redis is unavailable

---

**AthenAI v2.0** - The Future of Intelligent AI Agent Orchestration

[![GitHub](https://img.shields.io/badge/GitHub-Repository-black.svg)](https://github.com/KevinDyerAU/AthenAI)
[![Documentation](https://img.shields.io/badge/Docs-Knowledge%20Substrate-blue.svg)](KNOWLEDGE_SUBSTRATE_README.md)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> *"Intelligence is not just about processing information—it's about learning, remembering, and building upon every interaction."*

### Analytics and Monitoring UI Components

#### 3. QA Analytics Dashboard (`/examples/ui/qa_analytics.html`)
**Purpose**: Quality assurance monitoring and validation analytics

**Features**:
- Real-time quality gate monitoring
- Pass/fail rate tracking with trend visualization
- Error rate and latency P95 metrics
- Historical validation run analysis
- WebSocket integration for live updates (`/qa` namespace)
- Manual validation trigger capabilities

**Access**: Open `examples/ui/qa_analytics.html` in browser
**Configuration**: Requires API base URL and optional JWT token

**Key Metrics**:
- Pass Rate percentage
- Error Rate tracking
- Latency P95 measurements
- Quality gate status (PASS/FAIL)

#### 4. Self-Healing Operations Dashboard (`/examples/ui/self_healing_dashboard.html`)
**Purpose**: System operations monitoring and self-healing capabilities

**Features**:
- Real-time system metrics visualization
- Trend analysis with forecasting capabilities
- Live event monitoring via WebSocket
- Quality gate integration
- Manual validation triggers
- Multi-metric support (error_rate, cpu_load, latency_p95, queue_depth, memory_usage)

**Access**: Open `examples/ui/self_healing_dashboard.html` in browser
**Configuration**: Requires API base URL and JWT authentication

**Supported Metrics**:
- Error rate monitoring
- CPU load tracking
- Latency P95 analysis
- Queue depth monitoring
- Memory usage statistics

### UI Component Setup and Configuration

#### Prerequisites for All UI Components
```bash
# Ensure the AthenAI server is running
npm run dev

# Server should be accessible at http://localhost:3000
```

#### Configuration for Analytics Dashboards

**QA Analytics Dashboard**:
```javascript
// Required configuration
API Base: http://localhost:3000/api
JWT Token: [Optional - required for history/run operations]

// WebSocket connection
Namespace: /qa
Events: qa.validation.report, qa.gates.updated
```

**Self-Healing Dashboard**:
```javascript
// Required configuration  
API Base: http://localhost:3000/api
JWT Token: [Required for authenticated operations]

// Supported endpoints
GET /self_healing/metrics/trend
GET /self_healing/metrics/forecast
POST /validation/run
```

#### Accessing UI Components

1. **Start the AthenAI Server**:
   ```bash
   npm run dev
   ```

2. **Access Core Components**:
   - Main Portal: http://localhost:3000/
   - Chat Interface: http://localhost:3000/public/chat.html

3. **Access Analytics Dashboards**:
   - Open `examples/ui/qa_analytics.html` directly in your browser
   - Open `examples/ui/self_healing_dashboard.html` directly in your browser
   - Configure API endpoints to point to your running AthenAI instance

#### UI Component Integration

All UI components integrate with the AthenAI backend through:
- **REST API**: Standard HTTP endpoints for data retrieval and operations
- **WebSocket**: Real-time updates and live monitoring
- **Authentication**: JWT-based authentication for secure operations

#### Customization and Extension

The UI components are built with modern web technologies:
- **Vanilla JavaScript**: No framework dependencies for easy customization
- **Chart.js**: For data visualization and trend analysis
- **Socket.IO**: For real-time WebSocket communication
- **Responsive Design**: Mobile-friendly interfaces
- **Dark Theme**: Consistent dark mode across all components

## Architecture

AthenAI uses a simplified, cost-optimized architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │  Express.js API │    │ Master          │
│                 │◄──►│                 │◄──►│ Orchestrator    │
│ • Chat UI       │    │ • REST Routes   │    │ • AI Routing    │
│ • Portal        │    │ • WebSocket     │    │ • Task Analysis │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                │                        ▼
                                │              ┌─────────────────┐
                                │              │ Knowledge-      │
                                │              │ Enhanced Agents │
                                │              │ • Research      │
                                │              │ • QA            │
                                │              │ • Development   │
                                │              │ • Communication │
                                │              │ • Planning      │
                                │              │ • Execution     │
                                │              └─────────────────┘
                                │                        │
                                ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    KNOWLEDGE SUBSTRATE                          │
├─────────────────┬─────────────────┬─────────────────┬───────────┤
│   Supabase      │     Neo4j       │     Redis       │OpenRouter │
│   PostgreSQL    │ Knowledge Graph │   Caching       │Multi-Model│
│   + pgvector    │   (Optional)    │  (Optional)     │    AI     │
│                 │                 │                 │           │
│ • Entities      │ • Relationships │ • Agent Cache   │ • OpenAI  │
│ • Insights      │ • Sessions      │ • Context TTL   │ • Anthropic│
│ • QA Data       │ • Patterns      │ • Templates     │ • Google  │
│ • Documents     │ • Agent Links   │ • Performance   │ • Meta    │
│ • Vector Search │                 │                 │ • Custom  │
└─────────────────┴─────────────────┴─────────────────┴───────────┘
```

## API Reference

### REST Endpoints

#### System Endpoints
- `GET /health` - System health check
- `GET /api/metrics` - System performance metrics
- `GET /api/conversations/:sessionId` - Retrieve conversation history
- `GET /api/ws/rooms` - List active chat rooms
- `GET /api/ws/rooms/:id` - Get room details

#### Agent Endpoints
- `POST /api/chat` - Send message to Master Orchestrator
- `POST /api/agents/development` - Execute development tasks
- `POST /api/agents/communication` - Execute communication tasks
- `POST /api/agents/planning` - Execute planning tasks
- `POST /api/agents/execution` - Execute workflow tasks
- `POST /api/agents/quality-assurance` - Execute QA tasks
- `GET /api/agents/status` - Get all agent status
- `GET /api/agents/:agentId/metrics` - Get specific agent metrics

#### Legacy Endpoints
- `POST /api/research` - Execute research queries (Research Agent)
- `POST /api/analysis` - Execute analysis tasks (Analysis Agent)
- `POST /api/creative` - Execute creative tasks (Creative Agent)

### WebSocket Events

**Client → Server:**
- `join_room` - Join a chat room
- `send_message` - Send message to room
- `leave_room` - Leave a chat room

**Server → Client:**
- `user_joined` - User joined notification
- `user_left` - User left notification
- `new_message` - New message in room
- `ai_response` - AI agent response
- `room_update` - Room status update

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
REDIS_URL=redis://your-redis-url:port

# AI Services
OPENAI_API_KEY=your-openai-key
LANGCHAIN_API_KEY=your-langsmith-key

# Communication Agent Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your/webhook/url
TEAMS_WEBHOOK_URL=https://your-org.webhook.office.com/webhookb2/your-webhook

# Development Agent Configuration
WORKSPACE_ROOT=/path/to/workspace
CODE_EXECUTION_TIMEOUT=30000

# Optional APIs
SERPAPI_API_KEY=your-serpapi-key
UNSTRUCTURED_API_KEY=your-unstructured-key
```

## Testing

AthenAI includes a comprehensive test suite covering all major components:

### Test Structure

```
tests/
├── integration/           # Integration tests
│   ├── api.test.js       # REST API endpoints
│   └── websocket.test.js # WebSocket functionality
├── unit/                 # Unit tests
│   ├── agents.test.js    # AI agent logic
│   ├── database.test.js  # Database operations
│   └── chatroom.test.js  # Chat room management
├── setup.js              # Test configuration
└── jest.config.js        # Jest settings
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test file
npm test -- tests/unit/agents.test.js
```

### Test Coverage

- **🧪 Integration Tests**: REST API, WebSocket real-time communication
- **🤖 Agent Tests**: Task complexity analysis, routing, execution plans
- **💾 Database Tests**: Supabase, Neo4j, Redis operations
- **💬 Chatroom Tests**: User management, message history, cleanup
- **🔧 Mocked Services**: External API mocking for reliable testing

### Test Features

- **WebSocket Testing**: Real-time chat functionality with Socket.IO client
- **Agent Logic Testing**: Orchestration, research planning, result formatting
- **Database Validation**: Connection management, query validation, caching
- **Room Management**: User join/leave, message handling, cleanup operations
- **Comprehensive Mocking**: External services mocked for isolated unit tests

## Development

### Local Development Setup

```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Server will run on http://localhost:3000
```

### Project Structure

```
src/
├── agents/               # AI agent implementations
│   ├── MasterOrchestrator.js    # Main orchestration logic
│   ├── DevelopmentAgent.js      # Code generation & project setup
│   ├── CommunicationAgent.js    # Multi-channel messaging
│   ├── PlanningAgent.js         # Task planning & resource allocation
│   ├── ExecutionAgent.js        # Workflow & command execution
│   ├── QualityAssuranceAgent.js # Content validation & QA
│   ├── AgentHandlers.js         # Agent lifecycle management
│   ├── ResearchAgent.js         # Research & analysis (legacy)
│   ├── AnalysisAgent.js         # Data analysis (legacy)
│   ├── CreativeAgent.js         # Creative content (legacy)
│   └── index.js                 # Agent exports
├── middleware/           # Express middleware
│   ├── errorHandler.js
│   └── rateLimiter.js
├── routes/              # API route handlers
│   ├── index.js         # Main routes with agent endpoints
│   └── websocket.js     # WebSocket handling
├── services/            # Core services
│   ├── database.js      # Database connections & operations
│   └── chatroom.js      # Chat room management
├── utils/               # Utility functions
│   ├── logger.js        # Structured logging
│   └── versionControl.js # Git operations
└── app.js               # Main application entry

tests/
├── unit/                # Unit tests for all agents
│   ├── development.test.js
│   ├── communication.test.js
│   ├── planning.test.js
│   ├── execution.test.js
│   ├── qualityAssurance.test.js
│   └── agentHandlers.test.js
├── integration/         # Integration tests
└── e2e/                # End-to-end tests
```

## Agent Documentation

### Core Agents

AthenAI features a comprehensive suite of specialized agents, each designed for specific tasks and capabilities:

#### 🔧 Development Agent
**Purpose**: Code generation, project setup, and development workflow management

**Key Capabilities**:
- **Code Generation**: Generate code in multiple languages with best practices
- **Project Setup**: Create project structures, configuration files, and dependencies
- **Code Analysis**: Analyze existing code for quality, security, and performance
- **Test Generation**: Create comprehensive unit and integration tests
- **Documentation**: Generate technical documentation and API references
- **Sandboxed Execution**: Safe code execution in isolated environments

**API Endpoint**: `POST /api/agents/development`

**Example Usage**:
```javascript
{
  "task": {
    "code_request": "Create a REST API for user management",
    "language": "javascript",
    "framework": "express",
    "include_tests": true
  }
}
```

#### 📡 Communication Agent
**Purpose**: Multi-channel messaging and communication management

**Key Capabilities**:
- **Multi-Channel Support**: Email, Slack, Discord, Microsoft Teams integration
- **Message Formatting**: Audience-appropriate formatting and tone adjustment
- **Template Management**: Reusable message templates with variable substitution
- **Message Analysis**: Sentiment analysis and communication optimization
- **Broadcasting**: Send messages across multiple channels simultaneously
- **Message Routing**: Intelligent routing based on content and context

**API Endpoint**: `POST /api/agents/communication`

**Example Usage**:
```javascript
{
  "task": {
    "message": "Project milestone completed successfully",
    "channels": ["slack", "email"],
    "audience": "team",
    "tone": "professional"
  }
}
```

#### 📋 Planning Agent
**Purpose**: Complex task planning and resource management

**Key Capabilities**:
- **Task Breakdown**: Decompose complex objectives into manageable tasks
- **Timeline Creation**: Generate realistic project timelines with dependencies
- **Resource Planning**: Allocate human and technical resources efficiently
- **Risk Assessment**: Identify and mitigate potential project risks
- **Critical Path Analysis**: Optimize project schedules for efficiency
- **Milestone Creation**: Define and track project milestones
- **Contingency Planning**: Develop backup plans for various scenarios
- **Progress Tracking**: Monitor and report on project progress

**API Endpoint**: `POST /api/agents/planning`

**Example Usage**:
```javascript
{
  "task": {
    "objective": "Launch new mobile application",
    "constraints": {
      "budget": 100000,
      "timeline": "6 months",
      "team_size": 8
    },
    "planning_type": "project"
  }
}
```

#### ⚡ Execution Agent
**Purpose**: Workflow orchestration and task execution

**Key Capabilities**:
- **Command Execution**: Execute system commands with proper error handling
- **Workflow Orchestration**: Manage complex multi-step workflows
- **API Integration**: Make HTTP requests and integrate with external services
- **File Operations**: Comprehensive file system operations (CRUD)
- **Task Queue Management**: Prioritize and manage task execution queues
- **Error Recovery**: Automatic error detection and recovery mechanisms
- **Resource Management**: Monitor and manage system resources
- **Progress Monitoring**: Real-time task progress tracking

**API Endpoint**: `POST /api/agents/execution`

**Example Usage**:
```javascript
{
  "task": {
    "execution_plan": "Deploy application to staging environment",
    "execution_type": "workflow",
    "environment": "staging",
    "steps": [
      {"type": "command", "command": "npm run build"},
      {"type": "api_call", "url": "https://api.deploy.com/deploy"}
    ]
  }
}
```

#### 🔍 Quality Assurance Agent
**Purpose**: Content validation and quality assessment

**Key Capabilities**:
- **Content Validation**: Verify accuracy, completeness, and consistency
- **Completeness Assessment**: Ensure all requirements are met
- **Clarity Analysis**: Evaluate content clarity for target audiences
- **Consistency Checking**: Maintain consistency across documents and code
- **Security Assessment**: Identify potential security vulnerabilities
- **Performance Evaluation**: Assess performance implications
- **Quality Scoring**: Provide quantitative quality metrics
- **Recommendations**: Generate actionable improvement suggestions

**API Endpoint**: `POST /api/agents/quality-assurance`

**Example Usage**:
```javascript
{
  "task": {
    "content": "Technical documentation for API endpoints",
    "qa_type": "comprehensive",
    "standards": {
      "accuracy": 0.95,
      "completeness": 0.90,
      "clarity": 0.85
    }
  }
}
```

#### 🔄 Agent Handlers
**Purpose**: Agent lifecycle management and coordination

**Key Capabilities**:
- **Agent Registration**: Register and manage agent instances
- **Health Monitoring**: Continuous health checks and status monitoring
- **Load Balancing**: Distribute tasks across available agents
- **Coordination**: Manage multi-agent collaborations
- **Metrics Collection**: Gather performance and usage metrics
- **Error Handling**: Manage agent failures and recovery
- **Scaling**: Dynamic agent scaling based on demand

### Legacy Agents

The system also maintains backward compatibility with simplified legacy agents:

- **Research Agent**: Web search and information gathering
- **Analysis Agent**: Data analysis and pattern recognition  
- **Creative Agent**: Content creation and creative tasks

## Deployment

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build

# For development with hot reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

### Environment Setup

1. **Database Setup**: Configure Supabase, Neo4j Aura, and Redis Cloud
2. **API Keys**: Obtain OpenAI, LangChain, and optional service keys
3. **Communication Setup**: Configure email SMTP and webhook URLs for Slack/Discord/Teams
4. **Environment**: Copy and configure `.env` file with all agent configurations
5. **Dependencies**: Run `npm install` to install all required packages
6. **Testing**: Verify setup with `npm test` and `npm run test:unit`
7. **Launch**: Start with `npm run dev`

### Agent-Specific Setup

**Development Agent**:
- Set `WORKSPACE_ROOT` to your development workspace path
- Configure `CODE_EXECUTION_TIMEOUT` for sandboxed execution limits
- Ensure proper file system permissions for code generation

**Communication Agent**:
- Configure SMTP settings for email functionality
- Set up webhook URLs for Slack, Discord, and Teams integration
- Test communication channels before production use

**Execution Agent**:
- Ensure proper system permissions for command execution
- Configure resource limits and monitoring
- Set up proper error logging and recovery mechanisms

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit          # Unit tests for all agents
npm run test:integration   # Integration tests
npm run test:e2e          # End-to-end tests

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Coverage

The test suite provides comprehensive coverage for:

- **Agent Functionality**: All agent methods and capabilities
- **Error Handling**: Failure scenarios and recovery mechanisms
- **Integration**: Database operations and external service calls
- **API Endpoints**: All REST endpoints and WebSocket events
- **Orchestration**: Multi-agent coordination and task routing

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm test`)
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Development Guidelines

- Write comprehensive tests for new agents and features
- Follow existing code patterns and architecture
- Update documentation for new capabilities
- Ensure all tests pass before submitting PR
- Add environment variable documentation for new configurations

### Adding New Agents

To add a new agent to the system:

1. Create agent class extending base patterns in `src/agents/`
2. Implement required methods: `execute()`, `healthCheck()` (optional)
3. Add comprehensive unit tests in `tests/unit/`
4. Register agent in `src/agents/index.js`
5. Add API endpoint in `src/routes/index.js`
6. Update documentation and environment variables
7. Add integration tests for multi-agent scenarios

## Performance and Monitoring

### System Metrics

AthenAI provides comprehensive monitoring capabilities:

- **Agent Performance**: Response times, success rates, resource usage
- **System Health**: Database connections, memory usage, CPU load
- **API Metrics**: Endpoint response times, error rates, throughput
- **Queue Management**: Task queue depths, processing times

### Health Endpoints

- `GET /health` - Overall system health
- `GET /api/agents/status` - All agent status and metrics
- `GET /api/agents/:agentId/metrics` - Specific agent performance data

## Troubleshooting

### Common Issues

**Agent Registration Failures**:
- Verify all required environment variables are set
- Check database connectivity (Supabase, Neo4j, Redis)
- Ensure proper API key configurations

**Communication Agent Issues**:
- Verify SMTP settings and email credentials
- Test webhook URLs for Slack/Discord/Teams
- Check network connectivity and firewall settings

**Development Agent Execution Failures**:
- Ensure proper file system permissions
- Verify workspace directory exists and is writable
- Check code execution timeout settings

**Performance Issues**:
- Monitor database connection pools
- Check Redis cache hit rates
- Review agent load balancing and distribution

### Debug Mode

Enable debug logging by setting:
```bash
NODE_ENV=development
LOG_LEVEL=debug
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Additional Features

### Version Control Integration

The system includes comprehensive Git integration through the `versionControl.js` utility:

- **Repository Management**: Initialize, clone, and manage Git repositories
- **Branch Operations**: Create, switch, merge, and delete branches  
- **Commit Operations**: Stage, commit, and push changes with proper messaging
- **Remote Management**: Add, remove, and sync with remote repositories
- **History Tracking**: View commit history and file changes
- **Status Monitoring**: Check repository status and working directory changes

### Sandboxed Code Execution

The Development Agent provides secure code execution capabilities:

- **Multi-Language Support**: Execute JavaScript, Python, and other languages safely
- **Isolated Environment**: Code runs in sandboxed temporary directories
- **Timeout Protection**: Configurable execution timeouts prevent runaway processes
- **Resource Monitoring**: Track memory and CPU usage during execution
- **Error Handling**: Comprehensive error capture and reporting
- **File System Access**: Controlled file operations within sandbox boundaries

### Multi-Channel Communication

The Communication Agent supports various communication channels:

- **Email Integration**: SMTP-based email sending with template support
- **Slack Integration**: Webhook-based Slack messaging with rich formatting
- **Discord Integration**: Discord webhook support with embed capabilities
- **Microsoft Teams**: Teams webhook integration for enterprise communication
- **Message Templates**: Reusable templates with variable substitution
- **Broadcasting**: Send messages across multiple channels simultaneously

### Advanced Planning Capabilities

The Planning Agent provides sophisticated project planning:

- **Task Decomposition**: Break complex objectives into manageable subtasks
- **Resource Allocation**: Optimize human and technical resource distribution
- **Timeline Management**: Create realistic schedules with dependency tracking
- **Risk Assessment**: Identify and mitigate potential project risks
- **Critical Path Analysis**: Optimize project schedules for maximum efficiency
- **Milestone Tracking**: Define and monitor key project milestones
- **Contingency Planning**: Develop backup plans for various scenarios

### Workflow Orchestration

The Execution Agent manages complex workflow execution:

- **Command Execution**: Safe system command execution with proper error handling
- **API Integration**: HTTP client capabilities for external service integration
- **File Operations**: Comprehensive file system operations (CRUD)
- **Task Queuing**: Priority-based task queue management
- **Error Recovery**: Automatic error detection and recovery mechanisms
- **Progress Monitoring**: Real-time task progress tracking and reporting

### Quality Assurance Framework

The QA Agent provides comprehensive content validation:

- **Content Validation**: Multi-dimensional content quality assessment
- **Security Scanning**: Identify potential security vulnerabilities
- **Performance Analysis**: Evaluate performance implications of content/code
- **Consistency Checking**: Ensure consistency across documents and implementations
- **Quality Scoring**: Quantitative quality metrics with configurable standards
- **Recommendation Engine**: Generate actionable improvement suggestions

### Agent Lifecycle Management

The Agent Handlers provide sophisticated agent management:

- **Dynamic Registration**: Runtime agent registration and deregistration
- **Health Monitoring**: Continuous health checks and status reporting
- **Load Balancing**: Intelligent task distribution across available agents
- **Coordination**: Multi-agent collaboration and communication
- **Metrics Collection**: Comprehensive performance and usage analytics
- **Auto-Recovery**: Automatic agent restart and error recovery
- **Scaling**: Dynamic agent scaling based on demand

---

**AthenAI Full System v2.0** - Complete AI Agent Orchestration Platform

## Support and Community

For support and questions about AthenAI, please:
- Check the [documentation](documentation/) for detailed guides
- Review the [API reference](documentation/api/) for endpoint details
- Create an issue in the repository for bugs or feature requests
- Join our community discussions for general questions and collaboration

## Performance Monitoring

AthenAI includes comprehensive monitoring and observability features:

### System Metrics
- **Agent Performance**: Response times, success rates, resource utilization
- **API Endpoints**: Request/response metrics, error rates, throughput
- **Database Operations**: Query performance, connection pool status
- **Resource Usage**: CPU, memory, disk, and network utilization

### Health Checks
The system provides health check endpoints for monitoring:
- `/api/system/health` - Overall system health
- `/api/agents/status` - Agent system status
- `/api/database/health` - Database connectivity status

### Logging
Structured logging is implemented throughout the system with configurable log levels and formats.

## Development and Testing

### Running Tests

Execute the comprehensive test suite:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:agents

# Run tests with coverage
npm run test:coverage
```

### Development Mode

Start the system in development mode with hot reloading:

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start with specific configuration
NODE_ENV=development npm start
```

### Code Quality

The project maintains high code quality standards:
- ESLint for code linting
- Prettier for code formatting
- Jest for testing
- Comprehensive test coverage requirements

## Deployment Options

### Local Development
```bash
# Quick start
npm install
npm run dev
```

### Docker Deployment
```bash
# Build and run with Docker
docker build -t athenai .
docker run -p 3000:3000 athenai
```

### Production Deployment
```bash
# Production build
npm run build
npm start
```

## Feature Flags

AthenAI uses feature flags to enable/disable functionality and control system behavior. Configure these in your `.env` file:

### Core Agent Features
```bash
# Agent Capabilities
FEATURE_ENABLE_PLANNING=true          # Enable PlanningAgent
FEATURE_ENABLE_EXECUTION=true         # Enable ExecutionAgent  
FEATURE_ENABLE_QA=true                # Enable QualityAssuranceAgent
FEATURE_ENABLE_COMMUNICATION=true     # Enable CommunicationAgent

# AI Chat System
AI_CHAT_AGENT_ENABLED=true            # Enable AI chat interface
CONSCIOUSNESS_SUBSTRATE_ENABLED=true  # Enable knowledge substrate
INTER_AGENT_COMMUNICATION_ENABLED=true # Enable agent-to-agent communication
```

### System Infrastructure Features
```bash
# Core Infrastructure
WORKFLOW_ORCHESTRATION_ENABLED=true   # Enable workflow management
MULTI_MODEL_AI_ENABLED=true          # Enable OpenRouter multi-model support
VECTOR_SEARCH_ENABLED=true           # Enable pgvector document search
REAL_TIME_MONITORING_ENABLED=true    # Enable system monitoring
ADVANCED_ANALYTICS_ENABLED=true      # Enable analytics and insights
```

### ML Service Features
```bash
# ML Pipeline Control
ML_SERVICE_ENABLED=true              # Enable ML service
ML_TRAINING_ENABLED=true             # Enable model training
ML_BATCH_PROCESSING_ENABLED=true     # Enable batch job processing
ML_MONITORING_ENABLED=true           # Enable ML monitoring and drift detection
ML_RETRAINING_ENABLED=true           # Enable automated retraining
ML_DRIFT_DETECTION_ENABLED=true      # Enable data drift monitoring
ML_FEATURE_STORE_ENABLED=true        # Enable feature store functionality
ML_GPU_ACCELERATION_ENABLED=false    # Enable GPU acceleration (if available)
```

### Experimental Features (Disabled by Default)
```bash
# Future Capabilities
DYNAMIC_AGENT_CREATION_ENABLED=false    # Dynamic agent spawning
AUTO_SCALING_ENABLED=false              # Automatic service scaling
PREDICTIVE_ANALYTICS_ENABLED=false      # Predictive insights
QUANTUM_COMPUTING_INTEGRATION_ENABLED=false # Quantum computing support
```

### Feature Flag Usage

**Enabling Features**: Set flag to `true` in your `.env` file
```bash
FEATURE_ENABLE_PLANNING=true
```

**Disabling Features**: Set flag to `false` or comment out
```bash
FEATURE_ENABLE_PLANNING=false
# FEATURE_ENABLE_PLANNING=true
```

**Runtime Behavior**: 
- Disabled agents won't be loaded or accessible via API
- Disabled infrastructure features will skip initialization
- ML features can be selectively enabled based on your deployment needs
- Experimental features are disabled by default for stability

**Performance Impact**: Disabling unused features reduces:
- Memory usage
- Startup time  
- API surface area
- Resource consumption

## Contributing

We welcome contributions to AthenAI! Please follow these guidelines:

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure all tests pass
5. Submit a pull request

### Code Standards
- Follow existing code style and patterns
- Write comprehensive tests for new features
- Update documentation for API changes
- Use meaningful commit messages

### Testing Requirements
- Unit tests for all business logic
- Integration tests for API endpoints
- Agent-specific tests for new agent capabilities
- End-to-end tests for critical workflows

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

- **Documentation**: Comprehensive guides in `/documentation` folder
- **Issues**: Report bugs and feature requests via GitHub Issues
- **Community**: Join our discussions for help and collaboration
- **Enterprise**: Contact us for enterprise support and custom deployments

---

**AthenAI** - Intelligent Multi-Agent AI Platform with Knowledge Substrate Integration
