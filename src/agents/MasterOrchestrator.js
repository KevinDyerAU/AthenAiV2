const { ChatOpenAI } = require('@langchain/openai');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { logger } = require('../utils/logger');

class MasterOrchestrator {
  constructor() {
    // Primary OpenAI configuration with OpenRouter fallback
    const useOpenRouter = process.env.USE_OPENROUTER === 'true';
    
    if (useOpenRouter) {
      this.llm = new ChatOpenAI({
        modelName: process.env.OPENROUTER_MODEL || 'openai/gpt-4',
        temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE) || 0.1,
        openAIApiKey: process.env.OPENROUTER_API_KEY,
        configuration: {
          baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            'HTTP-Referer': 'https://athenai.local',
            'X-Title': 'AthenAI Master Orchestrator'
          }
        },
        tags: ['master-orchestrator', 'athenai', 'openrouter']
      });
    } else {
      this.llm = new ChatOpenAI({
        modelName: process.env.OPENAI_MODEL || 'gpt-4',
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.1,
        openAIApiKey: process.env.OPENAI_API_KEY,
        tags: ['master-orchestrator', 'athenai', 'openai']
      });
    }
    
    this.name = 'MasterOrchestrator';
    this.capabilities = ['task-analysis', 'agent-routing', 'orchestration'];
    this.agents = new Map();
    this.executionPlans = new Map();
  }

  async analyzeTaskComplexity(task) {
    try {
      // Ensure task is a string
      const taskString = typeof task === 'string' ? task : JSON.stringify(task);
      
      // AI-powered complexity analysis
      const complexityPrompt = PromptTemplate.fromTemplate(`
Analyze the complexity of this user request and provide a structured assessment.

User Request: {message}

Consider:
1. How many steps or sub-tasks are involved?
2. What level of expertise is required?
3. How much research or analysis is needed?
4. Are there multiple domains of knowledge involved?
5. How long might this reasonably take?

Respond in this exact JSON format:
{{
  "level": "low|medium|high",
  "factors": ["list", "of", "complexity", "factors"],
  "estimated_time": number_in_seconds,
  "required_agents": ["list", "of", "agent", "types"],
  "reasoning": "brief explanation of the complexity assessment"
}}
`);

      const chain = complexityPrompt.pipe(this.llm).pipe(new StringOutputParser());
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OpenRouter API timeout')), 10000); // 10 second timeout
      });
      
      const response = await Promise.race([
        chain.invoke({ message: taskString }),
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

  async determineAgentRouting(task) {
    try {
      // Ensure task is a string
      const taskString = typeof task === 'string' ? task : JSON.stringify(task);
      
      // AI-powered agent routing using LangChain
      const routingPrompt = PromptTemplate.fromTemplate(`
Analyze the following user message and determine the most appropriate AI agent to handle it.

User Message: {message}

Available Agents:
- research: For information gathering, fact-finding, data analysis, answering questions
- creative: For creative writing, brainstorming, design ideas, artistic content
- analysis: For data analysis, problem-solving, logical reasoning, technical analysis
- development: For coding, programming, technical implementation, software development
- planning: For project planning, task breakdown, timeline creation, resource allocation
- execution: For task execution, workflow management, process automation
- communication: For message formatting, external communications, notifications
- qa: For quality assurance, validation, testing, review processes
- general: For casual conversation, greetings, simple questions

Consider:
1. The primary intent and goal of the message
2. What type of expertise is needed
3. What tools and capabilities would be most useful

Respond with ONLY the agent name (research, creative, analysis, development, planning, execution, communication, qa, or general).
`);

      const chain = routingPrompt.pipe(this.llm).pipe(new StringOutputParser());
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OpenRouter API timeout')), 10000); // 10 second timeout
      });
      
      const primaryAgent = await Promise.race([
        chain.invoke({ message: taskString }),
        timeoutPromise
      ]);
      
      // Clean and validate the response
      const cleanAgent = primaryAgent.toLowerCase().trim();
      const validAgents = ['research', 'creative', 'analysis', 'development', 'planning', 'execution', 'communication', 'qa', 'general'];
      const selectedAgent = validAgents.includes(cleanAgent) ? cleanAgent : 'general';
      
      // Determine secondary agents and execution order based on primary
      let secondary = [];
      let executionOrder = [selectedAgent];
      
      if (selectedAgent === 'research') {
        secondary = ['analysis'];
        executionOrder = ['research', 'analysis'];
      } else if (selectedAgent === 'analysis') {
        secondary = ['research'];
        executionOrder = ['analysis', 'research'];
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
      
      return {
        primary: selectedAgent,
        secondary,
        execution_order: executionOrder,
        parallel_execution: false,
        reasoning: `AI determined '${selectedAgent}' agent is best suited for this task`
      };
    } catch (error) {
      logger.error('AI agent routing determination failed, falling back to keyword matching', { error: error.message });
      
      // Fallback to simple keyword matching if AI fails
      const taskString = typeof task === 'string' ? task : JSON.stringify(task);
      const taskLower = taskString.toLowerCase();
      
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
      
      return {
        primary,
        secondary: ['analysis'],
        execution_order: [primary, 'analysis'],
        parallel_execution: false,
        reasoning: 'Fallback keyword matching used'
      };
    }
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateOrchestrationId() {
    return `orch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  createExecutionPlan(task, complexity, routing) {
    try {
      const planId = `plan_${Date.now()}`;
      const steps = [
        {
          step: 1,
          agent: routing.primary || 'research',
          action: 'analyze_and_research',
          input: task,
          expected_output: 'research_results'
        },
        {
          step: 2,
          agent: (routing.secondary && routing.secondary[0]) || 'analysis',
          action: 'synthesize_results',
          input: 'research_results',
          expected_output: 'final_analysis'
        }
      ];

      const plan = {
        id: planId,
        task,
        complexity,
        routing,
        steps,
        estimated_duration: complexity.estimated_time || 300,
        resource_requirements: ['llm_access', 'web_search'],
        created_at: new Date().toISOString()
      };

      this.executionPlans.set(planId, plan);
      
      return plan;
    } catch (error) {
      logger.error('Execution plan creation failed', { error: error.message });
      throw error;
    }
  }

  async executeOrchestration(inputData) {
    try {
      const sessionId = await this.generateSessionId();
      const complexity = await this.analyzeTaskComplexity(inputData.task || inputData);
      const routing = await this.determineAgentRouting(inputData.task || inputData);
      const plan = await this.createExecutionPlan(inputData.task || inputData, complexity, routing);

      return {
        session_id: sessionId,
        orchestration_result: {
          complexity,
          routing,
          execution_plan: plan
        },
        status: 'completed',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Orchestration execution failed', { error: error.message });
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

  async shutdown() {
    logger.info('MasterOrchestrator shutting down');
    this.executionPlans.clear();
  }
}

module.exports = { MasterOrchestrator };
