// src/services/database.js
const { createClient } = require('@supabase/supabase-js');
const neo4j = require('neo4j-driver');
const redis = require('redis');
const { logger } = require('../utils/logger');

class DatabaseService {
  constructor() {
    this.supabase = null;
    this.neo4jDriver = null;
    this.redisClient = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      // Initialize Supabase
      if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        this.supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        logger.info('Supabase initialized');
      }

      // Initialize Neo4j
      if (process.env.NEO4J_URI && process.env.NEO4J_USER && process.env.NEO4J_PASSWORD) {
        this.neo4jDriver = neo4j.driver(
          process.env.NEO4J_URI,
          neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
        );

        // Test Neo4j connection
        const session = this.neo4jDriver.session();
        await session.run('RETURN 1');
        await session.close();
        logger.info('Neo4j initialized');
      }

      // Initialize Redis
      if (process.env.REDIS_URL) {
        try {
          const redisConfig = {
            url: process.env.REDIS_URL
          };

          // Add authentication if provided
          if (process.env.REDIS_PASSWORD) {
            redisConfig.password = process.env.REDIS_PASSWORD;
          }

          // Add username if provided (Redis 6+)
          if (process.env.REDIS_USERNAME) {
            redisConfig.username = process.env.REDIS_USERNAME;
          }

          this.redisClient = redis.createClient(redisConfig);
          
          this.redisClient.on('error', (err) => {
            logger.error('Redis Client Error', err);
            // Don't throw here, just log and continue without Redis
            this.redisClient = null;
          });
          
          this.redisClient.on('connect', () => {
            logger.info('Redis connected successfully');
          });

          this.redisClient.on('ready', () => {
            logger.info('Redis ready for operations');
          });
          
          await this.redisClient.connect();
          logger.info('Redis initialized');
        } catch (error) {
          logger.warn('Redis initialization failed, continuing without cache:', error.message);
          this.redisClient = null;
        }
      }

