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
        this.redisClient = redis.createClient({
          url: process.env.REDIS_URL
        });
        
        this.redisClient.on('error', (err) => {
          logger.error('Redis Client Error', err);
        });
        
        await this.redisClient.connect();
        logger.info('Redis initialized');
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
        session_id: sessionId,
        user_id: userId,
        message,
        response,
        agent_type: agentType,
        metadata,
        created_at: new Date().toISOString()
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
    await this.redisClient.setEx(key, ttl, JSON.stringify(value));
  }

  async cacheGet(key) {
    if (!this.redisClient) {
      logger.warn('Redis not initialized, returning null from cache');
      return null;
    }
    const value = await this.redisClient.get(key);
    return value ? JSON.parse(value) : null;
  }

  async cacheDelete(key) {
    if (!this.redisClient) {
      logger.warn('Redis not initialized, skipping cache delete');
      return;
    }
    await this.redisClient.del(key);
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
