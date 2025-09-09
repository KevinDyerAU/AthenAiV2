# AthenAI LangChain Workflows

## Overview

This directory contains the complete production-ready implementation of the AthenAI LangChain system using n8n workflows. The system provides a comprehensive AI agent ecosystem with specialized agents, tool workflows, and full observability through LangSmith integration.

## Architecture

### Core Components

1. **Master Orchestration Agent** - Central coordination and task routing
2. **Specialized Agents** - Research, Analysis, Creative, Development, Planning, and QA agents
3. **Tool Workflows** - Web Search, Document Processing, Data Analysis, and more
4. **Infrastructure** - RabbitMQ messaging, Neo4j knowledge graph, PostgreSQL memory

### Agent Workflows

| Workflow | File | Description | Queue |
|----------|------|-------------|-------|
| Master Orchestration | `01-master-orchestration.json` | Central task coordination and routing | `agent_tasks` |
| Research Agent | `02-research-agent.json` | Information gathering and research | `research_tasks` |
| Analysis Agent | `03-analysis-agent.json` | Data analysis and pattern recognition | `analysis_tasks` |
| Creative Agent | `04-creative-agent.json` | Content synthesis and generation | `creative_tasks` |
| Development Agent | `05-development-agent.json` | Software development and code generation | `development_tasks` |
| Planning Agent | `06-planning-agent.json` | Project planning and resource allocation | `planning_tasks` |
| QA Agent | `07-qa-agent.json` | Quality assurance and validation | `qa_tasks` |

### Tool Workflows

| Tool | File | Description | Queue |
|------|------|-------------|-------|
| Web Search | `tool-01-web-search.json` | Multi-source web search with ranking | `web_search_requests` |
| Document Processor | `tool-02-document-processor.json` | Document extraction and analysis | `document_processing_requests` |
| Data Analyzer | `tool-03-data-analyzer.json` | Statistical analysis and insights | `data_analysis_requests` |

## Features

### Production-Ready Implementation
- ✅ Real API integrations (OpenAI, SerpAPI, Bing Search, etc.)
- ✅ Comprehensive error handling and fallback mechanisms
- ✅ Full LangSmith tracing and observability
- ✅ Secure credential management via n8n credentials system
- ✅ Neo4j knowledge graph integration
- ✅ PostgreSQL memory persistence
- ✅ RabbitMQ message queuing

### AI Capabilities
- ✅ Multi-agent orchestration with intelligent task routing
- ✅ Advanced research with source validation and ranking
- ✅ Statistical analysis with pattern recognition
- ✅ Creative content synthesis with quality assessment
- ✅ Software development with architecture design
- ✅ Project planning with risk assessment
- ✅ Quality assurance with automated testing

### Observability
- ✅ LangSmith integration for all agents and tools
- ✅ Comprehensive logging and metrics
- ✅ Performance monitoring and quality scoring
- ✅ Neo4j relationship tracking
- ✅ PostgreSQL audit trails

## Prerequisites

### Required Services
- n8n (with LangChain Code Node support)
- OpenAI API access
- LangSmith account (optional but recommended)
- Neo4j database
- PostgreSQL database
- RabbitMQ message broker

### API Keys Required
- `OPENAI_API_KEY` - OpenAI API access
- `LANGCHAIN_API_KEY` - LangSmith tracing (optional)
- `SERPAPI_API_KEY` - Google search via SerpAPI (optional)
- `BING_SEARCH_API_KEY` - Bing search API (optional)
- `NEWS_API_KEY` - News search API (optional)

### n8n Credentials Setup
Configure the following credentials in n8n:
- `openAi` - OpenAI API key
- `langSmith` - LangSmith API key
- `serpApi` - SerpAPI key
- `bingSearch` - Bing Search API key
- `newsApi` - News API key

## Installation

### 1. Deploy Infrastructure
```bash
# Deploy the full stack including n8n, Neo4j, PostgreSQL, RabbitMQ
./deploy-local.sh
```

### 2. Import Workflows
The workflows will be automatically imported during deployment. To manually import:
```bash
# Load all workflows from this directory
./scripts/deploy/load-workflows.sh
```

### 3. Configure Environment
Ensure your `.env` file contains:
```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# LangSmith Configuration (Optional)
LANGCHAIN_API_KEY=your_langsmith_api_key
LANGCHAIN_PROJECT=athenai-production
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
LANGCHAIN_TRACING_V2=true

# Search APIs (Optional)
SERPAPI_API_KEY=your_serpapi_key
BING_SEARCH_API_KEY=your_bing_api_key
NEWS_API_KEY=your_news_api_key

# Database Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=athenai
POSTGRES_USER=athenai
POSTGRES_PASSWORD=your_postgres_password

# RabbitMQ Configuration
RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_USER=athenai
RABBITMQ_PASSWORD=your_rabbitmq_password
```

## Usage

### Starting a Task
Send a POST request to the Master Orchestration webhook:
```bash
curl -X POST http://localhost:5678/webhook/master/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Research the latest trends in AI and create a comprehensive report",
    "sessionId": "session_123",
    "userId": "user_456"
  }'
```

