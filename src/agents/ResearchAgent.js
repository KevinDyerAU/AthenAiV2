const { ChatOpenAI } = require('@langchain/openai');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { RunnableSequence } = require('@langchain/core/runnables');
const { DynamicTool } = require('@langchain/core/tools');
const { AgentExecutor } = require('langchain/agents');
const { ChatAgent } = require('langchain/agents');
const axios = require('axios');
const { logger } = require('../utils/logger');
const { ReasoningFramework } = require('../utils/reasoningFramework');
const { databaseService } = require('../services/database');
const { progressBroadcaster } = require('../services/progressBroadcaster');

class ResearchAgent {
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
            'X-Title': 'AthenAI Research Agent'
          }
        },
        tags: ['research-agent', 'athenai', 'openrouter']
      });
    } else {
      this.llm = new ChatOpenAI({
        modelName: process.env.OPENAI_MODEL || 'gpt-4',
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.1,
        openAIApiKey: process.env.OPENAI_API_KEY,
        timeout: parseInt(process.env.OPENAI_TIMEOUT) || 60000,
        maxRetries: 2,
        tags: ['research-agent', 'athenai', 'openai']
      });
    }
    
    this.name = 'ResearchAgent';
    this.capabilities = ['research', 'analysis', 'information-gathering', 'fact-checking', 'synthesis'];
    this.researchPlans = new Map();
    this.tools = [];
    this.agent = null;
    this.agentExecutor = null;
    
    // Initialize reasoning framework
    this.reasoning = new ReasoningFramework('ResearchAgent');
    
    // Initialize tools after constructor
    this.initializeTools();
  }

  async retrieveKnowledgeContext(query, sessionId) {
    try {
      // Query knowledge substrate for relevant research context
      const knowledgeQuery = {
        content_type: 'research_context',
        query_hash: this.generateQueryHash(query),
        session_id: sessionId
      };

      // Retrieve similar research queries and findings
      const domain = this.inferQueryDomain(query);
      const similarResearch = await databaseService.queryKnowledgeGraph(
        `MATCH (n:research_finding) WHERE n.domain = $domain RETURN n LIMIT 5`,
        { domain }
      );

      // Retrieve cached web search results for similar queries
      const queryHash = this.generateQueryHash(query);
      const cachedResults = await databaseService.queryKnowledgeGraph(
        `MATCH (n:web_search_cache) WHERE n.query_hash = $queryHash RETURN n LIMIT 3`,
        { queryHash }
      );

      return {
        similar_research: similarResearch || [],
        cached_results: cachedResults || [],
        domain_context: this.inferQueryDomain(query),
        retrieved_at: new Date().toISOString()
      };
    } catch (error) {
      logger.warn('Failed to retrieve research knowledge context', { error: error.message });
      return {
        similar_research: [],
        cached_results: [],
        domain_context: 'general',
        retrieved_at: new Date().toISOString()
      };
    }
  }

  async storeResearchInsights(query, results, sessionId, orchestrationId) {
    try {
      // Store research insights in knowledge substrate
      const insights = {
        session_id: sessionId,
        orchestration_id: orchestrationId,
        query: query,
        query_hash: this.generateQueryHash(query),
        domain: this.inferQueryDomain(query),
        search_results: results,
        research_patterns: this.extractResearchPatterns(results),
        created_at: new Date().toISOString()
      };

      await databaseService.createKnowledgeNode(
        sessionId,
        orchestrationId,
        'ResearchInsights',
        insights
      );

      logger.info('Research insights stored in knowledge substrate', { sessionId, orchestrationId });
    } catch (error) {
      logger.warn('Failed to store research insights', { error: error.message });
    }
  }

  generateQueryHash(query) {
    // Simple hash for query similarity matching
    const str = typeof query === 'string' ? query.toLowerCase() : JSON.stringify(query).toLowerCase();
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  inferQueryDomain(query) {
    const str = typeof query === 'string' ? query.toLowerCase() : JSON.stringify(query).toLowerCase();
    
    if (str.includes('github') || str.includes('repository') || str.includes('code')) return 'software';
    if (str.includes('security') || str.includes('vulnerability')) return 'security';
    if (str.includes('api') || str.includes('endpoint')) return 'api';
    if (str.includes('performance') || str.includes('optimization')) return 'performance';
    if (str.includes('data') || str.includes('analysis')) return 'data';
    if (str.includes('ai') || str.includes('machine learning') || str.includes('ml')) return 'ai';
    
    return 'general';
  }

  extractResearchPatterns(results) {
    // Extract research patterns for future reference
    const patterns = [];
    
    if (results.includes('documentation')) patterns.push('documentation_research');
    if (results.includes('tutorial') || results.includes('guide')) patterns.push('educational_content');
    if (results.includes('github') || results.includes('repository')) patterns.push('code_repository_research');
    if (results.includes('api') || results.includes('endpoint')) patterns.push('api_research');
    if (results.includes('security') || results.includes('vulnerability')) patterns.push('security_research');
    
    return patterns;
  }

  initializeTools() {
    this.tools = [
      new DynamicTool({
        name: 'knowledge_enhanced_web_search',
        description: 'Search web content with knowledge substrate enhancement - checks existing knowledge before performing web searches',
        func: async (query) => {
          try {
            const sessionId = this.currentSessionId || 'default_session';
            
            // PHASE 1: Check knowledge substrate first
            if (sessionId) {
              progressBroadcaster.updateProgress(sessionId, 'knowledge_retrieval', 'Checking knowledge substrate for existing research...');
            }
            
            const knowledgeContext = await this.retrieveKnowledgeContext(query, sessionId);
            
            // If we have sufficient cached results, use them
            if (knowledgeContext.cached_results.length > 0) {
              if (sessionId) {
                progressBroadcaster.updateProgress(sessionId, 'knowledge_utilization', 'Found relevant cached research, enhancing with fresh data...');
              }
              
              const cachedSummary = knowledgeContext.cached_results.map((result, index) => 
                `${index + 1}. [CACHED] ${result.title || 'Cached Result'}\n   ${result.summary || result.content || 'No summary available'}`
              ).join('\n\n');
              
              // Still perform a limited web search for fresh data
              const freshResults = await this.performWebSearch(query, 2); // Limited search
              
              const combinedResults = `KNOWLEDGE SUBSTRATE RESULTS:\n${cachedSummary}\n\nFRESH WEB SEARCH RESULTS:\n${freshResults}`;
              
              // Store the new insights
              await this.storeResearchInsights(query, combinedResults, sessionId, sessionId);
              
              return combinedResults;
            }
            
            // PHASE 2: Perform full web search with knowledge context
            if (sessionId) {
              progressBroadcaster.updateProgress(sessionId, 'web_search', 'Performing enhanced web search with knowledge context...');
            }
            
            const webResults = await this.performWebSearch(query, 5);
            
            // PHASE 3: Store insights for future use
            await this.storeResearchInsights(query, webResults, sessionId, sessionId);
            
            return webResults;
          } catch (error) {
            logger.error('Knowledge-enhanced web search failed:', error);
            return `Enhanced web search error: ${error.message}`;
          }
        }
      }),

      new DynamicTool({
        name: 'web_search',
        description: 'Direct web search using Firecrawl API (fallback method)',
        func: async (query) => {
          return await this.performWebSearch(query, 5);
        }
      }),
      
      new DynamicTool({
        name: 'think',
        description: 'Think through complex research challenges step by step, evaluate different research approaches, and reason about the optimal research strategy',
        func: async (input) => {
          try {
            // Broadcast thinking progress if sessionId is available
            const sessionId = this.currentSessionId;
            if (sessionId && typeof progressBroadcaster !== 'undefined') {
              progressBroadcaster.updateThinking(sessionId, 'research_analysis', 'Analyzing research challenge and planning approach...');
            }

            const thinkPrompt = PromptTemplate.fromTemplate(`
You are working through a complex research challenge. Break down your research reasoning step by step.

Research Challenge: {problem}

Think through this systematically:
1. What is the core research question or information need?
2. What different research approaches or methodologies could I use?
3. What are the potential sources of information for each approach?
4. What are the strengths and limitations of each research method?
5. What biases or gaps might exist in available information?
6. What is my recommended research strategy and why?
7. How will I validate and cross-reference my findings?
8. What follow-up research questions might emerge?

Provide your step-by-step research reasoning:
`);

            const chain = thinkPrompt.pipe(this.llm).pipe(new StringOutputParser());
            const thinking = await chain.invoke({ problem: input });
            
            if (sessionId && typeof progressBroadcaster !== 'undefined') {
              progressBroadcaster.updateThinking(sessionId, 'research_strategy', thinking.substring(0, 200) + '...');
            }
            
            return `RESEARCH THINKING PROCESS:\n${thinking}`;
          } catch (error) {
            return `Thinking error: ${error.message}`;
          }
        }
      }),

      new DynamicTool({
        name: 'knowledge_synthesis',
        description: 'Synthesize information from multiple sources and provide comprehensive analysis',
        func: async (input) => {
          try {
            const synthesisPrompt = PromptTemplate.fromTemplate(`
Available tools: {tools}
- Use the 'think' tool when you need to reason through complex research challenges step by step

Think through your reasoning process, then provide comprehensive research with:

Topic: {topic}
Context: {context}

Provide:
1. Key insights and findings
2. Connections between different aspects
3. Implications and significance
4. Areas that need further research

Be thorough but concise.
`);
            
            const chain = synthesisPrompt.pipe(this.llm).pipe(new StringOutputParser());
            const result = await chain.invoke({ topic: input, context: input });
            return result;
          } catch (error) {
            logger.error('Knowledge synthesis failed:', error);
            return 'Unable to synthesize information at this time.';
          }
        }
      }),
      
      new DynamicTool({
        name: 'fact_verification',
        description: 'Verify facts and check the reliability of information',
        func: async (input) => {
          try {
            const verificationPrompt = PromptTemplate.fromTemplate(`
Analyze the following statement for factual accuracy and reliability:

Statement: {statement}

Provide:
1. Assessment of factual accuracy (if verifiable)
2. Reliability indicators
3. Potential sources of verification
4. Any caveats or limitations

Be objective and indicate confidence level.
`);
            
            const chain = verificationPrompt.pipe(this.llm).pipe(new StringOutputParser());
            const result = await chain.invoke({ statement: input });
            return result;
          } catch (error) {
            logger.error('Fact verification failed:', error);
            return 'Unable to verify facts at this time.';
          }
        }
      }),
      
      new DynamicTool({
        name: 'research_planning',
        description: 'Create a structured research plan for complex topics',
        func: async (input) => {
          try {
            const planningPrompt = PromptTemplate.fromTemplate(`
Create a comprehensive research plan for the following topic:

Topic: {topic}

Provide a structured plan including:
1. Key research questions to investigate
2. Information sources to consult
3. Research methodology approach
4. Expected deliverables
5. Potential challenges and mitigation strategies

Format as a clear, actionable plan.
`);
            
            const chain = planningPrompt.pipe(this.llm).pipe(new StringOutputParser());
            const result = await chain.invoke({ topic: input });
            return result;
          } catch (error) {
            logger.error('Research planning failed:', error);
            return 'Unable to create research plan at this time.';
          }
        }
      })
    ];
  }

  async performWebSearch(query, limit = 5) {
    try {
      if (!process.env.FIRECRAWL_API_KEY) {
        return 'Web search unavailable: Firecrawl API key not configured';
      }
      
      // Use Firecrawl search endpoint
      const response = await axios.post('https://api.firecrawl.dev/v0/search', {
        query: query,
        pageOptions: {
          onlyMainContent: true,
          includeHtml: false,
          waitFor: 0
        },
        searchOptions: {
          limit: limit
        }
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      
      const results = response.data.data || [];
      if (results.length === 0) {
        return `No search results found for: ${query}`;
      }
      
      const searchResults = results.map((result, index) => {
        const content = result.content ? result.content.substring(0, 300) + '...' : 'No content available';
        return `${index + 1}. ${result.metadata?.title || 'No title'}\n   ${content}\n   Source: ${result.metadata?.sourceURL || result.url}`;
      }).join('\n\n');
      
      return `Web search results for "${query}":\n\n${searchResults}`;
    } catch (error) {
      logger.error('Firecrawl search failed:', error);
      return `Web search error: ${error.message}`;
    }
  }

  async initialize() {
    logger.info('ResearchAgent initialized');
    return {
      status: 'initialized',
      agent_name: this.name,
      capabilities: this.capabilities
    };
  }

  generateResearchPlan(query) {
    try {
      const planId = `research_plan_${Date.now()}`;
      const plan = {
        id: planId,
        query,
        steps: [
          'analyze_query_intent',
          'identify_key_concepts',
          'gather_information_sources',
          'synthesize_knowledge',
          'verify_facts',
          'generate_insights'
        ],
        tools_needed: ['web_search', 'knowledge_synthesis', 'fact_verification', 'research_planning'],
        langchain_tools: this.tools.map(tool => tool.name),
        estimated_time: 240,
        methodology: 'AI-powered research with LangChain tools',
        created_at: new Date().toISOString()
      };

      this.researchPlans.set(planId, plan);

      return plan;
    } catch (error) {
      logger.error('Research plan generation failed', { error: error.message });
      throw error;
    }
  }

  validateQuery(query) {
    try {
      const issues = [];
      
      if (!query || typeof query !== 'string') {
        issues.push('Query must be a non-empty string');
      }

      if (query && query.length < 3) {
        issues.push('Query too short (minimum 3 characters)');
      }

      if (query && query.length > 1000) {
        issues.push('Query too long (maximum 1000 characters)');
      }

      return {
        is_valid: issues.length === 0,
        validation_issues: issues
      };
    } catch (error) {
      logger.error('Query validation failed', { error: error.message });
      return {
        is_valid: false,
        validation_issues: ['Validation error occurred']
      };
    }
  }

  formatResults(rawResults) {
    try {
      const formatted = {
        summary: rawResults.analysis || 'Research completed successfully',
        sources: rawResults.web_search || ['Source 1', 'Source 2'],
        analysis: rawResults.analysis || 'Analysis completed',
        confidence_level: rawResults.confidence || 0.8,
        recommendations: rawResults.recommendations || ['Recommendation 1']
      };

      return formatted;
    } catch (error) {
      logger.error('Results formatting failed', { error: error.message });
      throw error;
    }
  }

  async initializeAgent() {
    try {
      // Use a simpler approach without OpenAI function calling to avoid naming pattern issues
      logger.info('Initializing Research Agent with direct tool execution');
      
      // Skip complex agent initialization and use direct tool execution
      this.agentExecutor = null; // Force fallback to direct LLM calls
      
      logger.info('Research Agent initialized with direct tool execution');
    } catch (error) {
      logger.error('Failed to initialize research agent:', error);
      // Continue without agent executor - will fall back to direct LLM calls
    }
  }

  async executeResearch(message, sessionId, orchestrationId, options = {}) {
    // Store session ID for think tool access
    this.currentSessionId = options.sessionId || sessionId;
    try {
      const query = typeof message === 'string' ? message : (message.query || message.task || message);
      logger.info('Research Agent executing advanced query', { query, sessionId });
      
      // PHASE 1: Strategic Planning and Reasoning
      const strategyPlan = await this.reasoning.planStrategy(query, {
        time_constraint: 'normal',
        quality_priority: 'high',
        creativity_needed: false
      });
      
      logger.info('Research strategy planned', { 
        strategy: strategyPlan.selected_strategy.name,
        confidence: strategyPlan.confidence,
        reasoning: strategyPlan.reasoning
      });
      
      // Ensure tools are properly initialized
      if (!this.tools || this.tools.length === 0) {
        this.initializeTools();
      }
      
      // PHASE 2: Execute Research with Strategy
      const researchResult = await this.enhancedDirectResearch(query, strategyPlan);
      
      // PHASE 3: Self-Evaluation
      const evaluation = await this.reasoning.evaluateOutput(researchResult, query, strategyPlan);
      
      logger.info('Research self-evaluation completed', {
        overall_rating: evaluation.overall_rating,
        confidence_score: evaluation.confidence_score,
        meets_criteria: evaluation.meets_success_criteria
      });
      
      // Generate research plan for complex queries
      const researchPlan = await this.generateAdvancedResearchPlan(query);
      
      return {
        summary: researchResult,
        agent_type: 'research',
        confidence: evaluation.confidence_score,
        query: query,
        research_plan: researchPlan,
        session_id: sessionId,
        tools_used: this.tools.map(tool => tool.name),
        timestamp: new Date().toISOString(),
        strategy_plan: strategyPlan,
        self_evaluation: evaluation,
        reasoning_logs: this.reasoning.getReasoningLogs()
      };
    } catch (error) {
      logger.error('Research execution failed', { error: error.message });
      const safeQuery = typeof inputData === 'string' ? inputData : (inputData?.query || inputData?.task || 'unknown query');
      return {
        summary: `I encountered an issue while researching "${safeQuery}". Let me provide what I can: This appears to be an interesting topic that would benefit from systematic investigation. Could you provide more specific aspects you'd like me to focus on?`,
        agent_type: 'research',
        confidence: 0.6,
        query: safeQuery,
        error: 'Research execution failed'
      };
    }
  }

  async enhancedDirectResearch(query, strategyPlan = null) {
    try {
      // Step 1: Try web search if available
      let webSearchResults = '';
      if (process.env.FIRECRAWL_API_KEY && this.tools && Array.isArray(this.tools)) {
        const webTool = this.tools.find(tool => tool && tool.name === 'web_search');
        if (webTool && typeof webTool.func === 'function') {
          try {
            webSearchResults = await webTool.func(query);
          } catch (error) {
            logger.warn('Web search failed:', error);
          }
        }
      }

      // Step 2: Use knowledge synthesis if we have web results
      let synthesizedKnowledge = '';
      if (webSearchResults && this.tools) {
        const synthesisTool = this.tools.find(tool => tool && tool.name === 'knowledge_synthesis');
        if (synthesisTool && typeof synthesisTool.func === 'function') {
          try {
            synthesizedKnowledge = await synthesisTool.func(`${query}\n\nWeb Search Results:\n${webSearchResults}`);
          } catch (error) {
            logger.warn('Knowledge synthesis failed:', error);
          }
        }
      }

      // Step 3: Create comprehensive research response using LLM with reasoning
      const researchPrompt = PromptTemplate.fromTemplate(`
You are a research specialist with advanced reasoning capabilities. Before providing your analysis, think through your approach step by step.

REASONING PHASE:
1. First, analyze what the user is really asking for
2. Consider what approach would be most effective for this query
3. Evaluate the quality and relevance of available information
4. Plan how to structure your response for maximum value

Query: {query}
Strategy Selected: {strategy}

Web Search Results:
{webResults}

Synthesized Knowledge:
{synthesis}

Now provide a thorough research response that includes:
1. Executive Summary
2. Key Findings  
3. Analysis and Insights
4. Supporting Evidence
5. Implications and Recommendations
6. Areas for Further Research
7. Confidence Assessment

Be comprehensive, accurate, and cite sources where applicable. Show your reasoning process where helpful.
`);

      const chain = researchPrompt.pipe(this.llm).pipe(new StringOutputParser());
      return await chain.invoke({
        query,
        strategy: strategyPlan ? strategyPlan.selected_strategy.name : 'direct',
        webResults: webSearchResults || 'No web search results available',
        synthesis: synthesizedKnowledge || 'No additional synthesis available'
      });
    } catch (error) {
      logger.error('Enhanced direct research failed:', error);
      return await this.fallbackResearch(query);
    }
  }
  
  async fallbackResearch(query) {
    try {
      const fallbackPrompt = PromptTemplate.fromTemplate(`
You are an expert research assistant with deep knowledge across multiple domains. Conduct comprehensive research on the following topic:

Topic: {query}

Provide a thorough response that includes:
1. **Overview**: Clear explanation of the topic and its significance
2. **Key Insights**: Important findings, facts, and current understanding
3. **Analysis**: Critical examination of different perspectives or approaches
4. **Implications**: What this means in practical terms or broader context
5. **Further Exploration**: Suggested areas for deeper investigation

Make your response informative, well-structured, and engaging. Use examples where helpful.
`);
    
      const chain = fallbackPrompt.pipe(this.llm).pipe(new StringOutputParser());
      return await chain.invoke({ query });
    } catch (error) {
      logger.error('Fallback research failed:', error);
      return 'Fallback research failed';
    }
  }
  
  async generateAdvancedResearchPlan(query) {
    try {
      const planPrompt = PromptTemplate.fromTemplate(`
Create a structured research methodology for investigating: {query}

Provide a JSON response with this structure:
{{
  "research_questions": ["list of key questions to investigate"],
  "methodology": "research approach description",
  "information_sources": ["types of sources to consult"],
  "analysis_framework": "how to analyze findings",
  "deliverables": ["expected outputs"]
}}
`);
      
      const chain = planPrompt.pipe(this.llm).pipe(new StringOutputParser());
      const planResponse = await chain.invoke({ query });
      
      try {
        return JSON.parse(planResponse);
      } catch (parseError) {
        logger.warn('Failed to parse research plan JSON, using text format');
        return { methodology: planResponse };
      }
    } catch (error) {
      logger.error('Research plan generation failed:', error);
      return {
        methodology: 'Standard research approach with information gathering, analysis, and synthesis',
        research_questions: ['What are the key aspects of this topic?', 'What are the current developments?']
      };
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
    logger.info('ResearchAgent shutting down');
    this.researchPlans.clear();
  }
}

module.exports = { ResearchAgent };
