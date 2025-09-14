const { createClient } = require('@supabase/supabase-js');
const neo4j = require('neo4j-driver');
const winston = require('winston');
const { generateEmbedding, calculateSimilarity } = require('../../services/ingestion-service/utils/embeddings');
const { AIProcessing } = require('../utils/aiProcessing');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/base_knowledge_agent.log' }),
    new winston.transports.Console()
  ]
});

class BaseKnowledgeAgent {
  constructor() {
    this.supabase = null;
    this.neo4jDriver = null;
    this.logger = logger;
    this.aiProcessing = new AIProcessing();

    // Initialize Supabase client
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Initialize Neo4j driver for Aura cloud instance
    this.neo4j = neo4j.driver(
      process.env.NEO4J_URI,
      neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
    );

    // Agent configuration
    this.agentId = agentConfig.id || 'base_knowledge_agent';
    this.searchStrategy = {
      knowledge_first: true,
      confidence_threshold: agentConfig.confidence_threshold || 0.7,
      completeness_threshold: agentConfig.completeness_threshold || 0.6,
      max_knowledge_results: agentConfig.max_knowledge_results || 10,
      max_web_results: agentConfig.max_web_results || 5,
      similarity_threshold: agentConfig.similarity_threshold || 0.75,
      enable_graph_search: agentConfig.enable_graph_search !== false,
      enable_web_fallback: agentConfig.enable_web_fallback !== false
    };

    this.performanceMetrics = {
      knowledge_hits: 0,
      web_fallbacks: 0,
      total_searches: 0,
      average_confidence: 0,
      cache_hit_rate: 0
    };
  }

  async search(query, context = {}) {
    try {
      logger.info('BaseKnowledgeAgent: Starting knowledge-first search', {
        agentId: this.agentId,
        query: query.substring(0, 100) + '...',
        context: Object.keys(context)
      });

      this.performanceMetrics.total_searches++;

      // Step 1: Search knowledge substrate first
      const knowledgeResults = await this.searchKnowledgeSubstrate(query, context);
      
      // Step 2: Evaluate knowledge results
      const confidence = this.evaluateResultConfidence(knowledgeResults, query);
      const completeness = this.evaluateResultCompleteness(knowledgeResults, query);

      logger.info('BaseKnowledgeAgent: Knowledge search evaluation', {
        resultsCount: knowledgeResults.length,
        confidence,
        completeness,
        thresholds: {
          confidence: this.searchStrategy.confidence_threshold,
          completeness: this.searchStrategy.completeness_threshold
        }
      });

      // Step 3: Determine if knowledge results are sufficient
      if (confidence >= this.searchStrategy.confidence_threshold && 
          completeness >= this.searchStrategy.completeness_threshold) {
        
        this.performanceMetrics.knowledge_hits++;
        this.updatePerformanceMetrics(confidence);

        logger.info('BaseKnowledgeAgent: Knowledge substrate results sufficient', {
          source: 'knowledge_substrate',
          confidence,
          completeness
        });

        return {
          source: 'knowledge_substrate',
          results: knowledgeResults,
          confidence: confidence,
          completeness: completeness,
          search_strategy: 'knowledge_only',
          performance_metrics: this.getPerformanceSnapshot()
        };
      }

      // Step 4: Fallback to web search if enabled and knowledge is insufficient
      if (this.searchStrategy.enable_web_fallback) {
        logger.info('BaseKnowledgeAgent: Knowledge insufficient, falling back to web search');
        
        this.performanceMetrics.web_fallbacks++;
        
        const webResults = await this.searchWeb(query, context, knowledgeResults);
        
        // Step 5: Store new knowledge from web results
        await this.storeNewKnowledge(webResults, query, context);

        const combinedConfidence = Math.max(confidence, 0.8); // Web results boost confidence

        return {
          source: 'combined',
          knowledge_results: knowledgeResults,
          web_results: webResults,
          confidence: combinedConfidence,
          completeness: Math.min(completeness + 0.3, 1.0),
          search_strategy: 'knowledge_with_web_fallback',
          performance_metrics: this.getPerformanceSnapshot()
        };
      }

      // Step 6: Return knowledge results even if insufficient (no web fallback)
      logger.warn('BaseKnowledgeAgent: Knowledge insufficient and web fallback disabled');
      
      return {
        source: 'knowledge_substrate_only',
        results: knowledgeResults,
        confidence: confidence,
        completeness: completeness,
        search_strategy: 'knowledge_only_insufficient',
        warning: 'Results may be incomplete - web fallback disabled',
        performance_metrics: this.getPerformanceSnapshot()
      };

    } catch (error) {
      logger.error('BaseKnowledgeAgent: Search failed', error);
      throw error;
    }
  }