### Workflow Execution Flow
1. **Master Orchestration** receives the request and analyzes complexity
2. **Task Routing** determines which agents are needed
3. **Agent Execution** runs specialized agents in sequence or parallel
4. **Tool Integration** agents call tool workflows as needed
5. **Quality Assurance** validates outputs before final delivery
6. **Response Synthesis** creates final comprehensive response

### Monitoring
- **LangSmith Dashboard**: Monitor all agent executions and performance
- **n8n Dashboard**: View workflow executions and debug issues
- **Neo4j Browser**: Explore knowledge graph relationships
- **PostgreSQL**: Query historical data and audit trails

## Configuration

### Agent Behavior
Each agent can be configured by modifying the respective workflow file:
- Temperature settings for creativity vs consistency
- Tool selection and availability
- Quality thresholds and validation rules
- Routing logic and collaboration patterns

### Tool Integration
Tools can be enabled/disabled by configuring API keys:
- Web search tools require SerpAPI or Bing API keys
- Document processing supports multiple formats
- Data analysis includes statistical and AI-powered insights

### Observability
LangSmith integration provides:
- Detailed execution traces for all agents
- Performance metrics and quality scores
- Error tracking and debugging information
- Cost analysis and usage statistics

## Database Schema

### Neo4j Relationships
```cypher
// Core entities and relationships
(User)-[:OWNS_SESSION]->(Session)
(Session)-[:HAS_ORCHESTRATION]->(Orchestration)
(Orchestration)-[:GENERATED_RESEARCH]->(ResearchReport)
(Orchestration)-[:GENERATED_ANALYSIS]->(AnalysisReport)
(Orchestration)-[:GENERATED_RESPONSE]->(CreativeResponse)
(ResearchReport)-[:CITES]->(Source)
```

### PostgreSQL Tables
- `orchestration_memory` - Master orchestration history
- `research_reports` - Research agent outputs
- `analysis_reports` - Analysis agent results
- `creative_responses` - Creative agent outputs
- `development_solutions` - Development agent deliverables
- `project_plans` - Planning agent plans
- `qa_reports` - QA agent assessments

## Troubleshooting

### Common Issues

#### 1. OpenAI API Errors
```
Error: 401 Unauthorized
```
**Solution**: Verify `OPENAI_API_KEY` is correctly set in n8n credentials or environment variables.

#### 2. LangSmith Connection Issues
```
Warning: LangSmith tracing disabled
```
**Solution**: Check `LANGCHAIN_API_KEY` and ensure LangSmith project exists.

#### 3. Search Tool Failures
```
Error: No search results available
```
**Solution**: Configure at least one search API (SerpAPI, Bing, or use DuckDuckGo fallback).

#### 4. Database Connection Errors
```
Error: Neo4j connection failed
```
**Solution**: Verify database services are running and connection strings are correct.

### Debug Mode
Enable verbose logging by setting:
```env
N8N_LOG_LEVEL=debug
LANGCHAIN_VERBOSE=true
```

### Performance Optimization
- Adjust agent temperature settings for speed vs quality trade-offs
- Configure tool timeouts to prevent hanging executions
- Use LangSmith metrics to identify bottlenecks
- Optimize database queries for large datasets

## Development

### Adding New Agents
1. Create new workflow file following naming convention
2. Implement agent logic with proper error handling
3. Add LangSmith tracing configuration
4. Update routing logic in Master Orchestration
5. Add database schema updates if needed

### Adding New Tools
1. Create tool workflow with standardized interface
2. Implement tool-specific logic and API integrations
3. Add proper input validation and error handling
4. Update agent workflows to use new tool
5. Document API requirements and configuration

### Testing
- Use n8n's test execution feature for individual workflows
- Monitor LangSmith traces for execution quality
- Validate outputs against expected formats
- Test error handling with invalid inputs

## Security Considerations

### API Key Management
- Use n8n credentials system for sensitive keys
- Rotate API keys regularly
- Monitor API usage and costs
- Implement rate limiting where appropriate

### Data Privacy
- Sanitize inputs to prevent injection attacks
- Encrypt sensitive data in databases
- Implement proper access controls
- Log security events for audit trails

### Network Security
- Use HTTPS for all external API calls
- Implement proper firewall rules
- Secure database connections with TLS
- Monitor network traffic for anomalies

## Support and Maintenance

### Regular Maintenance
- Monitor API usage and costs
- Update dependencies and security patches
- Review and optimize workflow performance
- Backup databases and configuration

### Monitoring Alerts
Set up alerts for:
- High error rates in workflows
- API quota exhaustion
- Database connection failures
- Unusual execution times

### Documentation Updates
Keep documentation current with:
- New workflow additions
- Configuration changes
- API updates and deprecations
- Performance optimization findings

## License

This implementation is part of the AthenAI project. Please refer to the main project license for usage terms and conditions.

## Contributing

1. Follow the established workflow patterns
2. Include comprehensive error handling
3. Add LangSmith tracing to new components
4. Update documentation for changes
5. Test thoroughly before deployment

---

For additional support or questions, please refer to the main AthenAI documentation or contact the development team.
