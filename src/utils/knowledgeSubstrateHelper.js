// Knowledge Substrate Helper - Standardized integration for all agents
const databaseService = require('../services/database');
const { logger } = require('./logger');

class KnowledgeSubstrateHelper {
  constructor(agentName, agentDomain = 'general') {
    this.agentName = agentName;
    this.agentDomain = agentDomain;
  }

  /**
   * Retrieve relevant context from knowledge substrate
   * @param {string} query - Search query or objective
   * @param {string} contentType - Type of content to search for
   * @param {Object} options - Additional search options
   * @returns {Object} Knowledge context with relevant results
   */
  async retrieveKnowledgeContext(query, contentType = 'general', options = {}) {
    try {
      // Validate inputs
      if (!query) {
        throw new Error('Query is required for knowledge context retrieval');
      }

      // Generate search parameters
      const searchQuery = `${contentType} ${query} ${options.complexity || ''}`.trim();
      const domain = options.domain || this.inferDomain(query);
      const queryHash = this.generateQueryHash(searchQuery);

      logger.debug(`${this.agentName}: Searching knowledge substrate`, {
        query: searchQuery,
        domain,
        contentType,
        queryHash
      });

      // Search for relevant knowledge
      let knowledgeResults = [];
      try {
        knowledgeResults = await databaseService.searchKnowledge({
          query: searchQuery,
          domain: domain,
          limit: options.limit || 10,
          similarity_threshold: options.similarity_threshold || 0.7,
          filters: {
            content_type: Array.isArray(contentType) ? contentType : [contentType],
            ...options.filters
          }
        });
      } catch (dbError) {
        logger.warn(`${this.agentName}: Knowledge search failed, continuing without context`, { 
          error: dbError.message 
        });
        knowledgeResults = [];
      }

      // Process and categorize results
      const relevantResults = [];
      const patterns = [];
      const insights = [];

      if (knowledgeResults && knowledgeResults.length > 0) {
        for (const result of knowledgeResults) {
          const processedResult = {
            id: result.id,
            title: result.metadata?.title || result.title || 'Untitled',
            content: result.content,
            domain: result.domain,
            content_type: result.metadata?.content_type,
            similarity_score: result.similarity_score,
            created_at: result.metadata?.created_at || result.created_at,
            metadata: result.metadata
          };

          // Categorize by content type
          if (result.metadata?.content_type === 'methodology' || 
              result.metadata?.content_type === 'pattern') {
            patterns.push({
              ...processedResult,
              pattern_name: result.metadata?.pattern_name,
              context: result.metadata?.context,
              applicable_complexity: result.metadata?.applicable_complexity
            });
          } else if (result.metadata?.content_type === 'insight' ||
                     result.metadata?.content_type === 'analysis') {
            insights.push({
              ...processedResult,
              confidence_score: result.confidence_score,
              source_type: result.source_type
            });
          } else {
            relevantResults.push(processedResult);
          }
        }
      }

      return {
        relevant_results: relevantResults,
        patterns: patterns,
        insights: insights,
        search_query: searchQuery,
        domain: domain,
        total_results: knowledgeResults.length,
        retrieved_at: new Date().toISOString(),
        agent: this.agentName
      };

    } catch (error) {
      logger.error(`${this.agentName}: Failed to retrieve knowledge context`, { 
        error: error.message 
      });
      return {
        relevant_results: [],
        patterns: [],
        insights: [],
        error: error.message,
        retrieved_at: new Date().toISOString(),
        agent: this.agentName
      };
    }
  }

