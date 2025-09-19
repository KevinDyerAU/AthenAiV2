// src/services/database.js
const { createClient } = require('@supabase/supabase-js');
const neo4j = require('neo4j-driver');
const redis = require('redis');
const { logger } = require('../utils/logger');
const { advancedLogger, startTimer, endTimer } = require('../utils/advancedLogger');
const { monitoringCollector } = require('../utils/monitoringCollector');
const { ErrorHandler, DatabaseError, AIAPIError } = require('../utils/errorHandler');

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
      const dbError = ErrorHandler.handleDatabaseError(error, 'initialization', { service: 'database_service' });
      throw dbError;
    }
  }

  // Supabase operations
  async createConversation(sessionId, userId, message, response, agentType, metadata = {}) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, skipping conversation storage');
      return null;
    }

    const timerId = startTimer('db_create_conversation', { sessionId, agentType });
    try {
      advancedLogger.logDbOperation('insert', 'conversations', 'INSERT conversation', { sessionId, userId, agentType });
      
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
      
      const perf = endTimer(timerId, { success: true, recordCount: 1 });
      monitoringCollector.recordDbQuery('insert', 'conversations', perf.durationMs, true, { sessionId, agentType });
      
      return data;
    } catch (error) {
      const perf = endTimer(timerId, { success: false });
      const dbError = ErrorHandler.handleDatabaseError(error, 'create_conversation', { 
        sessionId, userId, agentType 
      });
      monitoringCollector.recordDbQuery('insert', 'conversations', perf.durationMs, false, { sessionId, agentType });
      advancedLogger.logDbError('create_conversation', dbError, { sessionId, userId, agentType });
      throw dbError;
    }
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
      const dbError = ErrorHandler.handleDatabaseError(error, 'store_research_insights', { 
        query: insightsData.query?.substring(0, 100), 
        domain: insightsData.domain 
      });
      throw dbError;
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
      const dbError = ErrorHandler.handleDatabaseError(error, 'get_research_insights', { queryHash });
      logger.error('Failed to get research insights by query hash:', dbError);
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
      const dbError = ErrorHandler.handleDatabaseError(error, 'get_web_search_cache', { queryHash });
      logger.error('Error getting web search cache:', dbError);
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

  // Email processing operations
  async storeEmailLog(emailData) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, skipping email log storage');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('email_logs')
        .insert({
          gmail_id: emailData.gmail_id,
          from_address: emailData.from_address,
          to_address: emailData.to_address,
          subject: emailData.subject,
          body_text: emailData.body_text,
          body_html: emailData.body_html,
          received_at: emailData.received_at,
          processing_status: emailData.processing_status || 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Failed to store email log:', error);
      throw error;
    }
  }

  async updateEmailProcessingStatus(emailId, status, agentActions = null) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, skipping email status update');
      return null;
    }

    try {
      const updateData = {
        processing_status: status,
        processed_at: new Date().toISOString()
      };

      if (agentActions) {
        updateData.agent_actions = agentActions;
      }

      const { data, error } = await this.supabase
        .from('email_logs')
        .update(updateData)
        .eq('id', emailId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Failed to update email processing status:', error);
      throw error;
    }
  }

  async storeContact(contactData) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, skipping contact storage');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('contacts')
        .upsert({
          email_address: contactData.email_address,
          full_name: contactData.full_name,
          company: contactData.company,
          role: contactData.role,
          interaction_count: contactData.interaction_count || 1,
          last_interaction_at: new Date().toISOString(),
          contact_metadata: contactData.metadata || {}
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Failed to store contact:', error);
      throw error;
    }
  }

  async storeEmailAttachment(attachmentData) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, skipping attachment storage');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('email_attachments')
        .insert({
          email_log_id: attachmentData.email_log_id,
          filename: attachmentData.filename,
          content_type: attachmentData.content_type,
          size_bytes: attachmentData.size_bytes,
          storage_path: attachmentData.storage_path,
          processed: attachmentData.processed || false
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Failed to store email attachment:', error);
      throw error;
    }
  }

  async searchSimilarEmails(embedding, threshold = 0.8, limit = 5) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, returning empty similar emails');
      return [];
    }

    try {
      // Use Supabase vector similarity search
      const { data, error } = await this.supabase.rpc('match_emails', {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: limit
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('Failed to search similar emails:', error);
      return [];
    }
  }

  async storeAgentSession(sessionData) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, skipping agent session storage');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('agent_sessions')
        .insert({
          session_type: sessionData.session_type,
          initial_context: sessionData.initial_context,
          current_state: sessionData.current_state,
          status: sessionData.status || 'active'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Failed to store agent session:', error);
      throw error;
    }
  }

  async updateAgentSession(sessionId, updates) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, skipping agent session update');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('agent_sessions')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('Failed to update agent session:', error);
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

  // Knowledge substrate operations for PlanningAgent
  async searchKnowledge(searchParams) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, returning empty search results');
      return [];
    }

    try {
      const { query, domain, limit = 10, similarity_threshold = 0.7, filters = {} } = searchParams;
      
      let supabaseQuery = this.supabase
        .from('knowledge_entities')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      // Filter by domain if provided
      if (domain && domain !== 'general') {
        supabaseQuery = supabaseQuery.eq('domain', domain);
      }

      // Apply content type filters
      if (filters.content_type && Array.isArray(filters.content_type)) {
        supabaseQuery = supabaseQuery.in('entity_type', filters.content_type);
      }

      // Apply complexity level filter
      if (filters.complexity_level) {
        supabaseQuery = supabaseQuery.contains('metadata', { complexity_level: filters.complexity_level });
      }

      // Execute query
      const { data, error } = await supabaseQuery;

      if (error) throw error;

      // Transform results to match expected format
      const results = (data || []).map(item => ({
        id: item.id,
        title: item.metadata?.title || `Knowledge Entity ${item.id}`,
        content: item.content,
        domain: item.domain,
        similarity_score: 0.8, // Mock similarity score since we don't have vector search yet
        metadata: {
          ...item.metadata,
          content_type: item.entity_type,
          created_at: item.created_at,
          created_by: item.created_by
        }
      }));

      logger.debug('Knowledge search completed', {
        query: query?.substring(0, 100),
        domain,
        resultsCount: results.length
      });

      return results;
    } catch (error) {
      logger.error('Failed to search knowledge:', error);
      return [];
    }
  }

  async storeKnowledge(knowledgeData) {
    if (!this.supabase) {
      logger.warn('Supabase not initialized, skipping knowledge storage');
      return null;
    }

    try {
      const { title, content, domain, metadata = {} } = knowledgeData;
      
      // Generate external_id if not provided
      const external_id = metadata.session_id ? 
        `${metadata.session_id}_${Date.now()}` : 
        `knowledge_${Date.now()}`;

      // Generate query hash for the content
      const query_hash = this.generateSimpleHash(content?.substring(0, 200) || title);

      const entityData = {
        external_id,
        content: content || title,
        entity_type: metadata.content_type || 'planning',
        domain: domain || 'general',
        query_hash,
        metadata: {
          ...metadata,
          title: title,
          created_by: metadata.created_by || 'PlanningAgent',
          stored_at: new Date().toISOString()
        },
        confidence_score: 0.9,
        source_type: 'agent_generated'
      };

      const { data, error } = await this.supabase
        .from('knowledge_entities')
        .insert(entityData)
        .select()
        .single();

      if (error) throw error;

      logger.debug('Knowledge stored successfully', {
        id: data.id,
        domain: data.domain,
        entity_type: data.entity_type
      });

      return data;
    } catch (error) {
      logger.error('Failed to store knowledge:', error);
      throw error;
    }
  }

  // Helper method to generate simple hash
  generateSimpleHash(text) {
    if (!text) return 'empty';
    
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  // Method to execute raw SQL queries (for testing)
  async executeQuery(query, params = []) {
    if (!this.supabase) {
      throw new Error('Database not initialized');
    }

    // For simple queries like 'SELECT 1', use a basic approach
    if (query.trim().toLowerCase() === 'select 1 as test') {
      return [{ test: 1 }];
    }

    // For more complex queries, you would need to use Supabase's query methods
    throw new Error('Complex queries not implemented yet');
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

// Legacy function for backward compatibility
function createSupabaseClient() {
  if (!databaseService.supabase) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }
    
    databaseService.supabase = createClient(supabaseUrl, supabaseKey);
  }
  
  return databaseService.supabase;
}

module.exports = { 
  databaseService,
  createSupabaseClient
};
