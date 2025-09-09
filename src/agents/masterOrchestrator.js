// Master Orchestrator Agent - Extracted Logic
const { ChatOpenAI } = require("@langchain/openai");
const { AgentExecutor, createOpenAIFunctionsAgent } = require("langchain/agents");
const { DynamicTool } = require("@langchain/core/tools");
const { PromptTemplate } = require("@langchain/core/prompts");

class MasterOrchestrator {
  constructor(apiKey, langSmithConfig = {}) {
    this.apiKey = apiKey;
    this.langSmithConfig = langSmithConfig;
    this.setupLangSmith();
  }

  setupLangSmith() {
    if (this.langSmithConfig.enabled) {
      process.env.LANGCHAIN_TRACING_V2 = "true";
      process.env.LANGCHAIN_PROJECT = this.langSmithConfig.project || "athenai-master-orchestrator";
      process.env.LANGCHAIN_ENDPOINT = this.langSmithConfig.endpoint || "https://api.smith.langchain.com";
    }
  }

  async executeOrchestration(inputData) {
    try {
      const originalMessage = inputData.message;
      const sessionId = inputData.sessionId || 'default_session';
      const userId = inputData.userId || 'anonymous';
      
      if (!originalMessage) {
        throw new Error('Message is required for orchestration');
      }

      // Initialize OpenAI
      const llm = new ChatOpenAI({
        modelName: "gpt-4",
        temperature: 0.2,
        openAIApiKey: this.apiKey,
        tags: ["master-orchestrator", "athenai"]
      });

      // Create orchestration prompt
      const orchestrationPrompt = this.createOrchestrationPrompt();

      // Get orchestration plan from OpenAI
      const response = await llm.invoke(orchestrationPrompt.format({
        originalMessage: originalMessage,
        sessionId: sessionId
      }));

      let orchestrationPlan;
      
      try {
        orchestrationPlan = JSON.parse(response.content);
      } catch (e) {
        orchestrationPlan = this.createDefaultPlan(originalMessage, sessionId);
      }

      // Validate and enhance plan
      const taskComplexity = this.analyzeTaskComplexity(originalMessage);
      const agentRouting = this.determineAgentRouting(originalMessage, taskComplexity);
      
      // Update plan based on analysis
      orchestrationPlan.plan = this.createDetailedPlan(originalMessage, taskComplexity, agentRouting);
      orchestrationPlan.primary_agent = agentRouting.primary;
      orchestrationPlan.collaborators = agentRouting.collaborators;
      orchestrationPlan.metadata.complexity = taskComplexity.level;
      orchestrationPlan.metadata.estimated_duration = taskComplexity.estimatedDuration;

      // Create execution context
      const executionContext = this.createExecutionContext(orchestrationPlan, originalMessage, sessionId, userId);

      return {
        orchestration: orchestrationPlan,
        execution_context: executionContext,
        routing: {
          queue: orchestrationPlan.queue,
          priority: orchestrationPlan.metadata.priority || "normal"
        },
        neo4j_context: this.createNeo4jContext(sessionId, userId, originalMessage),
        memory: {
          upsert: true,
          keys: ["message", "timestamp", "session_id", "user_id"]
        },
        metadata: orchestrationPlan.metadata,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return this.createErrorResponse(error);
    }
  }

  createOrchestrationPrompt() {
    return PromptTemplate.fromTemplate(`You are the Master Orchestration Agent for AthenAI. Analyze this user request and create a detailed execution plan.

User Request: "{originalMessage}"

Respond with valid JSON containing:
- plan: array of execution steps
- primary_agent: string (research/analysis/creative/development/planning/qa)
- collaborators: array of supporting agents
- queue: string (agent_tasks)
- metadata: object with complexity, estimated_duration, priority

Example response:
{
  "plan": [
    {"step": 1, "action": "analyze_request", "agent": "research", "description": "Initial analysis"}
  ],
  "primary_agent": "research",
  "collaborators": ["analysis"],
  "queue": "agent_tasks",
  "metadata": {"complexity": "medium", "estimated_duration": "30s", "priority": "normal"}
}`);
  }

  createDefaultPlan(originalMessage, sessionId) {
    return {
      plan: [
        {
          step: 1,
          action: "analyze_request",
          agent: "research",
          description: "Analyze the user request and gather initial information"
        },
        {
          step: 2,
          action: "generate_response",
          agent: "creative",
          description: "Generate a comprehensive response based on analysis"
        }
      ],
      primary_agent: "research",
      collaborators: ["creative"],
      queue: "agent_tasks",
      metadata: {
        complexity: "medium",
        estimated_duration: "30s",
        priority: "normal"
      }
    };
  }

  analyzeTaskComplexity(message) {
    const indicators = {
      length: message.length,
      questions: (message.match(/\?/g) || []).length,
      keywords: this.extractKeywords(message),
      technicalTerms: this.countTechnicalTerms(message),
      requestTypes: this.identifyRequestTypes(message)
    };

    let complexityScore = 0;
    
    if (indicators.length > 200) complexityScore += 2;
    else if (indicators.length > 100) complexityScore += 1;
    
    complexityScore += Math.min(indicators.questions * 0.5, 2);
    complexityScore += Math.min(indicators.technicalTerms * 0.3, 2);
    complexityScore += indicators.requestTypes.complexity;

    let level, estimatedDuration;
    if (complexityScore <= 2) {
      level = "low";
      estimatedDuration = "15s";
    } else if (complexityScore <= 4) {
      level = "medium";
      estimatedDuration = "30s";
    } else {
      level = "high";
      estimatedDuration = "60s";
    }

    return {
      score: complexityScore,
      level: level,
      estimatedDuration: estimatedDuration,
      indicators: indicators
    };
  }

  determineAgentRouting(message, complexity) {
    const messageLower = message.toLowerCase();
    const routing = {
      primary: "research",
      collaborators: [],
      reasoning: ""
    };

    if (messageLower.includes("research") || messageLower.includes("find") || 
        messageLower.includes("search") || messageLower.includes("information")) {
      routing.primary = "research";
      routing.collaborators = ["analysis"];
      routing.reasoning = "Research request detected";
    }
    else if (messageLower.includes("create") || messageLower.includes("write") || 
             messageLower.includes("generate") || messageLower.includes("design")) {
      routing.primary = "creative";
      routing.collaborators = ["research"];
      routing.reasoning = "Creative task detected";
    }
    else if (messageLower.includes("code") || messageLower.includes("program") || 
             messageLower.includes("develop") || messageLower.includes("build")) {
      routing.primary = "development";
      routing.collaborators = ["research", "qa"];
      routing.reasoning = "Development task detected";
    }
    else if (messageLower.includes("analyze") || messageLower.includes("data") || 
             messageLower.includes("statistics") || messageLower.includes("trends")) {
      routing.primary = "analysis";
      routing.collaborators = ["research"];
      routing.reasoning = "Analysis task detected";
    }
    else if (messageLower.includes("plan") || messageLower.includes("strategy") || 
             messageLower.includes("organize") || messageLower.includes("schedule")) {
      routing.primary = "planning";
      routing.collaborators = ["research", "analysis"];
      routing.reasoning = "Planning task detected";
    }

    if (complexity.level === "high" && !routing.collaborators.includes("qa")) {
      routing.collaborators.push("qa");
    }

    return routing;
  }

  createDetailedPlan(message, complexity, routing) {
    const basePlan = [
      {
        step: 1,
        action: "analyze_request",
        agent: routing.primary,
        description: `Initial analysis using ${routing.primary} agent`,
        estimated_duration: "10s",
        dependencies: []
      }
    ];

    let stepCounter = 2;

    if (routing.primary !== "research" && routing.collaborators.includes("research")) {
      basePlan.push({
        step: stepCounter++,
        action: "gather_information",
        agent: "research",
        description: "Gather relevant information and context",
        estimated_duration: "15s",
        dependencies: [1]
      });
    }

    if (routing.collaborators.includes("analysis")) {
      basePlan.push({
        step: stepCounter++,
        action: "analyze_data",
        agent: "analysis",
        description: "Analyze gathered data and identify patterns",
        estimated_duration: "10s",
        dependencies: [stepCounter - 2]
      });
    }

    if (routing.primary === "creative" || routing.collaborators.includes("creative")) {
      basePlan.push({
        step: stepCounter++,
        action: "generate_content",
        agent: "creative",
        description: "Generate creative content based on analysis",
        estimated_duration: "15s",
        dependencies: [stepCounter - 2]
      });
    }

    if (routing.primary === "development" || routing.collaborators.includes("development")) {
      basePlan.push({
        step: stepCounter++,
        action: "develop_solution",
        agent: "development",
        description: "Develop technical solution or code",
        estimated_duration: "20s",
        dependencies: [stepCounter - 2]
      });
    }

    if (routing.collaborators.includes("qa")) {
      basePlan.push({
        step: stepCounter++,
        action: "quality_assurance",
        agent: "qa",
        description: "Review and validate output quality",
        estimated_duration: "10s",
        dependencies: [stepCounter - 2]
      });
    }

    basePlan.push({
      step: stepCounter,
      action: "synthesize_response",
      agent: routing.primary,
      description: "Synthesize final response from all agent outputs",
      estimated_duration: "10s",
      dependencies: [stepCounter - 1]
    });

    return basePlan;
  }

  createExecutionContext(orchestrationPlan, originalMessage, sessionId, userId) {
    return {
      orchestration_id: this.generateExecutionId(),
      session_id: sessionId,
      user_id: userId,
      original_message: originalMessage,
      plan: orchestrationPlan.plan,
      primary_agent: orchestrationPlan.primary_agent,
      collaborators: orchestrationPlan.collaborators,
      created_at: new Date().toISOString(),
      status: "queued"
    };
  }

  createNeo4jContext(sessionId, userId, originalMessage) {
    return {
      write: true,
      cypher: `MERGE (s:Session {id: '${sessionId}'}) 
               MERGE (u:User {id: '${userId}'}) 
               MERGE (r:Request {message: '${originalMessage.replace(/'/g, "\\'")}', timestamp: datetime()})
               MERGE (s)-[:HAS_REQUEST]->(r)
               MERGE (u)-[:OWNS_SESSION]->(s)`
    };
  }

  createErrorResponse(error) {
    return {
      error: error.message,
      timestamp: new Date().toISOString(),
      fallback_plan: {
        plan: [{
          step: 1,
          action: "error_response",
          agent: "creative",
          description: "Provide error response to user"
        }],
        primary_agent: "creative",
        collaborators: [],
        queue: "agent_tasks"
      }
    };
  }

  // Helper functions
  extractKeywords(text) {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'this', 'that', 'these', 'those', 'is', 'are', 
      'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 
      'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might'
    ]);
    
    return words.filter(word => !stopWords.has(word)).slice(0, 10);
  }

  countTechnicalTerms(text) {
    const technicalTerms = [
      'algorithm', 'api', 'database', 'function', 'variable', 'code', 'programming',
      'software', 'hardware', 'network', 'server', 'client', 'framework', 'library',
      'machine learning', 'artificial intelligence', 'data science', 'analytics'
    ];
    
    const textLower = text.toLowerCase();
    return technicalTerms.filter(term => textLower.includes(term)).length;
  }

  identifyRequestTypes(text) {
    const textLower = text.toLowerCase();
    let complexity = 0;
    const types = [];

    if (textLower.includes("explain") || textLower.includes("how")) {
      types.push("explanation");
      complexity += 1;
    }
    
    if (textLower.includes("create") || textLower.includes("generate")) {
      types.push("creation");
      complexity += 2;
    }
    
    if (textLower.includes("analyze") || textLower.includes("compare")) {
      types.push("analysis");
      complexity += 2;
    }
    
    if (textLower.includes("solve") || textLower.includes("fix")) {
      types.push("problem_solving");
      complexity += 3;
    }

    return { types, complexity };
  }

  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = { MasterOrchestrator };
