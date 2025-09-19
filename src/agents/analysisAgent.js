// Analysis Agent - Data Analysis and Statistical Insights
const { ChatOpenAI } = require('@langchain/openai');
const { AgentExecutor, createOpenAIToolsAgent } = require('langchain/agents');
const { DynamicTool } = require('@langchain/core/tools');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { logger } = require('../utils/logger');
const { ReasoningFramework } = require('../utils/reasoningFramework');
const { SemanticSimilarity } = require('../utils/semanticSimilarity');
const { progressBroadcaster } = require('../services/progressBroadcaster');
const databaseService = require('../services/database');
const { WebBrowsingUtils } = require('../utils/webBrowsingUtils');
const { KnowledgeSubstrateHelper } = require('../utils/knowledgeSubstrateHelper');

class AnalysisAgent {
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
            'X-Title': 'AthenAI System'
          }
        },
        timeout: 10000,
        maxRetries: 2
      });
    } else {
      this.llm = new ChatOpenAI({
        modelName: process.env.OPENAI_MODEL || 'gpt-4',
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.1,
        openAIApiKey: process.env.OPENAI_API_KEY,
        timeout: parseInt(process.env.OPENAI_TIMEOUT) || 60000,
        maxRetries: 2,
        tags: ['analysis-agent', 'athenai', 'openai']
      });
    }
    
    // Initialize reasoning framework
    this.reasoning = new ReasoningFramework('AnalysisAgent');
    
    // Initialize knowledge substrate helper
    this.knowledgeHelper = new KnowledgeSubstrateHelper();
    
    // Initialize analysis capabilities
    this.analysisQueue = [];
    this.runningAnalyses = new Map();
    this.maxConcurrentAnalyses = process.env.MAX_CONCURRENT_ANALYSES || 3;
  }

  // Knowledge substrate integration using standardized helper
  async retrieveKnowledgeContext(query, sessionId) {
    try {
      await progressBroadcaster.updateProgress(sessionId, 'knowledge_context', 'Retrieving knowledge context and cached analysis');
      
      return await this.knowledgeHelper.retrieveKnowledgeContext(query, 'analysis', {
        complexity: 'medium',
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

  async storeAnalysisInsights(query, results, sessionId) {
    try {
      const analysisResult = {
        success: true,
        query,
        output: results,
        insights: this.extractAnalysisInsights(results)
      };
      
      const context = {
        objective: query,
        sessionId,
        complexity: {
          level: 'medium',
          score: 6.0
        }
      };
      
      return await this.knowledgeHelper.storeKnowledgeResults(analysisResult, context, 'analysis');
    } catch (error) {
      logger.error('Error storing analysis insights:', {
        error: error.message,
        sessionId,
        query: query.substring(0, 100)
      });
      return false;
    }
  }

  extractAnalysisInsights(results) {
    const insights = [];
    if (typeof results === 'string') {
      const lines = results.split('\n');
      lines.forEach(line => {
        if (line.includes('trend') || line.includes('pattern') || line.includes('correlation')) {
          insights.push({ type: 'pattern', content: line.trim() });
        }
      });
    }
    return insights;
  }

  // Main analysis execution method
  async executeAnalysis(inputData, options = {}) {
    const sessionId = options.sessionId || 'default';
    const analysisType = options.analysisType || 'general';
    
    try {
      await progressBroadcaster.updateProgress(sessionId, 'analysis_start', 'Starting analysis execution');
      
      // Retrieve knowledge context first
      const knowledgeContext = await this.retrieveKnowledgeContext(inputData.query || JSON.stringify(inputData), sessionId);
      
      // Perform analysis with knowledge context
      const analysisResult = await this.performAnalysis(inputData, knowledgeContext, options);
      
      // Store insights for future use
      await this.storeAnalysisInsights(inputData.query || JSON.stringify(inputData), analysisResult, sessionId);
      
      await progressBroadcaster.updateProgress(sessionId, 'analysis_complete', 'Analysis completed successfully');
      
      return analysisResult;
    } catch (error) {
      logger.error('Error in analysis execution:', {
        error: error.message,
        sessionId,
        analysisType
      });
      
      await progressBroadcaster.updateProgress(sessionId, 'analysis_error', `Analysis failed: ${error.message}`);
      throw error;
    }
  }

  async performAnalysis(inputData, knowledgeContext, options = {}) {
    // Implementation would depend on the specific analysis tools and methods
    // This is a placeholder for the actual analysis logic
    return {
      success: true,
      data: inputData,
      context: knowledgeContext,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = AnalysisAgent;
