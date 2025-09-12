// Semantic Similarity Utilities for Knowledge Substrate Caching
const crypto = require('crypto');

class SemanticSimilarity {
  
  /**
   * Calculate semantic similarity between two text strings
   * @param {string} text1 - First text to compare
   * @param {string} text2 - Second text to compare
   * @param {number} threshold - Similarity threshold (0.0 to 1.0)
   * @returns {object} - {similarity: number, isMatch: boolean}
   */
  static calculateSimilarity(text1, text2, threshold = 0.75) {
    if (!text1 || !text2) return { similarity: 0, isMatch: false };
    
    // Normalize texts
    const normalized1 = this.normalizeText(text1);
    const normalized2 = this.normalizeText(text2);
    
    // Calculate multiple similarity metrics
    const jaccardSim = this.jaccardSimilarity(normalized1, normalized2);
    const cosineSim = this.cosineSimilarity(normalized1, normalized2);
    const levenshteinSim = this.levenshteinSimilarity(normalized1, normalized2);
    
    // Weighted average of similarity metrics
    const similarity = (jaccardSim * 0.4) + (cosineSim * 0.4) + (levenshteinSim * 0.2);
    
    return {
      similarity: Math.round(similarity * 1000) / 1000, // Round to 3 decimal places
      isMatch: similarity >= threshold,
      metrics: {
        jaccard: jaccardSim,
        cosine: cosineSim,
        levenshtein: levenshteinSim
      }
    };
  }
  
  /**
   * Normalize text for comparison
   * @param {string} text - Text to normalize
   * @returns {string} - Normalized text
   */
  static normalizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
  
  /**
   * Calculate Jaccard similarity (intersection over union of words)
   * @param {string} text1 - First normalized text
   * @param {string} text2 - Second normalized text
   * @returns {number} - Jaccard similarity (0.0 to 1.0)
   */
  static jaccardSimilarity(text1, text2) {
    const words1 = new Set(text1.split(' ').filter(w => w.length > 2));
    const words2 = new Set(text2.split(' ').filter(w => w.length > 2));
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return union.size === 0 ? 0 : intersection.size / union.size;
  }
  
  /**
   * Calculate cosine similarity using TF-IDF vectors
   * @param {string} text1 - First normalized text
   * @param {string} text2 - Second normalized text
   * @returns {number} - Cosine similarity (0.0 to 1.0)
   */
  static cosineSimilarity(text1, text2) {
    const words1 = text1.split(' ').filter(w => w.length > 2);
    const words2 = text2.split(' ').filter(w => w.length > 2);
    
    // Create vocabulary
    const vocab = [...new Set([...words1, ...words2])];
    
    // Create frequency vectors
    const vector1 = vocab.map(word => words1.filter(w => w === word).length);
    const vector2 = vocab.map(word => words2.filter(w => w === word).length);
    
    // Calculate dot product and magnitudes
    const dotProduct = vector1.reduce((sum, val, i) => sum + (val * vector2[i]), 0);
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + (val * val), 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + (val * val), 0));
    
    return (magnitude1 === 0 || magnitude2 === 0) ? 0 : dotProduct / (magnitude1 * magnitude2);
  }
  
  /**
   * Calculate Levenshtein similarity (normalized edit distance)
   * @param {string} text1 - First normalized text
   * @param {string} text2 - Second normalized text
   * @returns {number} - Levenshtein similarity (0.0 to 1.0)
   */
  static levenshteinSimilarity(text1, text2) {
    const distance = this.levenshteinDistance(text1, text2);
    const maxLength = Math.max(text1.length, text2.length);
    
    return maxLength === 0 ? 1 : 1 - (distance / maxLength);
  }
  
  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Edit distance
   */
  static levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  /**
   * Find the most similar cached result from a list
   * @param {string} query - Query to match against
   * @param {Array} cachedResults - Array of cached results with query/content fields
   * @param {string} queryField - Field name containing the query text (default: 'query')
   * @param {number} threshold - Similarity threshold (default: 0.75)
   * @returns {object|null} - Best match or null if no match above threshold
   */
  static findBestMatch(query, cachedResults, queryField = 'query', threshold = 0.75) {
    if (!cachedResults || cachedResults.length === 0) return null;
    
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const result of cachedResults) {
      const cachedQuery = result[queryField];
      if (!cachedQuery) continue;
      
      const similarity = this.calculateSimilarity(query, cachedQuery, threshold);
      
      if (similarity.isMatch && similarity.similarity > bestSimilarity) {
        bestSimilarity = similarity.similarity;
        bestMatch = {
          ...result,
          _similarity: similarity
        };
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Generate a semantic hash for grouping similar queries
   * @param {string} text - Text to hash
   * @returns {string} - Semantic hash
   */
  static generateSemanticHash(text) {
    // Extract key terms (words longer than 3 characters)
    const keyTerms = this.normalizeText(text)
      .split(' ')
      .filter(word => word.length > 3)
      .sort()
      .join('|');
    
    return crypto.createHash('md5').update(keyTerms).digest('hex');
  }
  
  /**
   * Check if a query is semantically similar to any in a list
   * @param {string} query - Query to check
   * @param {Array} queries - Array of query strings
   * @param {number} threshold - Similarity threshold (default: 0.75)
   * @returns {boolean} - True if similar query found
   */
  static hasSimilarQuery(query, queries, threshold = 0.75) {
    return queries.some(cachedQuery => {
      const similarity = this.calculateSimilarity(query, cachedQuery, threshold);
      return similarity.isMatch;
    });
  }
}

module.exports = { SemanticSimilarity };
