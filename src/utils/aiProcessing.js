/**
 * AI Processing Utilities for Knowledge Substrate
 * Replaces basic NLP with AI-powered content analysis
 */

const { ChatOpenAI } = require('@langchain/openai');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { logger } = require('./logger');

class AIProcessing {
  constructor() {
    // Initialize AI model with OpenRouter/OpenAI
    const useOpenRouter = process.env.USE_OPENROUTER === 'true';
    
    if (useOpenRouter) {
      this.llm = new ChatOpenAI({
        modelName: process.env.OPENROUTER_MODEL || 'openai/gpt-4',
        temperature: 0.1,
        openAIApiKey: process.env.OPENROUTER_API_KEY,
        configuration: {
          baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            'HTTP-Referer': 'https://athenai.local',
            'X-Title': 'AthenAI Knowledge Processing'
          }
        }
      });
    } else {
      this.llm = new ChatOpenAI({
        modelName: process.env.OPENAI_MODEL || 'gpt-4',
        temperature: 0.1,
        openAIApiKey: process.env.OPENAI_API_KEY
      });
    }
  }

  /**
   * AI-powered domain classification
   * Replaces simple keyword matching with intelligent classification
   */
  async classifyDomain(content) {
    try {
      const prompt = PromptTemplate.fromTemplate(`
Analyze the following content and classify it into the most appropriate domain category.

Content: {content}

Available domains:
- ai: Artificial Intelligence, Machine Learning, Neural Networks, LLMs
- software: Software Development, Programming, Code, APIs, Frameworks
- security: Cybersecurity, Privacy, Vulnerabilities, Threats, Compliance
- performance: Optimization, Benchmarking, Scalability, Monitoring
- data: Data Science, Analytics, Databases, Big Data, ETL
- general: General topics that don't fit other categories

Respond with only the domain name (lowercase).
`);

      const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
      const domain = await chain.invoke({ content });
      
      const validDomains = ['ai', 'software', 'security', 'performance', 'data', 'general'];
      const cleanDomain = domain.toLowerCase().trim();
      
      return validDomains.includes(cleanDomain) ? cleanDomain : 'general';
    } catch (error) {
      logger.error('AI domain classification failed:', error);
      return 'general'; // Fallback
    }
  }

  /**
   * AI-powered entity extraction
   * Replaces simple word filtering with Named Entity Recognition
   */
  async extractEntities(content) {
    try {
      const prompt = PromptTemplate.fromTemplate(`
Extract the most important entities from the following content. Focus on:
- Technical terms and concepts
- Product names and technologies
- Key topics and subjects
- Important people or organizations
- Specific tools or frameworks

Content: {content}

Return a JSON array of entities with their types:
[
  {"entity": "entity_name", "type": "technology|person|organization|concept|tool"},
  ...
]

Limit to the 8 most important entities.
`);

      const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
      const response = await chain.invoke({ content });
      
      try {
        const entities = JSON.parse(response);
        return Array.isArray(entities) ? entities.slice(0, 8) : [];
      } catch (parseError) {
        logger.warn('Failed to parse AI entity extraction response:', parseError);
        return [];
      }
    } catch (error) {
      logger.error('AI entity extraction failed:', error);
      return []; // Fallback to empty array
    }
  }

  /**
   * AI-powered pattern recognition
   * Identifies patterns, themes, and relationships in content
   */
  async recognizePatterns(content) {
    try {
      const prompt = PromptTemplate.fromTemplate(`
Analyze the following content and identify key patterns, themes, and insights:

Content: {content}

Identify:
1. Main themes and topics
2. Technical patterns or approaches
3. Problem-solution relationships
4. Recurring concepts or ideas
5. Potential connections to other domains

Return a JSON object:
{
  "themes": ["theme1", "theme2", ...],
  "patterns": ["pattern1", "pattern2", ...],
  "relationships": [{"from": "concept1", "to": "concept2", "type": "relates_to|solves|implements"}],
  "insights": ["insight1", "insight2", ...]
}
`);

      const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
      const response = await chain.invoke({ content });
      
      try {
        const patterns = JSON.parse(response);
        return {
          themes: patterns.themes || [],
          patterns: patterns.patterns || [],
          relationships: patterns.relationships || [],
          insights: patterns.insights || []
        };
      } catch (parseError) {
        logger.warn('Failed to parse AI pattern recognition response:', parseError);
        return { themes: [], patterns: [], relationships: [], insights: [] };
      }
    } catch (error) {
      logger.error('AI pattern recognition failed:', error);
      return { themes: [], patterns: [], relationships: [], insights: [] };
    }
  }

  /**
   * AI-powered content analysis
   * Comprehensive analysis replacing basic NLP processing
   */
  async analyzeContent(content) {
    try {
      const [domain, entities, patterns] = await Promise.all([
        this.classifyDomain(content),
        this.extractEntities(content),
        this.recognizePatterns(content)
      ]);

      return {
        domain,
        entities,
        patterns,
        processed_at: new Date().toISOString(),
        confidence: 0.9 // High confidence for AI processing
      };
    } catch (error) {
      logger.error('AI content analysis failed:', error);
      
      // Fallback to basic processing
      return {
        domain: 'general',
        entities: [],
        patterns: { themes: [], patterns: [], relationships: [], insights: [] },
        processed_at: new Date().toISOString(),
        confidence: 0.3 // Low confidence for fallback
      };
    }
  }

  /**
   * Generate query hash for caching
   */
  generateQueryHash(query) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(query.toLowerCase().trim()).digest('hex');
  }
}

module.exports = { AIProcessing };
