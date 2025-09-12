# AthenAI Agent Architecture Documentation

## Overview

AthenAI employs a sophisticated multi-agent architecture with intelligent routing through the MasterOrchestrator. Each agent is specialized for specific domains and equipped with LangChain-powered tools and capabilities.

## Agent Routing System

The **MasterOrchestrator** uses AI-powered semantic analysis to route messages to the most appropriate agent based on:

1. **Primary Intent Analysis**: What is the main goal of the message?
2. **Expertise Requirements**: What type of specialized knowledge is needed?
3. **Tool Requirements**: What capabilities and tools would be most useful?
4. **Core Competency Alignment**: Which agent's strengths best match the requirements?

### Routing Prompt Template

```
You are an intelligent agent router for AthenAI. Analyze the following message and determine which specialized agent should handle it.

Available Agents:
- research: For information gathering, fact-finding, data analysis, answering questions
- creative: For creative writing, brainstorming, design ideas, artistic content
- analysis: For data analysis, problem-solving, logical reasoning, technical analysis
- development: For coding, programming, technical implementation, software development
- planning: For project planning, task breakdown, timeline creation, resource allocation
- execution: For task execution, workflow management, process automation
- communication: For message formatting, external communications, notifications
- qa: For quality assurance, validation, testing, review processes
- document: For document processing, upload, search, analysis, and email attachments
- general: For casual conversation, greetings, simple questions

STEP-BY-STEP ANALYSIS:
1. What is the primary intent and goal of the message?
2. What type of expertise is needed?
3. What tools and capabilities would be most useful?
4. Which agent's core competencies align best with these requirements?

Think through your reasoning, then respond with ONLY the agent name.
```

## Agent Specifications

| Agent | Classification | Primary Role | Key Tools | Prompt Focus |
|-------|---------------|--------------|-----------|--------------|
| **ResearchAgent** | Information Gathering | Research, fact-finding, data collection | `knowledge_synthesis`, `fact_verification`, `research_planning`, `web_search` | Comprehensive research with knowledge substrate integration |
| **AnalysisAgent** | Data Processing | Statistical analysis, pattern detection, logical reasoning | `statistical_analysis`, `pattern_detection`, `correlation_analysis`, `trend_analysis`, `github_repository_analysis` | Deep analytical thinking with statistical rigor |
| **CreativeAgent** | Content Creation | Creative writing, brainstorming, artistic content | `content_structuring`, `tone_adaptation`, `engagement_optimization`, `creative_synthesis` | Creative synthesis with artistic flair |
| **DevelopmentAgent** | Technical Implementation | Coding, programming, software development | `code_generation`, `architecture_design`, `technical_implementation`, `github_integration` | Technical excellence with best practices |
| **PlanningAgent** | Project Management | Project planning, task breakdown, resource allocation | `project_planning`, `task_breakdown`, `timeline_creation`, `resource_allocation` | Strategic planning with structured methodology |
| **ExecutionAgent** | Task Management | Workflow execution, process automation | `task_execution`, `workflow_management`, `process_automation`, `status_tracking` | Efficient execution with progress monitoring |
| **CommunicationAgent** | External Relations | Message formatting, communications, notifications | `message_formatting`, `external_communications`, `notification_management`, `channel_optimization` | Clear communication with audience awareness |
| **QualityAssuranceAgent** | Validation & Testing | Quality assessment, validation, testing, review | `quality_assessment`, `validation_testing`, `review_processes`, `web_verification`, `reference_validation` | Comprehensive QA with web-verified fact-checking |
| **DocumentAgent** | Document Management | Document processing, search, analysis | `document_upload`, `semantic_search`, `document_status`, `summary_extraction`, `email_attachment_processing` | Document intelligence with semantic search |
| **MasterOrchestrator** | Routing & Coordination | Agent selection, task complexity analysis | `ai_routing`, `complexity_analysis`, `fallback_routing` | Intelligent routing with semantic understanding |

## Detailed Agent Specifications

