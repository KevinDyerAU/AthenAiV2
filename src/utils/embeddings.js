const axios = require('axios');
const { logger } = require('./logger');

/**
 * Embeddings Utility
 * Provides text embedding generation using OpenAI or OpenRouter APIs
 */
class EmbeddingService {
  constructor() {
    this.useOpenRouter = process.env.USE_OPENROUTER === 'true';
    this.apiKey = this.useOpenRouter ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
    this.baseURL = this.useOpenRouter ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1';
    this.model = this.useOpenRouter ? 'openai/text-embedding-ada-002' : 'text-embedding-ada-002';
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbedding(text) {
    try {
      if (!this.apiKey) {
        throw new Error(`${this.useOpenRouter ? 'OPENROUTER_API_KEY' : 'OPENAI_API_KEY'} not configured`);
      }

      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };

      if (this.useOpenRouter) {
        headers['HTTP-Referer'] = 'https://athenai.local';
        headers['X-Title'] = 'AthenAI Knowledge System';
      }

      const response = await axios.post(`${this.baseURL}/embeddings`, {
        model: this.model,
        input: text,
        encoding_format: 'float'
      }, { headers });

      if (response.data && response.data.data && response.data.data[0]) {
        return response.data.data[0].embedding;
      } else {
        throw new Error('Invalid embedding response format');
      }
    } catch (error) {
      logger.error('Embedding generation error:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateBatchEmbeddings(texts) {
    try {
      if (!this.apiKey) {
        throw new Error(`${this.useOpenRouter ? 'OPENROUTER_API_KEY' : 'OPENAI_API_KEY'} not configured`);
      }

      const headers = {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      };

      if (this.useOpenRouter) {
        headers['HTTP-Referer'] = 'https://athenai.local';
        headers['X-Title'] = 'AthenAI Knowledge System';
      }

      const response = await axios.post(`${this.baseURL}/embeddings`, {
        model: this.model,
        input: texts,
        encoding_format: 'float'
      }, { headers });

      if (response.data && response.data.data) {
        return response.data.data.map(item => item.embedding);
      } else {
        throw new Error('Invalid batch embedding response format');
      }
    } catch (error) {
      logger.error('Batch embedding generation error:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(embedding1, embedding2) {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * Find most similar embeddings from a list
   */
  findMostSimilar(queryEmbedding, embeddings, topK = 5) {
    const similarities = embeddings.map((embedding, index) => ({
      index,
      similarity: this.cosineSimilarity(queryEmbedding, embedding.vector || embedding),
      data: embedding
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Normalize text for embedding
   */
  normalizeText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-.,!?;:()]/g, '')
      .substring(0, 8000); // Limit to avoid token limits
  }
}

// Create singleton instance
const embeddingService = new EmbeddingService();

/**
 * Generate embedding for text (legacy function for backward compatibility)
 */
async function generateEmbedding(text) {
  return await embeddingService.generateEmbedding(text);
}

/**
 * Generate embeddings for multiple texts
 */
async function generateBatchEmbeddings(texts) {
  return await embeddingService.generateBatchEmbeddings(texts);
}

/**
 * Calculate cosine similarity between embeddings
 */
function cosineSimilarity(embedding1, embedding2) {
  return embeddingService.cosineSimilarity(embedding1, embedding2);
}

/**
 * Get embedding service instance
 */
function getEmbeddingService() {
  return embeddingService;
}

module.exports = {
  EmbeddingService,
  generateEmbedding,
  generateBatchEmbeddings,
  cosineSimilarity,
  getEmbeddingService,
  embeddingService
};
