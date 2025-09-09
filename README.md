# AthenAI — Full AI Agent Orchestration Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 18+](https://img.shields.io/badge/node.js-18+-green.svg)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-blue.svg)](https://socket.io/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-lightgrey.svg)](https://expressjs.com/)

> **A comprehensive AI agent orchestration platform with full agent capabilities, real-time communication, advanced planning, execution management, and quality assurance.**

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [WebSocket Events](#websocket-events)
- [Configuration](#configuration)
- [Development](#development)
- [Deployment](#deployment)
- [Contributing](#contributing)

## Overview

AthenAI is a comprehensive AI agent orchestration platform built with Node.js and Express.js. It provides real-time chat capabilities through WebSocket connections, intelligent multi-agent coordination, and advanced AI operations. The system features a full suite of specialized agents including Development, Communication, Planning, Execution, and Quality Assurance agents, all managed through sophisticated orchestration and lifecycle management.

Built for enterprise-scale operations, AthenAI integrates with modern cloud services including Supabase (PostgreSQL), Neo4j (knowledge graph), and Redis (caching) to provide a robust foundation for complex AI-powered workflows and autonomous agent collaboration.

## Features

✨ **Real-time Chat Interface** - WebSocket-powered chat with AI agents  
🤖 **Full Agent Suite** - Development, Communication, Planning, Execution, and QA agents  
🎯 **Master Orchestration** - Intelligent task routing and multi-agent coordination  
🧠 **Knowledge Graph Integration** - Neo4j-powered relationship mapping and context storage  
💾 **Multi-Database Support** - Supabase (PostgreSQL), Neo4j, and Redis integration  
🔧 **Development Tools** - Code generation, project setup, sandboxed execution  
📡 **Communication Hub** - Multi-channel messaging (Email, Slack, Discord, Teams)  
📋 **Advanced Planning** - Task breakdown, timeline creation, resource allocation  
⚡ **Execution Management** - Workflow orchestration, command execution, API calls  
🔍 **Quality Assurance** - Content validation, security assessment, performance evaluation  
🔄 **Agent Lifecycle** - Registration, health monitoring, load balancing, coordination  
🛠️ **Version Control** - Git integration with comprehensive repository management  
🔒 **Enterprise Security** - Rate limiting, error handling, and comprehensive logging  
📊 **Performance Monitoring** - Built-in metrics and health monitoring

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- API keys for OpenAI, Supabase, Neo4j, and Redis

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd AthenAi

# Install dependencies
npm install

# Configure environment
cp .env.simplified.example .env
# Edit .env with your API keys

# Start the server
npm run dev
```

### Access the Application

- **Main Portal**: http://localhost:3000/
- **Chat Interface**: http://localhost:3000/public/chat.html
- **API Health**: http://localhost:3000/health

## Architecture

AthenAI uses a simplified, cost-optimized architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │  Express.js API │    │ Master          │
│                 │◄──►│                 │◄──►│ Orchestrator    │
│ • Chat UI       │    │ • REST Routes   │    │                 │
│ • Portal        │    │ • WebSocket     │    └─────────────────┘
└─────────────────┘    └─────────────────┘              │
                                │                        ▼
                                │              ┌─────────────────┐
                                │              │ Agent Handlers  │
                                │              │ • Registration  │
                                │              │ • Lifecycle     │
                                │              │ • Coordination  │
                                │              └─────────────────┘
                                │                        │
                                ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Supabase      │    │     Neo4j       │    │  Specialized    │
│   (PostgreSQL)  │    │ (Knowledge Graph│    │    Agents       │
│                 │    │                 │    │ • Development   │
└─────────────────┘    └─────────────────┘    │ • Communication │
                                │              │ • Planning      │
                       ┌─────────────────┐    │ • Execution     │
                       │     Redis       │    │ • Quality Assur │
                       │   (Caching)     │    └─────────────────┘
                       │                 │
                       └─────────────────┘
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