### ResearchAgent
- **Classification**: Information Gathering & Knowledge Synthesis
- **Core Capabilities**: Web research, knowledge substrate integration, semantic similarity caching
- **LangChain Tools**:
  - `knowledge_synthesis`: Combines multiple sources into coherent insights
  - `fact_verification`: Validates information accuracy across sources
  - `research_planning`: Creates structured research methodologies
  - `web_search`: Enhanced web search with knowledge context
- **Prompt Strategy**: "Comprehensive research with knowledge substrate integration for continuous learning"
- **Knowledge Integration**: Two-tier caching (exact hash + semantic similarity)
- **Output Format**: Structured research findings with confidence scores

### AnalysisAgent
- **Classification**: Data Processing & Statistical Analysis
- **Core Capabilities**: Statistical analysis, pattern detection, trend identification
- **LangChain Tools**:
  - `statistical_analysis`: Performs comprehensive statistical computations
  - `pattern_detection`: Identifies patterns and anomalies in data
  - `correlation_analysis`: Finds relationships between variables
  - `trend_analysis`: Analyzes temporal trends and forecasting
  - `github_repository_analysis`: Specialized GitHub data analysis
- **Prompt Strategy**: "Deep analytical thinking with statistical rigor and evidence-based conclusions"
- **Knowledge Integration**: Analysis insights caching with domain classification
- **Output Format**: Executive summary, key findings, statistical analysis, recommendations

### CreativeAgent
- **Classification**: Content Creation & Artistic Synthesis
- **Core Capabilities**: Creative writing, brainstorming, content structuring
- **LangChain Tools**:
  - `content_structuring`: Organizes content for maximum impact
  - `tone_adaptation`: Adjusts tone for target audience
  - `engagement_optimization`: Enhances content engagement
  - `creative_synthesis`: Combines ideas into novel concepts
- **Prompt Strategy**: "Creative synthesis with artistic flair and audience engagement"
- **Output Format**: Structured creative content with engagement metrics

### DevelopmentAgent
- **Classification**: Technical Implementation & Software Development
- **Core Capabilities**: Code generation, architecture design, technical implementation
- **LangChain Tools**:
  - `code_generation`: Generates production-ready code
  - `architecture_design`: Creates system architecture plans
  - `technical_implementation`: Implements technical solutions
  - `github_integration`: Integrates with GitHub repositories
- **Prompt Strategy**: "Technical excellence with best practices and maintainable code"
- **Output Format**: Code implementations, architecture diagrams, technical documentation

### PlanningAgent
- **Classification**: Project Management & Strategic Planning
- **Core Capabilities**: Project planning, task breakdown, resource allocation
- **LangChain Tools**:
  - `project_planning`: Creates comprehensive project plans
  - `task_breakdown`: Decomposes complex tasks into manageable units
  - `timeline_creation`: Develops realistic project timelines
  - `resource_allocation`: Optimizes resource distribution
- **Prompt Strategy**: "Strategic planning with structured methodology and risk assessment"
- **Output Format**: Project plans, task hierarchies, timelines, resource maps

### ExecutionAgent
- **Classification**: Task Management & Process Automation
- **Core Capabilities**: Workflow execution, process automation, status tracking
- **LangChain Tools**:
  - `task_execution`: Executes defined tasks and workflows
  - `workflow_management`: Manages complex workflow processes
  - `process_automation`: Automates repetitive processes
  - `status_tracking`: Monitors execution progress and status
- **Prompt Strategy**: "Efficient execution with progress monitoring and adaptive optimization"
- **Output Format**: Execution reports, progress metrics, completion status

### CommunicationAgent
- **Classification**: External Relations & Message Optimization
- **Core Capabilities**: Message formatting, external communications, notifications
- **LangChain Tools**:
  - `message_formatting`: Formats messages for different channels
  - `external_communications`: Manages external stakeholder communications
  - `notification_management`: Handles notification systems
  - `channel_optimization`: Optimizes content for specific channels
