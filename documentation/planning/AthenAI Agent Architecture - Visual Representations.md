# AthenAI Agent Architecture - Visual Representations

## 1. Overall Agent Ecosystem Architecture

```mermaid
graph TB
    subgraph "User Interface Layer"
        UI[Chat Interface]
        API[REST API Gateway]
        WS[WebSocket Server]
    end
    
    subgraph "Core Orchestration"
        COORD[Enhanced Chat Coordinator<br/>🎯 Main Entry Point]
        MASTER[Master Orchestration Agent<br/>🧠 Task Delegation & Planning]
    end
    
    subgraph "Specialized Agent Layer"
        RESEARCH[Research Agent<br/>🔍 Information Gathering]
        ANALYSIS[Analysis Agent<br/>📊 Data Processing]
        CREATIVE[Creative Agent<br/>🎨 Content Creation]
        TECHNICAL[Technical Agent<br/>⚙️ Code & Development]
        COMM[Communication Agent<br/>📢 External Communications]
        PLANNING[Planning Agent<br/>📋 Project Management]
        QA[Quality Assurance Agent<br/>✅ Testing & Validation]
        EXEC[Execution Agent<br/>🚀 Task Execution]
    end
    
    subgraph "Tool Ecosystem"
        RT[Research Tools<br/>Web Search, Academic Search, Content Analysis]
        AT[Analysis Tools<br/>Data Visualization, Statistical Analysis]
        CT[Creative Tools<br/>Content Generation, Style Management, S3 Storage]
        DT[Development Tools<br/>Code Generation, Deployment, Testing]
        PT[Planning Tools<br/>Resource Allocation, Timeline Optimization]
        QT[QA Tools<br/>Automated Testing, Compliance Checking]
        ET[Execution Tools<br/>Error Recovery, Parallel Processing]
        COMT[Communication Tools<br/>Email Delivery, Social Media]
    end
    
    subgraph "Infrastructure Layer"
        NEO4J[(Neo4j Knowledge Graph<br/>Consciousness Substrate)]
        POSTGRES[(PostgreSQL<br/>Session & Agent Data)]
        RABBITMQ[RabbitMQ<br/>Message Queue]
        REDIS[(Redis Cache)]
    end
    
    subgraph "External Services"
        OPENAI[OpenAI API]
        GOOGLE[Google APIs]
        BING[Bing Search API]
        SCHOLAR[Semantic Scholar]
    end
    
    %% User Interface Connections
    UI --> API
    UI --> WS
    API --> COORD
    WS --> COORD
    
    %% Core Orchestration Flow
    COORD --> MASTER
    MASTER --> RESEARCH
    MASTER --> ANALYSIS
    MASTER --> CREATIVE
    MASTER --> TECHNICAL
    MASTER --> COMM
    MASTER --> PLANNING
    MASTER --> QA
    MASTER --> EXEC
    
    %% Agent-Tool Connections
    RESEARCH --> RT
    ANALYSIS --> AT
    CREATIVE --> CT
    TECHNICAL --> DT
    PLANNING --> PT
    QA --> QT
    EXEC --> ET
    COMM --> COMT
    
    %% Infrastructure Connections
    COORD --> POSTGRES
    MASTER --> NEO4J
    RESEARCH --> NEO4J
    ANALYSIS --> NEO4J
    CREATIVE --> NEO4J
    TECHNICAL --> NEO4J
    
    MASTER --> RABBITMQ
    RESEARCH --> RABBITMQ
    ANALYSIS --> RABBITMQ
    CREATIVE --> RABBITMQ
    TECHNICAL --> RABBITMQ
    
    %% External Service Connections
    RT --> GOOGLE
    RT --> BING
    RT --> SCHOLAR
    RESEARCH --> OPENAI
    ANALYSIS --> OPENAI
    CREATIVE --> OPENAI
    TECHNICAL --> OPENAI
    MASTER --> OPENAI
    
    %% Styling
    classDef userLayer fill:#e1f5fe
    classDef orchestration fill:#f3e5f5
    classDef agents fill:#e8f5e8
    classDef tools fill:#fff3e0
    classDef infrastructure fill:#fce4ec
    classDef external fill:#f1f8e9
    
    class UI,API,WS userLayer
    class COORD,MASTER orchestration
    class RESEARCH,ANALYSIS,CREATIVE,TECHNICAL,COMM,PLANNING,QA,EXEC agents
    class RT,AT,CT,DT,PT,QT,ET,COMT tools
    class NEO4J,POSTGRES,RABBITMQ,REDIS infrastructure
    class OPENAI,GOOGLE,BING,SCHOLAR external
```

