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
const { WebBrowsingUtils } = require('../utils/webBrowsingUtils');

class ResearchAgent {
  constructor() {
    // Primary OpenAI configuration with OpenRouter fallback
    const useOpenRouter = process.env.USE_OPENROUTER === 'true';
    
    if (useOpenRouter) {
      this.llm = new ChatOpenAI({
        modelName: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
        temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE) || 0.1,
        openAIApiKey: process.env.OPENROUTER_API_KEY,
        maxTokens: parseInt(process.env.OPENROUTER_MAX_TOKENS) || 2000,
        timeout: parseInt(process.env.OPENROUTER_TIMEOUT) || 30000,
        maxRetries: 2,
        configuration: {
          baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            'HTTP-Referer': 'https://athenai.local',
            'X-Title': 'AthenAI Research Agent',
            'Content-Type': 'application/json'
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
      const queryHash = this.generateQueryHash(query);
      const domain = this.inferQueryDomain(query);

      // Retrieve similar research insights from Supabase
      const similarResearch = await databaseService.getResearchInsightsByQueryHash(queryHash, 3);
      
      // Retrieve knowledge entities by domain
      const domainEntities = await databaseService.getKnowledgeEntitiesByDomain(domain, 5);
      
      return {
        similarResearch,
        domainEntities,
        queryHash,
        domain
      };
    } catch (error) {
      logger.error('Error retrieving knowledge context:', error);
      return { similarResearch: [], domainEntities: [], queryHash: null, domain: 'general' };
    }
  }

  async storeResearchInsights(query, results, sessionId) {
    try {
      const queryHash = this.generateQueryHash(query);
      const domain = this.inferQueryDomain(query);
      const patterns = this.extractResearchPatterns(results);
      
      // Store research insights
      await databaseService.storeResearchInsights({
        query_hash: queryHash,
        query_text: query,
        domain: domain,
        insights: results,
        patterns: patterns,
        confidence_score: 0.85,
        session_id: sessionId
      });

      // Create knowledge entities for significant findings
      if (results.length > 100) { // Only for substantial research
        await databaseService.createKnowledgeEntity({
          entity_type: 'research_finding',
          entity_name: `Research: ${query.substring(0, 50)}...`,
          domain: domain,
          content: results.substring(0, 500),
          metadata: { query, patterns, session_id: sessionId },
          confidence_score: 0.8
        });
      }
    } catch (error) {
      logger.error('Error storing research insights:', error);
    }
  }

  async processMessage(inputData, options = {}) {
    try {
      const sessionId = options.sessionId || 'default';
      
      // Retrieve knowledge context
      const knowledgeContext = await this.retrieveKnowledgeContext(inputData.message, sessionId);
      
      // Initialize agent executor with session context
      if (!this.agentExecutor) {
        this.tools = this.initializeTools(sessionId, progressBroadcaster);
        
        const prompt = PromptTemplate.fromTemplate(`
You are a sophisticated Research Agent with access to web browsing, knowledge synthesis, and fact verification tools.

Your capabilities include:
- Comprehensive research and information gathering
- Web search and URL browsing for current information
- Knowledge synthesis from multiple sources
- Fact verification and reference checking
- Research planning and methodology development

Knowledge Context:
- Previous Research: {previousResearch}
- Domain Entities: {domainEntities}
- Query Domain: {domain}

Current Task: {input}

Use your tools strategically to:
1. Search for relevant information using web_search
2. Browse specific URLs for detailed content using browse_url
3. Verify facts and claims using fact_verification
4. Synthesize findings using knowledge_synthesis
5. Plan comprehensive research using research_planning

Provide thorough, well-researched responses with proper citations and confidence levels.

{agent_scratchpad}
`);

        this.agent = await ChatAgent.fromLLMAndTools(this.llm, this.tools, {
          prefix: prompt.template
        });

        this.agentExecutor = new AgentExecutor({
          agent: this.agent,
          tools: this.tools,
          verbose: true,
          maxIterations: 10,
          returnIntermediateSteps: true
        });
      }

      // Execute research with knowledge context and error handling
      let result;
      try {
        result = await this.agentExecutor.call({
          input: inputData.message,
          previousResearch: JSON.stringify(knowledgeContext.similarResearch),
          domainEntities: JSON.stringify(knowledgeContext.domainEntities),
          domain: knowledgeContext.domain
        });
      } catch (llmError) {
        logger.error('LLM execution failed, providing fallback response', { error: llmError.message });
        
        // Provide a fallback response when LLM fails
        const fallbackResponse = `I encountered an issue with the AI service while processing your research request about "${inputData.message}". 

This appears to be related to: ${inputData.message.includes('github.com') ? 'GitHub repository analysis' : 'research inquiry'}.

Based on the available context:
- Domain: ${knowledgeContext.domain}
- Previous research available: ${knowledgeContext.similarResearch.length > 0 ? 'Yes' : 'No'}

I recommend trying again in a moment, or you can rephrase your request for better results.`;

        return {
          response: fallbackResponse,
          confidence: 0.4,
          sources: [],
          reasoning: 'Fallback response due to LLM service error',
          metadata: {
            agent: 'ResearchAgent',
            domain: knowledgeContext.domain,
            error: 'LLM_SERVICE_ERROR',
            fallback: true
          }
        };
      }

      // Store research insights
      await this.storeResearchInsights(inputData.message, result.output, sessionId);

      return {
        response: result.output,
        confidence: 0.9,
        sources: result.intermediateSteps || [],
        reasoning: result.intermediateSteps ? 'Used systematic research methodology with web browsing and knowledge synthesis' : 'Applied research analysis',
        metadata: {
          agent: 'ResearchAgent',
          domain: knowledgeContext.domain,
          knowledgeUsed: knowledgeContext.similarResearch.length > 0,
          toolsUsed: result.intermediateSteps?.length || 0
        }
      };
    } catch (error) {
      logger.error('Research Agent processing error:', error);
      return {
        response: `I encountered an error while conducting research: ${error.message}. Let me try a different approach.`,
        confidence: 0.3,
        sources: [],
        reasoning: 'Error occurred during research processing',
        metadata: { agent: 'ResearchAgent', error: error.message }
      };
    }
  }

  initializeTools(sessionId = null, progressBroadcaster = null) {
    const tools = [
      // Think tool for step-by-step reasoning
      new DynamicTool({
        name: 'think',
        description: 'Think through complex research challenges step by step, evaluate different research approaches, and reason about the optimal research strategy',
        func: async (input) => {
          try {
            const thinkPrompt = PromptTemplate.fromTemplate(`
You are working through a complex research challenge. Break down your research reasoning step by step.

Research Challenge: {problem}

Think through this systematically:
1. What is the core research question or information need?
2. What are the key concepts and terms I should investigate?
3. What different research approaches or methodologies could I use?
4. What are the most reliable and authoritative sources for this topic?
5. What potential biases or limitations should I be aware of?
6. What is my recommended research strategy and why?
7. How will I validate and cross-reference my findings?
8. What are the expected outcomes and deliverables?

Provide your step-by-step research reasoning:
`);

            const chain = thinkPrompt.pipe(this.llm).pipe(new StringOutputParser());
            const thinking = await chain.invoke({ problem: input });
            
            return `RESEARCH THINKING PROCESS:\n${thinking}`;
          } catch (error) {
            return `Thinking error: ${error.message}`;
          }
        }
      }),

      // Knowledge Synthesis Tool
      new DynamicTool({
        name: 'knowledge_synthesis',
        description: 'Synthesize information from multiple sources into coherent insights',
        func: async (input) => {
          try {
            const synthesisPrompt = PromptTemplate.fromTemplate(`
Synthesize the following information into coherent, actionable insights:

Information Sources: {sources}

Provide synthesis with:
1. Key themes and patterns identified
2. Conflicting information reconciled
3. Gaps in knowledge highlighted
4. Actionable insights derived
5. Confidence level in conclusions
6. Recommendations for further research

Synthesis:
`);
            
            const chain = synthesisPrompt.pipe(this.llm).pipe(new StringOutputParser());
            const result = await chain.invoke({ sources: input });
            return result;
          } catch (error) {
            logger.error('Knowledge synthesis failed:', error);
            return 'Unable to synthesize knowledge at this time.';
          }
        }
      }),

      // Fact Verification Tool
      new DynamicTool({
        name: 'fact_verification',
        description: 'Verify facts and claims against reliable sources',
        func: async (input) => {
          try {
            const verificationPrompt = PromptTemplate.fromTemplate(`
Verify the following statement or claim:

Statement: {statement}

Provide verification analysis including:
1. Factual accuracy assessment
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

      // Research Planning Tool
      new DynamicTool({
        name: 'research_planning',
        description: 'Create comprehensive research plans and methodologies for complex topics',
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
      }),

      new DynamicTool({
        name: 'web_search',
        description: 'Direct web search using Firecrawl API (fallback method)',
        func: async (query) => {
          return await this.performWebSearch(query, 5);
        }
      })
    ];

    // Add standardized web browsing tools if sessionId and progressBroadcaster are available
    if (sessionId && progressBroadcaster) {
      const webTools = WebBrowsingUtils.createWebBrowsingTools(sessionId, progressBroadcaster);
      tools.push(...webTools);
    } else {
      // Add web browsing tools without progress broadcasting
      const webTools = WebBrowsingUtils.createWebBrowsingTools();
      tools.push(...webTools);
    }

    return tools;
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

  async executeResearch(message, sessionId, orchestrationId, options = {}) {
    try {
      return await this.processMessage({ message }, { sessionId, ...options });
    } catch (error) {
      logger.error('Research execution error:', error);
      return {
        response: `Research failed: ${error.message}`,
        confidence: 0.3,
        sources: [],
        reasoning: 'Error occurred during research execution',
        metadata: { agent: 'ResearchAgent', error: error.message }
      };
    }
  }

  async performWebSearch(query, limit = 5) {
    try {
      // Check if Firecrawl API key is configured
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
        }
      });

      if (response.data && response.data.data) {
        const results = response.data.data.map(item => ({
          title: item.metadata?.title || 'No title',
          url: item.metadata?.sourceURL || item.url,
          content: item.content?.substring(0, 500) || 'No content available'
        }));

        return `Search Results for "${query}":\n\n${results.map((result, index) => 
          `${index + 1}. ${result.title}\n   URL: ${result.url}\n   Content: ${result.content}...\n`
        ).join('\n')}`;
      }

      return `No search results found for "${query}"`;
    } catch (error) {
      logger.error('Web search error:', error);
      return `Web search failed: ${error.message}`;
    }
  }
}

module.exports = { ResearchAgent };
