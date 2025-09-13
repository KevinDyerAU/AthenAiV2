const OpenAI = require('openai');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/embeddings.log' }),
    new winston.transports.Console()
  ]
});

class EmbeddingService {
  constructor() {
    // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.defaultModel = 'text-embedding-ada-002';
    this.maxTokens = 8191; // Max tokens for ada-002
    this.batchSize = 100; // Process embeddings in batches
  }

  async generateEmbedding(text, options = {}) {
    try {
      if (!text || typeof text !== 'string') {
        throw new Error('Text input is required and must be a string');
      }

      // Truncate text if it's too long
      const truncatedText = this.truncateText(text);

      const model = options.model || this.defaultModel;

      logger.debug('Generating embedding', { 
        textLength: text.length,
        truncatedLength: truncatedText.length,
        model 
      });

      const response = await this.openai.embeddings.create({
        model: model,
        input: truncatedText
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data received from OpenAI');
      }

      const embedding = response.data[0].embedding;

      logger.debug('Embedding generated successfully', { 
        embeddingDimensions: embedding.length,
        usage: response.usage
      });

      return embedding;

    } catch (error) {
      logger.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  async generateBatchEmbeddings(texts, options = {}) {
    try {
      if (!Array.isArray(texts) || texts.length === 0) {
        throw new Error('Texts input must be a non-empty array');
      }

      logger.info('Starting batch embedding generation', { 
        textCount: texts.length,
        batchSize: this.batchSize
      });

      const results = [];
      const batches = this.createBatches(texts, this.batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        logger.debug(`Processing batch ${i + 1}/${batches.length}`, { 
          batchSize: batch.length 
        });

        try {
          const batchResults = await this.processBatch(batch, options);
          results.push(...batchResults);
        } catch (error) {
          logger.error(`Error processing batch ${i + 1}:`, error);
          
          // Try processing items individually as fallback
          for (const text of batch) {
            try {
              const embedding = await this.generateEmbedding(text, options);
              results.push({ text, embedding, success: true });
            } catch (itemError) {
              logger.error('Error processing individual item:', itemError);
              results.push({ 
                text, 
                embedding: null, 
                success: false, 
                error: itemError.message 
              });
            }
          }
        }

        // Add delay between batches to respect rate limits
        if (i < batches.length - 1) {
          await this.delay(100);
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;

      logger.info('Batch embedding generation completed', { 
        total: results.length,
        successful,
        failed
      });

      return results;

    } catch (error) {
      logger.error('Error in batch embedding generation:', error);
      throw error;
    }
  }

  async processBatch(texts, options = {}) {
    const model = options.model || this.defaultModel;
    const truncatedTexts = texts.map(text => this.truncateText(text));

    const response = await this.openai.embeddings.create({
      model: model,
      input: truncatedTexts
    });

    if (!response.data || response.data.length !== texts.length) {
      throw new Error('Batch embedding response length mismatch');
    }

    return texts.map((text, index) => ({
      text,
      embedding: response.data[index].embedding,
      success: true
    }));
  }

  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  truncateText(text, maxTokens = null) {
    const limit = maxTokens || this.maxTokens;
    
    // Simple approximation: ~4 characters per token
    const maxChars = limit * 4;
    
    if (text.length <= maxChars) {
      return text;
    }

    // Truncate at word boundary
    const truncated = text.substring(0, maxChars);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    if (lastSpaceIndex > maxChars * 0.8) {
      return truncated.substring(0, lastSpaceIndex);
    }
    
    return truncated;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Calculate cosine similarity between two embeddings
  calculateSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2 || 
        embedding1.length !== embedding2.length) {
      throw new Error('Invalid embeddings for similarity calculation');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    
    if (magnitude === 0) {
      return 0;
    }

    return dotProduct / magnitude;
  }

  // Find most similar embeddings from a collection
  findMostSimilar(queryEmbedding, embeddingCollection, topK = 5) {
    if (!queryEmbedding || !Array.isArray(embeddingCollection)) {
      throw new Error('Invalid input for similarity search');
    }

    const similarities = embeddingCollection.map((item, index) => {
      const similarity = this.calculateSimilarity(queryEmbedding, item.embedding);
      return {
        index,
        similarity,
        ...item
      };
    });

    // Sort by similarity (descending) and return top K
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  // Cluster embeddings using simple k-means approach
  async clusterEmbeddings(embeddings, k = 5, maxIterations = 100) {
    try {
      if (!Array.isArray(embeddings) || embeddings.length < k) {
        throw new Error('Not enough embeddings for clustering');
      }

      logger.info('Starting embedding clustering', { 
        embeddingCount: embeddings.length,
        clusters: k
      });

      // Initialize centroids randomly
      let centroids = this.initializeCentroids(embeddings, k);
      let assignments = new Array(embeddings.length);
      let converged = false;
      let iteration = 0;

      while (!converged && iteration < maxIterations) {
        // Assign each embedding to nearest centroid
        const newAssignments = embeddings.map((embedding, index) => {
          let bestCluster = 0;
          let bestSimilarity = -1;

          for (let c = 0; c < k; c++) {
            const similarity = this.calculateSimilarity(embedding.embedding, centroids[c]);
            if (similarity > bestSimilarity) {
              bestSimilarity = similarity;
              bestCluster = c;
            }
          }

          return bestCluster;
        });

        // Check for convergence
        converged = newAssignments.every((assignment, index) => 
          assignment === assignments[index]
        );

        assignments = newAssignments;

        // Update centroids
        if (!converged) {
          centroids = this.updateCentroids(embeddings, assignments, k);
        }

        iteration++;
      }

      // Group embeddings by cluster
      const clusters = Array.from({ length: k }, () => []);
      embeddings.forEach((embedding, index) => {
        clusters[assignments[index]].push({
          ...embedding,
          cluster: assignments[index]
        });
      });

      logger.info('Clustering completed', { 
        iterations: iteration,
        converged,
        clusterSizes: clusters.map(c => c.length)
      });

      return {
        clusters,
        centroids,
        assignments,
        converged,
        iterations: iteration
      };

    } catch (error) {
      logger.error('Error in embedding clustering:', error);
      throw error;
    }
  }

  initializeCentroids(embeddings, k) {
    const centroids = [];
    const embeddingDim = embeddings[0].embedding.length;

    for (let i = 0; i < k; i++) {
      // Initialize with random embedding from the dataset
      const randomIndex = Math.floor(Math.random() * embeddings.length);
      centroids.push([...embeddings[randomIndex].embedding]);
    }

    return centroids;
  }

  updateCentroids(embeddings, assignments, k) {
    const centroids = [];
    const embeddingDim = embeddings[0].embedding.length;

    for (let c = 0; c < k; c++) {
      const clusterEmbeddings = embeddings.filter((_, index) => assignments[index] === c);
      
      if (clusterEmbeddings.length === 0) {
        // If cluster is empty, keep previous centroid or initialize randomly
        centroids.push(new Array(embeddingDim).fill(0));
        continue;
      }

      // Calculate mean of all embeddings in cluster
      const centroid = new Array(embeddingDim).fill(0);
      
      clusterEmbeddings.forEach(item => {
        item.embedding.forEach((value, dim) => {
          centroid[dim] += value;
        });
      });

      // Normalize by cluster size
      centroid.forEach((value, dim) => {
        centroid[dim] = value / clusterEmbeddings.length;
      });

      centroids.push(centroid);
    }

    return centroids;
  }

  // Get embedding statistics
  getEmbeddingStats(embeddings) {
    if (!Array.isArray(embeddings) || embeddings.length === 0) {
      return null;
    }

    const dimensions = embeddings[0].embedding.length;
    const magnitudes = embeddings.map(item => {
      return Math.sqrt(item.embedding.reduce((sum, val) => sum + val * val, 0));
    });

    return {
      count: embeddings.length,
      dimensions,
      averageMagnitude: magnitudes.reduce((sum, mag) => sum + mag, 0) / magnitudes.length,
      minMagnitude: Math.min(...magnitudes),
      maxMagnitude: Math.max(...magnitudes)
    };
  }
}

// Export singleton instance
const embeddingService = new EmbeddingService();

module.exports = {
  generateEmbedding: (text, options) => embeddingService.generateEmbedding(text, options),
  generateBatchEmbeddings: (texts, options) => embeddingService.generateBatchEmbeddings(texts, options),
  calculateSimilarity: (emb1, emb2) => embeddingService.calculateSimilarity(emb1, emb2),
  findMostSimilar: (query, collection, topK) => embeddingService.findMostSimilar(query, collection, topK),
  clusterEmbeddings: (embeddings, k, maxIter) => embeddingService.clusterEmbeddings(embeddings, k, maxIter),
  getEmbeddingStats: (embeddings) => embeddingService.getEmbeddingStats(embeddings),
  EmbeddingService
};