## 2. Agent Communication Flow

```mermaid
sequenceDiagram
    participant User
    participant ChatCoord as Enhanced Chat Coordinator
    participant Master as Master Orchestration Agent
    participant Research as Research Agent
    participant Analysis as Analysis Agent
    participant Creative as Creative Agent
    participant Neo4j as Neo4j Knowledge Graph
    participant RabbitMQ as Message Queue
    
    User->>ChatCoord: Send message via WebSocket/API
    ChatCoord->>ChatCoord: Normalize input & manage session
    ChatCoord->>Master: Delegate task with context
    
    Master->>Master: Analyze request using Think Tool
    Master->>Neo4j: Query existing knowledge context
    Neo4j-->>Master: Return relevant context
    
    Master->>Master: Plan delegation strategy
    Master->>RabbitMQ: Publish task to research queue
    Master->>RabbitMQ: Publish task to analysis queue
    
    RabbitMQ-->>Research: Consume research task
    RabbitMQ-->>Analysis: Consume analysis task
    
    par Research Activities
        Research->>Research: Execute web search tools
        Research->>Research: Execute academic search tools
        Research->>Neo4j: Store research findings
    and Analysis Activities
        Analysis->>Analysis: Execute data analysis tools
        Analysis->>Analysis: Execute visualization tools
        Analysis->>Neo4j: Store analysis results
    end
    
    Research->>RabbitMQ: Publish research results
    Analysis->>RabbitMQ: Publish analysis results
    
    RabbitMQ-->>Master: Consume agent results
    Master->>Master: Synthesize results
    Master->>Creative: Request content generation
    Creative->>Creative: Generate final response
    Creative->>Neo4j: Store conversation context
    
    Master->>ChatCoord: Return synthesized response
    ChatCoord->>User: Send response via WebSocket/API
```

## 3. Tool Integration Architecture

```mermaid
graph LR
    subgraph "Agent Layer"
        A1[Research Agent]
        A2[Analysis Agent]
        A3[Creative Agent]
        A4[Development Agent]
    end
    
    subgraph "Tool Orchestration"
        TO[Tool Orchestrator<br/>n8n Workflows]
    end
    
    subgraph "Research Tools"
        RT1[Web Search Tool<br/>Google + Bing APIs]
        RT2[Academic Search Tool<br/>Semantic Scholar API]
        RT3[Content Analysis Tool<br/>NLP Processing]
    end
    
    subgraph "Analysis Tools"
        AT1[Data Visualization Tool<br/>Chart Generation]
        AT2[Statistical Analysis Tool<br/>Statistical Computing]
    end
    
    subgraph "Creative Tools"
        CT1[Content Generation Tool<br/>GPT-based Creation]
        CT2[Style Management Tool<br/>Brand Guidelines]
        CT3[S3 Storage Tool<br/>Asset Management]
    end
    
    subgraph "Development Tools"
        DT1[Code Generation Tool<br/>Multi-language Support]
        DT2[Deployment Automation Tool<br/>CI/CD Pipeline]
        DT3[Testing Automation Tool<br/>Automated QA]
    end
    
    A1 --> TO
    A2 --> TO
    A3 --> TO
    A4 --> TO
    
    TO --> RT1
    TO --> RT2
    TO --> RT3
    TO --> AT1
    TO --> AT2
    TO --> CT1
    TO --> CT2
    TO --> CT3
    TO --> DT1
    TO --> DT2
    TO --> DT3
    
    classDef agents fill:#e8f5e8
    classDef orchestrator fill:#f3e5f5
    classDef tools fill:#fff3e0
    
    class A1,A2,A3,A4 agents
    class TO orchestrator
    class RT1,RT2,RT3,AT1,AT2,CT1,CT2,CT3,DT1,DT2,DT3 tools
```

