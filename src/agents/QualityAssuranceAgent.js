// Quality Assurance Agent - Output Validation and Quality Control
const { ChatOpenAI } = require('@langchain/openai');
const { AgentExecutor, createOpenAIFunctionsAgent } = require('langchain/agents');
const { DynamicTool } = require('@langchain/core/tools');
const { PromptTemplate } = require('@langchain/core/prompts');
const { logger } = require('../utils/logger');
const { databaseService } = require('../services/database');

class QualityAssuranceAgent {
  constructor() {
    this.llm = new ChatOpenAI({
      modelName: 'gpt-4',
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY,
      tags: ['qa-agent', 'athenai']
    });
    this.qualityStandards = {
      accuracy: 0.95,
      completeness: 0.90,
      clarity: 0.85,
      relevance: 0.90,
      consistency: 0.95
    };
  }

  async executeQualityAssurance(inputData) {
    const startTime = Date.now();
    const sessionId = inputData.sessionId || 'qa_session_' + Date.now();
    const orchestrationId = inputData.orchestrationId || 'qa_orchestration_' + Date.now();

    try {
      logger.info('Starting quality assurance task', { sessionId, orchestrationId });

      const taskData = inputData.task || inputData;
      const content = taskData.content || taskData.output || taskData.message;
      const qaType = taskData.qa_type || 'comprehensive';
      const standards = taskData.standards || this.qualityStandards;
      const context = taskData.context || {};

      if (!content) {
        throw new Error('Content is required for quality assurance');
      }

      // Initialize QA tools
      const tools = this.initializeQATools();

      // Create QA prompt
      const prompt = PromptTemplate.fromTemplate(`
You are a Quality Assurance Agent specialized in validating outputs, ensuring quality standards, and providing improvement recommendations.

Content to Review: {content}
QA Type: {qaType}
Quality Standards: {standards}
Context: {context}
Session ID: {sessionId}

Available tools: {tools}

Your responsibilities:
1. Validate content accuracy and factual correctness
2. Assess completeness and thoroughness
3. Evaluate clarity and readability
4. Check relevance to requirements
5. Ensure consistency and coherence
6. Identify potential issues and risks
7. Provide specific improvement recommendations
8. Generate quality scores and metrics

QA Types:
- comprehensive: Full quality assessment across all dimensions
- accuracy: Focus on factual correctness and reliability
- completeness: Assess if all requirements are met
- clarity: Evaluate readability and understandability
- consistency: Check for internal consistency and coherence
- compliance: Verify adherence to standards and guidelines
- security: Assess security implications and vulnerabilities
- performance: Evaluate efficiency and optimization

Current assessment: {qaType} review of provided content
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
        maxIterations: 12,
        returnIntermediateSteps: true
      });

      // Execute QA assessment
      const result = await agentExecutor.invoke({
        content: typeof content === 'object' ? JSON.stringify(content) : content,
        qaType,
        standards: JSON.stringify(standards),
        context: JSON.stringify(context),
        sessionId,
        tools: tools.map(t => t.name).join(', ')
      });

      // Process and structure the results
      const qaResult = {
        session_id: sessionId,
        orchestration_id: orchestrationId,
        original_content: content,
        qa_type: qaType,
        standards,
        assessment: result.output,
        intermediate_steps: result.intermediateSteps,
        execution_time_ms: Date.now() - startTime,
        status: 'completed'
      };

      // Store results in knowledge graph
      await databaseService.createKnowledgeNode(
        sessionId,
        orchestrationId,
        'QualityAssurance',
        {
          qa_type: qaType,
          status: 'completed',
          created_at: new Date().toISOString()
        }
      );

      // Cache the QA context
      await databaseService.cacheSet(
        `qa:${orchestrationId}`,
        qaResult,
        3600 // 1 hour TTL
      );

      logger.info('Quality assurance completed', {
        sessionId,
        orchestrationId,
        qaType,
        executionTime: qaResult.execution_time_ms
      });

      return qaResult;

    } catch (error) {
      logger.error('Quality assurance failed', {
        sessionId,
        orchestrationId,
        error: error.message
      });

      return {
        session_id: sessionId,
        orchestration_id: orchestrationId,
        error: error.message,
        status: 'failed',
        execution_time_ms: Date.now() - startTime
      };
    }
  }

  initializeQATools() {
    return [
      // Content Validation Tool
      new DynamicTool({
        name: 'validate_content',
        description: 'Validate content accuracy and factual correctness',
        func: async (input) => {
          try {
            const { content, validationType, references } = JSON.parse(input);
            const validation = await this.validateContent(content, validationType, references);
            return JSON.stringify(validation);
          } catch (error) {
            return JSON.stringify({ error: error.message });
          }
        }
      }),

      // Completeness Assessment Tool
      new DynamicTool({
        name: 'assess_completeness',
        description: 'Assess if content meets all requirements and is complete',
        func: async (input) => {
          try {
            const { content, requirements, checklist } = JSON.parse(input);
            const assessment = await this.assessCompleteness(content, requirements, checklist);
            return JSON.stringify(assessment);
          } catch (error) {
            return JSON.stringify({ error: error.message });
          }
        }
      }),

      // Clarity Analysis Tool
      new DynamicTool({
        name: 'analyze_clarity',
        description: 'Analyze content clarity, readability, and understandability',
        func: async (input) => {
          try {
            const { content, audience, complexity } = JSON.parse(input);
            const analysis = await this.analyzeClarity(content, audience, complexity);
            return JSON.stringify(analysis);
          } catch (error) {
            return JSON.stringify({ error: error.message });
          }
        }
      }),

      // Consistency Check Tool
      new DynamicTool({
        name: 'check_consistency',
        description: 'Check internal consistency and coherence',
        func: async (input) => {
          try {
            const { content, previousContent, standards } = JSON.parse(input);
            const consistency = await this.checkConsistency(content, previousContent, standards);
            return JSON.stringify(consistency);
          } catch (error) {
            return JSON.stringify({ error: error.message });
          }
        }
      }),

      // Security Assessment Tool
      new DynamicTool({
        name: 'assess_security',
        description: 'Assess security implications and vulnerabilities',
        func: async (input) => {
          try {
            const { content, contentType, securityLevel } = JSON.parse(input);
            const security = await this.assessSecurity(content, contentType, securityLevel);
            return JSON.stringify(security);
          } catch (error) {
            return JSON.stringify({ error: error.message });
          }
        }
      }),

      // Performance Evaluation Tool
      new DynamicTool({
        name: 'evaluate_performance',
        description: 'Evaluate performance and optimization aspects',
        func: async (input) => {
          try {
            const { content, metrics, benchmarks } = JSON.parse(input);
            const performance = await this.evaluatePerformance(content, metrics, benchmarks);
            return JSON.stringify(performance);
          } catch (error) {
            return JSON.stringify({ error: error.message });
          }
        }
      }),

      // Quality Scoring Tool
      new DynamicTool({
        name: 'calculate_quality_score',
        description: 'Calculate overall quality score and metrics',
        func: async (input) => {
          try {
            const { assessments, weights, standards } = JSON.parse(input);
            const score = await this.calculateQualityScore(assessments, weights, standards);
            return JSON.stringify(score);
          } catch (error) {
            return JSON.stringify({ error: error.message });
          }
        }
      }),

      // Improvement Recommendations Tool
      new DynamicTool({
        name: 'generate_recommendations',
        description: 'Generate specific improvement recommendations',
        func: async (input) => {
          try {
            const { issues, context, priorities } = JSON.parse(input);
            const recommendations = await this.generateRecommendations(issues, context, priorities);
            return JSON.stringify(recommendations);
          } catch (error) {
            return JSON.stringify({ error: error.message });
          }
        }
      })
    ];
  }

  async validateContent(content, validationType = 'general', references = []) {
    const validationPrompt = `Validate this content for accuracy and factual correctness:

Content: ${content}
Validation Type: ${validationType}
References: ${JSON.stringify(references)}

Perform ${validationType} validation focusing on:
1. Factual accuracy and correctness
2. Logical consistency and reasoning
3. Data integrity and reliability
4. Source credibility and citations
5. Claims substantiation
6. Potential misinformation or errors

Provide detailed validation results with:
- Accuracy score (0-1)
- Specific issues found
- Confidence level in assessment
- Recommendations for improvement
- Required fact-checking areas`;

    const response = await this.llm.invoke(validationPrompt);
    
    return {
      content_length: content.length,
      validation_type: validationType,
      validation_result: response.content,
      timestamp: new Date().toISOString()
    };
  }

  async assessCompleteness(content, requirements = [], checklist = []) {
    const completenessPrompt = `Assess the completeness of this content:

Content: ${content}
Requirements: ${JSON.stringify(requirements)}
Checklist: ${JSON.stringify(checklist)}

Evaluate completeness by checking:
1. All specified requirements are addressed
2. No critical information is missing
3. Appropriate level of detail provided
4. All checklist items are covered
5. Logical flow and structure completeness
6. Supporting evidence and examples included

Provide assessment with:
- Completeness score (0-1)
- Missing elements identified
- Coverage analysis
- Gaps and omissions
- Recommendations for completion`;

    const response = await this.llm.invoke(completenessPrompt);
    
    return {
      requirements_count: requirements.length,
      checklist_items: checklist.length,
      completeness_assessment: response.content,
      timestamp: new Date().toISOString()
    };
  }

  async analyzeClarity(content, audience = 'general', complexity = 'medium') {
    const clarityPrompt = `Analyze the clarity and readability of this content:

Content: ${content}
Target Audience: ${audience}
Complexity Level: ${complexity}

Evaluate clarity across:
1. Language appropriateness for audience
2. Sentence structure and length
3. Technical jargon usage
4. Logical organization and flow
5. Use of examples and illustrations
6. Overall comprehensibility

Provide analysis with:
- Clarity score (0-1)
- Readability assessment
- Language complexity evaluation
- Structure and organization review
- Specific improvement suggestions
- Audience alignment assessment`;

    const response = await this.llm.invoke(clarityPrompt);
    
    return {
      content_length: content.length,
      target_audience: audience,
      complexity_level: complexity,
      clarity_analysis: response.content,
      timestamp: new Date().toISOString()
    };
  }

  async checkConsistency(content, previousContent = null, standards = {}) {
    const consistencyPrompt = `Check the consistency and coherence of this content:

Current Content: ${content}
Previous Content: ${previousContent || 'None provided'}
Standards: ${JSON.stringify(standards)}

Evaluate consistency in:
1. Terminology and vocabulary usage
2. Style and tone consistency
3. Format and structure alignment
4. Logical coherence and flow
5. Cross-references and links
6. Standards compliance

${previousContent ? 'Also check consistency with previous content for:' : ''}
${previousContent ? '- Continuity and alignment' : ''}
${previousContent ? '- Contradictions or conflicts' : ''}
${previousContent ? '- Style and approach consistency' : ''}

Provide consistency assessment with:
- Consistency score (0-1)
- Issues and inconsistencies found
- Standards compliance evaluation
- Recommendations for improvement`;

    const response = await this.llm.invoke(consistencyPrompt);
    
    return {
      has_previous_content: !!previousContent,
      standards_provided: Object.keys(standards).length > 0,
      consistency_check: response.content,
      timestamp: new Date().toISOString()
    };
  }

  async assessSecurity(content, contentType = 'general', securityLevel = 'standard') {
    const securityPrompt = `Assess security implications and vulnerabilities in this content:

Content: ${content}
Content Type: ${contentType}
Security Level: ${securityLevel}

Evaluate security aspects:
1. Sensitive information exposure
2. Privacy and data protection
3. Security vulnerabilities mentioned
4. Potential misuse scenarios
5. Compliance with security standards
6. Risk assessment and mitigation

For code content, also check:
- Input validation and sanitization
- Authentication and authorization
- Encryption and data protection
- Error handling and information leakage
- Dependency security

Provide security assessment with:
- Security score (0-1)
- Vulnerabilities identified
- Risk level assessment
- Mitigation recommendations
- Compliance evaluation`;

    const response = await this.llm.invoke(securityPrompt);
    
    return {
      content_type: contentType,
      security_level: securityLevel,
      security_assessment: response.content,
      timestamp: new Date().toISOString()
    };
  }

  async evaluatePerformance(content, metrics = [], benchmarks = {}) {
    const performancePrompt = `Evaluate performance and optimization aspects of this content:

Content: ${content}
Metrics: ${JSON.stringify(metrics)}
Benchmarks: ${JSON.stringify(benchmarks)}

Evaluate performance in:
1. Efficiency and optimization
2. Resource utilization
3. Scalability considerations
4. Response time and latency
5. Throughput and capacity
6. Cost-effectiveness

For technical content, also assess:
- Algorithm efficiency
- Memory usage optimization
- Network and I/O efficiency
- Caching strategies
- Load balancing considerations

Provide performance evaluation with:
- Performance score (0-1)
- Optimization opportunities
- Bottlenecks identified
- Benchmark comparisons
- Improvement recommendations`;

    const response = await this.llm.invoke(performancePrompt);
    
    return {
      metrics_count: metrics.length,
      benchmarks_provided: Object.keys(benchmarks).length > 0,
      performance_evaluation: response.content,
      timestamp: new Date().toISOString()
    };
  }

  async calculateQualityScore(assessments, weights = {}, standards = {}) {
    // Default weights if not provided
    const defaultWeights = {
      accuracy: 0.25,
      completeness: 0.20,
      clarity: 0.20,
      consistency: 0.15,
      security: 0.10,
      performance: 0.10
    };

    const finalWeights = { ...defaultWeights, ...weights };
    let totalScore = 0;
    let totalWeight = 0;

    // Calculate weighted score
    for (const [dimension, weight] of Object.entries(finalWeights)) {
      if (assessments[dimension] !== undefined) {
        totalScore += assessments[dimension] * weight;
        totalWeight += weight;
      }
    }

    const overallScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    // Determine quality level
    let qualityLevel;
    if (overallScore >= 0.9) qualityLevel = 'excellent';
    else if (overallScore >= 0.8) qualityLevel = 'good';
    else if (overallScore >= 0.7) qualityLevel = 'acceptable';
    else if (overallScore >= 0.6) qualityLevel = 'needs_improvement';
    else qualityLevel = 'poor';

    return {
      overall_score: overallScore,
      quality_level: qualityLevel,
      dimension_scores: assessments,
      weights_used: finalWeights,
      standards_met: this.checkStandardsCompliance(assessments, standards),
      timestamp: new Date().toISOString()
    };
  }

  async generateRecommendations(issues, context = {}, priorities = []) {
    const recommendationPrompt = `Generate specific improvement recommendations based on these issues:

Issues Identified: ${JSON.stringify(issues)}
Context: ${JSON.stringify(context)}
Priorities: ${JSON.stringify(priorities)}

Generate actionable recommendations that:
1. Address each identified issue specifically
2. Provide clear, step-by-step guidance
3. Consider implementation complexity and effort
4. Align with stated priorities
5. Include expected impact and benefits
6. Suggest validation methods

Organize recommendations by:
- Priority level (high, medium, low)
- Implementation effort (quick wins, moderate, complex)
- Impact on quality (high, medium, low)
- Dependencies and prerequisites

Format as actionable items with:
- Clear description of the recommendation
- Rationale and expected benefits
- Implementation steps
- Success criteria
- Timeline estimates`;

    const response = await this.llm.invoke(recommendationPrompt);
    
    return {
      issues_count: Array.isArray(issues) ? issues.length : Object.keys(issues).length,
      priorities_provided: priorities.length,
      recommendations: response.content,
      timestamp: new Date().toISOString()
    };
  }

  checkStandardsCompliance(assessments, standards) {
    const compliance = {};
    
    for (const [standard, threshold] of Object.entries(standards)) {
      if (assessments[standard] !== undefined) {
        compliance[standard] = assessments[standard] >= threshold;
      }
    }
    
    return compliance;
  }
}

module.exports = { QualityAssuranceAgent };