- **Prompt Strategy**: "Clear communication with audience awareness and channel optimization"
- **Output Format**: Formatted messages, communication plans, notification schedules

### QualityAssuranceAgent
- **Classification**: Validation & Testing Excellence
- **Core Capabilities**: Quality assessment, validation testing, web verification
- **LangChain Tools**:
  - `quality_assessment`: Comprehensive quality evaluation
  - `validation_testing`: Systematic validation processes
  - `review_processes`: Structured review methodologies
  - `web_verification`: Web-based fact checking and verification
  - `reference_validation`: Validates citations and references
- **Prompt Strategy**: "Comprehensive QA with web-verified fact-checking and systematic validation"
- **Knowledge Integration**: QA insights caching with quality metrics
- **Output Format**: Quality reports, validation results, improvement recommendations

### DocumentAgent
- **Classification**: Document Intelligence & Semantic Search
- **Core Capabilities**: Document processing, semantic search, email attachments
- **LangChain Tools**:
  - `document_upload`: Processes and uploads documents
  - `semantic_search`: Performs semantic search across documents
  - `document_status`: Tracks document processing status
  - `summary_extraction`: Generates document summaries
  - `email_attachment_processing`: Processes email attachments
- **Prompt Strategy**: "Document intelligence with semantic search and comprehensive analysis"
- **Integration**: Unstructured.io processing with pgvector semantic search
- **Output Format**: Document metadata, search results, processing status

## Knowledge Substrate Integration

### Two-Tier Caching Strategy
1. **Tier 1**: Fast exact hash matching for identical queries
2. **Tier 2**: Semantic similarity matching on domain-filtered datasets

### Domain Classification
- `ai`: Artificial intelligence and machine learning topics
- `software`: Software development and programming
- `security`: Security, privacy, and compliance topics
- `performance`: Performance optimization and monitoring
- `data`: Data analysis and database topics
- `general`: General knowledge and miscellaneous topics

### Semantic Similarity Matching
- Uses Jaccard, Cosine, and Levenshtein similarity metrics
- Configurable similarity thresholds per agent type
- Automatic pattern extraction and insight storage

## Configuration & Environment

### OpenRouter Integration
All agents support OpenRouter for multi-model AI access:
```javascript
USE_OPENROUTER=true
OPENROUTER_API_KEY=your_key
OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free
OPENROUTER_TEMPERATURE=0.1
```

### Fallback Configuration
Automatic fallback to OpenAI if OpenRouter fails:
```javascript
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4
OPENAI_TEMPERATURE=0.1
```

### Progress Broadcasting
Real-time WebSocket progress updates for all agent operations:
- Phase tracking (planning, execution, evaluation, completion)
- Progress percentages (0-100)
- Detailed status messages
- Error handling and recovery

## Agent Lifecycle

1. **Initialization**: Agent setup with LLM configuration and tools
2. **Strategic Planning**: ReasoningFramework creates execution strategy
3. **Tool Execution**: LangChain AgentExecutor runs specialized tools
4. **Self-Evaluation**: Quality assessment and confidence scoring
5. **Knowledge Storage**: Results stored in knowledge substrate
6. **Progress Broadcasting**: Real-time updates via WebSocket

## Error Handling & Fallbacks

- **API Timeouts**: 8-second timeout with graceful degradation
- **Model Failures**: Automatic fallback from OpenRouter to OpenAI
- **Tool Errors**: Comprehensive error logging and recovery
- **Knowledge Substrate**: Graceful degradation if database unavailable
- **Test Environment**: Mock responses for testing scenarios

## Performance Optimization

- **Caching**: Multi-level caching (exact hash, semantic similarity, web search)
- **Connection Pooling**: Efficient database connection management
- **Async Processing**: Non-blocking operations with progress tracking
- **Resource Management**: Automatic cleanup and memory optimization
- **Rate Limiting**: Built-in rate limiting for external API calls

---

*This documentation reflects the current AthenAI agent architecture as of the latest system update. All agents are production-ready with comprehensive error handling, knowledge integration, and real-time progress tracking.*
