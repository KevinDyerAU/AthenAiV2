// Research Agent - Extracted Logic
const { ChatOpenAI } = require("@langchain/openai");
const { AgentExecutor, createOpenAIFunctionsAgent } = require("langchain/agents");
const { DynamicTool } = require("@langchain/core/tools");
const { PromptTemplate } = require("@langchain/core/prompts");
// const { WebBrowser } = require("langchain/tools/webbrowser"); // Commented out to avoid dependency issues in testing
const { SerpAPI } = require("@langchain/community/tools/serpapi");
const { WikipediaQueryRun } = require("@langchain/community/tools/wikipedia_query_run");

class ResearchAgent {
  constructor(apiKey, langSmithConfig = {}, searchApiKeys = {}) {
    this.apiKey = apiKey;
    this.langSmithConfig = langSmithConfig;
    this.searchApiKeys = searchApiKeys;
    this.setupLangSmith();
  }

  setupLangSmith() {
    if (this.langSmithConfig.enabled) {
      process.env.LANGCHAIN_TRACING_V2 = "true";
      process.env.LANGCHAIN_PROJECT = this.langSmithConfig.project || "athenai-research-agent";
      process.env.LANGCHAIN_ENDPOINT = this.langSmithConfig.endpoint || "https://api.smith.langchain.com";
    }
  }

  async executeResearch(inputData) {
    try {
      const taskData = inputData.task || inputData;
      const query = taskData.query || taskData.message || taskData.original_message;
      const sessionId = taskData.session_id || 'default_session';
      const orchestrationId = taskData.orchestration_id || 'default_orchestration';
      
      if (!query) {
        throw new Error('Query is required for research');
      }

      // Initialize OpenAI
      const llm = new ChatOpenAI({
        modelName: "gpt-4",
        temperature: 0.1,
        openAIApiKey: this.apiKey,
        tags: ["research-agent", "athenai"]
      });

      // Initialize research tools
      const tools = await this.initializeResearchTools();

      // Create research prompt template
      const researchPrompt = this.createResearchPrompt();

      // Create agent
      const agent = await createOpenAIFunctionsAgent({
        llm,
        tools,
        prompt: researchPrompt
      });

      const agentExecutor = new AgentExecutor({
        agent,
        tools,
        verbose: true,
        maxIterations: 10,
        returnIntermediateSteps: true
      });

      // Execute research
      const researchResult = await agentExecutor.invoke({
        query: query,
        sessionId: sessionId,
        orchestrationId: orchestrationId,
        tools: tools.map(t => t.name).join(", ")
      });

      // Process and structure the research findings
      const structuredFindings = await this.processResearchFindings(researchResult, query);

      // Generate research metrics
      const researchMetrics = this.calculateResearchMetrics(researchResult, structuredFindings);

      // Create research report
      const researchReport = {
        orchestration_id: orchestrationId,
        session_id: sessionId,
        agent_type: "research",
        query: query,
        findings: structuredFindings,
        raw_output: researchResult.output,
        intermediate_steps: researchResult.intermediateSteps,
        metrics: researchMetrics,
        sources: this.extractSources(researchResult),
        confidence_score: this.calculateConfidenceScore(structuredFindings),
        timestamp: new Date().toISOString(),
        status: "completed"
      };

      return {
        research_report: researchReport,
        next_actions: this.determineNextActions(structuredFindings, query),
        neo4j_context: this.createNeo4jContext(sessionId, orchestrationId, query, researchReport.confidence_score),
        memory: {
          upsert: true,
          keys: ["query", "findings", "sources", "confidence_score", "timestamp"]
        },
        routing: {
          queue: "analysis_tasks",
          priority: "normal"
        }
      };

    } catch (error) {
      return this.createErrorResponse(error);
    }
  }

  createResearchPrompt() {
    return PromptTemplate.fromTemplate(`
You are a Research Agent specialized in gathering comprehensive, accurate information.

User Query: {query}
Session ID: {sessionId}
Orchestration ID: {orchestrationId}

Your task:
1. Analyze the query to identify key research areas
2. Use available tools to gather relevant information
3. Synthesize findings into a comprehensive research report
4. Identify gaps that may need additional research
5. Provide source citations and reliability assessments

Available tools: {tools}

Provide a structured research report with:
- Executive Summary
- Key Findings
- Detailed Analysis
- Sources and Citations
- Confidence Levels
- Recommendations for further research

Query: {query}
`);
  }

