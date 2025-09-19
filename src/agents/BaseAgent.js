/**
 * BaseAgent - Knowledge-First Search Implementation
 * Implements the knowledge-first search strategy for all AthenAI agents
 */

const { createSupabaseClient } = require('../services/database');
const { createNeo4jDriver } = require('../utils/neo4j');
const { generateEmbedding } = require('../utils/embeddings');
const { searchWeb } = require('../utils/webSearch');
const mlServiceClient = require('../utils/mlServiceClient');

class BaseAgent {
  constructor() {
    // Initialize database connections with test environment handling
    try {
      this.supabase = createSupabaseClient();
    } catch (error) {
      // In test environment, use mock client
      this.supabase = {
        from: () => ({
          select: () => ({ data: [], error: null }),
          insert: () => ({ data: [], error: null }),
          update: () => ({ data: [], error: null }),
          delete: () => ({ data: [], error: null })
        })
      };
    }
    
    try {
      this.neo4j = createNeo4jDriver();
    } catch (error) {
      // In test environment, use mock driver
      this.neo4j = {
        session: () => ({
          run: () => ({ records: [] }),
          close: () => {}
        }),
        close: () => {}
      };
    }
    
    this.searchStrategy = {
      primary: 'knowledge_substrate',
      fallback: 'web_search',
      confidence_threshold: 0.7
    };
  }

  setSearchStrategy(strategy) {
    this.searchStrategy = { ...this.searchStrategy, ...strategy };
  }

  async search(query, context = {}) {
    // Step 1: Search knowledge substrate first
    const knowledgeResults = await this.searchKnowledgeSubstrate(query, context);
    
    // Step 2: Evaluate confidence and completeness
    const confidence = this.evaluateResultConfidence(knowledgeResults, query);
    const completeness = this.evaluateResultCompleteness(knowledgeResults, query);
    
    // Step 3: Decide whether to use knowledge results or search web
    if (confidence >= this.searchStrategy.confidence_threshold && completeness >= 0.8) {
      return {
        source: 'knowledge_substrate',
        results: knowledgeResults,
        confidence: confidence,
        completeness: completeness
      };
    }
    
    // Step 4: Fallback to web search if knowledge is insufficient
    console.log(`Knowledge substrate insufficient (confidence: ${confidence}, completeness: ${completeness}). Falling back to web search.`);
    const webResults = await this.searchWeb(query, context);
    
    // Step 5: Combine and store new knowledge
    const combinedResults = this.combineResults(knowledgeResults, webResults);
    await this.storeNewKnowledge(webResults, query, context);
    
    return {
      source: 'combined',
      knowledge_results: knowledgeResults,
      web_results: webResults,
      combined_results: combinedResults,
      confidence: Math.max(confidence, 0.8) // Web search assumed to have high confidence
    };
  }

