// Analysis Agent - Extracted Logic
const { ChatOpenAI } = require('@langchain/openai');
const { AgentExecutor, createOpenAIToolsAgent } = require('langchain/agents');
const { DynamicTool } = require('@langchain/core/tools');
const { PromptTemplate } = require('@langchain/core/prompts');
const { ReasoningFramework } = require('../utils/reasoningFramework');
const { WebBrowsingUtils } = require('../utils/webBrowsingUtils');

class AnalysisAgent {
  constructor(apiKey, langSmithConfig = {}) {
    this.apiKey = apiKey;
    this.langSmithConfig = langSmithConfig;
    this.setupLangSmith();
    
    // Initialize reasoning framework
    this.reasoning = new ReasoningFramework('AnalysisAgent');
  }

  setupLangSmith() {
    if (this.langSmithConfig.enabled) {
      process.env.LANGCHAIN_TRACING_V2 = 'true';
      process.env.LANGCHAIN_PROJECT = this.langSmithConfig.project || 'athenai-analysis-agent';
      process.env.LANGCHAIN_ENDPOINT = this.langSmithConfig.endpoint || 'https://api.smith.langchain.com';
    }
  }

  async executeAnalysis(inputData) {
    try {
      const taskData = inputData.task || inputData;
      let dataToAnalyze = taskData.data || taskData.research_findings || taskData.content || taskData.message;
      const analysisType = taskData.analysis_type || 'comprehensive';
      const sessionId = taskData.session_id || 'default_session';
      const orchestrationId = taskData.orchestration_id || 'default_orchestration';
      
      // Handle GitHub URLs and other web content
      if (!dataToAnalyze) {
        throw new Error('Data is required for analysis');
      }
      
      // If the data is a GitHub URL, fetch the repository information first
      if (typeof dataToAnalyze === 'string' && dataToAnalyze.includes('github.com')) {
        dataToAnalyze = await this.fetchGitHubRepositoryData(dataToAnalyze);
      }

      // PHASE 1: Strategic Planning and Reasoning
      const strategyPlan = await this.reasoning.planStrategy(dataToAnalyze, {
        time_constraint: 'normal',
        quality_priority: 'high',
        creativity_needed: analysisType === 'creative'
      });

      // Primary OpenAI configuration with OpenRouter fallback
      const useOpenRouter = process.env.USE_OPENROUTER === 'true';
      
      if (useOpenRouter) {
        this.llm = new ChatOpenAI({
          modelName: process.env.OPENROUTER_MODEL || 'openai/gpt-4',
          temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE) || 0.1,
          openAIApiKey: this.apiKey || process.env.OPENROUTER_API_KEY,
          configuration: {
            baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
            defaultHeaders: {
              'HTTP-Referer': 'https://athenai.local',
              'X-Title': 'AthenAI Analysis Agent'
            }
          },
          tags: ['analysis-agent', 'athenai', 'openrouter']
        });
      } else {
        this.llm = new ChatOpenAI({
          modelName: process.env.OPENAI_MODEL || 'gpt-4',
          temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.1,
          openAIApiKey: this.apiKey || process.env.OPENAI_API_KEY,
          timeout: parseInt(process.env.OPENAI_TIMEOUT) || 60000,
          maxRetries: 2,
          tags: ['analysis-agent', 'athenai', 'openai']
        });
      }

      // Initialize analysis tools
      const tools = this.initializeAnalysisTools();

      // Create analysis prompt
      const analysisPrompt = this.createAnalysisPrompt();

      // Create agent
      const agent = await createOpenAIToolsAgent({
        llm,
        tools,
        prompt: analysisPrompt
      });

      const agentExecutor = new AgentExecutor({
        agent,
        tools,
        verbose: true,
        maxIterations: 8,
        returnIntermediateSteps: true
      });

      // PHASE 2: Execute analysis with strategy
      const analysisResult = await agentExecutor.invoke({
        data: JSON.stringify(dataToAnalyze),
        analysisType: analysisType,
        strategy: strategyPlan.selected_strategy.name,
        sessionId: sessionId,
        orchestrationId: orchestrationId,
        tools: tools.map(t => t.name).join(', ')
      });

      // Process analysis results
      const structuredAnalysis = await this.processAnalysisResults(analysisResult, dataToAnalyze, analysisType);

      // PHASE 3: Self-Evaluation
      const evaluation = await this.reasoning.evaluateOutput(structuredAnalysis, dataToAnalyze, strategyPlan);

      // Calculate analysis metrics
      const analysisMetrics = this.calculateAnalysisMetrics(structuredAnalysis, analysisResult);

      // Create analysis report
      const analysisReport = {
        orchestration_id: orchestrationId,
        session_id: sessionId,
        agent_type: 'analysis',
        analysis_type: analysisType,
        input_data_summary: this.summarizeInputData(dataToAnalyze),
        analysis_results: structuredAnalysis,
        raw_output: analysisResult.output,
        intermediate_steps: analysisResult.intermediateSteps,
        metrics: analysisMetrics,
        insights: this.extractInsights(structuredAnalysis),
        recommendations: this.generateRecommendations(structuredAnalysis),
        confidence_score: evaluation.confidence_score,
        timestamp: new Date().toISOString(),
        status: 'completed'
      };

      return {
        analysis_report: analysisReport,
        next_actions: this.determineNextActions(structuredAnalysis, analysisType),
        neo4j_context: this.createNeo4jContext(sessionId, orchestrationId, analysisType, evaluation.confidence_score),
        memory: {
          upsert: true,
          keys: ['analysis_type', 'insights', 'recommendations', 'confidence_score', 'timestamp']
        },
        routing: {
          queue: 'creative_tasks',
          priority: 'normal'
        },
        strategy_plan: strategyPlan,
        self_evaluation: evaluation,
        reasoning_logs: this.reasoning.getReasoningLogs()
      };

    } catch (error) {
      return this.createErrorResponse(error);
    }
  }

  createAnalysisPrompt() {
    return PromptTemplate.fromTemplate(`
You are an Analysis Agent with advanced reasoning capabilities. Before conducting your analysis, think through your approach systematically.

REASONING PHASE:
1. Analyze the data structure and type to determine the most appropriate analytical approach
2. Consider what insights would be most valuable for this specific analysis type
3. Plan your analytical methodology based on the selected strategy
4. Identify potential challenges and how to address them

Data to Analyze: {data}
Analysis Type: {analysisType}
Strategy Selected: {strategy}
Session ID: {sessionId}
Orchestration ID: {orchestrationId}

Your systematic approach:
1. Examine the provided data thoroughly with strategic focus
2. Identify patterns, trends, and anomalies using the selected methodology
3. Perform statistical analysis where applicable
4. Generate actionable insights with confidence assessments
5. Validate findings against success criteria
6. Suggest areas for deeper analysis

Available tools: {tools}

Provide a structured analysis with:
- Data Overview and Quality Assessment
- Statistical Summary with Confidence Intervals
- Pattern Analysis with Supporting Evidence
- Trend Identification and Significance Testing
- Correlation Analysis with Causation Considerations
- Predictive Insights with Uncertainty Quantification
- Recommendations with Implementation Guidance
- Self-Assessment of Analysis Quality

Show your reasoning process where it adds value to understanding.

Data: {data}

{agent_scratchpad}
`);
  }

  initializeAnalysisTools() {
    const tools = [];

    // Web search tool for current data and trends using Firecrawl
    if (process.env.FIRECRAWL_API_KEY) {
      tools.push(new DynamicTool({
        name: 'web_search_analysis',
        description: 'Search and crawl web content for current data, trends, and analytical insights using Firecrawl',
        func: async (query) => {
          try {
            const axios = require('axios');
            const response = await axios.post('https://api.firecrawl.dev/v0/search', {
              query: query + ' data trends analysis statistics',
              pageOptions: {
                onlyMainContent: true,
                includeHtml: false,
                waitFor: 0
              },
              searchOptions: {
                limit: 5
              }
            }, {
              headers: {
                'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
                'Content-Type': 'application/json'
              },
              timeout: 15000
            });
            
            const results = response.data.data || [];
            if (results.length === 0) {
              return `No analytical data found for: ${query}`;
            }
            
            const searchResults = results.map((result, index) => {
              const content = result.content ? result.content.substring(0, 300) + '...' : 'No content available';
              return `${index + 1}. ${result.metadata?.title || 'No title'}\n   ${content}\n   Source: ${result.metadata?.sourceURL || result.url}`;
            }).join('\n\n');
            
            return `Current data and trends for "${query}":\n\n${searchResults}`;
          } catch (error) {
            return `Web search error: ${error.message}`;
          }
        }
      }));
    }

    // Add standardized web browsing tools
    const webTools = WebBrowsingUtils.createWebBrowsingTools();
    tools.push(...webTools);

    // Think tool for step-by-step reasoning
    tools.push(new DynamicTool({
      name: 'think',
      description: 'Think through complex analytical problems step by step, evaluate different analytical approaches, and reason about the best methodology',
      func: async (input) => {
        try {
          const thinkPrompt = PromptTemplate.fromTemplate(`
You are analyzing a complex problem. Break down your analytical reasoning step by step.

Problem/Question: {problem}

Think through this systematically:
1. What is the core analytical question or challenge?
2. What data or information do I have available?
3. What analytical methods could I apply?
4. What are the strengths and limitations of each approach?
5. What assumptions am I making and are they valid?
6. What is my recommended analytical approach and why?
7. What potential biases or errors should I watch for?
8. How will I validate my findings?

Provide your step-by-step analytical reasoning:
`);

          const chain = thinkPrompt.pipe(this.llm).pipe(new StringOutputParser());
          const thinking = await chain.invoke({ problem: input });
          
          return `ANALYTICAL THINKING PROCESS:\n${thinking}`;
        } catch (error) {
          return `Thinking error: ${error.message}`;
        }
      }
    }));

    // Statistical analysis tool
    tools.push(new DynamicTool({
      name: 'statistical_analyzer',
      description: 'Perform statistical analysis on numerical data',
      func: async (data) => {
        try {
          const parsedData = this.parseNumericalData(data);
          if (parsedData.length === 0) {
            return 'No numerical data found for statistical analysis';
          }

          const stats = this.calculateStatistics(parsedData);
          return `Statistical Analysis:
Mean: ${stats.mean.toFixed(2)}
Median: ${stats.median.toFixed(2)}
Standard Deviation: ${stats.stdDev.toFixed(2)}
Min: ${stats.min}
Max: ${stats.max}
Count: ${stats.count}
Variance: ${stats.variance.toFixed(2)}`;
        } catch (error) {
          return `Statistical analysis error: ${error.message}`;
        }
      }
    }));

    // Trend analyzer tool
    tools.push(new DynamicTool({
      name: 'trend_analyzer',
      description: 'Identify trends and patterns in time-series or sequential data',
      func: async (data) => {
        try {
          const trends = this.analyzeTrends(data);
          return `Trend Analysis:
Overall Direction: ${trends.direction}
Strength: ${trends.strength}
Volatility: ${trends.volatility}
Key Patterns: ${trends.patterns.join(', ')}
Anomalies Detected: ${trends.anomalies.length}`;
        } catch (error) {
          return `Trend analysis error: ${error.message}`;
        }
      }
    }));

    // Correlation finder tool
    tools.push(new DynamicTool({
      name: 'correlation_finder',
      description: 'Find correlations between different data variables',
      func: async (data) => {
        try {
          const correlations = this.findCorrelations(data);
          return `Correlation Analysis:
Strong Correlations Found: ${correlations.strong.length}
Moderate Correlations: ${correlations.moderate.length}
Weak Correlations: ${correlations.weak.length}
Top Correlation: ${correlations.top.description} (${correlations.top.strength})`;
        } catch (error) {
          return `Correlation analysis error: ${error.message}`;
        }
      }
    }));

    // Pattern detector tool
    tools.push(new DynamicTool({
      name: 'pattern_detector',
      description: 'Detect recurring patterns and anomalies in data',
      func: async (data) => {
        try {
          const patterns = this.detectPatterns(data);
          return `Pattern Detection:
Recurring Patterns: ${patterns.recurring.length}
Seasonal Patterns: ${patterns.seasonal.length}
Anomalies: ${patterns.anomalies.length}
Confidence Level: ${patterns.confidence}%`;
        } catch (error) {
          return `Pattern detection error: ${error.message}`;
        }
      }
    }));

    // Predictive analyzer tool
    tools.push(new DynamicTool({
      name: 'predictive_analyzer',
      description: 'Generate predictive insights based on historical data patterns',
      func: async (data) => {
        try {
          const predictions = this.generatePredictions(data);
          return `Predictive Analysis:
Short-term Forecast: ${predictions.shortTerm}
Long-term Trend: ${predictions.longTerm}
Confidence Interval: ${predictions.confidence}%
Risk Factors: ${predictions.risks.join(', ')}`;
        } catch (error) {
          return `Predictive analysis error: ${error.message}`;
        }
      }
    }));

    return tools;
  }

  async fetchGitHubRepositoryData(githubUrl) {
    try {
      // Extract repository information from GitHub URL
      const urlMatch = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!urlMatch) {
        return `Unable to parse GitHub URL: ${githubUrl}`;
      }

      const [, owner, repo] = urlMatch;
      const cleanRepo = repo.replace(/\.git$/, '');

      // Use web search to gather repository information
      if (process.env.FIRECRAWL_API_KEY) {
        const axios = require('axios');
        
        try {
          const response = await axios.post('https://api.firecrawl.dev/v0/search', {
            query: `${owner} ${cleanRepo} github repository code analysis`,
            pageOptions: {
              onlyMainContent: true,
              includeHtml: false,
              waitFor: 0
            },
            searchOptions: {
              limit: 3
            }
          }, {
            headers: {
              'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 15000
          });

          const results = response.data.data || [];
          if (results.length > 0) {
            const repositoryInfo = results.map((result, index) => {
              const content = result.content ? result.content.substring(0, 500) + '...' : 'No content available';
              return `${index + 1}. ${result.metadata?.title || 'Repository Info'}\n   ${content}\n   Source: ${result.metadata?.sourceURL || result.url}`;
            }).join('\n\n');

            return `GitHub Repository Analysis Data for ${owner}/${cleanRepo}:\n\n${repositoryInfo}`;
          }
        } catch (searchError) {
          console.warn('Firecrawl search failed, using fallback approach:', searchError.message);
        }
      }

      // Fallback: return structured information about the repository
      return `GitHub Repository: ${owner}/${cleanRepo}
URL: ${githubUrl}
Repository Structure Analysis Required:
- Owner: ${owner}
- Repository Name: ${cleanRepo}
- Analysis Type: Code repository review
- Recommended Actions: 
  1. Review repository structure and main files
  2. Analyze code quality and architecture
  3. Identify key technologies and frameworks used
  4. Assess project complexity and scope
  5. Provide high-level summary of functionality`;

    } catch (error) {
      return `Error fetching GitHub repository data: ${error.message}. URL: ${githubUrl}`;
    }
  }

  parseNumericalData(data) {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    const numberMatches = text.match(/\d+(?:\.\d+)?/g) || [];
    
    return numberMatches.map(n => parseFloat(n)).filter(n => !isNaN(n));
  }

  calculateStatistics(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const count = numbers.length;
    const sum = numbers.reduce((a, b) => a + b, 0);
    const mean = sum / count;
    
    const variance = numbers.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);
    
    const median = count % 2 === 0 
      ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
      : sorted[Math.floor(count / 2)];

    return {
      mean,
      median,
      stdDev,
      variance,
      min: sorted[0],
      max: sorted[count - 1],
      count
    };
  }

  analyzeTrends(data) {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    
    // Simple trend analysis based on keywords and patterns
    const increasingWords = (text.match(/increas|grow|rise|up|higher|more/gi) || []).length;
    const decreasingWords = (text.match(/decreas|fall|drop|down|lower|less/gi) || []).length;
    
    let direction = 'stable';
    if (increasingWords > decreasingWords + 2) direction = 'increasing';
    else if (decreasingWords > increasingWords + 2) direction = 'decreasing';
    
    const strength = Math.abs(increasingWords - decreasingWords) > 5 ? 'strong' : 'moderate';
    const volatility = text.includes('volatile') || text.includes('fluctuat') ? 'high' : 'low';
    
    const patterns = [];
    if (text.includes('seasonal')) patterns.push('seasonal');
    if (text.includes('cyclic')) patterns.push('cyclical');
    if (text.includes('linear')) patterns.push('linear');
    
    return {
      direction,
      strength,
      volatility,
      patterns,
      anomalies: this.detectAnomalies(text)
    };
  }

  detectAnomalies(text) {
    const anomalyKeywords = ['unusual', 'unexpected', 'anomaly', 'outlier', 'exception', 'irregular'];
    const anomalies = [];
    
    for (const keyword of anomalyKeywords) {
      if (text.toLowerCase().includes(keyword)) {
        anomalies.push(keyword);
      }
    }
    
    return anomalies;
  }

  findCorrelations(data) {
    // Simplified correlation analysis
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    
    const correlationKeywords = [
      { terms: ['price', 'cost'], strength: 0.8 },
      { terms: ['time', 'duration'], strength: 0.7 },
      { terms: ['size', 'volume'], strength: 0.6 },
      { terms: ['quality', 'satisfaction'], strength: 0.9 }
    ];
    
    const strong = [];
    const moderate = [];
    const weak = [];
    
    for (const corr of correlationKeywords) {
      const hasTerms = corr.terms.every(term => text.toLowerCase().includes(term));
      if (hasTerms) {
        if (corr.strength > 0.7) strong.push(corr);
        else if (corr.strength > 0.5) moderate.push(corr);
        else weak.push(corr);
      }
    }
    
    return {
      strong,
      moderate,
      weak,
      top: strong[0] || moderate[0] || weak[0] || { description: 'No significant correlations', strength: 0 }
    };
  }

  detectPatterns(data) {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    
    const recurring = [];
    const seasonal = [];
    const anomalies = [];
    
    // Simple pattern detection
    if (text.includes('repeat') || text.includes('regular')) {
      recurring.push('regular_intervals');
    }
    
    if (text.includes('season') || text.includes('month') || text.includes('quarter')) {
      seasonal.push('temporal_patterns');
    }
    
    if (text.includes('spike') || text.includes('drop') || text.includes('unusual')) {
      anomalies.push('data_anomalies');
    }
    
    return {
      recurring,
      seasonal,
      anomalies,
      confidence: Math.min(95, Math.max(60, (recurring.length + seasonal.length) * 20))
    };
  }

  generatePredictions(data) {
    const text = typeof data === 'string' ? data : JSON.stringify(data);
    
    // Simple prediction logic based on trends
    let shortTerm = 'stable';
    let longTerm = 'uncertain';
    let confidence = 60;
    
    if (text.includes('grow') || text.includes('increas')) {
      shortTerm = 'continued growth expected';
      longTerm = 'positive trajectory';
      confidence = 75;
    } else if (text.includes('declin') || text.includes('decreas')) {
      shortTerm = 'continued decline expected';
      longTerm = 'negative trajectory';
      confidence = 70;
    }
    
    const risks = [];
    if (text.includes('volatile')) risks.push('high_volatility');
    if (text.includes('uncertain')) risks.push('market_uncertainty');
    if (text.includes('external')) risks.push('external_factors');
    
    return {
      shortTerm,
      longTerm,
      confidence,
      risks
    };
  }

  async processAnalysisResults(analysisResult, originalData, _analysisType) {
    const results = {
      data_overview: this.createDataOverview(originalData),
      statistical_summary: {},
      pattern_analysis: {},
      trend_identification: {},
      correlation_analysis: {},
      predictive_insights: {},
      quality_assessment: {}
    };

    try {
      const output = analysisResult.output || '';
      
      // Extract different analysis components from the output
      results.statistical_summary = this.extractStatisticalSummary(output);
      results.pattern_analysis = this.extractPatternAnalysis(output);
      results.trend_identification = this.extractTrendAnalysis(output);
      results.correlation_analysis = this.extractCorrelationAnalysis(output);
      results.predictive_insights = this.extractPredictiveInsights(output);
      results.quality_assessment = this.assessDataQuality(originalData, output);
      
    } catch (error) {
      results.error = `Error processing analysis results: ${error.message}`;
    }

    return results;
  }

  createDataOverview(data) {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    
    return {
      data_type: this.identifyDataType(data),
      size: dataStr.length,
      structure: this.analyzeDataStructure(data),
      completeness: this.assessDataCompleteness(dataStr),
      key_attributes: this.extractKeyAttributes(dataStr)
    };
  }

  identifyDataType(data) {
    if (typeof data === 'string') return 'text';
    if (Array.isArray(data)) return 'array';
    if (typeof data === 'object') return 'object';
    if (typeof data === 'number') return 'numeric';
    return 'unknown';
  }

  analyzeDataStructure(data) {
    if (typeof data === 'object' && data !== null) {
      return {
        type: 'structured',
        keys: Object.keys(data).length,
        nested: this.hasNestedStructure(data)
      };
    }
    return { type: 'unstructured' };
  }

  hasNestedStructure(obj) {
    return Object.values(obj).some(value => typeof value === 'object' && value !== null);
  }

  assessDataCompleteness(dataStr) {
    const nullCount = (dataStr.match(/null|undefined|""/g) || []).length;
    const totalFields = (dataStr.match(/:/g) || []).length;
    
    if (totalFields === 0) return 1.0;
    return Math.max(0, 1 - (nullCount / totalFields));
  }

  extractKeyAttributes(dataStr) {
    const words = dataStr.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    const frequency = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });
    
    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word, count]) => ({ attribute: word, frequency: count }));
  }

  extractStatisticalSummary(output) {
    const stats = {};
    
    const meanMatch = output.match(/mean[:\s]+(\d+(?:\.\d+)?)/i);
    if (meanMatch) stats.mean = parseFloat(meanMatch[1]);
    
    const medianMatch = output.match(/median[:\s]+(\d+(?:\.\d+)?)/i);
    if (medianMatch) stats.median = parseFloat(medianMatch[1]);
    
    const stdDevMatch = output.match(/standard deviation[:\s]+(\d+(?:\.\d+)?)/i);
    if (stdDevMatch) stats.standardDeviation = parseFloat(stdDevMatch[1]);
    
    return stats;
  }

  extractPatternAnalysis(output) {
    const patterns = {
      recurring: [],
      seasonal: [],
      anomalies: []
    };
    
    if (output.includes('recurring')) {
      patterns.recurring.push('recurring_pattern_detected');
    }
    
    if (output.includes('seasonal')) {
      patterns.seasonal.push('seasonal_pattern_detected');
    }
    
    if (output.includes('anomal') || output.includes('outlier')) {
      patterns.anomalies.push('anomaly_detected');
    }
    
    return patterns;
  }

  extractTrendAnalysis(output) {
    const trends = {
      direction: 'stable',
      strength: 'moderate',
      confidence: 0.6
    };
    
    if (output.includes('increas') || output.includes('grow')) {
      trends.direction = 'increasing';
      trends.confidence = 0.8;
    } else if (output.includes('decreas') || output.includes('declin')) {
      trends.direction = 'decreasing';
      trends.confidence = 0.8;
    }
    
    if (output.includes('strong')) {
      trends.strength = 'strong';
    } else if (output.includes('weak')) {
      trends.strength = 'weak';
    }
    
    return trends;
  }

  extractCorrelationAnalysis(output) {
    return {
      strong_correlations: (output.match(/strong correlation/gi) || []).length,
      moderate_correlations: (output.match(/moderate correlation/gi) || []).length,
      weak_correlations: (output.match(/weak correlation/gi) || []).length
    };
  }

  extractPredictiveInsights(output) {
    return {
      short_term_forecast: this.extractForecast(output, 'short'),
      long_term_forecast: this.extractForecast(output, 'long'),
      risk_factors: this.extractRiskFactors(output),
      opportunities: this.extractOpportunities(output)
    };
  }

  extractForecast(output, term) {
    const regex = new RegExp(`${term}[\\s-]*term[^.]*`, 'i');
    const match = output.match(regex);
    return match ? match[0] : `No ${term}-term forecast available`;
  }

  extractRiskFactors(output) {
    const riskKeywords = ['risk', 'threat', 'challenge', 'concern', 'issue'];
    const risks = [];
    
    for (const keyword of riskKeywords) {
      const regex = new RegExp(`[^.]*${keyword}[^.]*`, 'gi');
      const matches = output.match(regex) || [];
      risks.push(...matches.slice(0, 2));
    }
    
    return risks.slice(0, 5);
  }

  extractOpportunities(output) {
    const opportunityKeywords = ['opportunity', 'potential', 'advantage', 'benefit'];
    const opportunities = [];
    
    for (const keyword of opportunityKeywords) {
      const regex = new RegExp(`[^.]*${keyword}[^.]*`, 'gi');
      const matches = output.match(regex) || [];
      opportunities.push(...matches.slice(0, 2));
    }
    
    return opportunities.slice(0, 5);
  }

  assessDataQuality(originalData, analysisOutput) {
    const dataStr = typeof originalData === 'string' ? originalData : JSON.stringify(originalData);
    
    return {
      completeness: this.assessDataCompleteness(dataStr),
      accuracy: this.assessAccuracy(analysisOutput),
      consistency: this.assessConsistency(dataStr),
      relevance: this.assessRelevance(analysisOutput),
      timeliness: this.assessTimeliness(dataStr)
    };
  }

  assessAccuracy(output) {
    const confidenceIndicators = (output.match(/confident|accurate|precise|reliable/gi) || []).length;
    const uncertaintyIndicators = (output.match(/uncertain|unclear|approximate|estimated/gi) || []).length;
    
    return Math.max(0.3, Math.min(0.95, 0.7 + (confidenceIndicators - uncertaintyIndicators) * 0.1));
  }

  assessConsistency(dataStr) {
    const inconsistencyIndicators = (dataStr.match(/inconsistent|conflicting|contradictory/gi) || []).length;
    return Math.max(0.3, 1 - (inconsistencyIndicators * 0.2));
  }

  assessRelevance(output) {
    const relevanceIndicators = (output.match(/relevant|applicable|pertinent|related/gi) || []).length;
    return Math.max(0.5, Math.min(0.95, 0.6 + relevanceIndicators * 0.1));
  }

  assessTimeliness(dataStr) {
    const currentYear = new Date().getFullYear();
    const recentYears = [currentYear, currentYear - 1, currentYear - 2];
    
    const hasRecentData = recentYears.some(year => dataStr.includes(year.toString()));
    return hasRecentData ? 0.9 : 0.6;
  }

  extractInsights(analysisResults) {
    const insights = [];
    
    if (analysisResults.statistical_summary.mean) {
      insights.push(`Average value identified: ${analysisResults.statistical_summary.mean}`);
    }
    
    if (analysisResults.trend_identification.direction !== 'stable') {
      insights.push(`Trend direction: ${analysisResults.trend_identification.direction}`);
    }
    
    if (analysisResults.pattern_analysis.anomalies.length > 0) {
      insights.push(`Anomalies detected: ${analysisResults.pattern_analysis.anomalies.length} instances`);
    }
    
    if (analysisResults.quality_assessment.completeness < 0.8) {
      insights.push('Data completeness could be improved for more accurate analysis');
    }
    
    return insights;
  }

  generateRecommendations(analysisResults) {
    const recommendations = [];
    
    if (analysisResults.quality_assessment.completeness < 0.7) {
      recommendations.push({
        type: 'data_quality',
        priority: 'high',
        description: 'Improve data completeness before conducting further analysis'
      });
    }
    
    if (analysisResults.trend_identification.direction === 'decreasing') {
      recommendations.push({
        type: 'trend_response',
        priority: 'medium',
        description: 'Investigate causes of declining trend and develop mitigation strategies'
      });
    }
    
    if (analysisResults.pattern_analysis.anomalies.length > 2) {
      recommendations.push({
        type: 'anomaly_investigation',
        priority: 'medium',
        description: 'Investigate detected anomalies for potential insights or data quality issues'
      });
    }
    
    recommendations.push({
      type: 'continuous_monitoring',
      priority: 'low',
      description: 'Establish regular monitoring to track changes in key metrics'
    });
    
    return recommendations;
  }

  calculateConfidenceScore(analysisResults) {
    let score = 0.5; // Base confidence
    
    if (analysisResults.quality_assessment.completeness > 0.8) score += 0.1;
    if (analysisResults.quality_assessment.accuracy > 0.7) score += 0.1;
    if (analysisResults.statistical_summary.mean !== undefined) score += 0.1;
    if (analysisResults.trend_identification.confidence > 0.7) score += 0.1;
    
    return Math.min(0.95, Math.max(0.2, score));
  }

  calculateAnalysisMetrics(analysisResults, rawResult) {
    return {
      data_points_analyzed: this.countDataPoints(analysisResults),
      patterns_identified: this.countPatterns(analysisResults),
      insights_generated: analysisResults.insights ? analysisResults.insights.length : 0,
      confidence_level: this.calculateConfidenceScore(analysisResults),
      analysis_depth: this.calculateAnalysisDepth(analysisResults),
      execution_time: this.estimateExecutionTime(rawResult)
    };
  }

  countDataPoints(analysisResults) {
    return analysisResults.data_overview ? analysisResults.data_overview.size : 0;
  }

  countPatterns(analysisResults) {
    const patterns = analysisResults.pattern_analysis || {};
    return (patterns.recurring || []).length + 
           (patterns.seasonal || []).length + 
           (patterns.anomalies || []).length;
  }

  calculateAnalysisDepth(analysisResults) {
    let depth = 0;
    if (analysisResults.statistical_summary && Object.keys(analysisResults.statistical_summary).length > 0) depth += 1;
    if (analysisResults.pattern_analysis && Object.keys(analysisResults.pattern_analysis).length > 0) depth += 1;
    if (analysisResults.trend_identification && Object.keys(analysisResults.trend_identification).length > 0) depth += 1;
    if (analysisResults.correlation_analysis && Object.keys(analysisResults.correlation_analysis).length > 0) depth += 1;
    if (analysisResults.predictive_insights && Object.keys(analysisResults.predictive_insights).length > 0) depth += 1;
    return depth;
  }

  estimateExecutionTime(rawResult) {
    const steps = rawResult.intermediateSteps ? rawResult.intermediateSteps.length : 1;
    return steps * 3; // Estimate 3 seconds per analysis step
  }

  summarizeInputData(data) {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    return {
      type: this.identifyDataType(data),
      size: dataStr.length,
      preview: dataStr.substring(0, 200) + (dataStr.length > 200 ? '...' : ''),
      key_elements: this.extractKeyAttributes(dataStr).slice(0, 5)
    };
  }

  determineNextActions(analysisResults, analysisType) {
    const actions = [];
    
    if (analysisResults.quality_assessment.completeness < 0.7) {
      actions.push({
        action: 'data_enhancement',
        priority: 'high',
        description: 'Improve data quality before proceeding with advanced analysis'
      });
    }
    
    if (analysisResults.pattern_analysis.anomalies.length > 0) {
      actions.push({
        action: 'anomaly_investigation',
        priority: 'medium',
        description: 'Investigate detected anomalies for root causes'
      });
    }
    
    if (analysisType === 'comprehensive') {
      actions.push({
        action: 'report_generation',
        priority: 'normal',
        description: 'Generate comprehensive analysis report for stakeholders'
      });
    }
    
    return actions;
  }

  createNeo4jContext(sessionId, orchestrationId, analysisType, confidenceScore) {
    const reportId = this.generateReportId();
    return {
      write: true,
      cypher: `MERGE (s:Session {id: '${sessionId}'}) 
               MERGE (o:Orchestration {id: '${orchestrationId}'}) 
               MERGE (a:AnalysisReport {id: '${reportId}', type: '${analysisType}', timestamp: datetime(), confidence: ${confidenceScore}}) 
               MERGE (s)-[:HAS_ORCHESTRATION]->(o) 
               MERGE (o)-[:GENERATED_ANALYSIS]->(a)`
    };
  }

  createErrorResponse(error) {
    return {
      error: error.message,
      agent_type: 'analysis',
      status: 'failed',
      timestamp: new Date().toISOString(),
      fallback_analysis: {
        summary: 'Analysis agent encountered an error. Manual analysis may be required.',
        recommendations: [
          'Verify data format and structure',
          'Check for data quality issues',
          'Review analysis parameters'
        ]
      }
    };
  }

  generateReportId() {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = { AnalysisAgent };