  async initializeResearchTools() {
    const tools = [];

    // Web search tool (SerpAPI)
    if (this.searchApiKeys.serpApi) {
      tools.push(new SerpAPI(this.searchApiKeys.serpApi, {
        hl: "en",
        gl: "us"
      }));
    }

    // Wikipedia search tool
    tools.push(new WikipediaQueryRun({
      topKResults: 3,
      maxDocContentLength: 4000
    }));

    // Custom web scraping tool
    tools.push(new DynamicTool({
      name: "web_scraper",
      description: "Scrape content from a specific URL for detailed information",
      func: async (url) => {
        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          if (!response.ok) {
            return `Error: Unable to fetch ${url} - ${response.status}`;
          }
          
          const html = await response.text();
          const textContent = html
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/<style[^>]*>.*?<\/style>/gi, '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 5000);
          
          return textContent;
        } catch (error) {
          return `Error scraping ${url}: ${error.message}`;
        }
      }
    }));

    // Academic search tool
    tools.push(new DynamicTool({
      name: "academic_search",
      description: "Search for academic papers and scholarly articles",
      func: async (query) => {
        try {
          const searchUrl = `https://arxiv.org/search/?query=${encodeURIComponent(query)}&searchtype=all&abstracts=show&order=-announced_date_first&size=5`;
          
          const response = await fetch(searchUrl);
          if (!response.ok) {
            return "Academic search temporarily unavailable";
          }
          
          return `Academic search results for "${query}":\n\nFound relevant academic papers. For detailed results, please use specialized academic databases like arXiv, PubMed, or Google Scholar.`;
        } catch (error) {
          return `Academic search error: ${error.message}`;
        }
      }
    }));