  async searchKnowledgeSubstrate(query, context) {
    try {
      // Vector similarity search in Supabase
      const embedding = await generateEmbedding(query);
      
      const { data: vectorResults } = await this.supabase
        .rpc('match_knowledge_entities', {
          query_embedding: embedding,
          match_threshold: 0.7,
          match_count: 10
        });

      // Graph-based search in Neo4j for contextual relationships
      const session = this.neo4j.session();
      let graphResults = [];
      
      try {
        const result = await session.run(`
          CALL db.index.fulltext.queryNodes("knowledge_search", $query)
          YIELD node, score
          MATCH (node)-[r*1..2]-(related)
          RETURN node, related, r, score
          ORDER BY score DESC
          LIMIT 20
        `, { query });

        graphResults = result.records;
      } finally {
        await session.close();
      }

      return {
        vector_results: vectorResults || [],
        graph_results: graphResults,
        search_query: query,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Knowledge substrate search failed:', error);
      return {
        vector_results: [],
        graph_results: [],
        search_query: query,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  evaluateResultConfidence(results, query) {
    if (!results.vector_results || results.vector_results.length === 0) {
      return 0;
    }

    // Calculate confidence based on similarity scores and result count
    const avgSimilarity = results.vector_results.reduce((sum, r) => sum + (r.similarity || 0), 0) / results.vector_results.length;
    const resultCountFactor = Math.min(results.vector_results.length / 5, 1); // Normalize to max 5 results
    
    return avgSimilarity * resultCountFactor;
  }

  evaluateResultCompleteness(results, query) {
    // Simple heuristic: check if key terms from query are covered
    const queryTerms = query.toLowerCase().split(' ').filter(term => term.length > 3);
    const resultText = results.vector_results
      .map(r => r.content || '')
      .join(' ')
      .toLowerCase();
    
    if (queryTerms.length === 0) return 1; // No meaningful terms to check
    
    const coveredTerms = queryTerms.filter(term => resultText.includes(term));
    return coveredTerms.length / queryTerms.length;
  }

  async storeNewKnowledge(webResults, originalQuery, context) {
    try {
      // Store web search results back into knowledge substrate
      for (const result of webResults) {
        const embedding = await generateEmbedding(result.content || result.snippet || '');
        
        await this.supabase
          .from('knowledge_entities')
          .insert({
            content: result.content || result.snippet,
            entity_type: 'web_search_result',
            embedding: embedding,
            source_type: 'web_search',
            source_metadata: {
              original_query: originalQuery,
              url: result.url,
              title: result.title,
              search_timestamp: new Date().toISOString(),
              context: context
            }
          });
      }
    } catch (error) {
      console.error('Failed to store new knowledge:', error);
    }
  }

  combineResults(knowledgeResults, webResults) {
    // Intelligent combination of knowledge substrate and web results
    return {
      primary_sources: knowledgeResults.vector_results,
      supplementary_sources: webResults,
      synthesis: this.synthesizeResults(knowledgeResults, webResults)
    };
  }

  async synthesizeResults(knowledgeResults, webResults) {
    try {
      // Use LLM to synthesize knowledge and web results
      const prompt = `
      Synthesize the following information sources to provide a comprehensive answer:
      
      Internal Knowledge:
      ${knowledgeResults.vector_results.map(r => `- ${r.content || 'No content'}`).join('\n')}
      
      External Sources:
      ${webResults.map(r => `- ${r.title || 'No title'}: ${r.snippet || r.content || 'No content'}`).join('\n')}
      
      Provide a coherent synthesis that prioritizes internal knowledge while incorporating relevant external information.
      `;

      // Call LLM for synthesis (implementation depends on your LLM setup)
      return await this.callLLM(prompt);
    } catch (error) {
      console.error('Failed to synthesize results:', error);
      return 'Unable to synthesize results due to processing error.';
    }
  }

  async callLLM(prompt) {
    // Placeholder for LLM integration - implement based on your setup
    // This could use OpenAI, OpenRouter, or other LLM services
    return 'LLM synthesis not implemented yet';
  }

  // Optional ML Service Integration Methods
  async getMLExpertisePrediction(topic, options = {}) {
    if (!mlServiceClient.isAvailable()) {
      return null; // Graceful fallback - no ML predictions available
    }

    try {
      const result = await mlServiceClient.predictExpertise(topic, options);
      return result.success ? result.experts : null;
    } catch (error) {
      console.error('ML expertise prediction failed:', error);
      return null; // Graceful fallback
    }
  }

  async getMLLinkPrediction(source, target, relationshipType) {
    if (!mlServiceClient.isAvailable()) {
      return null; // Graceful fallback - no ML predictions available
    }

    try {
      const result = await mlServiceClient.predictLink(source, target, relationshipType);
      return result.success ? result : null;
    } catch (error) {
      console.error('ML link prediction failed:', error);
      return null; // Graceful fallback
    }
  }

  getMLServiceStatus() {
    return mlServiceClient.getStatus();
  }

  async searchWeb(query, context) {
    try {
      return await searchWeb(query, context);
    } catch (error) {
      console.error('Web search failed:', error);
      return [];
    }
  }
}

module.exports = BaseAgent;
