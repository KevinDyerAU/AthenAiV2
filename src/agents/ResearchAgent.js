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
const { WebBrowsingUtils } = require('../utils/webBrowsingUtils');
const { SemanticSimilarity } = require('../utils/semanticSimilarity');
const { progressBroadcaster } = require('../services/progressBroadcaster');
const databaseService = require('../services/database');

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

      // First try exact hash match for fastest retrieval
      let similarResearch = await databaseService.getResearchInsightsByQueryHash(queryHash, 3);
      
      // If no exact matches, get broader set for semantic similarity matching
      if (!similarResearch || similarResearch.length === 0) {
        similarResearch = await databaseService.getResearchInsightsForSimilarity(domain, 20);
        logger.info('No exact hash matches found, retrieved research insights for semantic similarity', {
          domain,
          count: similarResearch.length,
          query: query.substring(0, 100) + '...'
        });
      } else {
        logger.info('Found exact hash matches for research query', {
          count: similarResearch.length,
          queryHash
        });
      }
      
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
      
      logger.info('ResearchAgent: Storing research insights in database', {
        queryHash,
        domain,
        queryLength: query.length,
        resultsLength: results?.length || 0,
        sessionId,
        patterns: patterns?.length || 0
      });
      
      // Store research insights
      const storeResult = await databaseService.storeResearchInsights({
        query_hash: queryHash,
        original_query: query, // Make sure this field matches what we're looking for
        query_text: query,
        domain: domain,
        research_results: results, // Make sure this field matches what we're looking for
        insights: results,
        patterns: patterns,
        confidence_score: 0.85,
        session_id: sessionId
      });

      logger.info('ResearchAgent: Research insights stored successfully', {
        storeResult,
        queryHash,
        sessionId
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
      
      logger.info('ResearchAgent: Knowledge context retrieved', {
        message: inputData.message,
        similarResearchCount: knowledgeContext.similarResearch?.length || 0,
        domain: knowledgeContext.domain,
        queryHash: knowledgeContext.queryHash,
        sessionId
      });
      
      // Check if we have semantically similar cached research
      if (knowledgeContext.similarResearch && knowledgeContext.similarResearch.length > 0) {
        const bestMatch = SemanticSimilarity.findBestMatch(
          inputData.message, 
          knowledgeContext.similarResearch, 
          'original_query', 
          0.8 // Higher threshold for research caching
        );
        
        logger.info('ResearchAgent: Semantic similarity check result', {
          bestMatch: !!bestMatch,
          hasResearchResults: bestMatch?.research_results ? true : false,
          similarity: bestMatch?._similarity?.similarity,
          threshold: 0.8,
          originalQuery: inputData.message,
          cachedQuery: bestMatch?.original_query,
          sessionId
        });

        if (bestMatch && bestMatch.research_results) {
          logger.info('Using semantically similar cached research results', { 
            originalQuery: inputData.message,
            cachedQuery: bestMatch.original_query,
            similarity: bestMatch._similarity.similarity,
            cacheAge: Date.now() - new Date(bestMatch.created_at).getTime()
          });
          
          progressBroadcaster.updateProgress(sessionId, 'cache_hit', 
            `Found similar research (${Math.round(bestMatch._similarity.similarity * 100)}% match), using cached data`);
          
          return {
            success: true,
            research_findings: bestMatch.research_results,
            sources: bestMatch.sources || [],
            confidence: bestMatch.confidence_score || 0.9,
            timestamp: new Date().toISOString(),
            metadata: {
              cached: true,
              cache_timestamp: bestMatch.created_at,
              similarity_score: bestMatch._similarity.similarity,
              original_cached_query: bestMatch.original_query
            }
          };
        }
      }
      
      progressBroadcaster.updateProgress(sessionId, 'fresh_research', 'No cached results found, performing fresh research', {
        progress: 20
      });
      
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

      // Store research insights for future caching
      logger.info('ResearchAgent: Storing research insights', {
        query: inputData.message,
        resultLength: result.output?.length || 0,
        sessionId
      });
      
      await this.storeResearchInsights(inputData.message, result.output, sessionId);
      
      progressBroadcaster.updateProgress(sessionId, 'research_stored', 'Research results stored in knowledge substrate for future use', {
        progress: 95
      });

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
    const startTime = Date.now();
    
    try {
      // Check for GitHub repository URLs and validate them
      const repoValidation = await this.validateRepositoryRequest(message);
      if (repoValidation.isInvalid) {
        return {
          summary: repoValidation.message,
          agent_type: 'research',
          confidence: 0.9,
          execution_time_ms: Date.now() - startTime,
          session_id: sessionId,
          orchestration_id: orchestrationId
        };
      }
      
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

  async validateRepositoryRequest(message) {
    const githubUrlRegex = /https?:\/\/github\.com\/([^\/\s]+)\/([^\/\s]+)/g;
    const matches = [...message.matchAll(githubUrlRegex)];
    
    if (matches.length === 0) {
      return { isInvalid: false };
    }

    for (const match of matches) {
      const [fullUrl, owner, repo] = match;
      const cleanRepo = repo.replace(/[^\w-]/g, ''); // Remove any trailing characters
      
      try {
        // Check if repository exists using GitHub API
        const response = await axios.get(`https://api.github.com/repos/${owner}/${cleanRepo}`, {
          timeout: 5000,
          headers: {
            'User-Agent': 'AthenAI-ResearchAgent/1.0'
          }
        });
        
        if (response.status === 200) {
          logger.info('Repository validation successful', { owner, repo: cleanRepo });
          return { isInvalid: false };
        }
      } catch (error) {
        if (error.response?.status === 404) {
          return {
            isInvalid: true,
            message: `## Repository Not Found

I couldn't find the repository **${owner}/${cleanRepo}** on GitHub.

**Please check:**
- The repository URL is correct
- The repository exists and is public
- You have the correct owner and repository names

**Valid repository URL format:**
\`https://github.com/owner/repository-name\`

**Examples of valid repositories:**
- \`https://github.com/microsoft/vscode\`
- \`https://github.com/facebook/react\`
- \`https://github.com/nodejs/node\`

Please provide a valid GitHub repository URL and I'll be happy to research it for you!`
          };
        } else if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
          return {
            isInvalid: true,
            message: `## Network Error

I'm having trouble connecting to GitHub to validate the repository. This could be due to:
- Network connectivity issues
- GitHub API rate limiting
- Temporary service unavailability

Please try again in a moment, or provide a different repository URL.`
          };
        } else {
          logger.warn('Repository validation error', { error: error.message, owner, repo: cleanRepo });
          return {
            isInvalid: true,
            message: `## Repository Validation Error

I encountered an issue while trying to validate the repository **${owner}/${cleanRepo}**.

Please ensure:
- The repository URL is correct and accessible
- The repository is public (private repositories require authentication)
- Try providing the repository URL in this format: \`https://github.com/owner/repository-name\`

If the issue persists, please try with a different repository.`
          };
        }
      }
    }
    
    return { isInvalid: false };
  }
}

module.exports = { ResearchAgent };
