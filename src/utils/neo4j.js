const neo4j = require('neo4j-driver');
const { logger } = require('./logger');

/**
 * Neo4j Database Utility
 * Provides connection and query utilities for Neo4j graph database
 */
class Neo4jClient {
  constructor() {
    this.driver = null;
    this.session = null;
  }

  /**
   * Initialize Neo4j connection
   */
  async connect() {
    try {
      const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
      const user = process.env.NEO4J_USER || 'neo4j';
      const password = process.env.NEO4J_PASSWORD || 'password';

      this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
      
      // Test connection
      await this.driver.verifyConnectivity();
      logger.info('Neo4j connection established successfully');
      
      return this.driver;
    } catch (error) {
      logger.error('Failed to connect to Neo4j:', error);
      throw error;
    }
  }

  /**
   * Get a new session
   */
  getSession() {
    if (!this.driver) {
      throw new Error('Neo4j driver not initialized. Call connect() first.');
    }
    return this.driver.session();
  }

  /**
   * Execute a Cypher query
   */
  async executeQuery(query, parameters = {}) {
    const session = this.getSession();
    try {
      const result = await session.run(query, parameters);
      return result.records.map(record => record.toObject());
    } catch (error) {
      logger.error('Neo4j query error:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Execute a write transaction
   */
  async executeWriteTransaction(query, parameters = {}) {
    const session = this.getSession();
    try {
      const result = await session.executeWrite(tx => tx.run(query, parameters));
      return result.records.map(record => record.toObject());
    } catch (error) {
      logger.error('Neo4j write transaction error:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Execute a read transaction
   */
  async executeReadTransaction(query, parameters = {}) {
    const session = this.getSession();
    try {
      const result = await session.executeRead(tx => tx.run(query, parameters));
      return result.records.map(record => record.toObject());
    } catch (error) {
      logger.error('Neo4j read transaction error:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Close the connection
   */
  async close() {
    if (this.driver) {
      await this.driver.close();
      logger.info('Neo4j connection closed');
    }
  }

  /**
   * Create or update an entity node
   */
  async createEntity(entityData) {
    const query = `
      MERGE (e:Entity {name: $name, type: $type})
      SET e.confidence = $confidence,
          e.description = $description,
          e.created_at = datetime(),
          e.last_seen = datetime(),
          e.mention_count = COALESCE(e.mention_count, 0) + 1
      RETURN e
    `;
    
    return await this.executeWriteTransaction(query, entityData);
  }

  /**
   * Create a relationship between entities
   */
  async createRelationship(fromEntity, toEntity, relationshipType, properties = {}) {
    const query = `
      MATCH (from:Entity {name: $fromName, type: $fromType})
      MATCH (to:Entity {name: $toName, type: $toType})
      MERGE (from)-[r:${relationshipType}]->(to)
      SET r += $properties,
          r.created_at = datetime(),
          r.last_updated = datetime()
      RETURN r
    `;
    
    const parameters = {
      fromName: fromEntity.name,
      fromType: fromEntity.type,
      toName: toEntity.name,
      toType: toEntity.type,
      properties
    };
    
    return await this.executeWriteTransaction(query, parameters);
  }

  /**
   * Search entities by name or type
   */
  async searchEntities(searchTerm, entityType = null) {
    let query = `
      MATCH (e:Entity)
      WHERE e.name CONTAINS $searchTerm
    `;
    
    const parameters = { searchTerm };
    
    if (entityType) {
      query += ` AND e.type = $entityType`;
      parameters.entityType = entityType;
    }
    
    query += ` RETURN e ORDER BY e.mention_count DESC LIMIT 20`;
    
    return await this.executeReadTransaction(query, parameters);
  }

  /**
   * Get entity relationships
   */
  async getEntityRelationships(entityName, entityType, depth = 1) {
    const query = `
      MATCH (e:Entity {name: $entityName, type: $entityType})
      MATCH (e)-[r*1..${depth}]-(related)
      RETURN e, r, related
      LIMIT 50
    `;
    
    return await this.executeReadTransaction(query, { entityName, entityType });
  }
}

// Create singleton instance
const neo4jClient = new Neo4jClient();

/**
 * Create Neo4j driver (legacy function for backward compatibility)
 */
function createNeo4jDriver() {
  return neo4jClient.connect();
}

/**
 * Get Neo4j client instance
 */
function getNeo4jClient() {
  return neo4jClient;
}

module.exports = {
  Neo4jClient,
  createNeo4jDriver,
  getNeo4jClient,
  neo4jClient
};