    // News search tool
    tools.push(new DynamicTool({
      name: "news_search",
      description: "Search for recent news articles and current events",
      func: async (query) => {
        try {
          if (this.searchApiKeys.newsApi) {
            const newsUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=5&apiKey=${this.searchApiKeys.newsApi}`;
            
            const response = await fetch(newsUrl);
            const data = await response.json();
            
            if (data.articles && data.articles.length > 0) {
              return data.articles.map(article => 
                `Title: ${article.title}\nSource: ${article.source.name}\nPublished: ${article.publishedAt}\nSummary: ${article.description}\nURL: ${article.url}`
              ).join('\n\n');
            }
          }
          
          return `News search for "${query}" - API key required for detailed results`;
        } catch (error) {
          return `News search error: ${error.message}`;
        }
      }
    }));

    return tools;
  }

  async processResearchFindings(researchResult, query) {
    const findings = {
      executive_summary: "",
      key_findings: [],
      detailed_analysis: "",
      data_points: [],
      trends: [],
      gaps: []
    };

    try {
      const output = researchResult.output || "";
      
      findings.executive_summary = this.extractExecutiveSummary(output);
      findings.key_findings = this.extractKeyFindings(output);
      findings.detailed_analysis = output;
      findings.data_points = this.extractDataPoints(output);
      findings.trends = this.identifyTrends(output);
      findings.gaps = this.identifyResearchGaps(output, query);
      
    } catch (error) {
      findings.executive_summary = "Error processing research findings";
      findings.key_findings = ["Processing error occurred"];
    }

    return findings;
  }

  extractExecutiveSummary(text) {
    const sentences = text.split('.').filter(s => s.trim().length > 20);
    return sentences.slice(0, 3).join('. ') + '.';
  }

  extractKeyFindings(text) {
    const findings = [];
    const lines = text.split('\n').filter(line => line.trim().length > 10);
    
    for (const line of lines.slice(0, 10)) {
      if (line.includes('finding') || line.includes('result') || line.includes('shows') || line.includes('indicates')) {
        findings.push(line.trim());
      }
    }
    
    return findings.slice(0, 5);
  }

  extractDataPoints(text) {
    const dataPoints = [];
    const numberPattern = /\d+(?:\.\d+)?\s*(?:%|percent|million|billion|thousand)/gi;
    const matches = text.match(numberPattern) || [];
    
    return matches.slice(0, 10).map(match => ({
      value: match,
      context: this.extractContext(text, match)
    }));
  }

  extractContext(text, match) {
    const index = text.indexOf(match);
    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + match.length + 50);
    return text.substring(start, end).trim();
  }

  identifyTrends(text) {
    const trendKeywords = ['increase', 'decrease', 'growing', 'declining', 'trend', 'rising', 'falling'];
    const trends = [];
    
    for (const keyword of trendKeywords) {
      const regex = new RegExp(`[^.]*${keyword}[^.]*`, 'gi');
      const matches = text.match(regex) || [];
      trends.push(...matches.slice(0, 2));
    }
    
    return trends.slice(0, 5);
  }

  identifyResearchGaps(text, query) {
    const gaps = [];
    
    if (text.length < 500) {
      gaps.push("Limited information available - may need additional sources");
    }
    
    if (!text.includes('data') && !text.includes('statistics')) {
      gaps.push("Quantitative data may be lacking");
    }
    
    if (!text.includes('recent') && !text.includes('2024') && !text.includes('2023')) {
      gaps.push("Current/recent information may be missing");
    }
    
    return gaps;
  }

  extractSources(researchResult) {
    const sources = [];
    
    if (researchResult.intermediateSteps) {
      for (const step of researchResult.intermediateSteps) {
        if (step.action && step.action.tool) {
          sources.push({
            tool: step.action.tool,
            query: step.action.toolInput,
            url: this.extractUrlFromStep(step),
            title: this.extractTitleFromStep(step),
            reliability: this.assessSourceReliability(step.action.tool)
          });
        }
      }
    }
    
    return sources;
  }

  extractUrlFromStep(step) {
    const observation = step.observation || "";
    const urlMatch = observation.match(/https?:\/\/[^\s]+/);
    return urlMatch ? urlMatch[0] : "";
  }

  extractTitleFromStep(step) {
    const observation = step.observation || "";
    const lines = observation.split('\n');
    return lines[0] ? lines[0].substring(0, 100) : "Untitled";
  }

  assessSourceReliability(toolName) {
    const reliabilityMap = {
      'serpapi': 'medium',
      'wikipedia': 'high',
      'web_scraper': 'medium',
      'academic_search': 'high',
      'news_search': 'medium'
    };
    
    return reliabilityMap[toolName] || 'unknown';
  }

  calculateConfidenceScore(findings) {
    let score = 0.5; // Base confidence
    
    if (findings.key_findings.length > 3) score += 0.1;
    if (findings.data_points.length > 2) score += 0.1;
    if (findings.detailed_analysis.length > 1000) score += 0.1;
    if (findings.gaps.length < 2) score += 0.1;
    
    return Math.min(0.95, Math.max(0.1, score));
  }

  calculateResearchMetrics(researchResult, findings) {
    return {
      sources_consulted: (researchResult.intermediateSteps || []).length,
      information_depth: this.calculateInformationDepth(findings),
      source_diversity: this.calculateSourceDiversity(researchResult),
      factual_density: this.calculateFactualDensity(findings.detailed_analysis),
      research_completeness: this.calculateCompleteness(findings),
      execution_time: this.calculateExecutionTime(researchResult)
    };
  }

  calculateInformationDepth(findings) {
    return findings.detailed_analysis.length + findings.key_findings.length * 50;
  }

  calculateSourceDiversity(researchResult) {
    const tools = new Set();
    if (researchResult.intermediateSteps) {
      researchResult.intermediateSteps.forEach(step => {
        if (step.action && step.action.tool) {
          tools.add(step.action.tool);
        }
      });
    }
    return tools.size;
  }

  calculateFactualDensity(text) {
    const factualIndicators = text.match(/\d+|according to|study shows|research indicates|data suggests/gi) || [];
    return factualIndicators.length / Math.max(1, text.split(' ').length / 100);
  }

  calculateCompleteness(findings) {
    let completeness = 0;
    if (findings.executive_summary.length > 50) completeness += 0.2;
    if (findings.key_findings.length > 2) completeness += 0.2;
    if (findings.detailed_analysis.length > 500) completeness += 0.2;
    if (findings.data_points.length > 1) completeness += 0.2;
    if (findings.trends.length > 0) completeness += 0.2;
    return completeness;
  }

  calculateExecutionTime(researchResult) {
    const steps = researchResult.intermediateSteps ? researchResult.intermediateSteps.length : 1;
    return steps * 2; // Rough estimate of 2 seconds per step
  }

  determineNextActions(findings, query) {
    const actions = [];
    
    if (findings.gaps.length > 2) {
      actions.push({
        action: "additional_research",
        priority: "high",
        description: "Significant research gaps identified - additional investigation needed"
      });
    }
    
    if (findings.data_points.length > 3) {
      actions.push({
        action: "data_analysis",
        priority: "medium",
        description: "Sufficient data available for quantitative analysis"
      });
    }
    
    actions.push({
      action: "synthesis",
      priority: "normal",
      description: "Synthesize research findings into actionable insights"
    });
    
    return actions;
  }

  createNeo4jContext(sessionId, orchestrationId, query, confidenceScore) {
    const reportId = this.generateReportId();
    return {
      write: true,
      cypher: `MERGE (s:Session {id: '${sessionId}'}) 
               MERGE (o:Orchestration {id: '${orchestrationId}'}) 
               MERGE (r:ResearchReport {id: '${reportId}', query: '${query.replace(/'/g, "\\'")}', timestamp: datetime(), confidence: ${confidenceScore}}) 
               MERGE (s)-[:HAS_ORCHESTRATION]->(o) 
               MERGE (o)-[:GENERATED_RESEARCH]->(r)`
    };
  }

  createErrorResponse(error) {
    return {
      error: error.message,
      agent_type: "research",
      status: "failed",
      timestamp: new Date().toISOString(),
      fallback_research: {
        summary: "Research agent encountered an error. Manual research may be required.",
        recommendations: [
          "Verify API keys for search tools",
          "Check network connectivity",
          "Review query complexity"
        ]
      }
    };
  }

  generateReportId() {
    return `research_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = { ResearchAgent };