  async searchKnowledgeSubstrate(query, context = {}) {
    try {
      const results = [];

      // Step 1: Vector similarity search in Supabase
      const vectorResults = await this.vectorSimilaritySearch(query, context);
      results.push(...vectorResults);

      // Step 2: Graph-based contextual search in Neo4j (if enabled)
      if (this.searchStrategy.enable_graph_search) {
        const graphResults = await this.graphContextualSearch(query, context);
        results.push(...graphResults);
      }

      // Step 3: Deduplicate and rank results
      const deduplicatedResults = this.deduplicateResults(results);
      const rankedResults = this.rankResults(deduplicatedResults, query);

      // Step 4: Limit results
      const limitedResults = rankedResults.slice(0, this.searchStrategy.max_knowledge_results);

      logger.info('BaseKnowledgeAgent: Knowledge substrate search completed', {
        vectorResults: vectorResults.length,
        graphResults: this.searchStrategy.enable_graph_search ? 
          results.length - vectorResults.length : 0,
        totalResults: results.length,
        deduplicatedResults: deduplicatedResults.length,
        finalResults: limitedResults.length
      });

      return limitedResults;

    } catch (error) {
      logger.error('BaseKnowledgeAgent: Knowledge substrate search failed', error);
      return [];
    }
  }

  async vectorSimilaritySearch(query, context = {}) {
    try {
      // Generate embedding for the query
      const queryEmbedding = await generateEmbedding(query);

      // Search for similar content using Supabase vector similarity
      const { data, error } = await this.supabase.rpc('search_similar_content', {
        query_embedding: queryEmbedding,
        similarity_threshold: this.searchStrategy.similarity_threshold,
        match_count: this.searchStrategy.max_knowledge_results
      });

      if (error) {
        logger.error('BaseKnowledgeAgent: Vector similarity search error', error);
        return [];
      }

      // Transform results to standard format
      const transformedResults = (data || []).map(item => ({
        id: item.id,
        content: item.content,
        similarity: item.similarity,
        source_type: item.source_type,
        metadata: item.source_metadata,
        search_method: 'vector_similarity',
        relevance_score: item.similarity
      }));

      logger.debug('BaseKnowledgeAgent: Vector similarity search results', {
        resultsCount: transformedResults.length,
        avgSimilarity: transformedResults.length > 0 ? 
          transformedResults.reduce((sum, r) => sum + r.similarity, 0) / transformedResults.length : 0
      });

      return transformedResults;

    } catch (error) {
      logger.error('BaseKnowledgeAgent: Vector similarity search failed', error);
      return [];
    }
  }