      this.initialized = true;
      logger.info('All database connections initialized successfully');
    } catch (error) {
      logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  // Supabase operations
  async createConversation(sessionId, userId, message, response, agentType, metadata = {}) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, skipping conversation storage');
      return null;
    }

    const { data, error } = await this.supabase
      .from('conversations')
      .insert({
        title: `Session ${sessionId}`,
        metadata: {
          session_id: sessionId,
          user_id: userId,
          message,
          response,
          agent_type: agentType,
          ...metadata
        }
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getConversations(sessionId, limit = 10) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, returning empty history');
      return [];
    }

    const { data, error } = await this.supabase
      .from('conversations')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  async getConversationHistory(sessionId, limit = 10) {
    return this.getConversations(sessionId, limit);
  }

  async updateConversation(conversationId, updates) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, skipping conversation update');
      return null;
    }

    const { data, error } = await this.supabase
      .from('conversations')
      .update(updates)
      .eq('id', conversationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  validateConversationData(conversationData) {
    const required = ['session_id', 'message'];
    return required.every(field => conversationData && conversationData[field]);
  }

  // Neo4j operations
  async createKnowledgeNode(sessionId, orchestrationId, nodeType, properties) {
    if (!this.neo4jDriver) {
      logger.warn('Neo4j not initialized, skipping knowledge node creation');
      return null;
    }

    const session = this.neo4jDriver.session();
    try {
      const result = await session.run(
        `MERGE (s:Session {id: $sessionId})
         MERGE (o:Orchestration {id: $orchestrationId})
         CREATE (n:${nodeType} $properties)
         MERGE (s)-[:HAS_ORCHESTRATION]->(o)
         MERGE (o)-[:GENERATED]->(n)
         RETURN n`,
        { sessionId, orchestrationId, properties }
      );
      return result.records[0]?.get('n').properties;
    } finally {
      await session.close();
    }
  }

  // Knowledge Substrate Operations
  async createKnowledgeEntity(entityData) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, skipping knowledge entity creation');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('knowledge_entities')
        .insert({
          external_id: entityData.external_id,
          content: entityData.content,
          entity_type: entityData.entity_type || 'general',
          domain: entityData.domain || 'general',
          query_hash: entityData.query_hash,
          created_by: entityData.created_by,
          metadata: entityData.metadata || {},
          confidence_score: entityData.confidence_score || 0.0,
          source_type: entityData.source_type || 'agent_generated'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Failed to create knowledge entity:', error);
      throw error;
    }
  }

  async getKnowledgeEntitiesByDomain(domain, limit = 10) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, returning empty knowledge entities');
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('knowledge_entities')
        .select('*')
        .eq('domain', domain)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Failed to get knowledge entities by domain:', error);
      return [];
    }
  }

  async getKnowledgeEntitiesByQueryHash(queryHash, limit = 5) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, returning empty knowledge entities');
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('knowledge_entities')
        .select('*')
        .eq('query_hash', queryHash)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Failed to get knowledge entities by query hash:', error);
      return [];
    }
  }

  async storeResearchInsights(insightsData) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, skipping research insights storage');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('research_insights')
        .insert({
          query: insightsData.query_text || insightsData.query,
          original_query: insightsData.original_query || insightsData.query_text || insightsData.query,
          query_hash: insightsData.query_hash,
          domain: insightsData.domain || 'general',
          patterns: insightsData.patterns || [],
          search_results: insightsData.search_results || {},
          research_results: insightsData.research_results || insightsData.insights || insightsData.search_results,
          session_id: insightsData.session_id,
          orchestration_id: insightsData.orchestration_id,
          metadata: insightsData.metadata || {}
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Failed to store research insights:', error);
      throw error;
    }
  }

  async getResearchInsightsByQueryHash(queryHash, limit = 3) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, returning empty research insights');
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('research_insights')
        .select('*')
        .eq('query_hash', queryHash)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Failed to get research insights by query hash:', error);
      return [];
    }
  }

  // New method for semantic similarity-based research retrieval
  async getResearchInsightsForSimilarity(domain = null, limit = 10) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, returning empty research insights');
      return [];
    }

    try {
      let query = this.supabase
        .from('research_insights')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      // Filter by domain if provided
      if (domain && domain !== 'general') {
        query = query.eq('domain', domain);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Failed to get research insights for similarity:', error);
      return [];
    }
  }

  // New method for semantic similarity-based analysis retrieval
  async getAnalysisInsightsForSimilarity(domain = null, limit = 10) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, returning empty analysis insights');
      return [];
    }

    try {
      let query = this.supabase
        .from('analysis_insights')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      // Filter by domain if provided
      if (domain && domain !== 'general') {
        query = query.eq('domain', domain);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Failed to get analysis insights for similarity:', error);
      return [];
    }
  }

  // New method for semantic similarity-based QA retrieval
  async getQAInsightsForSimilarity(domain = null, limit = 10) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, returning empty QA insights');
      return [];
    }

    try {
      let query = this.supabase
        .from('qa_insights')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      // Filter by domain if provided
      if (domain && domain !== 'general') {
        query = query.eq('domain', domain);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Failed to get QA insights for similarity:', error);
      return [];
    }
  }

  async storeWebSearchCache(cacheData) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, skipping web search cache storage');
      return null;
    }

    try {
      // First check if cache entry already exists
      const { data: existing } = await this.supabase
        .from('web_search_cache')
        .select('id, hit_count')
        .eq('query_hash', cacheData.query_hash)
        .single();

      if (existing) {
        // Update existing entry
        const { data, error } = await this.supabase
          .from('web_search_cache')
          .update({
            hit_count: existing.hit_count + 1,
            cached_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new entry
        const { data, error } = await this.supabase
          .from('web_search_cache')
          .insert({
            query_hash: cacheData.query_hash,
            query_text: cacheData.query_text,
            domain: cacheData.domain || 'general',
            results: cacheData.results,
            metadata: cacheData.metadata || {}
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    } catch (error) {
      logger.error('Failed to store web search cache:', error);
      throw error;
    }
  }

  async getWebSearchCache(queryHash) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, returning null from web search cache');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('web_search_cache')
        .select('*')
        .eq('query_hash', queryHash)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found"
      return data;
    } catch (error) {
      logger.error('Failed to get web search cache:', error);
      return null;
    }
  }

  async storeQAInsights(qaData) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, skipping QA insights storage');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('qa_insights')
        .insert({
          content_hash: qaData.content_hash,
          qa_type: qaData.qa_type,
          quality_metrics: qaData.quality_metrics || {},
          improvement_patterns: qaData.improvement_patterns || [],
          session_id: qaData.session_id,
          orchestration_id: qaData.orchestration_id,
          metadata: qaData.metadata || {}
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Failed to store QA insights:', error);
      throw error;
    }
  }

  async getQAInsightsByContentHash(contentHash, limit = 5) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, returning empty QA insights');
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('qa_insights')
        .select('*')
        .eq('content_hash', contentHash)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Failed to get QA insights by content hash:', error);
      return [];
    }
  }

  async createKnowledgeRelationship(fromNodeId, toNodeId, relationshipType, properties = {}) {
    if (!this.neo4jDriver) {
      logger.warn('Neo4j not initialized, skipping relationship creation');
      return null;
    }

    const session = this.neo4jDriver.session();
    try {
      const result = await session.run(
        `MATCH (a), (b) WHERE id(a) = $fromNodeId AND id(b) = $toNodeId
         CREATE (a)-[r:${relationshipType} $properties]->(b)
         RETURN r`,
        { fromNodeId, toNodeId, properties }
      );
      return result.records[0]?.get('r').properties;
    } finally {
      await session.close();
    }
  }

  async queryKnowledgeGraph(cypher, parameters = {}) {
    return this.queryKnowledge(cypher, parameters);
  }

  validateCypherQuery(cypher) {
    if (!cypher || typeof cypher !== 'string') return false;
    const validKeywords = ['MATCH', 'CREATE', 'MERGE', 'RETURN', 'WHERE', 'WITH', 'UNWIND'];
    const upperCypher = cypher.toUpperCase();
    return validKeywords.some(keyword => upperCypher.includes(keyword));
  }

  async queryKnowledge(cypher, parameters = {}) {
    if (!this.neo4jDriver) {
      logger.warn('Neo4j not initialized, returning empty results');
      return [];
    }

    const session = this.neo4jDriver.session();
    try {
      const result = await session.run(cypher, parameters);
      return result.records.map(record => record.toObject());
    } finally {
      await session.close();
    }
  }

  // Redis operations
  async cacheSet(key, value, ttl = 3600) {
    if (!this.redisClient) {
      logger.warn('Redis not initialized, skipping cache set');
      return;
    }
    
    try {
      await this.redisClient.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error('Redis cache set failed:', error.message);
      // Don't throw, just log and continue
    }
  }

  async cacheGet(key) {
    if (!this.redisClient) {
      logger.warn('Redis not initialized, returning null from cache');
      return null;
    }
    
    try {
      const value = await this.redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis cache get failed:', error.message);
      return null;
    }
  }

  async cacheDelete(key) {
    if (!this.redisClient) {
      logger.warn('Redis not initialized, skipping cache delete');
      return;
    }
    
    try {
      await this.redisClient.del(key);
    } catch (error) {
      logger.error('Redis cache delete failed:', error.message);
      // Don't throw, just log and continue
    }
  }

  async cacheDel(key) {
    return this.cacheDelete(key);
  }

  validateCacheKey(key) {
    if (!key || typeof key !== 'string' || key.length === 0) {
      return false;
    }
    return true;
  }

  // Cleanup
  async close() {
    if (this.neo4jDriver) {
      await this.neo4jDriver.close();
    }
    if (this.redisClient) {
      await this.redisClient.quit();
    }
    logger.info('Database connections closed');
  }
}

// Singleton instance
const databaseService = new DatabaseService();

module.exports = { databaseService };
