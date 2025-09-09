// src/agents/ResearchAgent.js
const { ChatOpenAI } = require('@langchain/openai');
const { DynamicTool } = require('@langchain/core/tools');
const { AgentExecutor, createOpenAIFunctionsAgent } = require('langchain/agents');
const { PromptTemplate } = require('@langchain/core/prompts');
const axios = require('axios');
const { logger } = require('../utils/logger');
const { databaseService } = require('../services/database');

class ResearchAgent {
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4',
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY,
      tags: ['research-agent', 'athenai']
    });
  }

  async executeResearch(query, sessionId, orchestrationId) {
    const startTime = Date.now();
    
    try {
      logger.info('Starting research', { query, sessionId, orchestrationId });

      // Check cache first
      const cacheKey = `research:${Buffer.from(query).toString('base64')}`;
      const cachedResult = await databaseService.cacheGet(cacheKey);
      
      if (cachedResult) {
        logger.info('Returning cached research result', { query });
        return cachedResult;
      }

      // Initialize research tools
      const tools = await this.initializeResearchTools();

      // Create research prompt
      const prompt = PromptTemplate.fromTemplate(`
You are a Research Agent specialized in gathering comprehensive, accurate information.

Query: {query}
Session ID: {sessionId}

Your task:
1. Use available tools to gather relevant information
2. Analyze and synthesize findings
3. Provide source citations and reliability assessments
4. Identify any gaps in the research

Available tools: {tools}

Provide a structured research report with:
- Executive Summary (2-3 sentences)
- Key Findings (3-5 bullet points)
- Detailed Analysis
- Sources and Citations
- Confidence Level (0-1)

Query: {query}
`);

      // Create agent
      const agent = await createOpenAIFunctionsAgent({
        llm: this.llm,
        tools,
        prompt
      });

      const agentExecutor = new AgentExecutor({
        agent,
        tools,
        verbose: false,
        maxIterations: 5,
        returnIntermediateSteps: true
      });

      // Execute research
      const result = await agentExecutor.invoke({
        query,
        sessionId,
        tools: tools.map(t => t.name).join(', ')
      });

      // Process and structure findings
      const researchReport = this.processResearchFindings(result, query);
      
      // Store in Neo4j
      await databaseService.createKnowledgeNode(
        sessionId,
        orchestrationId,
        'ResearchReport',
        {
          query,
          summary: researchReport.summary,
          confidence: researchReport.confidence,
          source_count: researchReport.sources.length,
          created_at: new Date().toISOString()
        }
      );

      // Cache the result
      await databaseService.cacheSet(cacheKey, researchReport, 3600); // 1 hour cache

      const executionTime = Date.now() - startTime;
      logger.info('Research completed', { 
        query, 
        sessionId, 
        orchestrationId, 
        executionTime,
        confidence: researchReport.confidence 
      });

      return researchReport;

    } catch (error) {
      logger.error('Research failed', { 
        query, 
        sessionId, 
        orchestrationId, 
        error: error.message 
      });
      
      return {
        query,
        error: error.message,
        summary: 'Research failed due to technical error',
        findings: [],
        sources: [],
        confidence: 0,
        status: 'failed'
      };
    }
  }

  async initializeResearchTools() {
    const tools = [];

    // Web search tool
    if (process.env.SERPAPI_API_KEY) {
      tools.push(new DynamicTool({
        name: 'web_search',
        description: 'Search the web for current information',
        func: async (query) => {
          try {
            const response = await axios.get('https://serpapi.com/search', {
              params: {
                q: query,
                api_key: process.env.SERPAPI_API_KEY,
                engine: 'google',
                num: 5
              }
            });
            
            const results = response.data.organic_results || [];
            return results.map(r => 
              `Title: ${r.title}\nURL: ${r.link}\nSnippet: ${r.snippet}`
            ).join('\n\n');
          } catch (error) {
            return `Web search error: ${error.message}`;
          }
        }
      }));
    }

    // Document processing tool
    if (process.env.UNSTRUCTURED_API_KEY) {
      tools.push(new DynamicTool({
        name: 'document_processor',
        description: 'Process and extract information from documents',
        func: async (url) => {
          try {
            const response = await axios.post(
              `${process.env.UNSTRUCTURED_API_URL}/general/v0/general`,
              { url },
              {
                headers: {
                  'Authorization': `Bearer ${process.env.UNSTRUCTURED_API_KEY}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            
            return response.data.map(element => element.text).join('\n');
          } catch (error) {
            return `Document processing error: ${error.message}`;
          }
        }
      }));
    }

    // Fallback web scraper
    tools.push(new DynamicTool({
      name: 'web_scraper',
      description: 'Scrape content from a specific URL',
      func: async (url) => {
        try {
          const response = await axios.get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; AthenAI/1.0)'
            },
            timeout: 10000
          });
          
          // Simple text extraction (can be enhanced with cheerio)
          const text = response.data
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/<style[^>]*>.*?<\/style>/gi, '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 3000);
          
          return text;
        } catch (error) {
          return `Scraping error: ${error.message}`;
        }
      }
    }));

    return tools;
  }

  processResearchFindings(result, query) {
    const output = result.output || '';
    
    return {
      query,
      summary: this.extractSummary(output),
      findings: this.extractFindings(output),
      analysis: output,
      sources: this.extractSources(result.intermediateSteps || []),
      confidence: this.calculateConfidence(output, result.intermediateSteps || []),
      execution_steps: result.intermediateSteps?.length || 0,
      status: 'completed',
      timestamp: new Date().toISOString()
    };
  }

  extractSummary(text) {
    const lines = text.split('\n').filter(line => line.trim().length > 20);
    return lines.slice(0, 2).join(' ').substring(0, 200) + '...';
  }

  extractFindings(text) {
    const findings = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.includes('•') || line.includes('-') || line.includes('*')) {
        findings.push(line.trim());
      }
    }
    
    return findings.slice(0, 5);
  }

  extractSources(steps) {
    const sources = [];
    
    for (const step of steps) {
      if (step.action && step.action.tool) {
        sources.push({
          tool: step.action.tool,
          query: step.action.toolInput,
          reliability: this.assessReliability(step.action.tool)
        });
      }
    }
    
    return sources;
  }

  assessReliability(toolName) {
    const reliabilityMap = {
      'web_search': 0.8,
      'document_processor': 0.9,
      'web_scraper': 0.6
    };
    
    return reliabilityMap[toolName] || 0.5;
  }

  calculateConfidence(output, steps) {
    let confidence = 0.5;
    
    if (output.length > 500) confidence += 0.1;
    if (steps.length > 2) confidence += 0.1;
    if (output.includes('data') || output.includes('study')) confidence += 0.1;
    if (steps.some(s => s.action?.tool === 'web_search')) confidence += 0.2;
    
    return Math.min(0.95, confidence);
  }
}

module.exports = { ResearchAgent };