  async graphContextualSearch(query, context = {}) {
    const session = this.neo4j.session();
    
    try {
      // Extract key entities from query for graph traversal
      const queryEntities = this.extractQueryEntities(query);
      
      if (queryEntities.length === 0) {
        return [];
      }

      // Search for related entities and content in the knowledge graph
      const cypher = `
        MATCH (e:Entity)
        WHERE e.name IN $entities
        OPTIONAL MATCH (e)-[r:RELATED_TO]-(related:Entity)
        OPTIONAL MATCH (d:Document)-[:MENTIONS]->(e)
        OPTIONAL MATCH (d)-[:HAS_CHUNK]->(c:Chunk)
        RETURN DISTINCT d.id as document_id, 
               c.content as content,
               c.id as chunk_id,
               e.name as entity,
               related.name as related_entity,
               r.type as relationship_type,
               r.confidence as relationship_confidence
        LIMIT 20
      `;

      const result = await session.run(cypher, { entities: queryEntities });
      
      const graphResults = result.records.map(record => ({
        id: record.get('chunk_id') || record.get('document_id'),
        content: record.get('content') || `Document ${record.get('document_id')}`,
        entity: record.get('entity'),
        related_entity: record.get('related_entity'),
        relationship_type: record.get('relationship_type'),
        relationship_confidence: record.get('relationship_confidence') || 0.5,
        source_type: 'knowledge_graph',
        search_method: 'graph_contextual',
        relevance_score: this.calculateGraphRelevance(record, queryEntities)
      })).filter(item => item.content && item.content.length > 10);

      logger.debug('BaseKnowledgeAgent: Graph contextual search results', {
        queryEntities,
        resultsCount: graphResults.length
      });

      return graphResults;

    } catch (error) {
      logger.error('BaseKnowledgeAgent: Graph contextual search failed', error);
      return [];
    } finally {
      await session.close();
    }
  }

  async extractQueryEntities(query) {
    // AI-powered entity extraction replacing simple NLP
    try {
      const entities = await this.aiProcessing.extractEntities(query);
      return entities.map(e => e.entity).slice(0, 8); // Return entity names
    } catch (error) {
      this.logger.warn('AI entity extraction failed, falling back to simple extraction:', error);
      
      // Fallback to simple extraction
      const words = query.toLowerCase().split(/\s+/);
      const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'what', 'how', 'when', 'where', 'why', 'who']);
      
