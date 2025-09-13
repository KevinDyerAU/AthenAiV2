const crypto = require('crypto');
const winston = require('winston');
const { createClient } = require('@supabase/supabase-js');
const neo4j = require('neo4j-driver');
const { intelligentChunking } = require('../utils/chunking');
const { extractEntities } = require('../extractors/entity_extractor');
const { extractRelationships } = require('../extractors/relationship_extractor');
const { generateEmbedding } = require('../utils/embeddings');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/base_processor.log' }),
    new winston.transports.Console()
  ]
});

class BaseProcessor {
  constructor() {
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

    this.defaultOptions = {
      maxChunkSize: 1000,
      overlapSize: 200,
      preserveStructure: true,
      generateEmbeddings: true,
      extractEntities: true,
      extractRelationships: true
    };
  }

  async processContent(content, metadata, options = {}) {
    const processingId = crypto.randomUUID();
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      logger.info('Starting content processing', { 
        processingId,
        contentLength: content.length,
        sourceType: metadata.source_type 
      });

      // 1. Intelligent chunking based on content type and structure
      const chunks = await intelligentChunking(content, {
        contentType: metadata.source_type,
        maxChunkSize: opts.maxChunkSize,
        overlapSize: opts.overlapSize,
        preserveStructure: opts.preserveStructure
      });

      logger.info('Content chunked', { processingId, chunksCount: chunks.length });

      // 2. Process each chunk
      const processedChunks = [];
      for (const chunk of chunks) {
        const chunkData = await this.processChunk(chunk, metadata, processingId, opts);
        processedChunks.push(chunkData);
      }

      // 3. Extract document-level entities and relationships
      let documentEntities = [];
      let documentRelationships = [];

      if (opts.extractEntities) {
        documentEntities = await extractEntities(content);
        logger.info('Entities extracted', { 
          processingId, 
          entitiesCount: documentEntities.length 
        });
      }

      if (opts.extractRelationships) {
        documentRelationships = await extractRelationships(content, documentEntities);
        logger.info('Relationships extracted', { 
          processingId, 
          relationshipsCount: documentRelationships.length 
        });
      }

      // 4. Store in knowledge graph
      await this.storeInKnowledgeGraph({
        processingId,
        chunks: processedChunks,
        entities: documentEntities,
        relationships: documentRelationships,
        metadata
      });

      // 5. Store processing record
      await this.storeProcessingRecord(processingId, {
        content_length: content.length,
        chunks_processed: processedChunks.length,
        entities_extracted: documentEntities.length,
        relationships_found: documentRelationships.length,
        source_type: metadata.source_type,
        metadata: metadata,
        status: 'completed'
      });

      logger.info('Content processing completed', { 
        processingId,
        chunksProcessed: processedChunks.length,
        entitiesExtracted: documentEntities.length,
        relationshipsFound: documentRelationships.length
      });

      return {
        processingId,
        chunksProcessed: processedChunks.length,
        entitiesExtracted: documentEntities.length,
        relationshipsFound: documentRelationships.length,
        status: 'completed'
      };

    } catch (error) {
      logger.error(`Processing failed for ${processingId}:`, error);
      
      // Store error record
      await this.storeProcessingRecord(processingId, {
        content_length: content.length,
        source_type: metadata.source_type,
        metadata: metadata,
        status: 'failed',
        error: error.message
      });

      throw error;
    }
  }

  async processChunk(chunk, metadata, processingId, options) {
    try {
      let embedding = null;
      
      // Generate embedding for semantic search if enabled
      if (options.generateEmbeddings) {
        embedding = await generateEmbedding(chunk.text);
      }

      // Extract chunk-level entities if enabled
      let chunkEntities = [];
      if (options.extractEntities) {
        chunkEntities = await extractEntities(chunk.text);
      }

      // Store chunk in Supabase knowledge_entities table
      const { data: knowledgeEntity, error } = await this.supabase
        .from('knowledge_entities')
        .insert({
          external_id: `${processingId}_chunk_${chunk.index}`,
          content: chunk.text,
          entity_type: 'content_chunk',
          embedding: embedding,
          source_type: metadata.source_type,
          source_metadata: {
            ...metadata,
            chunk_index: chunk.index,
            chunk_start: chunk.start,
            chunk_end: chunk.end,
            chunk_type: chunk.type,
            entities: chunkEntities,
            processing_id: processingId
          }
        })
        .select()
        .single();

      if (error) {
        logger.error('Error storing chunk in Supabase:', error);
        throw error;
      }

      return {
        chunkId: knowledgeEntity.id,
        externalId: knowledgeEntity.external_id,
        text: chunk.text,
        entities: chunkEntities,
        embedding: embedding,
        type: chunk.type
      };

    } catch (error) {
      logger.error('Error processing chunk:', error);
      throw error;
    }
  }

  async storeInKnowledgeGraph(data) {
    const session = this.neo4j.session();
    
    try {
      logger.info('Storing in knowledge graph', { 
        processingId: data.processingId,
        chunksCount: data.chunks.length,
        entitiesCount: data.entities.length,
        relationshipsCount: data.relationships.length
      });

      // Create document node
      await session.run(`
        CREATE (d:Document {
          id: $processingId,
          source_type: $sourceType,
          created_at: datetime(),
          metadata: $metadata,
          chunks_count: $chunksCount,
          entities_count: $entitiesCount
        })
      `, {
        processingId: data.processingId,
        sourceType: data.metadata.source_type,
        metadata: JSON.stringify(data.metadata),
        chunksCount: data.chunks.length,
        entitiesCount: data.entities.length
      });

      // Create chunk nodes and relationships
      for (const chunk of data.chunks) {
        await session.run(`
          MATCH (d:Document {id: $processingId})
          CREATE (c:Chunk {
            id: $chunkId,
            external_id: $externalId,
            content: $content,
            chunk_index: $chunkIndex,
            chunk_type: $chunkType,
            entities_count: $entitiesCount
          })
          CREATE (d)-[:HAS_CHUNK {index: $chunkIndex}]->(c)
        `, {
          processingId: data.processingId,
          chunkId: chunk.chunkId,
          externalId: chunk.externalId,
          content: chunk.text,
          chunkIndex: data.chunks.indexOf(chunk),
          chunkType: chunk.type,
          entitiesCount: chunk.entities.length
        });
      }

      // Create entity nodes and relationships
      for (const entity of data.entities) {
        await session.run(`
          MERGE (e:Entity {name: $entityName, type: $entityType})
          ON CREATE SET e.created_at = datetime(), e.confidence = $confidence
          ON MATCH SET e.last_seen = datetime()
          WITH e
          MATCH (d:Document {id: $processingId})
          CREATE (d)-[:MENTIONS {confidence: $confidence, context: $context}]->(e)
        `, {
          entityName: entity.name,
          entityType: entity.type,
          confidence: entity.confidence,
          context: entity.context || '',
          processingId: data.processingId
        });
      }

      // Create relationships between entities
      for (const relationship of data.relationships) {
        await session.run(`
          MATCH (e1:Entity {name: $entity1})
          MATCH (e2:Entity {name: $entity2})
          MERGE (e1)-[r:RELATED_TO {type: $relType}]->(e2)
          ON CREATE SET r.confidence = $confidence, r.created_at = datetime(), r.context = $context
          ON MATCH SET r.last_seen = datetime(), r.confidence = CASE WHEN r.confidence < $confidence THEN $confidence ELSE r.confidence END
        `, {
          entity1: relationship.source,
          entity2: relationship.target,
          relType: relationship.type,
          confidence: relationship.confidence,
          context: relationship.context || ''
        });
      }

      logger.info('Knowledge graph storage completed', { processingId: data.processingId });

    } catch (error) {
      logger.error('Error storing in knowledge graph:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async storeProcessingRecord(processingId, record) {
    try {
      const { error } = await this.supabase
        .from('processing_logs')
        .insert({
          processing_id: processingId,
          ...record,
          created_at: new Date().toISOString()
        });

      if (error) {
        logger.error('Error storing processing record:', error);
        throw error;
      }
    } catch (error) {
      logger.error('Error in storeProcessingRecord:', error);
      // Don't throw here to avoid breaking the main processing flow
    }
  }

  // Search for similar content in the knowledge base
  async searchSimilarContent(query, options = {}) {
    try {
      const embedding = await generateEmbedding(query);
      const limit = options.limit || 10;
      const threshold = options.threshold || 0.7;

      const { data, error } = await this.supabase.rpc('search_similar_content', {
        query_embedding: embedding,
        similarity_threshold: threshold,
        match_count: limit
      });

      if (error) {
        logger.error('Error searching similar content:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Error in searchSimilarContent:', error);
      return [];
    }
  }

  // Get processing statistics
  async getProcessingStats(timeframe = '24 hours') {
    try {
      const { data, error } = await this.supabase
        .from('processing_logs')
        .select('*')
        .gte('created_at', new Date(Date.now() - this.parseTimeframe(timeframe)).toISOString());

      if (error) {
        logger.error('Error getting processing stats:', error);
        return null;
      }

      const stats = {
        total_processed: data.length,
        successful: data.filter(r => r.status === 'completed').length,
        failed: data.filter(r => r.status === 'failed').length,
        total_chunks: data.reduce((sum, r) => sum + (r.chunks_processed || 0), 0),
        total_entities: data.reduce((sum, r) => sum + (r.entities_extracted || 0), 0),
        total_relationships: data.reduce((sum, r) => sum + (r.relationships_found || 0), 0),
        by_source_type: {}
      };

      // Group by source type
      data.forEach(record => {
        const sourceType = record.source_type || 'unknown';
        if (!stats.by_source_type[sourceType]) {
          stats.by_source_type[sourceType] = 0;
        }
        stats.by_source_type[sourceType]++;
      });

      return stats;
    } catch (error) {
      logger.error('Error in getProcessingStats:', error);
      return null;
    }
  }

  parseTimeframe(timeframe) {
    const match = timeframe.match(/(\d+)\s*(hour|day|week)s?/);
    if (!match) return 24 * 60 * 60 * 1000; // Default 24 hours

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'hour': return value * 60 * 60 * 1000;
      case 'day': return value * 24 * 60 * 60 * 1000;
      case 'week': return value * 7 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  // Cleanup method
  async close() {
    try {
      await this.neo4j.close();
      logger.info('BaseProcessor connections closed');
    } catch (error) {
      logger.error('Error closing BaseProcessor connections:', error);
    }
  }
}

module.exports = BaseProcessor;
