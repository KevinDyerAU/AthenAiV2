// Creative Agent - Extracted Logic
const { ChatOpenAI } = require('@langchain/openai');
const { AgentExecutor, createOpenAIFunctionsAgent } = require('langchain/agents');
const { DynamicTool } = require('@langchain/core/tools');
const { PromptTemplate } = require('@langchain/core/prompts');

class CreativeAgent {
  constructor(apiKey, langSmithConfig = {}) {
    this.apiKey = apiKey;
    this.langSmithConfig = langSmithConfig;
    this.setupLangSmith();
  }

  setupLangSmith() {
    if (this.langSmithConfig.enabled) {
      process.env.LANGCHAIN_TRACING_V2 = 'true';
      process.env.LANGCHAIN_PROJECT = this.langSmithConfig.project || 'athenai-creative-agent';
      process.env.LANGCHAIN_ENDPOINT = this.langSmithConfig.endpoint || 'https://api.smith.langchain.com';
    }
  }

  async executeCreative(inputData) {
    try {
      const taskData = inputData.task || inputData;
      const content = taskData.content || taskData.research_findings || taskData.analysis_results;
      const creativeType = taskData.creative_type || 'synthesis';
      const sessionId = taskData.session_id || 'default_session';
      const orchestrationId = taskData.orchestration_id || 'default_orchestration';
      
      if (!content) {
        throw new Error('Content is required for creative synthesis');
      }

      // Primary OpenAI configuration with OpenRouter fallback
      const useOpenRouter = process.env.USE_OPENROUTER === 'true';
      
      if (useOpenRouter) {
        this.llm = new ChatOpenAI({
          modelName: process.env.OPENROUTER_MODEL || 'openai/gpt-4',
          temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE) || 0.7,
          openAIApiKey: this.apiKey || process.env.OPENROUTER_API_KEY,
          configuration: {
            baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
            defaultHeaders: {
              'HTTP-Referer': 'https://athenai.local',
              'X-Title': 'AthenAI Creative Agent'
            }
          },
          tags: ['creative-agent', 'athenai', 'openrouter']
        });
      } else {
        this.llm = new ChatOpenAI({
          modelName: process.env.OPENAI_MODEL || 'gpt-4',
          temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
          openAIApiKey: this.apiKey || process.env.OPENAI_API_KEY,
          tags: ['creative-agent', 'athenai', 'openai']
        });
      }

      const tools = this.initializeCreativeTools();
      const creativePrompt = this.createCreativePrompt();

      const agent = await createOpenAIFunctionsAgent({
        llm,
        tools,
        prompt: creativePrompt
      });

      const agentExecutor = new AgentExecutor({
        agent,
        tools,
        verbose: true,
        maxIterations: 6,
        returnIntermediateSteps: true
      });

      const creativeResult = await agentExecutor.invoke({
        content: JSON.stringify(content),
        creativeType: creativeType,
        sessionId: sessionId,
        orchestrationId: orchestrationId,
        tools: tools.map(t => t.name).join(', ')
      });

      const structuredOutput = await this.processCreativeOutput(creativeResult, content, creativeType);
      const qualityMetrics = this.calculateQualityMetrics(structuredOutput, creativeResult);

      const creativeReport = {
        orchestration_id: orchestrationId,
        session_id: sessionId,
        agent_type: 'creative',
        creative_type: creativeType,
        input_summary: this.summarizeInput(content),
        creative_output: structuredOutput,
        raw_output: creativeResult.output,
        intermediate_steps: creativeResult.intermediateSteps,
        quality_metrics: qualityMetrics,
        engagement_score: this.calculateEngagementScore(structuredOutput),
        timestamp: new Date().toISOString(),
        status: 'completed'
      };

      return {
        creative_report: creativeReport,
        next_actions: this.determineNextActions(structuredOutput, creativeType),
        neo4j_context: this.createNeo4jContext(sessionId, orchestrationId, creativeType, creativeReport.engagement_score),
        memory: {
          upsert: true,
          keys: ['creative_type', 'engagement_score', 'quality_metrics', 'timestamp']
        },
        routing: {
          queue: 'qa_tasks',
          priority: 'normal'
        }
      };

    } catch (error) {
      return this.createErrorResponse(error);
    }
  }

  createCreativePrompt() {
    return PromptTemplate.fromTemplate(`
You are a Creative Agent specialized in content synthesis, storytelling, and engaging communication.

Content to Process: {content}
Creative Type: {creativeType}
Session ID: {sessionId}
Orchestration ID: {orchestrationId}

Your task:
1. Analyze the provided content for key themes and insights
2. Synthesize information into engaging, coherent narrative
3. Adapt tone and style for target audience
4. Ensure accuracy while maintaining creativity
5. Include proper citations and references
6. Generate compelling and actionable content

Available tools: {tools}

Provide structured creative output with:
- Executive Summary
- Main Content/Narrative
- Key Takeaways
- Call to Action
- Supporting Evidence
- Style and Tone Assessment

Content: {content}
`);
  }

  initializeCreativeTools() {
    const tools = [];

    tools.push(new DynamicTool({
      name: 'content_structurer',
      description: 'Structure content into logical, engaging sections',
      func: async (content) => {
        try {
          const structure = this.analyzeContentStructure(content);
          return `Content Structure Analysis:
Sections Identified: ${structure.sections.length}
Logical Flow: ${structure.flow}
Key Themes: ${structure.themes.join(', ')}
Recommended Structure: ${structure.recommendation}`;
        } catch (error) {
          return `Content structuring error: ${error.message}`;
        }
      }
    }));

    tools.push(new DynamicTool({
      name: 'tone_adapter',
      description: 'Adapt content tone for specific audiences and purposes',
      func: async (content) => {
        try {
          const toneAnalysis = this.analyzeTone(content);
          return `Tone Analysis:
Current Tone: ${toneAnalysis.current}
Recommended Tone: ${toneAnalysis.recommended}
Audience Fit: ${toneAnalysis.audienceFit}
Adjustments Needed: ${toneAnalysis.adjustments.join(', ')}`;
        } catch (error) {
          return `Tone adaptation error: ${error.message}`;
        }
      }
    }));

    return tools;
  }

  analyzeContentStructure(content) {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const sentences = text.split('.').filter(s => s.trim().length > 10);
    
    return {
      sections: this.identifySections(sentences),
      flow: this.assessFlow(sentences),
      themes: this.extractThemes(text),
      recommendation: 'Introduction -> Main Points -> Conclusion'
    };
  }

  identifySections(sentences) {
    const sections = [];
    let currentSection = [];
    
    for (const sentence of sentences) {
      if (sentence.includes('first') || sentence.includes('introduction')) {
        if (currentSection.length > 0) sections.push(currentSection);
        currentSection = [sentence];
      } else {
        currentSection.push(sentence);
      }
    }
    
    if (currentSection.length > 0) sections.push(currentSection);
    return sections;
  }

  assessFlow(sentences) {
    const transitionWords = ['however', 'therefore', 'furthermore', 'additionally', 'consequently'];
    const hasTransitions = sentences.some(s => 
      transitionWords.some(word => s.toLowerCase().includes(word))
    );
    
    return hasTransitions ? 'good' : 'needs_improvement';
  }

  extractThemes(text) {
    const themes = [];
    const themeKeywords = {
      'technology': ['tech', 'digital', 'software', 'system'],
      'business': ['market', 'revenue', 'profit', 'strategy'],
      'research': ['study', 'analysis', 'findings', 'data'],
      'innovation': ['new', 'innovative', 'breakthrough', 'novel']
    };
    
    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      if (keywords.some(keyword => text.toLowerCase().includes(keyword))) {
        themes.push(theme);
      }
    }
    
    return themes;
  }

  analyzeTone(content) {
    const text = typeof content === 'string' ? content : JSON.stringify(content);
    const textLower = text.toLowerCase();
    
    let currentTone = 'neutral';
    if (textLower.includes('exciting') || textLower.includes('amazing')) {
      currentTone = 'enthusiastic';
    } else if (textLower.includes('concern') || textLower.includes('issue')) {
      currentTone = 'cautious';
    } else if (textLower.includes('data') || textLower.includes('analysis')) {
      currentTone = 'analytical';
    }
    
    return {
      current: currentTone,
      recommended: 'professional_engaging',
      audienceFit: 'medium',
      adjustments: ['add_engaging_elements', 'maintain_professionalism']
    };
  }

  async processCreativeOutput(creativeResult, _originalContent, _creativeType) {
    const output = {
      executive_summary: '',
      main_content: '',
      key_takeaways: [],
      call_to_action: '',
      supporting_evidence: [],
      style_assessment: {}
    };

    try {
      const resultText = creativeResult.output || '';
      
      output.executive_summary = this.extractExecutiveSummary(resultText);
      output.main_content = resultText;
      output.key_takeaways = this.extractKeyTakeaways(resultText);
      output.call_to_action = this.extractCallToAction(resultText);
      output.supporting_evidence = this.extractEvidence(resultText);
      output.style_assessment = this.assessStyle(resultText);
      
    } catch (error) {
      output.main_content = 'Error processing creative output';
    }

    return output;
  }

  extractExecutiveSummary(text) {
    const sentences = text.split('.').filter(s => s.trim().length > 20);
    return sentences.slice(0, 2).join('. ') + '.';
  }

  extractKeyTakeaways(text) {
    const takeaways = [];
    const lines = text.split('\n').filter(line => line.trim().length > 10);
    
    for (const line of lines) {
      if (line.includes('key') || line.includes('important') || line.includes('takeaway')) {
        takeaways.push(line.trim());
      }
    }
    
    return takeaways.slice(0, 5);
  }

  extractCallToAction(text) {
    const ctaKeywords = ['should', 'must', 'recommend', 'suggest', 'action', 'next step'];
    const sentences = text.split('.').filter(s => s.trim().length > 10);
    
    for (const sentence of sentences) {
      if (ctaKeywords.some(keyword => sentence.toLowerCase().includes(keyword))) {
        return sentence.trim();
      }
    }
    
    return 'Consider implementing the insights provided in this analysis.';
  }

  extractEvidence(text) {
    const evidence = [];
    const evidenceKeywords = ['data shows', 'research indicates', 'studies suggest', 'according to'];
    
    for (const keyword of evidenceKeywords) {
      const regex = new RegExp(`[^.]*${keyword}[^.]*`, 'gi');
      const matches = text.match(regex) || [];
      evidence.push(...matches.slice(0, 2));
    }
    
    return evidence.slice(0, 5);
  }

  assessStyle(text) {
    return {
      readability: this.calculateReadability(text),
      engagement: this.calculateEngagement(text),
      clarity: this.calculateClarity(text),
      professionalism: this.calculateProfessionalism(text)
    };
  }

  calculateReadability(text) {
    const sentences = text.split('.').length;
    const words = text.split(' ').length;
    const avgWordsPerSentence = words / sentences;
    
    if (avgWordsPerSentence < 15) return 'high';
    if (avgWordsPerSentence < 25) return 'medium';
    return 'low';
  }

  calculateEngagement(text) {
    const engagingWords = (text.match(/interesting|exciting|important|significant|remarkable/gi) || []).length;
    const questions = (text.match(/\?/g) || []).length;
    
    return engagingWords + questions > 3 ? 'high' : 'medium';
  }

  calculateClarity(text) {
    const clarityIndicators = (text.match(/clear|obvious|evident|specifically|precisely/gi) || []).length;
    const confusingWords = (text.match(/complex|complicated|unclear|ambiguous/gi) || []).length;
    
    return clarityIndicators > confusingWords ? 'high' : 'medium';
  }

  calculateProfessionalism(text) {
    const professionalWords = (text.match(/analysis|research|data|strategy|implementation/gi) || []).length;
    const casualWords = (text.match(/awesome|cool|stuff|things|whatever/gi) || []).length;
    
    return professionalWords > casualWords ? 'high' : 'medium';
  }

  calculateQualityMetrics(output, _rawResult) {
    return {
      content_length: output.main_content.length,
      structure_score: this.calculateStructureScore(output),
      engagement_level: this.calculateEngagementScore(output),
      evidence_strength: output.supporting_evidence.length,
      clarity_score: output.style_assessment.clarity === 'high' ? 0.9 : 0.7,
      completeness: this.calculateCompleteness(output)
    };
  }

  calculateStructureScore(output) {
    let score = 0;
    if (output.executive_summary.length > 50) score += 0.2;
    if (output.main_content.length > 200) score += 0.2;
    if (output.key_takeaways.length > 2) score += 0.2;
    if (output.call_to_action.length > 20) score += 0.2;
    if (output.supporting_evidence.length > 1) score += 0.2;
    return score;
  }

  calculateEngagementScore(output) {
    let score = 0.5;
    if (output.style_assessment.engagement === 'high') score += 0.2;
    if (output.key_takeaways.length > 3) score += 0.1;
    if (output.call_to_action.length > 30) score += 0.1;
    return Math.min(0.95, score);
  }

  calculateCompleteness(output) {
    const requiredSections = ['executive_summary', 'main_content', 'key_takeaways', 'call_to_action'];
    const completedSections = requiredSections.filter(section => 
      output[section] && (typeof output[section] === 'string' ? output[section].length > 10 : output[section].length > 0)
    );
    
    return completedSections.length / requiredSections.length;
  }

  summarizeInput(content) {
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    return {
      type: typeof content,
      length: contentStr.length,
      preview: contentStr.substring(0, 150) + (contentStr.length > 150 ? '...' : ''),
      key_topics: this.extractThemes(contentStr)
    };
  }

  determineNextActions(output, _creativeType) {
    const actions = [];
    
    if (output.style_assessment.engagement === 'low') {
      actions.push({
        action: 'enhance_engagement',
        priority: 'medium',
        description: 'Improve content engagement through storytelling and examples'
      });
    }
    
    if (output.supporting_evidence.length < 2) {
      actions.push({
        action: 'add_evidence',
        priority: 'medium',
        description: 'Strengthen content with additional supporting evidence'
      });
    }
    
    actions.push({
      action: 'quality_review',
      priority: 'normal',
      description: 'Conduct final quality review before publication'
    });
    
    return actions;
  }

  createNeo4jContext(sessionId, orchestrationId, creativeType, engagementScore) {
    const reportId = this.generateReportId();
    return {
      write: true,
      cypher: `MERGE (s:Session {id: '${sessionId}'}) 
               MERGE (o:Orchestration {id: '${orchestrationId}'}) 
               MERGE (c:CreativeOutput {id: '${reportId}', type: '${creativeType}', timestamp: datetime(), engagement: ${engagementScore}}) 
               MERGE (s)-[:HAS_ORCHESTRATION]->(o) 
               MERGE (o)-[:GENERATED_CREATIVE]->(c)`
    };
  }

  createErrorResponse(error) {
    return {
      error: error.message,
      agent_type: 'creative',
      status: 'failed',
      timestamp: new Date().toISOString(),
      fallback_content: {
        summary: 'Creative agent encountered an error. Manual content creation may be required.',
        recommendations: [
          'Review input content format',
          'Check creative parameters',
          'Verify API connectivity'
        ]
      }
    };
  }

  generateReportId() {
    return `creative_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = { CreativeAgent };