      return words
        .filter(word => word.length > 2 && !stopWords.has(word))
        .slice(0, 5);
    }
  }

  calculateGraphRelevance(record, queryEntities) {
    let relevance = 0.3; // Base relevance
    
    const entity = record.get('entity');
    const relatedEntity = record.get('related_entity');
    const relationshipConfidence = record.get('relationship_confidence') || 0.5;
    
    // Boost relevance for direct entity matches
    if (queryEntities.includes(entity?.toLowerCase())) {
      relevance += 0.4;
    }
    
    // Boost for related entity matches
    if (relatedEntity && queryEntities.includes(relatedEntity.toLowerCase())) {
      relevance += 0.2;
    }
    
    // Factor in relationship confidence
    relevance += relationshipConfidence * 0.1;
    
    return Math.min(relevance, 1.0);
  }

  deduplicateResults(results) {
    const seen = new Set();
    const deduplicated = [];

    for (const result of results) {
      // Create a key based on content similarity or ID
      const key = result.id || result.content?.substring(0, 100);
      
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(result);
      }
    }

    return deduplicated;
  }

  rankResults(results, query) {
    // Sort by relevance score (descending)
    return results.sort((a, b) => {
      const scoreA = a.relevance_score || a.similarity || 0;
      const scoreB = b.relevance_score || b.similarity || 0;
      return scoreB - scoreA;
    });
  }

  evaluateResultConfidence(results, query) {
    if (!results || results.length === 0) {
      return 0;
    }

    // Calculate confidence based on result quality and relevance
    const avgRelevance = results.reduce((sum, result) => {
      return sum + (result.relevance_score || result.similarity || 0);
    }, 0) / results.length;

    // Factor in result count (more results = higher confidence up to a point)
    const countFactor = Math.min(results.length / 5, 1.0);
    
    // Factor in content quality (longer, more detailed content = higher confidence)
    const avgContentLength = results.reduce((sum, result) => {
      return sum + (result.content?.length || 0);
    }, 0) / results.length;
    
    const contentFactor = Math.min(avgContentLength / 500, 1.0);

    const confidence = (avgRelevance * 0.6) + (countFactor * 0.2) + (contentFactor * 0.2);
    
    return Math.min(confidence, 1.0);
  }

  evaluateResultCompleteness(results, query) {
    if (!results || results.length === 0) {
      return 0;
    }

    // Simple heuristic: completeness based on result diversity and coverage
    const sourceTypes = new Set(results.map(r => r.source_type));
    const searchMethods = new Set(results.map(r => r.search_method));
    
    // More diverse sources = higher completeness
    const diversityFactor = (sourceTypes.size + searchMethods.size) / 6; // Max 3 source types + 3 search methods
    
    // More results = higher completeness (up to a point)
    const quantityFactor = Math.min(results.length / 8, 1.0);
    
    // Check if results cover different aspects of the query
    const queryWords = query.toLowerCase().split(/\s+/);
    const coveredWords = new Set();
    
    results.forEach(result => {
      const content = result.content?.toLowerCase() || '';
      queryWords.forEach(word => {
        if (content.includes(word)) {
          coveredWords.add(word);
        }
      });
    });
    
    const coverageFactor = coveredWords.size / Math.max(queryWords.length, 1);
    
    const completeness = (diversityFactor * 0.3) + (quantityFactor * 0.3) + (coverageFactor * 0.4);
    
    return Math.min(completeness, 1.0);
  }

  async searchWeb(query, context = {}, knowledgeResults = []) {
    // Placeholder for web search implementation
    // This would integrate with existing web search capabilities
    logger.info('BaseKnowledgeAgent: Web search fallback triggered', {
      query: query.substring(0, 100) + '...',
      knowledgeResultsCount: knowledgeResults.length
    });

    // Return empty results for now - would be implemented with actual web search
    return [];
  }

  async storeNewKnowledge(webResults, query, context = {}) {
    try {
      if (!webResults || webResults.length === 0) {
        return;
      }

      logger.info('BaseKnowledgeAgent: Storing new knowledge from web results', {
        resultsCount: webResults.length,
        query: query.substring(0, 100) + '...'
      });

      // Store web results as new knowledge entities
      for (const result of webResults) {
        try {
          const embedding = await generateEmbedding(result.content || result.title || '');
          
          const { error } = await this.supabase
            .from('knowledge_entities')
            .insert({
              external_id: `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              content: result.content || result.title || '',
              entity_type: 'web_search_result',
              embedding: embedding,
              source_type: 'web_search',
              source_metadata: {
                query: query,
                url: result.url,
                title: result.title,
                search_timestamp: new Date().toISOString(),
                agent_id: this.agentId,
                ...context
              }
            });

          if (error) {
            logger.error('BaseKnowledgeAgent: Error storing web result', error);
          }
        } catch (itemError) {
          logger.error('BaseKnowledgeAgent: Error processing web result item', itemError);
        }
      }

    } catch (error) {
      logger.error('BaseKnowledgeAgent: Failed to store new knowledge', error);
    }
  }

  updatePerformanceMetrics(confidence) {
    const currentAvg = this.performanceMetrics.average_confidence;
    const totalSearches = this.performanceMetrics.total_searches;
    
    this.performanceMetrics.average_confidence = 
      ((currentAvg * (totalSearches - 1)) + confidence) / totalSearches;
    
    this.performanceMetrics.cache_hit_rate = 
      this.performanceMetrics.knowledge_hits / this.performanceMetrics.total_searches;
  }

  getPerformanceSnapshot() {
    return {
      ...this.performanceMetrics,
      timestamp: new Date().toISOString(),
      agent_id: this.agentId
    };
  }

  // Get search statistics
  getSearchStats() {
    return {
      performance_metrics: this.performanceMetrics,
      search_strategy: this.searchStrategy,
      agent_id: this.agentId,
      uptime: Date.now() - (this.startTime || Date.now())
    };
  }

  // Update search strategy configuration
  updateSearchStrategy(newStrategy) {
    this.searchStrategy = {
      ...this.searchStrategy,
      ...newStrategy
    };
    
    logger.info('BaseKnowledgeAgent: Search strategy updated', {
      agentId: this.agentId,
      newStrategy: this.searchStrategy
    });
  }

  // Cleanup method
  async close() {
    try {
      await this.neo4j.close();
      logger.info('BaseKnowledgeAgent: Connections closed', { agentId: this.agentId });
    } catch (error) {
      logger.error('BaseKnowledgeAgent: Error closing connections', error);
    }
  }
}

module.exports = BaseKnowledgeAgent;
