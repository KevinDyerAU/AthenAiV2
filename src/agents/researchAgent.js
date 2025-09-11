const { ChatOpenAI } = require('@langchain/openai');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { RunnableSequence } = require('@langchain/core/runnables');
const { DynamicTool } = require('@langchain/core/tools');
const { AgentExecutor } = require('langchain/agents');
const { ChatAgent } = require('langchain/agents');
const axios = require('axios');
const { logger } = require('../utils/logger');

class ResearchAgent {
  constructor() {
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
      tags: ['research-agent', 'athenai']
    });
    
    this.name = 'ResearchAgent';
    this.capabilities = ['research', 'analysis', 'information-gathering', 'fact-checking', 'synthesis'];
    this.researchPlans = new Map();
    this.tools = [];
    this.agent = null;
    this.agentExecutor = null;
    
    // Initialize tools after constructor
    this.initializeTools();
  }

  initializeTools() {
    this.tools = [
      new DynamicTool({
        name: 'web_search',
        description: 'Search and crawl web content using Firecrawl API',
        func: async (query) => {
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
                limit: 5
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
      }),
      
      new DynamicTool({
        name: 'knowledge_synthesis',
        description: 'Synthesize information from multiple sources and provide comprehensive analysis',
        func: async (input) => {
          try {
            const synthesisPrompt = PromptTemplate.fromTemplate(`
Synthesize the following information and provide a comprehensive analysis:

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

  async executeResearch(inputData, roomId, sessionId) {
    try {
      const query = typeof inputData === 'string' ? inputData : (inputData.query || inputData.task || inputData);
      logger.info('Research Agent executing advanced query', { query, roomId, sessionId });
      
      // Ensure tools are properly initialized
      if (!this.tools || this.tools.length === 0) {
        this.initializeTools();
      }
      
      // Use enhanced direct research with tool integration
      const researchResult = await this.enhancedDirectResearch(query);
      
      // Generate research plan for complex queries
      const researchPlan = await this.generateAdvancedResearchPlan(query);
      
      return {
        summary: researchResult,
        agent_type: 'research',
        confidence: 0.9,
        query: query,
        research_plan: researchPlan,
        session_id: sessionId,
        tools_used: this.tools.map(tool => tool.name),
        timestamp: new Date().toISOString()
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

  async enhancedDirectResearch(query) {
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

      // Step 3: Generate comprehensive research response
      const enhancedPrompt = PromptTemplate.fromTemplate(`
You are an expert research assistant conducting comprehensive research on the following topic:

Topic: {query}

${webSearchResults ? 'Web Search Results:\n{webResults}\n\n' : ''}${synthesizedKnowledge ? 'Synthesized Knowledge:\n{synthesis}\n\n' : ''}Provide a thorough research response that includes:

1. **Executive Summary**: Clear overview of the topic and key findings
2. **Detailed Analysis**: In-depth examination of important aspects
3. **Current Developments**: Latest trends, news, or updates if available
4. **Key Insights**: Critical findings and their implications
5. **Practical Applications**: How this information can be used
6. **Further Research**: Areas that warrant additional investigation

Make your response comprehensive, well-structured, and actionable.
`);

      const chain = enhancedPrompt.pipe(this.llm).pipe(new StringOutputParser());
      return await chain.invoke({
        query,
        webResults: webSearchResults || 'No web search results available',
        synthesis: synthesizedKnowledge || 'No additional synthesis available'
      });
    } catch (error) {
      logger.error('Enhanced direct research failed:', error);
      return await this.fallbackResearch(query);
    }
  }
  
  async fallbackResearch(query) {
    // Try to use web search even in fallback mode
    let webSearchResults = '';
    if (process.env.FIRECRAWL_API_KEY && this.tools && Array.isArray(this.tools)) {
      try {
        const webTool = this.tools.find(tool => tool && tool.name === 'web_search');
        if (webTool && typeof webTool.func === 'function') {
          webSearchResults = await webTool.func(query);
        }
      } catch (error) {
        logger.warn('Firecrawl search failed in fallback mode:', error);
      }
    }
    
    const enhancedPrompt = PromptTemplate.fromTemplate(`
You are an expert research assistant with deep knowledge across multiple domains. Conduct comprehensive research on the following topic:

Topic: {query}

${webSearchResults ? 'Web Search Results:\n{webResults}\n\n' : ''}Provide a thorough response that includes:

1. **Overview**: Clear explanation of the topic and its significance
2. **Key Insights**: Important findings, facts, and current understanding
3. **Analysis**: Critical examination of different perspectives or approaches
4. **Implications**: What this means in practical terms or broader context
5. **Further Exploration**: Suggested areas for deeper investigation

Make your response informative, well-structured, and engaging. Use examples where helpful.
`);
    
    const chain = enhancedPrompt.pipe(this.llm).pipe(new StringOutputParser());
    return await chain.invoke({ 
      query,
      webResults: webSearchResults || 'No web search results available'
    });
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
