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

let openaiClient = null;

function createOpenAIClient() {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OpenAI API key. Please set OPENAI_API_KEY environment variable.');
  }

  try {
    openaiClient = new OpenAI({
      apiKey: apiKey,
      timeout: 30000
    });

    logger.info('OpenAI client initialized successfully');
    return openaiClient;
  } catch (error) {
    logger.error('Failed to initialize OpenAI client:', error);
    throw error;
  }
}

class EmbeddingService {
  constructor() {
    this.client = createOpenAIClient();
    this.model = 'text-embedding-ada-002';
  }

  async generateEmbedding(text) {
    try {
      if (!text || typeof text !== 'string') {
        throw new Error('Text must be a non-empty string');
      }

      // Clean and truncate text if necessary (ada-002 has ~8191 token limit)
      const cleanText = text.replace(/\s+/g, ' ').trim();
      const truncatedText = cleanText.length > 32000 ? cleanText.substring(0, 32000) : cleanText;

      const response = await this.client.embeddings.create({
        model: this.model,
        input: truncatedText
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data received from OpenAI');
      }

      const embedding = response.data[0].embedding;
      logger.info(`Generated embedding for text (${truncatedText.length} chars)`);
      
      return embedding;
    } catch (error) {
      logger.error('Error generating embedding:', error);
      throw error;
    }
  }

  async generateEmailEmbedding(emailData) {
    try {
      // Combine relevant email fields for embedding
      const combinedText = [
        emailData.subject || '',
        emailData.body_text || '',
        emailData.from_address || ''
      ].filter(text => text.length > 0).join(' ');

      if (!combinedText.trim()) {
        throw new Error('No text content available for embedding generation');
      }

      return await this.generateEmbedding(combinedText);
    } catch (error) {
      logger.error('Error generating email embedding:', error);
      throw error;
    }
  }

  async generateBatchEmbeddings(texts) {
    try {
      if (!Array.isArray(texts) || texts.length === 0) {
        throw new Error('Texts must be a non-empty array');
      }

      // Clean and validate texts
      const cleanTexts = texts
        .filter(text => text && typeof text === 'string')
        .map(text => {
          const clean = text.replace(/\s+/g, ' ').trim();
          return clean.length > 32000 ? clean.substring(0, 32000) : clean;
        });

      if (cleanTexts.length === 0) {
        throw new Error('No valid texts provided for embedding generation');
      }

      const response = await this.client.embeddings.create({
        model: this.model,
        input: cleanTexts
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data received from OpenAI');
      }

      const embeddings = response.data.map(item => item.embedding);
      logger.info(`Generated ${embeddings.length} embeddings in batch`);
      
      return embeddings;
    } catch (error) {
      logger.error('Error generating batch embeddings:', error);
      throw error;
    }
  }

  // Calculate cosine similarity between two embeddings
  calculateSimilarity(embedding1, embedding2) {
    try {
      if (!Array.isArray(embedding1) || !Array.isArray(embedding2)) {
        throw new Error('Embeddings must be arrays');
      }

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

      const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
      return similarity;
    } catch (error) {
      logger.error('Error calculating similarity:', error);
      throw error;
    }
  }

  // Find most similar embeddings from a list
  findMostSimilar(queryEmbedding, candidateEmbeddings, threshold = 0.8) {
    try {
      const similarities = candidateEmbeddings.map((embedding, index) => ({
        index,
        similarity: this.calculateSimilarity(queryEmbedding, embedding.embedding || embedding),
        data: embedding
      }));

      return similarities
        .filter(item => item.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity);
    } catch (error) {
      logger.error('Error finding most similar embeddings:', error);
      throw error;
    }
  }
}

module.exports = {
  createOpenAIClient,
  EmbeddingService
};
