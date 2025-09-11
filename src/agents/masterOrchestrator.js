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
        timeout: parseInt(process.env.OPENROUTER_TIMEOUT) || 30000,
        maxRetries: 2,
        tags: ['master-orchestrator', 'athenai', 'openrouter']
      });
    } else {
      this.llm = new ChatOpenAI({
        modelName: process.env.OPENAI_MODEL || 'gpt-4',
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.1,
        openAIApiKey: process.env.OPENAI_API_KEY,
        timeout: parseInt(process.env.OPENAI_TIMEOUT) || 60000,
        maxRetries: 2,
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
2. What level of expertise is required?
3. How much research or analysis is needed?
4. Are there multiple domains of knowledge involved?
5. How long might this reasonably take?

STEP-BY-STEP REASONING:
Think through each criterion above and explain your reasoning for the complexity level.

Respond in this exact JSON format:
{{
  "level": "low|medium|high",
  "factors": ["list", "of", "complexity", "factors"],
  "estimated_time": number_in_seconds,
  "required_agents": ["list", "of", "agent", "types"],
  "reasoning": "detailed step-by-step explanation of your complexity assessment including your reasoning process"
}}`);

      const chain = complexityPrompt.pipe(this.llm).pipe(new StringOutputParser());
      
      // Execute with built-in timeout and retry logic
      const response = await chain.invoke({ message: taskString });
      
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
      
      // AI-powered agent routing with explicit reasoning
      const routingPrompt = PromptTemplate.fromTemplate(`
You are an expert agent routing specialist. Before selecting an agent, think through your decision step by step.

REASONING PHASE:
1. First, analyze the core intent and requirements of the user message
2. Identify the primary domain of expertise needed
3. Consider what tools and capabilities would be most effective
4. Evaluate which agent's specialization best matches the task
5. Consider any secondary agents that might be helpful

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
- document: For document processing, upload, search, analysis, and email attachments
- general: For casual conversation, greetings, simple questions

STEP-BY-STEP ANALYSIS:
1. What is the primary intent and goal of the message?
2. What type of expertise is needed?
3. What tools and capabilities would be most useful?
4. Which agent's core competencies align best with these requirements?

Think through your reasoning, then respond with ONLY the agent name (research, creative, analysis, development, planning, execution, communication, qa, document, or general).`);

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
      const validAgents = ['research', 'creative', 'analysis', 'development', 'planning', 'execution', 'communication', 'qa', 'document', 'general'];
      const selectedAgent = validAgents.includes(cleanAgent) ? cleanAgent : 'general';
      
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