  /**
   * Store results in knowledge substrate for future reference
   * @param {Object} result - The agent result to store
   * @param {Object} context - Additional context about the operation
   * @param {string} contentType - Type of content being stored
   */
  async storeKnowledgeResults(result, context, contentType = 'general') {
    try {
      const { objective, sessionId, orchestrationId, complexity } = context;
      
      // Extract objective from multiple sources
      const resultObjective = objective || 
                             result.objective || 
                             result.query || 
                             result.task ||
                             'Unknown Objective';
      
      // Extract content from result
      const resultContent = result.output || 
                           result.result || 
                           result.content ||
                           JSON.stringify(result);
      
      const domain = this.inferDomain(resultObjective);

      // Structure the knowledge document
      const knowledgeDocument = {
        title: `${this.agentName} Session: ${resultObjective.substring(0, 100)}`,
        content: resultContent,
        domain: domain,
        metadata: {
          content_type: contentType,
          agent_type: this.agentName.toLowerCase().replace('agent', ''),
          objective: resultObjective,
          complexity_level: complexity,
          session_id: sessionId,
          orchestration_id: orchestrationId,
          success: result.success,
          confidence_score: result.confidence || 0.8,
          methodology: this.extractMethodology(resultContent),
          key_insights: this.extractKeyInsights(resultContent),
          created_at: new Date().toISOString(),
          created_by: this.agentName
        }
      };

      // Store the knowledge document
      await databaseService.storeKnowledge(knowledgeDocument);

      // Store additional insights if available
      if (result.insights && Array.isArray(result.insights)) {
        for (const insight of result.insights) {
          const insightDocument = {
            title: `${this.agentName} Insight: ${insight.title || insight.type}`,
            content: insight.content || insight.description,
            domain: domain,
            metadata: {
              content_type: 'insight',
              agent_type: this.agentName.toLowerCase().replace('agent', ''),
              insight_type: insight.type,
              confidence_score: insight.confidence || 0.8,
              session_id: sessionId,
              parent_session: sessionId,
              created_at: new Date().toISOString(),
              created_by: this.agentName
            }
          };
          
          await databaseService.storeKnowledge(insightDocument);
        }
      }

      logger.debug(`${this.agentName}: Results stored in knowledge substrate`, {
        contentType,
        domain,
        sessionId,
        objective: resultObjective
      });

    } catch (error) {
      logger.error(`${this.agentName}: Failed to store knowledge results`, { 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Infer domain from content
   * @param {string} content - Content to analyze
   * @returns {string} Inferred domain
   */
  inferDomain(content) {
    if (!content || typeof content !== 'string') {
      return this.agentDomain;
    }
    
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('ai') || lowerContent.includes('machine learning') || 
        lowerContent.includes('analytics') || lowerContent.includes('model')) {
      return 'ai';
    } else if (lowerContent.includes('software') || lowerContent.includes('development') || 
               lowerContent.includes('code') || lowerContent.includes('programming')) {
      return 'software';
    } else if (lowerContent.includes('data') || lowerContent.includes('analysis') || 
               lowerContent.includes('dashboard') || lowerContent.includes('visualization')) {
      return 'data';
    } else if (lowerContent.includes('business') || lowerContent.includes('strategy') || 
               lowerContent.includes('project') || lowerContent.includes('management')) {
      return 'business';
    } else if (lowerContent.includes('research') || lowerContent.includes('investigation') ||
               lowerContent.includes('study') || lowerContent.includes('analysis')) {
      return 'research';
    } else if (lowerContent.includes('security') || lowerContent.includes('vulnerability') ||
               lowerContent.includes('threat') || lowerContent.includes('risk')) {
      return 'security';
    } else if (lowerContent.includes('performance') || lowerContent.includes('optimization') ||
               lowerContent.includes('efficiency') || lowerContent.includes('speed')) {
      return 'performance';
    } else {
      return this.agentDomain;
    }
  }

  /**
   * Generate query hash for caching
   * @param {string} query - Search query
   * @returns {string} Query hash
   */
  generateQueryHash(query) {
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Extract methodology from content
   * @param {string} content - Content to analyze
   * @returns {string} Extracted methodology
   */
  extractMethodology(content) {
    const methodologies = ['waterfall', 'agile', 'hybrid', 'lean', 'iterative', 'systematic'];
    const lowerContent = content.toLowerCase();
    
    for (const methodology of methodologies) {
      if (lowerContent.includes(methodology)) {
        return methodology;
      }
    }
    return 'standard';
  }

  /**
   * Extract key insights from content
   * @param {string} content - Content to analyze
   * @returns {Array} Array of key insights
   */
  extractKeyInsights(content) {
    const insights = [];
    const sentences = content.split('.').filter(s => s.trim().length > 20);
    
    // Look for insight indicators
    const insightKeywords = ['important', 'key', 'critical', 'significant', 'notable', 'recommend'];
    
    for (const sentence of sentences.slice(0, 5)) {
      const lowerSentence = sentence.toLowerCase();
      if (insightKeywords.some(keyword => lowerSentence.includes(keyword))) {
        insights.push(sentence.trim());
      }
    }
    
    return insights.length > 0 ? insights : [content.substring(0, 200) + '...'];
  }
}

module.exports = { KnowledgeSubstrateHelper };