## 4. Knowledge Graph Integration

```mermaid
graph TB
    subgraph "Agent Interactions"
        AGENTS[All Specialized Agents]
    end
    
    subgraph "Neo4j Consciousness Substrate"
        subgraph "Knowledge Entities"
            CONCEPTS[Concepts & Facts]
            INSIGHTS[Generated Insights]
            CONTEXT[Contextual Information]
        end
        
        subgraph "Relationships"
            SEMANTIC[Semantic Connections]
            TEMPORAL[Temporal Relationships]
            CAUSAL[Causal Links]
        end
        
        subgraph "Memory Systems"
            SHORTTERM[Short-term Memory<br/>Active Context]
            LONGTERM[Long-term Memory<br/>Persistent Knowledge]
            EPISODIC[Episodic Memory<br/>Conversation History]
        end
    end
    
    subgraph "Vector Embeddings"
        EMBEDDINGS[OpenAI Embeddings]
        SIMILARITY[Similarity Search]
        CLUSTERING[Concept Clustering]
    end
    
    AGENTS --> CONCEPTS
    AGENTS --> INSIGHTS
    AGENTS --> CONTEXT
    
    CONCEPTS --> SEMANTIC
    INSIGHTS --> TEMPORAL
    CONTEXT --> CAUSAL
    
    SEMANTIC --> SHORTTERM
    TEMPORAL --> LONGTERM
    CAUSAL --> EPISODIC
    
    CONCEPTS --> EMBEDDINGS
    EMBEDDINGS --> SIMILARITY
    SIMILARITY --> CLUSTERING
    
    CLUSTERING --> AGENTS
    LONGTERM --> AGENTS
    EPISODIC --> AGENTS
```

## 5. n8n Workflow Execution Pattern

```mermaid
graph TD
    subgraph "Webhook Triggers"
        WH1[Agent Webhook Endpoint]
        WH2[Tool Webhook Endpoint]
    end
    
    subgraph "Input Processing"
        NORM[Normalize Input]
        VALIDATE[Validate Parameters]
    end
    
    subgraph "Core Processing"
        AI[AI Agent Node<br/>OpenAI Integration]
        THINK[Think Tool Integration]
        FUNC[Custom Function Nodes]
    end
    
    subgraph "External Integrations"
        API1[External API Calls]
        DB[Database Operations]
        QUEUE[Message Queue Operations]
    end
    
    subgraph "Output Processing"
        FORMAT[Format Response]
        STORE[Store Results]
        RESPOND[Send Response]
    end
    
    WH1 --> NORM
    WH2 --> NORM
    NORM --> VALIDATE
    VALIDATE --> AI
    AI --> THINK
    THINK --> FUNC
    FUNC --> API1
    FUNC --> DB
    FUNC --> QUEUE
    API1 --> FORMAT
    DB --> FORMAT
    QUEUE --> FORMAT
    FORMAT --> STORE
    STORE --> RESPOND
    
    classDef webhook fill:#e1f5fe
    classDef processing fill:#e8f5e8
    classDef integration fill:#fff3e0
    classDef output fill:#f3e5f5
    
    class WH1,WH2 webhook
    class NORM,VALIDATE,AI,THINK,FUNC processing
    class API1,DB,QUEUE integration
    class FORMAT,STORE,RESPOND output
```

