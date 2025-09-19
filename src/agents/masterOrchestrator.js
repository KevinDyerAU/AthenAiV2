const { ChatOpenAI } = require('@langchain/openai');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { logger } = require('../utils/logger');
const { progressBroadcaster } = require('../services/progressBroadcaster');
const { agentRegistry } = require('./AgentRegistry');
const { chatroomService } = require('../services/chatroom');
const { KnowledgeSubstrateHelper } = require('../utils/knowledgeSubstrateHelper');

class MasterOrchestrator {
  constructor() {
    // Primary OpenAI configuration with OpenRouter fallback
    const useOpenRouter = process.env.USE_OPENROUTER === 'true';
    
    // Log configuration details for debugging
    logger.debug('MasterOrchestrator: Initializing with configuration', {
      useOpenRouter,
      openRouterModel: process.env.OPENROUTER_MODEL || 'openai/gpt-4',
      openAiModel: process.env.OPENAI_MODEL || 'gpt-4',
      hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
      hasOpenAiKey: !!process.env.OPENAI_API_KEY,
      openRouterKeyLength: process.env.OPENROUTER_API_KEY ? process.env.OPENROUTER_API_KEY.length : 0,
      openAiKeyLength: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0
    });
    
    if (useOpenRouter) {
      if (!process.env.OPENROUTER_API_KEY) {
        logger.error('MasterOrchestrator: OpenRouter selected but OPENROUTER_API_KEY not configured');
      }
      this.llm = new ChatOpenAI({
        modelName: process.env.OPENROUTER_MODEL || 'openai/gpt-4',
        temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE) || 0.1,
        openAIApiKey: process.env.OPENROUTER_API_KEY,
        configuration: {
          baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            'HTTP-Referer': 'https://athenai.local',
            'X-Title': 'AthenAI System'
          }
        },
        timeout: 10000,
        maxRetries: 2
      });
    } else {
      if (!process.env.OPENAI_API_KEY) {
        logger.error('MasterOrchestrator: OpenAI selected but OPENAI_API_KEY not configured');
      }
      this.llm = new ChatOpenAI({
        modelName: process.env.OPENAI_MODEL || 'gpt-4',
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.1,
        openAIApiKey: process.env.OPENAI_API_KEY,
        timeout: parseInt(process.env.OPENAI_TIMEOUT) || 60000,
        maxRetries: 2,
        tags: ['master-orchestrator', 'athenai', 'openai']
      });
    }
    
    // Initialize knowledge substrate helper
    this.knowledgeHelper = new KnowledgeSubstrateHelper();
    
    this.name = 'MasterOrchestrator';
    this.capabilities = ['task-analysis', 'agent-routing', 'orchestration'];
    this.agents = new Map();
    this.executionPlans = new Map();
  }

  // Knowledge substrate integration using standardized helper
  async retrieveKnowledgeContext(query, sessionId) {
    try {
      await progressBroadcaster.updateProgress(sessionId, 'knowledge_context', 'Retrieving orchestration knowledge context');
      
      return await this.knowledgeHelper.retrieveKnowledgeContext(query, 'orchestration', {
        complexity: 'high',
        filters: {
          session_id: sessionId
        }
      });
    } catch (error) {
      logger.error('Error retrieving knowledge context:', {
        error: error.message,
        sessionId,
        query: query.substring(0, 100)
      });
      return { domain: 'general', similarResults: [], knowledgeEntities: [], queryHash: null };
    }
  }

  async storeOrchestrationInsights(query, results, sessionId) {
    try {
      const orchestrationResult = {
        success: true,
        query,
        output: results,
        insights: this.extractOrchestrationInsights(results)
      };
      
      const context = {
        objective: query,
        sessionId,
        complexity: {
          level: 'high',
          score: 8.0
        }
      };
      
      return await this.knowledgeHelper.storeKnowledgeResults(orchestrationResult, context, 'orchestration');
    } catch (error) {
      logger.error('Error storing orchestration insights:', {
        error: error.message,
        sessionId,
        query: query.substring(0, 100)
      });
      return false;
    }
  }

  extractOrchestrationInsights(results) {
    const insights = [];
    if (typeof results === 'string') {
      const lines = results.split('\n');
      lines.forEach(line => {
        if (line.includes('orchestration') || line.includes('routing') || line.includes('coordination')) {
          insights.push({ type: 'orchestration_pattern', content: line.trim() });
        }
      });
    }
    return insights;
  }

  async analyzeTaskComplexity(task, conversationContext = []) {
    try {
      // Ensure task is a string
      const taskString = typeof task === 'string' ? task : JSON.stringify(task);
      
      // Build context summary for complexity analysis
      const contextSummary = conversationContext.length > 0 
        ? `\n\nConversation Context (last ${conversationContext.length} messages):\n` + 
          conversationContext.map(msg => `${msg.role}: ${msg.content}`).join('\n')
        : '';
      
      // Check if API key is available
      const useOpenRouter = process.env.USE_OPENROUTER === 'true';
      const apiKey = useOpenRouter ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        logger.warn('No API key available, using fallback heuristics for complexity analysis');
        throw new Error('No API key configured');
      }
      
      // AI-powered complexity analysis with explicit reasoning
      const complexityPrompt = PromptTemplate.fromTemplate(`
You are an expert task complexity analyzer. Before providing your assessment, think through your analysis step by step.

REASONING PHASE:
1. First, break down the user request into its core components
2. Identify the types of knowledge and skills required
3. Estimate the number of steps and sub-tasks involved
4. Consider the interdependencies between different parts
5. Assess the time and resource requirements
6. Determine which specialized agents would be most effective

User Request: {message}

ANALYSIS CRITERIA:
1. How many steps or sub-tasks are involved?

Respond with a JSON object in this format:
{
  "level": "low|medium|high",
  "factors": ["factor1", "factor2", ...],
  "estimated_time": seconds,
  "required_agents": ["agent1", "agent2", ...],
  "reasoning": "explanation of complexity assessment"
}

Current Task: {task}
{contextSummary}

Consider factors like:
- Information gathering requirements
- Analysis depth needed
- Creative or technical complexity
- Multi-step processes
- Domain expertise required
- Time sensitivity
- Conversation continuity and context
- Follow-up or clarification needs
- Previous discussion topics

Respond with ONLY the JSON object.`);

      const chain = complexityPrompt.pipe(this.llm).pipe(new StringOutputParser());
      
      // Add timeout wrapper to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('API timeout - complexity analysis')), 8000);
      });
      
      // Execute with timeout protection
      const response = await Promise.race([
        chain.invoke({ task: taskString, contextSummary }),
        timeoutPromise
      ]);
      
      // Check for rate limiting
      if (response && response.includes && response.includes('429')) {
        throw new Error('Rate limit exceeded');
      }
      
      try {
        // Parse the JSON response
        const analysis = JSON.parse(response);
        
        // Validate and set defaults
        return {
          level: analysis.level || 'medium',
          factors: Array.isArray(analysis.factors) ? analysis.factors : ['multi-step'],
          estimated_time: analysis.estimated_time || 300,
          required_agents: Array.isArray(analysis.required_agents) ? analysis.required_agents : ['research'],
          reasoning: analysis.reasoning || 'AI-powered complexity analysis'
        };
      } catch (parseError) {
        logger.warn('Failed to parse AI complexity analysis, using fallback', { parseError: parseError.message });
        throw new Error('JSON parsing failed');
      }
    } catch (error) {
      logger.error('AI complexity analysis failed, using simple heuristics', { error: error.message });
      
      // Fallback to simple heuristics
      const taskString = typeof task === 'string' ? task : JSON.stringify(task);
      const wordCount = taskString.split(' ').length;
      const hasQuestions = taskString.includes('?');
      const hasMultipleParts = taskString.includes(' and ') || taskString.includes(',');
      
      let level = 'low';
      let estimatedTime = 120;
      let factors = ['simple-query'];
      
      if (wordCount > 10 || hasMultipleParts) {
        level = 'medium';
        estimatedTime = 300;
        factors = ['multi-step', 'moderate-complexity'];
      }
      
      if (wordCount > 25 || (hasQuestions && hasMultipleParts)) {
        level = 'high';
        estimatedTime = 600;
        factors = ['complex-analysis', 'multi-domain', 'research-intensive'];
      }
      
      return {
        level,
        factors,
        estimated_time: estimatedTime,
        required_agents: ['research', 'analysis'],
        reasoning: 'Fallback heuristic analysis used'
      };
    }
  }

  async routeToAgent(task, sessionId, conversationContext = []) {
    const startTime = Date.now();
    try {
      // Ensure task is a string
      const taskString = typeof task === 'string' ? task : JSON.stringify(task);
      
      logger.debug('MasterOrchestrator: Starting agent routing process', {
        taskString: taskString.substring(0, 200) + '...',
        sessionId,
        conversationContextLength: conversationContext.length,
        timestamp: new Date().toISOString()
      });

      await progressBroadcaster.updateProgress(sessionId, {
        phase: 'registry_routing_start',
        message: 'Consulting AgentRegistry for optimal agent selection...',
        progress: 30
      });

      // First, try AgentRegistry-based routing
      logger.info('MasterOrchestrator: Attempting AgentRegistry selection', { sessionId });
      const selectedAgent = await agentRegistry.selectAgent(taskString, conversationContext);
      
      if (!selectedAgent) {
        logger.warn('MasterOrchestrator: AgentRegistry returned null/undefined agent', { 
          sessionId,
          taskString: taskString.substring(0, 100) + '...'
        });
        throw new Error('AgentRegistry returned no agent selection');
      }
      
      logger.info('MasterOrchestrator: AgentRegistry selection completed', {
        selectedAgent: selectedAgent ? {
          id: selectedAgent.id,
          name: selectedAgent.name,
          confidence: selectedAgent.confidence_threshold,
          capabilities: selectedAgent.capabilities
        } : null,
        sessionId,
        routingTime: Date.now() - startTime
      });

      await progressBroadcaster.updateProgress(sessionId, {
        phase: 'registry_routing_complete',
        message: `AgentRegistry selected: ${selectedAgent.name}`,
        progress: 50
      });

      // Map registry agent to our routing format
      const routingResult = this.mapRegistryAgentToRouting(selectedAgent, taskString);
      
      logger.info('MasterOrchestrator: Agent routing determination complete', { 
        routingResult,
        selectedAgentId: selectedAgent.id,
        totalRoutingTime: Date.now() - startTime,
        sessionId
      });

      return routingResult;

    } catch (error) {
      const routingTime = Date.now() - startTime;
      logger.error('MasterOrchestrator: AgentRegistry routing failed, using fallback', {
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack
        },
        taskString: typeof task === 'string' ? task.substring(0, 100) + '...' : JSON.stringify(task).substring(0, 100) + '...',
        sessionId,
        routingTime,
        timestamp: new Date().toISOString()
      });

      // Fallback to AI-powered routing if registry fails
      return this.fallbackAIRouting(task, sessionId, conversationContext || []);
    }
  }

  async determineAgentRouting(task, sessionId = 'default', conversationContext = []) {
    try {
      // Ensure task is a string
      const taskString = typeof task === 'string' ? task : JSON.stringify(task);
      
      await progressBroadcaster.updateProgress(sessionId, {
        phase: 'routing_start',
        message: 'Starting intelligent agent routing...',
        progress: 35
      });

      // Use AgentRegistry for intelligent agent selection
      logger.info('MasterOrchestrator: Using AgentRegistry for intelligent routing', {
        taskString: taskString.substring(0, 100) + '...',
        sessionId
      });

      const selectedAgent = agentRegistry.findBestAgentForTask(taskString, { sessionId });
      
      if (!selectedAgent) {
        logger.warn('AgentRegistry returned no agent, falling back to keyword matching');
        throw new Error('AgentRegistry selection failed');
      }

      logger.info('MasterOrchestrator: AgentRegistry selected agent', {
        agentId: selectedAgent.id,
        agentName: selectedAgent.name,
        capabilities: selectedAgent.capabilities,
        confidence: selectedAgent.confidence_threshold
      });

      await progressBroadcaster.updateProgress(sessionId, {
        phase: 'registry_routing_complete',
        message: `AgentRegistry selected: ${selectedAgent.name}`,
        progress: 50
      });

      // Map registry agent to our routing format
      const routingResult = this.mapRegistryAgentToRouting(selectedAgent, taskString);
      
      logger.info('MasterOrchestrator: Agent routing determination complete', { 
        routingResult,
        selectedAgent: selectedAgent.id
      });

      return routingResult;

    } catch (error) {
      logger.warn('MasterOrchestrator: AgentRegistry routing failed, using fallback', {
        error: error.message,
        taskString: typeof task === 'string' ? task.substring(0, 100) + '...' : JSON.stringify(task).substring(0, 100) + '...'
      });

      // Fallback to AI-powered routing if registry fails
      return this.fallbackAIRouting(task, sessionId, conversationContext);
    }
  }

  async fallbackAIRouting(task, sessionId, conversationContext = []) {
    const startTime = Date.now();
    const orchestrationId = this.generateSessionId(); // Generate orchestration ID
    try {
      // Ensure task is a string
      const taskString = typeof task === 'string' ? task : JSON.stringify(task);
      
      logger.debug('MasterOrchestrator: Starting fallback AI routing', {
        taskString: taskString.substring(0, 100) + '...',
        sessionId,
        conversationContextLength: conversationContext.length,
        timestamp: new Date().toISOString()
      });
      
      // Check if API key is available
      const useOpenRouter = process.env.USE_OPENROUTER === 'true';
      const apiKey = useOpenRouter ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
      
      logger.debug('MasterOrchestrator: API key validation', {
        useOpenRouter,
        hasApiKey: !!apiKey,
        apiKeyLength: apiKey ? apiKey.length : 0,
        sessionId
      });
      
      if (!apiKey) {
        const errorMessage = useOpenRouter 
          ? 'OpenRouter API key is not configured. Please set OPENROUTER_API_KEY in your environment variables.'
          : 'OpenAI API key is not configured. Please set OPENAI_API_KEY in your environment variables.';
        
        logger.error('MasterOrchestrator: No API key available', {
          useOpenRouter,
          sessionId,
          taskString: taskString.substring(0, 100) + '...',
          timestamp: new Date().toISOString(),
          error: errorMessage
        });
        
        progressBroadcaster.errorProgress(sessionId, errorMessage);
        throw new Error(errorMessage);
      }
      
      // Build context summary for routing
      const contextSummary = conversationContext.length > 0 
        ? `\n\nConversation Context (last ${conversationContext.length} messages):\n` + 
          conversationContext.map(msg => `${msg.role}: ${msg.content}`).join('\n')
        : '';

      // AI-powered agent routing with explicit reasoning and conversation context
      const routingPrompt = PromptTemplate.fromTemplate(`
You are an expert agent routing specialist. Before selecting an agent, think through your decision step by step considering the conversation context.

REASONING PHASE:
1. First, analyze the core intent and requirements of the user message
2. Consider the conversation context and continuity
3. Identify the primary domain of expertise needed
4. Consider what tools and capabilities would be most effective
5. Evaluate which agent's specialization best matches the task
6. Consider any secondary agents that might be helpful

Current User Message: {message}
{contextSummary}

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
2. How does this relate to the previous conversation?
3. What type of expertise is needed?
4. What tools and capabilities would be most useful?
5. Which agent's core competencies align best with these requirements?

Think through your reasoning, then respond with ONLY the agent name (research, creative, analysis, development, planning, execution, communication, qa, document, or general).`);

      const chain = routingPrompt.pipe(this.llm).pipe(new StringOutputParser());
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('API timeout - agent routing')), 8000);
      });
      
      let primaryAgent = 'general'; // Initialize with default value
      try {
        logger.info('MasterOrchestrator: Invoking AI agent routing', { 
          taskString: taskString.substring(0, 200) + '...',
          fullTaskString: taskString,
          sessionId,
          orchestrationId,
          llmModel: this.llm.modelName || 'unknown',
          llmConfig: {
            temperature: this.llm.temperature,
            apiKey: this.llm.openAIApiKey ? 'present' : 'missing'
          }
        });
        
        progressBroadcaster.updateProgress(sessionId, 'ai_routing', 'Calling AI model for agent routing...', { progress: 40 });
        
        const startTime = Date.now();
        const response = await Promise.race([
          chain.invoke({ message: taskString, contextSummary }),
          timeoutPromise
        ]);
        const responseTime = Date.now() - startTime;
        
        // Safely assign primaryAgent only if we got a valid response
        if (response && typeof response === 'string' && response.trim()) {
          primaryAgent = response.trim();
        }
        
        logger.info('MasterOrchestrator: AI agent routing response received', { 
          response,
          primaryAgent, 
          type: typeof primaryAgent,
          responseTime,
          rawResponse: JSON.stringify(response),
          taskString: taskString.substring(0, 100) + '...',
          sessionId
        });
        
        progressBroadcaster.updateProgress(sessionId, 'ai_routing_complete', `AI selected agent: "${primaryAgent}" in ${responseTime}ms`, { progress: 50 });
      } catch (error) {
        const aiRoutingTime = Date.now() - startTime;
        logger.error('MasterOrchestrator: Agent routing API call failed', { 
          error: {
            message: error.message,
            name: error.name,
            stack: error.stack,
            code: error.code
          },
          taskString: taskString.substring(0, 100) + '...',
          sessionId,
          aiRoutingTime,
          useOpenRouter,
          hasApiKey: !!apiKey,
          timestamp: new Date().toISOString()
        });
        
        // Return proper error instead of falling back to keywords
        const errorMessage = error.message.includes('timeout') 
          ? 'AI routing service timed out. Please check your API key configuration and try again.'
          : `AI routing failed: ${error.message}. Please verify your API key is valid and try again.`;
        
        progressBroadcaster.errorProgress(sessionId, errorMessage);
        throw new Error(errorMessage);
      }
      
      // Clean and validate the response
      if (!primaryAgent || typeof primaryAgent !== 'string') {
        logger.warn('MasterOrchestrator: Invalid primaryAgent response, using fallback', { 
          primaryAgent, 
          type: typeof primaryAgent,
          value: primaryAgent,
          taskString: taskString.substring(0, 100) + '...',
          sessionId
        });
        
        await progressBroadcaster.updateProgress(sessionId, {
          phase: 'validation_error',
          message: `Invalid agent response (${typeof primaryAgent}): ${primaryAgent}. Using general agent.`,
          progress: 55,
          error: `primaryAgent validation failed - type: ${typeof primaryAgent}, value: ${primaryAgent}`
        });
        
        primaryAgent = 'general';
      }
      
      const cleanAgent = primaryAgent.toLowerCase().trim();
      const validAgents = ['research', 'creative', 'analysis', 'development', 'planning', 'execution', 'communication', 'qa', 'document', 'general'];
      const selectedAgent = validAgents.includes(cleanAgent) ? cleanAgent : 'general';
      
      logger.info('MasterOrchestrator: Agent validation process', {
        originalResponse: primaryAgent,
        cleanedAgent: cleanAgent,
        selectedAgent: selectedAgent,
        isValid: validAgents.includes(cleanAgent),
        validAgents: validAgents,
        fallbackToGeneral: selectedAgent === 'general' && cleanAgent !== 'general',
        sessionId
      });
      
      await progressBroadcaster.updateProgress(sessionId, {
        phase: 'agent_validation',
        message: `Agent validation: ${primaryAgent} → ${cleanAgent} → ${selectedAgent}`,
        progress: 60
      });
      
      // Determine secondary agents and execution order based on primary
      let secondary = [];
      let executionOrder = [selectedAgent];
      
      if (selectedAgent === 'research') {
        secondary = ['analysis'];
        executionOrder = ['research', 'analysis'];
      } else if (selectedAgent === 'analysis') {
        // For GitHub URLs and repository analysis, research should come first
        if (taskString.includes('github.com') || taskString.includes('repository') || taskString.includes('repo')) {
          secondary = ['research'];
          executionOrder = ['research', 'analysis'];
        } else {
          secondary = ['research'];
          executionOrder = ['analysis', 'research'];
        }
      } else if (selectedAgent === 'creative') {
        secondary = ['analysis'];
        executionOrder = ['creative', 'analysis'];
      } else if (selectedAgent === 'development') {
        secondary = ['planning', 'qa'];
        executionOrder = ['planning', 'development', 'qa'];
      } else if (selectedAgent === 'planning') {
        secondary = ['execution'];
        executionOrder = ['planning', 'execution'];
      } else if (selectedAgent === 'execution') {
        secondary = ['qa'];
        executionOrder = ['execution', 'qa'];
      } else if (selectedAgent === 'communication') {
        secondary = ['creative'];
        executionOrder = ['creative', 'communication'];
      }
      
      const routingResult = {
        primary: selectedAgent,
        secondary,
        execution_order: executionOrder,
        parallel_execution: false,
        reasoning: `AI determined '${selectedAgent}' agent is best suited for this task`
      };

      logger.info('MasterOrchestrator: Agent routing determination complete', { 
        routingResult,
        originalAgent: primaryAgent,
        cleanAgent,
        selectedAgent
      });

      return routingResult;
    } catch (error) {
      logger.error('MasterOrchestrator: AI agent routing determination failed, falling back to keyword matching', { 
        error: error.message,
        stack: error.stack,
        name: error.name,
        task: typeof task === 'string' ? task.substring(0, 100) + '...' : JSON.stringify(task).substring(0, 100) + '...',
        timestamp: new Date().toISOString()
      });
      
      // Fallback to simple keyword matching if AI fails
      const taskString = typeof task === 'string' ? task : JSON.stringify(task);
      const taskLower = taskString.toLowerCase();
      
      logger.info('MasterOrchestrator: Using keyword-based fallback routing', { taskLower: taskLower.substring(0, 100) + '...' });
      
      let primary = 'general';
      if (taskLower.includes('research') || taskLower.includes('analyze') || taskLower.includes('find') || taskLower.includes('what') || taskLower.includes('how')) {
        primary = 'research';
      } else if (taskLower.includes('creative') || taskLower.includes('design') || taskLower.includes('write') || taskLower.includes('create')) {
        primary = 'creative';
      } else if (taskLower.includes('code') || taskLower.includes('development') || taskLower.includes('program')) {
        primary = 'development';
      } else if (taskLower.includes('plan') || taskLower.includes('schedule') || taskLower.includes('organize')) {
        primary = 'planning';
      } else if (taskLower.includes('execute') || taskLower.includes('run') || taskLower.includes('perform')) {
        primary = 'execution';
      } else if (taskLower.includes('send') || taskLower.includes('notify') || taskLower.includes('communicate')) {
        primary = 'communication';
      } else if (taskLower.includes('test') || taskLower.includes('validate') || taskLower.includes('check') || taskLower.includes('review')) {
        primary = 'qa';
      }
      
      const fallbackResult = {
        primary,
        secondary: ['analysis'],
        execution_order: [primary, 'analysis'],
        parallel_execution: false,
        reasoning: 'Fallback keyword matching used'
      };

      logger.info('MasterOrchestrator: Keyword-based fallback routing complete', { 
        fallbackResult,
        taskLower: taskLower.substring(0, 100) + '...'
      });

      return fallbackResult;
    }
  }

  mapRegistryAgentToRouting(selectedAgent, taskString) {
    // Map AgentRegistry agent IDs to our existing routing system
    const agentMapping = {
      'research_agent': 'research',
      'analysis_agent': 'analysis', 
      'creative_agent': 'creative',
      'development_agent': 'development',
      'planning_agent': 'planning',
      'execution_agent': 'execution',
      'communication_agent': 'communication',
      'quality_assurance_agent': 'qa',
      'document_agent': 'document',
      'email_agent': 'email'
    };

    const primaryAgent = agentMapping[selectedAgent.id] || 'research';
    
    // Determine secondary agents based on primary agent capabilities
    let secondary = [];
    let executionOrder = [primaryAgent];

    // Use the agent's suggested workflow from registry
    if (selectedAgent.capabilities.includes('research_synthesis') && primaryAgent !== 'research') {
      secondary.push('research');
    }
    if (selectedAgent.capabilities.includes('data_analysis') && primaryAgent !== 'analysis') {
      secondary.push('analysis');
    }
    if (selectedAgent.capabilities.includes('quality_assurance') && primaryAgent !== 'qa') {
      secondary.push('qa');
    }

    // Create execution order based on complexity and agent type
    if (secondary.length > 0) {
      if (primaryAgent === 'development') {
        executionOrder = ['planning', primaryAgent, 'qa'];
      } else if (primaryAgent === 'research') {
        executionOrder = [primaryAgent, 'analysis'];
      } else {
        executionOrder = [primaryAgent, ...secondary];
      }
    }

    return {
      primary: primaryAgent,
      secondary: secondary,
      execution_order: executionOrder,
      parallel_execution: false,
      reasoning: `AgentRegistry selected ${selectedAgent.name} based on capabilities: ${selectedAgent.capabilities.join(', ')}`,
      agent_profile: {
        id: selectedAgent.id,
        name: selectedAgent.name,
        description: selectedAgent.description,
        complexity_level: selectedAgent.complexity_level,
        confidence_threshold: selectedAgent.confidence_threshold,
        performance_metrics: selectedAgent.performance_metrics
      }
    };
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateOrchestrationId() {
    return `orch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async createExecutionPlan(task, complexity, routing, conversationContext = []) {
    const contextAwareness = conversationContext.length > 0 ? {
      has_context: true,
      context_length: conversationContext.length,
      recent_topics: this.extractTopicsFromContext(conversationContext),
      conversation_continuity: this.assessContinuity(conversationContext)
    } : {
      has_context: false,
      context_length: 0,
      recent_topics: [],
      conversation_continuity: 'new_conversation'
    };

    // If primary agent is planning, delegate to PlanningAgent for comprehensive planning
    if (routing.primary === 'planning') {
      logger.info('MasterOrchestrator: Delegating execution plan creation to PlanningAgent');
      
      try {
        const { PlanningAgent } = require('./PlanningAgent');
        const planningAgent = new PlanningAgent();
        
        // Get comprehensive agent registry information
        const agentRegistryInfo = this.getAgentRegistryInfo();
        
        const planningRequest = {
          task: task,
          objective: task,
          complexity: complexity,
          routing: routing,
          conversationContext: conversationContext,
          constraints: {},
          resources: {
            available_agents: routing.secondary || [],
            execution_order: routing.execution_order || [routing.primary],
            parallel_execution: routing.parallel_execution || false,
            agent_registry: agentRegistryInfo // Pass comprehensive agent information
          },
          sessionId: `plan_${Date.now()}`,
          orchestrationId: `orch_${Date.now()}`,
          planning_type: 'orchestration'
        };

        // Get comprehensive plan from PlanningAgent
        const planningResult = await planningAgent.executePlanning(planningRequest);
        
        // Transform PlanningAgent result into MasterOrchestrator execution plan format
        return {
          task_id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          primary_agent: routing.primary,
          secondary_agents: routing.secondary || [],
          execution_order: routing.execution_order || [routing.primary],
          parallel_execution: routing.parallel_execution || false,
          estimated_time: complexity.estimated_time || 300,
          priority: this.determinePriority(complexity.level),
          dependencies: [],
          checkpoints: this.createCheckpoints(routing.execution_order || [routing.primary]),
          context_awareness: contextAwareness,
          fallback_strategy: {
            primary_fallback: 'research',
            timeout_threshold: 30000,
            retry_attempts: 2
          },
          // Enhanced with PlanningAgent comprehensive planning
          comprehensive_plan: {
            planning_result: planningResult,
            work_breakdown: planningResult.work_breakdown || 'Detailed planning completed',
            timeline: planningResult.timeline || 'Timeline established',
            resource_allocation: planningResult.resource_allocation || 'Resources allocated',
            risk_assessment: planningResult.risk_assessment || 'Risks assessed',
            success_metrics: planningResult.success_metrics || 'Success criteria defined'
          },
          metadata: {
            complexity_factors: complexity.factors || [],
            reasoning: complexity.reasoning || 'Standard execution plan',
            created_at: new Date().toISOString(),
            conversation_context: conversationContext.slice(-3),
            planning_agent_used: true,
            planning_confidence: planningResult.confidence || 'high'
          }
        };
        
      } catch (error) {
        logger.warn('MasterOrchestrator: PlanningAgent integration failed, using fallback plan', { 
          error: error.message 
        });
        // Fallback to standard execution plan
      }
    }

    // Standard execution plan for non-planning tasks
    return {
      task_id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      primary_agent: routing.primary,
      secondary_agents: routing.secondary || [],
      execution_order: routing.execution_order || [routing.primary],
      parallel_execution: routing.parallel_execution || false,
      estimated_time: complexity.estimated_time || 300,
      priority: this.determinePriority(complexity.level),
      dependencies: [],
      checkpoints: this.createCheckpoints(routing.execution_order || [routing.primary]),
      context_awareness: contextAwareness,
      fallback_strategy: {
        primary_fallback: 'research',
        timeout_threshold: 30000,
        retry_attempts: 2
      },
      metadata: {
        complexity_factors: complexity.factors || [],
        reasoning: complexity.reasoning || 'Standard execution plan',
        created_at: new Date().toISOString(),
        conversation_context: conversationContext.slice(-3),
        planning_agent_used: false
      }
    };
  }

  extractTopicsFromContext(conversationContext) {
    // Simple topic extraction from recent messages
    const recentMessages = conversationContext.slice(-5);
    const topics = new Set();
    
    recentMessages.forEach(msg => {
      const words = msg.content.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 4 && !['that', 'this', 'with', 'from', 'they', 'have', 'been', 'will', 'would', 'could', 'should'].includes(word)) {
          topics.add(word);
        }
      });
    });
    
    return Array.from(topics).slice(0, 10); // Return top 10 topics
  }

  assessContinuity(conversationContext) {
    if (conversationContext.length === 0) return 'new_conversation';
    if (conversationContext.length === 1) return 'first_response';
    if (conversationContext.length <= 5) return 'early_conversation';
    return 'ongoing_conversation';
  }

  async executeOrchestration(inputData) {
    const startTime = Date.now();
    const sessionId = inputData.sessionId || this.generateSessionId();
    const taskMessage = inputData.message || inputData.task || inputData;
    const conversationContext = inputData.conversationContext || [];
    
    try {
      logger.info('MasterOrchestrator: Starting orchestration', {
        sessionId,
        taskMessage: taskMessage?.substring(0, 100) + '...',
        inputData: JSON.stringify(inputData, null, 2)
      });

      // Start progress tracking
      progressBroadcaster.startProgress(sessionId, 'MasterOrchestrator', 'Analyzing task and routing to appropriate agent');
      
      // Step 1: Analyze task complexity
      progressBroadcaster.updateProgress(sessionId, 'complexity_analysis', 'Analyzing task complexity and requirements');
      progressBroadcaster.updateThinking(sessionId, 'analyzing', 'Breaking down the user request to understand complexity and requirements...');
      
      logger.info('MasterOrchestrator: Analyzing task complexity');
      const complexity = await this.analyzeTaskComplexity(taskMessage);
      
      // Use think tool only for highly complex tasks
      let thinkingResult = null;
      if (complexity.level === 'high' || complexity.level === 'very_complex') {
        logger.info('MasterOrchestrator: High complexity detected, engaging think tool');
        progressBroadcaster.updateThinking(sessionId, 'deep_thinking', 'Engaging advanced reasoning for complex task...');
        try {
          thinkingResult = await this.think(taskMessage);
          logger.debug('MasterOrchestrator: Think tool completed', { 
            steps: thinkingResult.steps?.length || 0,
            responseTime: thinkingResult.responseTime 
          });
        } catch (error) {
          logger.warn('MasterOrchestrator: Think tool failed for complex task', { error: error.message });
        }
      }
      
      const routing = await this.routeToAgent(taskMessage, sessionId, conversationContext);
      
      const orchestrationId = this.generateSessionId();
      logger.info('MasterOrchestrator: Agent routing complete', { 
        orchestrationId, 
        routing 
      });

      // Step 3: Create execution plan with context
      progressBroadcaster.updateProgress(sessionId, {
        phase: 'plan_creation',
        message: 'Creating dynamic execution plan...',
        progress: 60
      });
      
      const plan = await this.createExecutionPlan(taskMessage, complexity, routing, conversationContext);
      
      logger.info('MasterOrchestrator: Execution plan created', { 
        orchestrationId, 
        plan 
      });

      // Step 4: Execute comprehensive plan if created by PlanningAgent
      let executionResult = null;
      if (plan.comprehensive_plan && plan.metadata.planning_agent_used) {
        logger.info('MasterOrchestrator: Executing comprehensive plan from PlanningAgent');
        progressBroadcaster.updateProgress(sessionId, {
          phase: 'plan_execution',
          message: 'Executing comprehensive plan...',
          progress: 80
        });
        
        try {
          executionResult = await this.executeComprehensivePlan(plan, sessionId, orchestrationId);
          logger.info('MasterOrchestrator: Comprehensive plan execution completed', { 
            orchestrationId,
            executionStatus: executionResult.status 
          });
        } catch (error) {
          logger.error('MasterOrchestrator: Comprehensive plan execution failed', { 
            error: error.message,
            orchestrationId 
          });
          executionResult = {
            status: 'failed',
            error: error.message,
            fallback_executed: true
          };
        }
      }

      // Step 5: Store orchestration result
      const metadata = {
        orchestration_id: orchestrationId,
        task_type: routing.primary,
        complexity_level: complexity.level || 'simple'
      };
      
      this.executionPlans.set(orchestrationId, {
        complexity,
        routing,
        plan,
        thinkingResult, // Include thinking result for complex tasks
        executionResult, // Include execution result if comprehensive plan was executed
        conversationContext: conversationContext.slice(-5), // Store last 5 messages for reference
        metadata: {
          ...metadata,
          created_at: new Date().toISOString(),
          session_id: sessionId,
          user_id: inputData.userId || 'anonymous',
          used_think_tool: !!thinkingResult,
          executed_comprehensive_plan: !!executionResult
        }
      });

      const result = {
        session_id: sessionId,
        orchestration_id: orchestrationId,
        orchestration_result: {
          complexity,
          routing,
          execution_plan: plan,
          execution_result: executionResult
        },
        status: 'completed',
        timestamp: new Date().toISOString()
      };

      logger.info('MasterOrchestrator: Orchestration completed successfully', { 
        sessionId, 
        primaryAgent: routing.primary,
        resultStatus: result.status 
      });
      
      progressBroadcaster.completeProgress(sessionId, {
        selectedAgent: routing.primary,
        complexity: complexity.level,
        estimatedTime: complexity.estimated_time
      });
      
      return result;
      
    } catch (error) {
      const orchestrationTime = Date.now() - startTime;
      logger.error('MasterOrchestrator: Orchestration execution failed', {
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack,
          code: error.code
        },
        sessionId,
        taskMessage: taskMessage?.substring(0, 100) + '...',
        orchestrationTime,
        timestamp: new Date().toISOString(),
        context: {
          hasTaskMessage: !!taskMessage,
          taskMessageType: typeof taskMessage,
          taskMessageLength: taskMessage?.length || 0
        }
      });
      progressBroadcaster.errorProgress(sessionId, error);
      throw error;
    }
  }

  async healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      capabilities: this.capabilities
    };
  }

  getKeywordBasedAgent(message) {
    const lowerMessage = message.toLowerCase();
    
    logger.info('MasterOrchestrator: Keyword-based agent selection process', {
      originalMessage: message.substring(0, 200) + '...',
      lowerMessage: lowerMessage.substring(0, 200) + '...',
      fullMessage: message
    });
    
    // Simple greetings and casual conversation patterns
    if (lowerMessage.match(/^(hi|hello|hey|good morning|good afternoon|good evening|greetings|howdy)$/i) ||
        lowerMessage.match(/^(hi|hello|hey)\s*[!.]*$/i) ||
        lowerMessage.includes('how are you') || lowerMessage.includes('what\'s up') ||
        lowerMessage.includes('good day') || lowerMessage.includes('nice to meet')) {
      logger.info('MasterOrchestrator: Matched greeting pattern', { pattern: 'general' });
      return 'general';
    }
    
    // Repository/GitHub analysis patterns
    if (lowerMessage.includes('github.com') || lowerMessage.includes('repository') || 
        lowerMessage.includes('repo') || lowerMessage.includes('analyze') && lowerMessage.includes('code')) {
      logger.info('MasterOrchestrator: Matched development pattern (GitHub/repo)', { pattern: 'development' });
      return 'development';
    }
    
    // Research patterns
    if (lowerMessage.includes('research') || lowerMessage.includes('investigate') || 
        lowerMessage.includes('find information') || lowerMessage.includes('search for')) {
      logger.info('MasterOrchestrator: Matched research pattern', { pattern: 'research' });
      return 'research';
    }
    
    // Development patterns
    if (lowerMessage.includes('code') || lowerMessage.includes('develop') || 
        lowerMessage.includes('build') || lowerMessage.includes('implement')) {
      logger.info('MasterOrchestrator: Matched development pattern (code/build)', { pattern: 'development' });
      return 'development';
    }
    
    // Analysis patterns
    if (lowerMessage.includes('analyze') || lowerMessage.includes('analysis') || 
        lowerMessage.includes('examine') || lowerMessage.includes('evaluate')) {
      logger.info('MasterOrchestrator: Matched analysis pattern', { pattern: 'analysis' });
      return 'analysis';
    }
    
    // Creative patterns
    if (lowerMessage.includes('create') || lowerMessage.includes('write') || 
        lowerMessage.includes('design') || lowerMessage.includes('generate')) {
      logger.info('MasterOrchestrator: Matched creative pattern', { pattern: 'creative' });
      return 'creative';
    }
    
    // Planning patterns
    if (lowerMessage.includes('plan') || lowerMessage.includes('strategy') || 
        lowerMessage.includes('roadmap') || lowerMessage.includes('schedule')) {
      logger.info('MasterOrchestrator: Matched planning pattern', { pattern: 'planning' });
      return 'planning';
    }
    
    // QA patterns
    if (lowerMessage.includes('test') || lowerMessage.includes('quality') || 
        lowerMessage.includes('review') || lowerMessage.includes('check')) {
      logger.info('MasterOrchestrator: Matched QA pattern', { pattern: 'qa' });
      return 'qa';
    }
    
    // Communication patterns
    if (lowerMessage.includes('explain') || lowerMessage.includes('communicate') || 
        lowerMessage.includes('present') || lowerMessage.includes('report')) {
      logger.info('MasterOrchestrator: Matched communication pattern', { pattern: 'communication' });
      return 'communication';
    }
    
    // Default to general for simple queries and conversations
    logger.info('MasterOrchestrator: No specific pattern matched, defaulting to general', { 
      pattern: 'general',
      reason: 'default_fallback'
    });
    return 'general';
  }

  determinePriority(complexityLevel) {
    switch (complexityLevel) {
      case 'simple':
        return 'low';
      case 'moderate':
        return 'medium';
      case 'complex':
        return 'high';
      case 'very_complex':
        return 'critical';
      default:
        return 'medium';
    }
  }

  createCheckpoints(executionOrder) {
    return executionOrder.map((agent, index) => ({
      checkpoint_id: `checkpoint_${index + 1}`,
      agent: agent,
      description: `Complete ${agent} agent execution`,
      estimated_duration: 30,
      dependencies: index > 0 ? [`checkpoint_${index}`] : []
    }));
  }

  /**
   * Execute a comprehensive plan created by the PlanningAgent
   * @param {Object} plan - The execution plan containing comprehensive_plan
   * @param {string} sessionId - Session identifier for progress tracking
   * @param {string} orchestrationId - Orchestration identifier
   * @returns {Object} Execution result with status and outcomes
   */
  async executeComprehensivePlan(plan, sessionId, orchestrationId) {
    const startTime = Date.now();
    const comprehensivePlan = plan.comprehensive_plan;
    
    logger.info('MasterOrchestrator: Starting comprehensive plan execution', {
      orchestrationId,
      workBreakdown: comprehensivePlan.work_breakdown?.length || 0,
      agentCoordination: comprehensivePlan.agent_coordination?.length || 0
    });

    try {
      const executionResults = {
        status: 'in_progress',
        orchestration_id: orchestrationId,
        session_id: sessionId,
        started_at: new Date().toISOString(),
        work_breakdown_results: [],
        agent_coordination_results: [],
        success_metrics_achieved: [],
        risks_encountered: [],
        overall_progress: 0
      };

      // Phase 1: Execute work breakdown structure
      if (comprehensivePlan.work_breakdown && comprehensivePlan.work_breakdown.length > 0) {
        logger.info('MasterOrchestrator: Executing work breakdown structure');
        progressBroadcaster.updateProgress(sessionId, {
          phase: 'work_breakdown_execution',
          message: 'Executing work breakdown tasks...',
          progress: 85
        });

        for (let i = 0; i < comprehensivePlan.work_breakdown.length; i++) {
          const task = comprehensivePlan.work_breakdown[i];
          const taskProgress = ((i + 1) / comprehensivePlan.work_breakdown.length) * 100;
          
          progressBroadcaster.updateProgress(sessionId, {
            phase: 'work_breakdown_execution',
            message: `Executing task: ${task.task_name || task.name || `Task ${i + 1}`}`,
            progress: 85 + (taskProgress * 0.1) // 85-95% range
          });

          try {
            const taskResult = await this.executeWorkBreakdownTask(task, sessionId, orchestrationId);
            executionResults.work_breakdown_results.push({
              task_id: task.id || `task_${i + 1}`,
              task_name: task.task_name || task.name,
              status: taskResult.status,
              result: taskResult.result,
              agent_used: taskResult.agent_used,
              execution_time: taskResult.execution_time,
              completed_at: new Date().toISOString()
            });
            
            logger.debug('MasterOrchestrator: Work breakdown task completed', {
              taskName: task.task_name || task.name,
              status: taskResult.status
            });
          } catch (error) {
            logger.error('MasterOrchestrator: Work breakdown task failed', {
              taskName: task.task_name || task.name,
              error: error.message
            });
            
            executionResults.work_breakdown_results.push({
              task_id: task.id || `task_${i + 1}`,
              task_name: task.task_name || task.name,
              status: 'failed',
              error: error.message,
              completed_at: new Date().toISOString()
            });
          }
        }
      }

      // Phase 2: Execute agent coordination if specified
      if (comprehensivePlan.agent_coordination && comprehensivePlan.agent_coordination.length > 0) {
        logger.info('MasterOrchestrator: Executing agent coordination');
        progressBroadcaster.updateProgress(sessionId, {
          phase: 'agent_coordination',
          message: 'Coordinating multi-agent execution...',
          progress: 95
        });

        for (const coordination of comprehensivePlan.agent_coordination) {
          try {
            const coordResult = await this.executeAgentCoordination(coordination, sessionId, orchestrationId);
            executionResults.agent_coordination_results.push({
              coordination_type: coordination.type || coordination.coordination_type,
              agents_involved: coordination.agents || coordination.agents_involved,
              status: coordResult.status,
              result: coordResult.result,
              completed_at: new Date().toISOString()
            });
          } catch (error) {
            logger.error('MasterOrchestrator: Agent coordination failed', {
              coordinationType: coordination.type,
              error: error.message
            });
            
            executionResults.agent_coordination_results.push({
              coordination_type: coordination.type || coordination.coordination_type,
              status: 'failed',
              error: error.message,
              completed_at: new Date().toISOString()
            });
          }
        }
      }

      // Phase 3: Evaluate success metrics
      if (comprehensivePlan.success_metrics) {
        logger.info('MasterOrchestrator: Evaluating success metrics');
        try {
          const metricsEvaluation = await this.evaluateSuccessMetrics(
            comprehensivePlan.success_metrics,
            executionResults,
            sessionId
          );
          executionResults.success_metrics_achieved = metricsEvaluation.achieved;
          executionResults.overall_progress = metricsEvaluation.overall_progress;
        } catch (error) {
          logger.warn('MasterOrchestrator: Success metrics evaluation failed', { error: error.message });
          executionResults.overall_progress = this.calculateFallbackProgress(executionResults);
        }
      } else {
        executionResults.overall_progress = this.calculateFallbackProgress(executionResults);
      }

      // Determine final status
      const failedTasks = executionResults.work_breakdown_results.filter(r => r.status === 'failed').length;
      const totalTasks = executionResults.work_breakdown_results.length;
      
      if (failedTasks === 0) {
        executionResults.status = 'completed';
      } else if (failedTasks < totalTasks) {
        executionResults.status = 'partially_completed';
      } else {
        executionResults.status = 'failed';
      }

      executionResults.completed_at = new Date().toISOString();
      executionResults.execution_time = Date.now() - startTime;

      logger.info('MasterOrchestrator: Comprehensive plan execution completed', {
        orchestrationId,
        status: executionResults.status,
        tasksCompleted: totalTasks - failedTasks,
        totalTasks,
        executionTime: executionResults.execution_time
      });

      return executionResults;

    } catch (error) {
      logger.error('MasterOrchestrator: Comprehensive plan execution failed', {
        orchestrationId,
        error: error.message,
        executionTime: Date.now() - startTime
      });

      return {
        status: 'failed',
        error: error.message,
        orchestration_id: orchestrationId,
        session_id: sessionId,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        execution_time: Date.now() - startTime
      };
    }
  }

  /**
   * Execute a single work breakdown task by routing to appropriate agent
   * @param {Object} task - Work breakdown task to execute
   * @param {string} sessionId - Session identifier
   * @param {string} orchestrationId - Orchestration identifier
   * @returns {Object} Task execution result
   */
  async executeWorkBreakdownTask(task, sessionId, orchestrationId) {
    const startTime = Date.now();
    
    try {
      // Determine which agent should handle this task
      const taskDescription = task.description || task.task_description || task.name || task.task_name;
      const agentType = task.assigned_agent || task.agent || await this.determineTaskAgent(taskDescription);
      
      logger.debug('MasterOrchestrator: Executing work breakdown task', {
        taskName: task.name || task.task_name,
        agentType,
        orchestrationId
      });

      // Get the appropriate agent instance
      const agent = this.agentRegistry.getAgent(agentType);
      if (!agent) {
        throw new Error(`Agent '${agentType}' not found in registry`);
      }

      // Execute the task with the agent
      const agentInput = {
        message: taskDescription,
        task: taskDescription,
        sessionId: sessionId,
        orchestrationId: orchestrationId,
        taskContext: {
          task_id: task.id,
          task_name: task.name || task.task_name,
          priority: task.priority,
          dependencies: task.dependencies,
          estimated_time: task.estimated_time
        }
      };

      let result;
      if (agentType === 'research') {
        result = await agent.executeResearch(agentInput);
      } else if (agentType === 'analysis') {
        result = await agent.executeAnalysis(agentInput);
      } else if (agentType === 'creative') {
        result = await agent.executeCreative(agentInput);
      } else if (agentType === 'development') {
        result = await agent.executeDevelopment(agentInput);
      } else if (agentType === 'communication') {
        result = await agent.executeCommunication(agentInput);
      } else if (agentType === 'execution') {
        result = await agent.executeExecution(agentInput);
      } else if (agentType === 'qa') {
        result = await agent.executeQualityAssurance(agentInput);
      } else {
        // Generic execution method
        result = await agent.execute(agentInput);
      }

      return {
        status: 'completed',
        result: result,
        agent_used: agentType,
        execution_time: Date.now() - startTime
      };

    } catch (error) {
      logger.error('MasterOrchestrator: Work breakdown task execution failed', {
        taskName: task.name || task.task_name,
        error: error.message
      });

      return {
        status: 'failed',
        error: error.message,
        execution_time: Date.now() - startTime
      };
    }
  }

  /**
   * Execute agent coordination strategy
   * @param {Object} coordination - Agent coordination specification
   * @param {string} sessionId - Session identifier
   * @param {string} orchestrationId - Orchestration identifier
   * @returns {Object} Coordination execution result
   */
  async executeAgentCoordination(coordination, sessionId, orchestrationId) {
    const startTime = Date.now();
    
    try {
      const coordinationType = coordination.type || coordination.coordination_type;
      const agentsInvolved = coordination.agents || coordination.agents_involved || [];
      
      logger.debug('MasterOrchestrator: Executing agent coordination', {
        type: coordinationType,
        agents: agentsInvolved,
        orchestrationId
      });

      let result;
      
      if (coordinationType === 'sequential') {
        result = await this.executeSequentialCoordination(agentsInvolved, coordination, sessionId);
      } else if (coordinationType === 'parallel') {
        result = await this.executeParallelCoordination(agentsInvolved, coordination, sessionId);
      } else if (coordinationType === 'collaborative') {
        result = await this.executeCollaborativeCoordination(agentsInvolved, coordination, sessionId);
      } else {
        // Default to sequential execution
        result = await this.executeSequentialCoordination(agentsInvolved, coordination, sessionId);
      }

      return {
        status: 'completed',
        result: result,
        execution_time: Date.now() - startTime
      };

    } catch (error) {
      logger.error('MasterOrchestrator: Agent coordination execution failed', {
        coordinationType: coordination.type,
        error: error.message
      });

      return {
        status: 'failed',
        error: error.message,
        execution_time: Date.now() - startTime
      };
    }
  }

  /**
   * Evaluate success metrics against execution results
   * @param {Array} successMetrics - Success metrics to evaluate
   * @param {Object} executionResults - Current execution results
   * @param {string} sessionId - Session identifier
   * @returns {Object} Metrics evaluation result
   */
  async evaluateSuccessMetrics(successMetrics, executionResults, sessionId) {
    const achieved = [];
    let totalScore = 0;
    let maxScore = 0;

    for (const metric of successMetrics) {
      maxScore += metric.weight || 1;
      
      try {
        const isAchieved = await this.evaluateMetric(metric, executionResults);
        if (isAchieved) {
          achieved.push({
            metric: metric.name || metric.description,
            achieved: true,
            score: metric.weight || 1
          });
          totalScore += metric.weight || 1;
        } else {
          achieved.push({
            metric: metric.name || metric.description,
            achieved: false,
            score: 0
          });
        }
      } catch (error) {
        logger.warn('MasterOrchestrator: Metric evaluation failed', {
          metric: metric.name,
          error: error.message
        });
        achieved.push({
          metric: metric.name || metric.description,
          achieved: false,
          error: error.message,
          score: 0
        });
      }
    }

    const overallProgress = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

    return {
      achieved,
      overall_progress: overallProgress,
      total_score: totalScore,
      max_score: maxScore
    };
  }

  /**
   * Calculate fallback progress when success metrics evaluation fails
   * @param {Object} executionResults - Execution results to analyze
   * @returns {number} Progress percentage
   */
  calculateFallbackProgress(executionResults) {
    const totalTasks = executionResults.work_breakdown_results.length;
    if (totalTasks === 0) return 100;
    
    const completedTasks = executionResults.work_breakdown_results.filter(r => r.status === 'completed').length;
    return (completedTasks / totalTasks) * 100;
  }

  /**
   * Determine which agent should handle a specific task
   * @param {string} taskDescription - Description of the task
   * @returns {string} Agent type identifier
   */
  async determineTaskAgent(taskDescription) {
    // Simple keyword-based routing for now - could be enhanced with AI
    const description = taskDescription.toLowerCase();
    
    if (description.includes('research') || description.includes('investigate') || description.includes('analyze data')) {
      return 'research';
    } else if (description.includes('analyze') || description.includes('evaluation') || description.includes('metrics')) {
      return 'analysis';
    } else if (description.includes('create') || description.includes('design') || description.includes('content')) {
      return 'creative';
    } else if (description.includes('develop') || description.includes('code') || description.includes('implement')) {
      return 'development';
    } else if (description.includes('communicate') || description.includes('email') || description.includes('message')) {
      return 'communication';
    } else if (description.includes('test') || description.includes('quality') || description.includes('validate')) {
      return 'qa';
    } else {
      return 'execution'; // Default fallback
    }
  }

  /**
   * Execute sequential agent coordination
   * @param {Array} agents - List of agents to coordinate
   * @param {Object} coordination - Coordination specification
   * @param {string} sessionId - Session identifier
   * @returns {Object} Coordination result
   */
  async executeSequentialCoordination(agents, coordination, sessionId) {
    const results = [];
    let previousResult = null;

    for (const agentType of agents) {
      const agent = this.agentRegistry.getAgent(agentType);
      if (!agent) {
        logger.warn(`Agent '${agentType}' not found for sequential coordination`);
        continue;
      }

      const input = {
        message: coordination.task || coordination.description,
        sessionId: sessionId,
        previousResult: previousResult,
        coordinationContext: coordination
      };

      try {
        const result = await agent.execute(input);
        results.push({
          agent: agentType,
          status: 'completed',
          result: result
        });
        previousResult = result;
      } catch (error) {
        results.push({
          agent: agentType,
          status: 'failed',
          error: error.message
        });
        break; // Stop sequential execution on failure
      }
    }

    return { type: 'sequential', results };
  }

  /**
   * Execute parallel agent coordination
   * @param {Array} agents - List of agents to coordinate
   * @param {Object} coordination - Coordination specification
   * @param {string} sessionId - Session identifier
   * @returns {Object} Coordination result
   */
  async executeParallelCoordination(agents, coordination, sessionId) {
    const promises = agents.map(async (agentType) => {
      const agent = this.agentRegistry.getAgent(agentType);
      if (!agent) {
        return {
          agent: agentType,
          status: 'failed',
          error: 'Agent not found'
        };
      }

      const input = {
        message: coordination.task || coordination.description,
        sessionId: sessionId,
        coordinationContext: coordination
      };

      try {
        const result = await agent.execute(input);
        return {
          agent: agentType,
          status: 'completed',
          result: result
        };
      } catch (error) {
        return {
          agent: agentType,
          status: 'failed',
          error: error.message
        };
      }
    });

    const results = await Promise.all(promises);
    return { type: 'parallel', results };
  }

  /**
   * Execute collaborative agent coordination
   * @param {Array} agents - List of agents to coordinate
   * @param {Object} coordination - Coordination specification
   * @param {string} sessionId - Session identifier
   * @returns {Object} Coordination result
   */
  async executeCollaborativeCoordination(agents, coordination, sessionId) {
    // For collaborative coordination, we'll use a round-robin approach
    // where each agent builds on the work of others
    const results = [];
    let sharedContext = {
      task: coordination.task || coordination.description,
      collaborativeResults: []
    };

    for (let round = 0; round < (coordination.rounds || 2); round++) {
      const roundResults = [];
      
      for (const agentType of agents) {
        const agent = this.agentRegistry.getAgent(agentType);
        if (!agent) {
          logger.warn(`Agent '${agentType}' not found for collaborative coordination`);
          continue;
        }

        const input = {
          message: coordination.task || coordination.description,
          sessionId: sessionId,
          sharedContext: sharedContext,
          round: round,
          coordinationContext: coordination
        };

        try {
          const result = await agent.execute(input);
          roundResults.push({
            agent: agentType,
            round: round,
            status: 'completed',
            result: result
          });
          
          // Add to shared context for next agents
          sharedContext.collaborativeResults.push({
            agent: agentType,
            round: round,
            contribution: result
          });
        } catch (error) {
          roundResults.push({
            agent: agentType,
            round: round,
            status: 'failed',
            error: error.message
          });
        }
      }
      
      results.push(...roundResults);
    }

    return { type: 'collaborative', results, sharedContext };
  }

  /**
   * Evaluate a single success metric
   * @param {Object} metric - Success metric to evaluate
   * @param {Object} executionResults - Current execution results
   * @returns {boolean} Whether the metric is achieved
   */
  async evaluateMetric(metric, executionResults) {
    const metricType = metric.type || metric.metric_type;
    const target = metric.target || metric.target_value;

    switch (metricType) {
      case 'completion_rate':
        const completionRate = this.calculateFallbackProgress(executionResults);
        return completionRate >= target;
        
      case 'task_success':
        const successfulTasks = executionResults.work_breakdown_results.filter(r => r.status === 'completed').length;
        return successfulTasks >= target;
        
      case 'time_limit':
        const totalTime = executionResults.execution_time || 0;
        return totalTime <= target;
        
      case 'quality_score':
        // This would require more sophisticated quality evaluation
        // For now, assume quality is met if tasks completed successfully
        const qualityScore = this.calculateFallbackProgress(executionResults);
        return qualityScore >= target;
        
      default:
        logger.warn('MasterOrchestrator: Unknown metric type', { metricType });
        return false;
    }
  }

  /**
   * Get comprehensive agent registry information for planning
   * @returns {Object} Complete agent registry data with capabilities, tools, and performance metrics
   */
  getAgentRegistryInfo() {
    try {
      const registryStats = this.agentRegistry.getRegistryStats();
      const allAgents = this.agentRegistry.getAllAgents();
      
      const agentInfo = {
        total_agents: registryStats.totalAgents,
        agents: allAgents.map(agent => ({
          id: agent.id,
          name: agent.name,
          description: agent.description,
          capabilities: agent.capabilities,
          tools: agent.tools,
          domains: agent.domains,
          complexity_level: agent.complexity_level,
          max_iterations: agent.max_iterations,
          routing_keywords: agent.routing_keywords,
          confidence_threshold: agent.confidence_threshold,
          performance_metrics: agent.performance_metrics,
          search_priority: agent.search_priority
        })),
        capabilities_distribution: registryStats.capabilityDistribution,
        domain_distribution: registryStats.agentsByDomain,
        complexity_distribution: registryStats.agentsByComplexity,
        performance_stats: registryStats.performanceStats
      };
      
      logger.debug('MasterOrchestrator: Agent registry info compiled', {
        totalAgents: agentInfo.total_agents,
        capabilities: Object.keys(agentInfo.capabilities_distribution).length,
        domains: Object.keys(agentInfo.domain_distribution).length
      });
      
      return agentInfo;
      
    } catch (error) {
      logger.error('MasterOrchestrator: Failed to get agent registry info', { error: error.message });
      
      // Fallback minimal agent info
      return {
        total_agents: 0,
        agents: [],
        capabilities_distribution: {},
        domain_distribution: {},
        complexity_distribution: {},
        performance_stats: {},
        error: 'Failed to load agent registry information'
      };
    }
  }

  async think(problem) {
    logger.debug('MasterOrchestrator: Starting think process', { problem: problem.substring(0, 100) });
    
    try {
      // AI-powered thinking with step-by-step reasoning
      const thinkPrompt = PromptTemplate.fromTemplate(`
You are the Master Orchestrator's reasoning engine. Think through complex problems step by step with systematic analysis.

REASONING PHASE:
1. First, break down the problem into its core components
2. Identify the key challenges and requirements
3. Consider multiple approaches and their trade-offs
4. Determine the optimal strategy and execution plan
5. Anticipate potential obstacles and mitigation strategies
6. Synthesize your analysis into actionable insights

PROBLEM TO ANALYZE:
{problem}

INSTRUCTIONS:
- Think systematically through each phase
- Consider complexity, dependencies, and resource requirements
- Provide clear reasoning for your recommendations
- Structure your response as numbered steps with explanations
- Focus on practical, actionable insights

Provide your step-by-step reasoning and recommendations:
`);

      const chain = thinkPrompt.pipe(this.llm).pipe(new StringOutputParser());
      
      const startTime = Date.now();
      const reasoning = await chain.invoke({ problem });
      const responseTime = Date.now() - startTime;
      
      logger.debug('MasterOrchestrator: Think process completed', { 
        responseTime,
        reasoningLength: reasoning.length 
      });

      // Parse the reasoning into structured steps
      const steps = this.parseReasoningSteps(reasoning);
      
      return {
        problem,
        reasoning,
        steps,
        responseTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('MasterOrchestrator: Think process failed', { 
        error: error.message,
        problem: problem.substring(0, 100)
      });
      
      // Fallback to simple structured thinking
      return {
        problem,
        reasoning: `Fallback analysis: ${problem}`,
        steps: [
          { step: 1, description: 'Analyze the problem', reasoning: 'Break down the core requirements' },
          { step: 2, description: 'Consider approaches', reasoning: 'Evaluate different solution strategies' },
          { step: 3, description: 'Plan execution', reasoning: 'Determine implementation steps' }
        ],
        responseTime: 0,
        timestamp: new Date().toISOString(),
        fallback: true,
        error: error.message
      };
    }
  }

  parseReasoningSteps(reasoning) {
    const steps = [];
    const lines = reasoning.split('\n');
    let currentStep = null;
    let stepCounter = 1;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Look for numbered steps or bullet points
      if (trimmedLine.match(/^\d+\./)) {
        if (currentStep) {
          steps.push(currentStep);
        }
        currentStep = {
          step: stepCounter++,
          description: trimmedLine.replace(/^\d+\.\s*/, ''),
          reasoning: ''
        };
      } else if (trimmedLine.match(/^[-*•]/)) {
        if (currentStep) {
          steps.push(currentStep);
        }
        currentStep = {
          step: stepCounter++,
          description: trimmedLine.replace(/^[-*•]\s*/, ''),
          reasoning: ''
        };
      } else if (currentStep && trimmedLine.length > 0) {
        currentStep.reasoning += (currentStep.reasoning ? ' ' : '') + trimmedLine;
      }
    }
    
    // Add the last step
    if (currentStep) {
      steps.push(currentStep);
    }

    // If no structured steps found, create a simple breakdown
    if (steps.length === 0) {
      const sentences = reasoning.split('.').filter(s => s.trim().length > 0);
      sentences.slice(0, 5).forEach((sentence, index) => {
        steps.push({
          step: index + 1,
          description: sentence.trim(),
          reasoning: 'AI-generated reasoning step'
        });
      });
    }

    return steps;
  }

  async shutdown() {
    logger.info('MasterOrchestrator shutting down');
    this.executionPlans.clear();
  }
}

module.exports = { MasterOrchestrator };
