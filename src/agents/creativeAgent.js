// Creative Agent - Content Creation and Synthesis
const { ChatOpenAI } = require('@langchain/openai');
const { AgentExecutor, createOpenAIToolsAgent } = require('langchain/agents');
const { DynamicTool } = require('@langchain/core/tools');
const { PromptTemplate } = require('@langchain/core/prompts');
const { ReasoningFramework } = require('../utils/reasoningFramework');
const { WebBrowsingUtils } = require('../utils/webBrowsingUtils');

class CreativeAgent {
  constructor(apiKey, langSmithConfig = {}) {
    this.apiKey = apiKey;
    this.langSmithConfig = langSmithConfig;
    this.setupLangSmith();
    
    // Initialize reasoning framework
    this.reasoning = new ReasoningFramework('CreativeAgent');
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

      // PHASE 1: Strategic Planning and Reasoning
      const strategyPlan = await this.reasoning.planStrategy(content, {
        time_constraint: 'normal',
        quality_priority: 'high',
        creativity_needed: true
      });

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
          temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
          openAIApiKey: this.apiKey || process.env.OPENAI_API_KEY,
          tags: ['creative-agent', 'athenai', 'openai']
        });
      }

      const tools = this.initializeCreativeTools();
      const creativePrompt = this.createCreativePrompt();

      const agent = await createOpenAIToolsAgent({
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

      // PHASE 2: Execute the task with strategy
      const result = await agentExecutor.invoke({
        content: typeof content === 'object' ? JSON.stringify(content) : content,
        creativeType,
        strategy: strategyPlan.selected_strategy.name,
        sessionId,
        orchestrationId,
        tools: tools.map(t => t.name).join(', ')
      });

      // PHASE 3: Self-Evaluation
      const evaluation = await this.reasoning.evaluateOutput(result.output, content, strategyPlan);

      const structuredOutput = await this.processCreativeOutput(result, content, creativeType);
      const qualityMetrics = this.calculateQualityMetrics(structuredOutput, result);

      const creativeReport = {
        orchestration_id: orchestrationId,
        session_id: sessionId,
        agent_type: 'creative',
        creative_type: creativeType,
        input_summary: this.summarizeInput(content),
        creative_output: structuredOutput,
        raw_output: result.output,
        intermediate_steps: result.intermediateSteps,
        quality_metrics: qualityMetrics,
        confidence_score: evaluation.confidence_score,
        timestamp: new Date().toISOString(),
        status: 'completed'
      };

      return {
        creative_output: structuredOutput,
        next_actions: this.determineNextActions(structuredOutput, creativeType),
        neo4j_context: this.createNeo4jContext(sessionId, orchestrationId, creativeType, evaluation.confidence_score),
        memory: {
          upsert: true,
          keys: ['creative_type', 'key_takeaways', 'style_assessment', 'confidence_score', 'timestamp']
        },
        routing: {
          queue: 'quality_assurance_tasks',
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

  createCreativePrompt() {
    return PromptTemplate.fromTemplate(`
You are a Creative Agent with advanced reasoning capabilities specialized in content synthesis, storytelling, and engaging communication. Before creating content, think through your approach step by step.

REASONING PHASE:
1. First, analyze the content structure and identify key themes, insights, and narrative elements
2. Consider the target audience and determine the most effective tone and style
3. Plan the creative approach that will best engage and inform the audience
4. Think about how to balance creativity with accuracy and factual integrity
5. Consider what supporting evidence and citations will strengthen the content
6. Plan the optimal structure for maximum impact and clarity

Content to Process: {content}
Creative Type: {creativeType}
Session ID: {sessionId}
Orchestration ID: {orchestrationId}

STEP-BY-STEP CREATIVE PROCESS:
1. Content Analysis: What are the core themes, insights, and key messages?
2. Audience Consideration: Who is the target audience and what tone will resonate?
3. Creative Strategy: What creative approach will be most effective?
4. Structure Planning: How should the content be organized for maximum impact?
5. Evidence Integration: What supporting evidence and citations are needed?
6. Quality Assurance: How can accuracy be maintained while enhancing creativity?

Available tools: {tools}

Think through your reasoning process, then provide structured creative output with:
- Executive Summary (with confidence assessment)
- Main Content/Narrative (with reasoning for creative choices)
- Key Takeaways (prioritized by importance)
- Call to Action (with justification for approach)
- Supporting Evidence (with source credibility assessment)
- Style and Tone Assessment (with audience fit analysis)
- Confidence Score (0.0-1.0) and reasoning for your creative decisions

Content: {content}

{agent_scratchpad}`);
  }

  initializeCreativeTools() {
    const tools = [];

    tools.push(new DynamicTool({
      name: 'think',
      description: 'Think through creative challenges step by step, explore different creative approaches, and reason about the most engaging solution',
      func: async (input) => {
        try {
          const thinkPrompt = PromptTemplate.fromTemplate(`
You are working through a creative challenge. Break down your creative reasoning step by step.

Creative Challenge: {problem}

Think through this systematically:
1. What is the core creative goal or message I want to convey?
2. Who is my target audience and what will resonate with them?
3. What creative approaches or styles could I use?
4. What are the strengths and potential impact of each approach?
5. How can I balance creativity with clarity and effectiveness?
6. What is my recommended creative direction and why?
7. What creative risks should I consider?
8. How will I measure the success of this creative approach?

Provide your step-by-step creative reasoning:
`);

          const chain = thinkPrompt.pipe(this.llm).pipe(new StringOutputParser());
          const thinking = await chain.invoke({ problem: input });
          
          return `CREATIVE THINKING PROCESS:\n${thinking}`;
        } catch (error) {
          return `Thinking error: ${error.message}`;
        }
      }
    }));

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

    // Add standardized web browsing tools
    const webTools = WebBrowsingUtils.createWebBrowsingTools();
    tools.push(...webTools);

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
