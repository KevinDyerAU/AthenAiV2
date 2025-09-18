// Analysis Agent - Data Analysis and Statistical Insights
const { ChatOpenAI } = require('@langchain/openai');
const { AgentExecutor, createOpenAIToolsAgent } = require('langchain/agents');
const { DynamicTool } = require('@langchain/core/tools');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { logger } = require('../utils/logger');
const { ReasoningFramework } = require('../utils/reasoningFramework');
const { SemanticSimilarity } = require('../utils/semanticSimilarity');
const progressBroadcaster = require('../services/progressBroadcaster');
const databaseService = require('../services/database');
const { WebBrowsingUtils } = require('../utils/webBrowsingUtils');

class AnalysisAgent {
  constructor() {
    // Primary OpenAI configuration with OpenRouter fallback
    const useOpenRouter = process.env.USE_OPENROUTER === 'true';
    
    if (useOpenRouter) {
      this.llm = new ChatOpenAI({
        modelName: process.env.OPENROUTER_MODEL || 'openai/gpt-4',
        temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE) || 0.1,
        openAIApiKey: process.env.OPENROUTER_API_KEY,
        configuration: {
          baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            'HTTP-Referer': 'https://athenai.local',
            'X-Title': 'AthenAI System'
          }
        },
        timeout: 10000,
        maxRetries: 2
      });
    } else {
      this.llm = new ChatOpenAI({
        modelName: process.env.OPENAI_MODEL || 'gpt-4',
        temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.1,
        openAIApiKey: process.env.OPENAI_API_KEY,
        timeout: parseInt(process.env.OPENAI_TIMEOUT) || 60000,
        maxRetries: 2,
        tags: ['analysis-agent', 'athenai', 'openai']
      });
    }
    
    // Initialize reasoning framework
    this.reasoning = new ReasoningFramework('AnalysisAgent');
    
    // Initialize analysis capabilities
    this.analysisQueue = [];
    this.runningAnalyses = new Map();
    this.maxConcurrentAnalyses = process.env.MAX_CONCURRENT_ANALYSES || 3;
  }

  // Knowledge substrate integration
  async retrieveKnowledgeContext(query, sessionId) {
    try {
      await progressBroadcaster.updateProgress(sessionId, 'knowledge_context', 'Retrieving knowledge context and cached analysis');
      
      // Infer domain from query content
      const domain = this.inferAnalysisDomain(query);
      
      // Get cached analysis results - first try exact hash match
      const queryHash = this.generateQueryHash(query);
      let similarAnalysis = await databaseService.getAnalysisInsightsByQueryHash(queryHash);
      
      // If no exact matches, get broader set for semantic similarity matching
      if (!similarAnalysis || similarAnalysis.length === 0) {
        similarAnalysis = await databaseService.getAnalysisInsightsForSimilarity(domain, 20);
        logger.info('No exact hash matches found, retrieved analysis insights for semantic similarity', {
          domain,
          count: similarAnalysis.length,
          query: query.substring(0, 100) + '...'
        });
      } else {
        logger.info('Found exact hash matches for analysis query', {
          count: similarAnalysis.length,
          queryHash
        });
      }
      
      // Get domain-specific knowledge entities
      const knowledgeEntities = await databaseService.getKnowledgeEntitiesByDomain(domain);
      
      await progressBroadcaster.updateProgress(sessionId, 'knowledge_retrieval', 
        `Found ${similarAnalysis.length} cached results and ${knowledgeEntities.length} knowledge entities`, {
        progress: 20
      });

      return {
        domain,
        similarAnalysis,
        knowledgeEntities,
        queryHash
      };
    } catch (error) {
      logger.error('Error retrieving knowledge context:', {
        error: error.message,
        stack: error.stack,
        sessionId,
        query: query?.substring(0, 100) + '...',
        timestamp: new Date().toISOString()
      });
      await progressBroadcaster.broadcastProgress(sessionId, {
        phase: 'knowledge_retrieval',
        message: 'Knowledge retrieval failed, proceeding with fresh analysis',
        progress: 20,
        error: error.message
      });
      return { domain: 'general', cachedResults: [], knowledgeEntities: [], queryHash: null };
    }
  }

  async storeAnalysisInsights(analysisResults, queryHash, sessionId) {
    try {
      await progressBroadcaster.broadcastProgress(sessionId, {
        phase: 'knowledge_storage',
        message: 'Storing analysis insights for future use...',
        progress: 90
      });

      // Extract insights and patterns
      const insights = this.extractAnalysisInsights(analysisResults);
      
      // Store analysis insights
      if (queryHash && insights.length > 0) {
        await databaseService.storeAnalysisInsights(queryHash, insights, analysisResults.confidence || 0.8);
      }

      // Create knowledge entities for significant findings
      if (analysisResults.key_findings && analysisResults.key_findings.length > 0) {
        for (const finding of analysisResults.key_findings) {
          if (finding.significance === 'high') {
            await databaseService.createKnowledgeEntity({
              type: 'analysis_finding',
              domain: analysisResults.domain || 'general',
              content: finding.description,
              metadata: {
                analysis_type: analysisResults.analysis_type,
                confidence: finding.confidence,
                source: 'AnalysisAgent',
                session_id: sessionId
              }
            });
          }
        }
      }

      await progressBroadcaster.broadcastProgress(sessionId, {
        phase: 'knowledge_storage',
        message: 'Analysis insights stored successfully',
        progress: 95
      });

    } catch (error) {
      logger.error('Error storing analysis insights:', {
        error: error.message,
        stack: error.stack,
        sessionId,
        analysisType: analysisResults?.analysis_type,
        queryHash,
        timestamp: new Date().toISOString()
      });
      await progressBroadcaster.broadcastProgress(sessionId, {
        phase: 'knowledge_storage',
        message: 'Failed to store insights, but analysis completed',
        progress: 95,
        error: error.message
      });
    }
  }

  inferAnalysisDomain(query) {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('software') || queryLower.includes('code') || queryLower.includes('programming')) {
      return 'software';
    } else if (queryLower.includes('security') || queryLower.includes('vulnerability') || queryLower.includes('threat')) {
      return 'security';
    } else if (queryLower.includes('performance') || queryLower.includes('optimization') || queryLower.includes('speed')) {
      return 'performance';
    } else if (queryLower.includes('data') || queryLower.includes('statistics') || queryLower.includes('analytics')) {
      return 'data';
    } else if (queryLower.includes('api') || queryLower.includes('endpoint') || queryLower.includes('service')) {
      return 'api';
    } else if (queryLower.includes('ai') || queryLower.includes('machine learning') || queryLower.includes('neural')) {
      return 'ai';
    }
    
    return 'general';
  }

  generateQueryHash(query) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(query.toLowerCase().trim()).digest('hex');
  }

  extractAnalysisInsights(analysisResults) {
    const insights = [];
    
    // Extract patterns from analysis
    if (analysisResults.patterns) {
      insights.push({
        type: 'pattern',
        content: `Analysis revealed patterns: ${analysisResults.patterns.join(', ')}`,
        confidence: analysisResults.confidence || 0.8
      });
    }
    
    // Extract trends
    if (analysisResults.trends) {
      insights.push({
        type: 'trend',
        content: `Identified trends: ${analysisResults.trends.join(', ')}`,
        confidence: analysisResults.confidence || 0.8
      });
    }
    
    // Extract recommendations
    if (analysisResults.recommendations) {
      for (const rec of analysisResults.recommendations) {
        insights.push({
          type: 'recommendation',
          content: rec.description || rec,
          confidence: rec.confidence || 0.8
        });
      }
    }
    
    return insights;
  }

  async executeAnalysis(inputData) {
    try {
      const taskData = inputData.task || inputData;
      let dataToAnalyze = taskData.data || taskData.research_findings || taskData.content || taskData.message;
      const analysisType = taskData.analysis_type || 'comprehensive';
      const sessionId = taskData.session_id || 'default_session';
      const orchestrationId = taskData.orchestration_id || 'default_orchestration';

      await progressBroadcaster.broadcastProgress(sessionId, {
        phase: 'initialization',
        message: 'Starting comprehensive data analysis...',
        progress: 5
      });

      if (!dataToAnalyze) {
        throw new Error('Data is required for analysis');
      }

      // Retrieve knowledge context first
      const knowledgeContext = await this.retrieveKnowledgeContext(dataToAnalyze, sessionId);

      // Check if we have semantically similar cached analysis
      if (knowledgeContext.similarAnalysis && knowledgeContext.similarAnalysis.length > 0) {
        const bestMatch = SemanticSimilarity.findBestMatch(
          dataToAnalyze, 
          knowledgeContext.similarAnalysis, 
          'original_query', 
          0.75 // Threshold for analysis caching
        );
        
        if (bestMatch && bestMatch.insights && bestMatch.analysis_type === analysisType) {
          logger.info('Using semantically similar cached analysis results', { 
            originalQuery: dataToAnalyze,
            cachedQuery: bestMatch.original_query,
            similarity: bestMatch._similarity.similarity,
            analysisType,
            cacheAge: Date.now() - new Date(bestMatch.created_at).getTime()
          });
          
          await progressBroadcaster.broadcastProgress(sessionId, {
            phase: 'cache_hit',
            message: `Found similar analysis (${Math.round(bestMatch._similarity.similarity * 100)}% match), using cached insights`,
            progress: 90
          });
          
          return {
            success: true,
            analysis_type: analysisType,
            executive_summary: bestMatch.insights.executive_summary || 'Analysis completed from cache',
            key_findings: bestMatch.insights.key_findings || [],
            statistical_analysis: bestMatch.insights.statistical_analysis || {},
            patterns: bestMatch.insights.patterns || [],
            trends: bestMatch.insights.trends || [],
            recommendations: bestMatch.insights.recommendations || [],
            confidence: bestMatch.confidence_score || 0.9,
            timestamp: new Date().toISOString(),
            metadata: {
              cached: true,
              cache_timestamp: bestMatch.created_at,
              similarity_score: bestMatch._similarity.similarity,
              original_cached_query: bestMatch.original_query
            }
          };
        }
      }

      await progressBroadcaster.broadcastProgress(sessionId, {
        phase: 'data_preparation',
        message: 'No cached results found, performing fresh analysis...',
        progress: 25
      });

      // Handle GitHub repository data if needed
      if (typeof dataToAnalyze === 'string' && dataToAnalyze.includes('github.com')) {
        dataToAnalyze = await this.fetchGitHubRepositoryData(dataToAnalyze);
      }

      await progressBroadcaster.broadcastProgress(sessionId, {
        phase: 'strategic_planning',
        message: 'Planning analysis strategy...',
        progress: 35
      });

      // Strategic planning with knowledge context
      const strategyPlan = await this.reasoning.planStrategy(dataToAnalyze, {
        time_constraint: 'normal',
        quality_priority: 'high',
        creativity_needed: analysisType === 'creative',
        knowledge_context: knowledgeContext
      });

      await progressBroadcaster.broadcastProgress(sessionId, {
        phase: 'analysis_execution',
        message: 'Executing comprehensive analysis...',
        progress: 50
      });

      // Create analysis tools
      const analysisTools = this.createAnalysisTools(sessionId);

      // Create enhanced prompt with knowledge context
      const analysisPrompt = PromptTemplate.fromTemplate(`
You are an expert data analyst with access to advanced analytical tools and historical knowledge context.

ANALYSIS TASK:
- Type: {analysisType}
- Data: {dataToAnalyze}
- Domain: {domain}

KNOWLEDGE CONTEXT:
- Previous similar analyses: {cachedResults}
- Relevant knowledge entities: {knowledgeEntities}

AVAILABLE TOOLS:
{tools}

INSTRUCTIONS:
1. Perform comprehensive analysis using available tools
2. Leverage knowledge context to enhance insights
3. Identify patterns, trends, and anomalies
4. Provide statistical analysis where applicable
5. Generate actionable recommendations
6. Assess confidence levels for all findings

Use the following format for your analysis:
- Executive Summary
- Key Findings (with confidence scores)
- Statistical Analysis
- Patterns and Trends
- Recommendations
- Confidence Assessment

{agent_scratchpad}
`);

      // Create and execute agent
      const agent = await createOpenAIToolsAgent({
        llm: this.llm,
        tools: analysisTools,
        prompt: analysisPrompt
      });

      const agentExecutor = new AgentExecutor({
        agent,
        tools: analysisTools,
        verbose: process.env.NODE_ENV === 'development',
        maxIterations: 10,
        returnIntermediateSteps: true
      });

      await progressBroadcaster.broadcastProgress(sessionId, {
        phase: 'analysis_execution',
        message: 'Running AI-powered analysis...',
        progress: 70
      });

      const result = await agentExecutor.invoke({
        analysisType,
        dataToAnalyze: JSON.stringify(dataToAnalyze),
        domain: knowledgeContext.domain,
        cachedResults: JSON.stringify(knowledgeContext.cachedResults.slice(0, 3)),
        knowledgeEntities: JSON.stringify(knowledgeContext.knowledgeEntities.slice(0, 5)),
        sessionId,
        tools: analysisTools.map(tool => tool.name).join(', ')
      });

      await progressBroadcaster.broadcastProgress(sessionId, {
        phase: 'evaluation',
        message: 'Evaluating analysis quality...',
        progress: 80
      });

      // Self-evaluation
      const evaluation = await this.performSelfEvaluation(result.output, dataToAnalyze, sessionId);

      // Structure final results
      const analysisResults = {
        analysis_type: analysisType,
        domain: knowledgeContext.domain,
        executive_summary: this.extractExecutiveSummary(result.output),
        key_findings: this.extractKeyFindings(result.output),
        statistical_analysis: this.extractStatisticalAnalysis(result.output),
        patterns: this.extractPatterns(result.output),
        trends: this.extractTrends(result.output),
        recommendations: this.extractRecommendations(result.output),
        confidence: evaluation.overall_confidence,
        quality_score: evaluation.quality_score,
        session_id: sessionId,
        orchestration_id: orchestrationId,
        timestamp: new Date().toISOString(),
        raw_output: result.output,
        intermediate_steps: result.intermediateSteps
      };

      // Store insights in knowledge substrate
      await this.storeAnalysisInsights(analysisResults, knowledgeContext.queryHash, sessionId);

      await progressBroadcaster.broadcastProgress(sessionId, {
        phase: 'completion',
        message: 'Analysis completed successfully',
        progress: 100
      });

      return analysisResults;

    } catch (error) {
      logger.error('Analysis execution failed:', {
        error: error.message,
        stack: error.stack,
        sessionId,
        orchestrationId,
        analysisType,
        dataType: typeof dataToAnalyze,
        dataLength: Array.isArray(dataToAnalyze) ? dataToAnalyze.length : 'N/A',
        timestamp: new Date().toISOString(),
        phase: 'executeAnalysis'
      });
      await progressBroadcaster.broadcastProgress(sessionId, {
        phase: 'error',
        message: `Analysis failed: ${error.message}`,
        progress: 100,
        error: error.message
      });
      return this.createErrorResponse(error);
    }
  }

  // Create specialized analysis tools
  createAnalysisTools(sessionId) {
    return [
      // Think tool for step-by-step analysis reasoning
      new DynamicTool({
        name: 'think',
        description: 'Think through complex analysis challenges step by step, evaluate different analytical approaches, and reason about the optimal analysis strategy',
        func: async (input) => {
          try {
            const thinkPrompt = PromptTemplate.fromTemplate(`
You are working through a complex analysis challenge. Break down your analytical reasoning step by step.

Analysis Challenge: {problem}

Think through this systematically:
1. What is the core analytical question or data insight I need to uncover?
2. What are the key data dimensions and variables I should examine?
3. What different analytical approaches or methodologies could I use?
4. What patterns, trends, or correlations should I look for?
5. What statistical methods would be most appropriate?
6. How should I validate and interpret my findings?

Provide your step-by-step analysis reasoning:
`);

            const chain = thinkPrompt.pipe(this.llm).pipe(new StringOutputParser());
            const thinking = await chain.invoke({ problem: input });
            
            return `ANALYSIS THINKING PROCESS:\n${thinking}`;
          } catch (error) {
            return `Thinking error: ${error.message}`;
          }
        }
      }),

      new DynamicTool({
        name: 'statistical_analysis',
        description: 'Perform statistical analysis on numerical data including mean, median, mode, standard deviation, and correlation analysis',
        func: async (input) => {
          await progressBroadcaster.broadcastProgress(sessionId, {
            phase: 'tool_execution',
            message: 'Performing statistical analysis...',
            progress: 60
          });
          return this.performStatisticalAnalysis(JSON.parse(input));
        }
      }),

      new DynamicTool({
        name: 'pattern_detection',
        description: 'Detect patterns, trends, and anomalies in data sets',
        func: async (input) => {
          await progressBroadcaster.broadcastProgress(sessionId, {
            phase: 'tool_execution',
            message: 'Detecting patterns and trends...',
            progress: 65
          });
          return this.detectPatterns(JSON.parse(input));
        }
      }),

      new DynamicTool({
        name: 'correlation_analysis',
        description: 'Analyze correlations between different variables in the dataset',
        func: async (input) => {
          await progressBroadcaster.broadcastProgress(sessionId, {
            phase: 'tool_execution',
            message: 'Analyzing correlations...',
            progress: 70
          });
          return this.analyzeCorrelations(JSON.parse(input));
        }
      }),

      new DynamicTool({
        name: 'trend_analysis',
        description: 'Identify and analyze trends over time in the data',
        func: async (input) => {
          await progressBroadcaster.broadcastProgress(sessionId, {
            phase: 'tool_execution',
            message: 'Analyzing trends...',
            progress: 75
          });
          return this.analyzeTrends(JSON.parse(input));
        }
      }),

      new DynamicTool({
        name: 'github_repository_analysis',
        description: 'Analyze GitHub repository data including code structure, commits, and metrics',
        func: async (input) => {
          await progressBroadcaster.broadcastProgress(sessionId, {
            phase: 'tool_execution',
            message: 'Analyzing GitHub repository...',
            progress: 80
          });
          return this.analyzeGitHubRepository(input);
        }
      })
    ];
  }

  // Statistical analysis implementation
  async performStatisticalAnalysis(data) {
    try {
      if (!Array.isArray(data) || data.length === 0) {
        return { error: 'Invalid data format for statistical analysis' };
      }

      const numericData = data.filter(item => typeof item === 'number' && !isNaN(item));
      
      if (numericData.length === 0) {
        return { error: 'No numeric data found for statistical analysis' };
      }

      const mean = numericData.reduce((sum, val) => sum + val, 0) / numericData.length;
      const sortedData = [...numericData].sort((a, b) => a - b);
      const median = sortedData.length % 2 === 0 
        ? (sortedData[sortedData.length / 2 - 1] + sortedData[sortedData.length / 2]) / 2
        : sortedData[Math.floor(sortedData.length / 2)];
      
      const variance = numericData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / numericData.length;
      const standardDeviation = Math.sqrt(variance);
      
      const min = Math.min(...numericData);
      const max = Math.max(...numericData);

      return {
        count: numericData.length,
        mean: parseFloat(mean.toFixed(4)),
        median: parseFloat(median.toFixed(4)),
        standardDeviation: parseFloat(standardDeviation.toFixed(4)),
        variance: parseFloat(variance.toFixed(4)),
        min,
        max,
        range: max - min
      };
    } catch (error) {
      logger.error('Statistical analysis error:', {
        error: error.message,
        stack: error.stack,
        dataType: typeof data,
        dataLength: Array.isArray(data) ? data.length : 'N/A',
        timestamp: new Date().toISOString(),
        method: 'performStatisticalAnalysis'
      });
      return { error: error.message };
    }
  }

  // Pattern detection implementation
  async detectPatterns(data) {
    try {
      const patterns = [];
      
      if (Array.isArray(data) && data.length > 2) {
        // Detect increasing/decreasing trends
        let increasing = 0, decreasing = 0;
        for (let i = 1; i < data.length; i++) {
          if (data[i] > data[i-1]) increasing++;
          else if (data[i] < data[i-1]) decreasing++;
        }
        
        if (increasing > decreasing * 2) {
          patterns.push({ type: 'trend', pattern: 'increasing', confidence: 0.8 });
        } else if (decreasing > increasing * 2) {
          patterns.push({ type: 'trend', pattern: 'decreasing', confidence: 0.8 });
        }

        // Detect cyclical patterns
        if (data.length >= 6) {
          const cycles = this.detectCycles(data);
          if (cycles.length > 0) {
            patterns.push({ type: 'cyclical', patterns: cycles, confidence: 0.7 });
          }
        }
      }

      return { patterns, analysis_timestamp: new Date().toISOString() };
    } catch (error) {
      logger.error('Pattern detection error:', error);
      return { error: error.message };
    }
  }

  // Correlation analysis implementation
  async analyzeCorrelations(data) {
    try {
      if (!data || typeof data !== 'object') {
        return { error: 'Invalid data format for correlation analysis' };
      }

      const correlations = [];
      const keys = Object.keys(data).filter(key => Array.isArray(data[key]));
      
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          const correlation = this.calculateCorrelation(data[keys[i]], data[keys[j]]);
          if (!isNaN(correlation)) {
            correlations.push({
              variables: [keys[i], keys[j]],
              correlation: parseFloat(correlation.toFixed(4)),
              strength: this.interpretCorrelation(correlation)
            });
          }
        }
      }

      return { correlations, analysis_timestamp: new Date().toISOString() };
    } catch (error) {
      logger.error('Correlation analysis error:', error);
      return { error: error.message };
    }
  }

  // Helper methods for analysis
  detectCycles(data) {
    const cycles = [];
    const minCycleLength = 3;
    const maxCycleLength = Math.floor(data.length / 2);
    
    for (let cycleLength = minCycleLength; cycleLength <= maxCycleLength; cycleLength++) {
      let matches = 0;
      for (let i = 0; i < data.length - cycleLength; i++) {
        if (Math.abs(data[i] - data[i + cycleLength]) < 0.1 * Math.abs(data[i])) {
          matches++;
        }
      }
      
      if (matches > cycleLength) {
        cycles.push({ length: cycleLength, confidence: matches / (data.length - cycleLength) });
      }
    }
    
    return cycles;
  }

  calculateCorrelation(x, y) {
    if (x.length !== y.length || x.length === 0) return NaN;
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  interpretCorrelation(correlation) {
    const abs = Math.abs(correlation);
    if (abs >= 0.8) return 'very strong';
    if (abs >= 0.6) return 'strong';
    if (abs >= 0.4) return 'moderate';
    if (abs >= 0.2) return 'weak';
    return 'very weak';
  }

  // GitHub data fetching
  async fetchGitHubRepositoryData(repoUrl) {
    try {
      const webBrowsingUtils = new WebBrowsingUtils();
      const repoData = await webBrowsingUtils.fetchGitHubRepositoryData(repoUrl);
      return repoData;
    } catch (error) {
      logger.error('Error fetching GitHub repository data:', error);
      throw error;
    }
  }

  // Self-evaluation
  async performSelfEvaluation(analysisOutput, originalData, sessionId) {
    try {
      await progressBroadcaster.broadcastProgress(sessionId, {
        phase: 'evaluation',
        message: 'Performing self-evaluation...',
        progress: 85
      });

      const evaluationPrompt = `
Evaluate the quality of this analysis output:

ANALYSIS OUTPUT:
${analysisOutput}

ORIGINAL DATA:
${JSON.stringify(originalData).substring(0, 500)}...

Rate the analysis on these criteria (1-10):
1. Completeness - Does it address all aspects of the data?
2. Accuracy - Are the findings statistically sound?
3. Clarity - Is the analysis easy to understand?
4. Actionability - Are the recommendations practical?
5. Insight Quality - Does it provide valuable insights?

Provide scores and overall confidence (0-1).
`;

      const evaluation = await this.llm.invoke(evaluationPrompt);
      
      return {
        overall_confidence: 0.8,
        quality_score: 8.0,
        evaluation_details: evaluation.content
      };
    } catch (error) {
      logger.error('Self-evaluation error:', error);
      return {
        overall_confidence: 0.7,
        quality_score: 7.0,
        evaluation_details: 'Self-evaluation failed, using default scores'
      };
    }
  }

  // Result extraction methods
  extractExecutiveSummary(output) {
    const lines = output.split('\n');
    const summaryStart = lines.findIndex(line => line.toLowerCase().includes('executive summary'));
    if (summaryStart === -1) return 'Analysis completed successfully';
    
    const summaryEnd = lines.findIndex((line, index) => 
      index > summaryStart && (line.toLowerCase().includes('key findings') || line.toLowerCase().includes('##'))
    );
    
    return lines.slice(summaryStart + 1, summaryEnd === -1 ? summaryStart + 3 : summaryEnd)
      .join(' ').trim() || 'Analysis completed successfully';
  }

  extractKeyFindings(output) {
    const findings = [];
    const lines = output.split('\n');
    
    lines.forEach(line => {
      if (line.includes('•') || line.includes('-') || line.includes('*')) {
        const finding = line.replace(/[•\-*]/g, '').trim();
        if (finding.length > 10) {
          findings.push({
            description: finding,
            confidence: 0.8,
            significance: 'medium'
          });
        }
      }
    });
    
    return findings.slice(0, 5);
  }

  extractStatisticalAnalysis(output) {
    const stats = {};
    const lines = output.split('\n');
    
    lines.forEach(line => {
      if (line.toLowerCase().includes('mean') || line.toLowerCase().includes('average')) {
        stats.mean_mentioned = true;
      }
      if (line.toLowerCase().includes('correlation')) {
        stats.correlation_analysis = true;
      }
      if (line.toLowerCase().includes('trend')) {
        stats.trend_analysis = true;
      }
    });
    
    return stats;
  }

  extractPatterns(output) {
    const patterns = [];
    const lines = output.split('\n');
    
    lines.forEach(line => {
      if (line.toLowerCase().includes('pattern') || line.toLowerCase().includes('recurring')) {
        patterns.push(line.trim());
      }
    });
    
    return patterns.slice(0, 3);
  }

  extractTrends(output) {
    const trends = [];
    const lines = output.split('\n');
    
    lines.forEach(line => {
      if (line.toLowerCase().includes('trend') || line.toLowerCase().includes('increasing') || line.toLowerCase().includes('decreasing')) {
        trends.push(line.trim());
      }
    });
    
    return trends.slice(0, 3);
  }

  extractRecommendations(output) {
    const recommendations = [];
    const lines = output.split('\n');
    
    lines.forEach(line => {
      if (line.toLowerCase().includes('recommend') || line.toLowerCase().includes('suggest') || line.toLowerCase().includes('should')) {
        recommendations.push({
          description: line.trim(),
          priority: 'medium',
          confidence: 0.8
        });
      }
    });
    
    return recommendations.slice(0, 5);
  }

  // Error handling
  createErrorResponse(error) {
    logger.error('Creating error response:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      timestamp: new Date().toISOString(),
      method: 'createErrorResponse'
    });
    
    return {
      success: false,
      error: error.message,
      error_details: {
        name: error.name,
        code: error.code,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      analysis_type: 'error',
      confidence: 0,
      timestamp: new Date().toISOString(),
      recommendations: [{
        description: 'Review input data format and try again',
        priority: 'high',
        confidence: 1.0
      }]
    };
  }
}

module.exports = { AnalysisAgent };
