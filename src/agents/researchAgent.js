const { ChatOpenAI } = require('@langchain/openai');
const { logger } = require('../utils/logger');

class ResearchAgent {
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4',
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY,
      tags: ['research-agent', 'athenai']
    });
    
    this.name = 'ResearchAgent';
    this.capabilities = ['research', 'analysis', 'information-gathering'];
    this.tools = ['web_search', 'database_query', 'document_analysis'];
    this.researchPlans = new Map();
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
          'identify_key_concepts',
          'gather_primary_sources',
          'analyze_information',
          'synthesize_findings'
        ],
        tools_needed: ['web_search', 'database_access'],
        estimated_time: 180,
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

  async executeResearch(inputData) {
    try {
      const query = typeof inputData === 'string' ? inputData : (inputData.query || inputData.task || inputData);
      logger.info('Research Agent executing query', { query });
      
      // Use OpenAI to generate research response
      const prompt = `You are a research assistant. Provide a comprehensive, informative response about: ${query}

Please provide:
1. A clear summary of the topic
2. Key insights and findings
3. Practical recommendations or next steps

Keep the response conversational and helpful, as if speaking directly to the user.`;

      const response = await this.llm.invoke(prompt);
      const researchContent = response.content || response.text || response;

      return {
        summary: researchContent,
        agent_type: 'research',
        confidence: 0.9,
        query: query
      };
    } catch (error) {
      logger.error('Research execution failed', { error: error.message });
      // Return fallback response if OpenAI fails
      return {
        summary: `I'd be happy to help you research "${query}". Could you provide more specific details about what aspects you'd like me to focus on?`,
        agent_type: 'research',
        confidence: 0.7,
        query: query
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
