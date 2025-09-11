// Reasoning Framework - Enhanced cognitive capabilities for all agents
const { logger } = require('./logger');

class ReasoningFramework {
  constructor(agentName) {
    this.agentName = agentName;
    this.reasoningLogs = [];
    this.confidenceThresholds = {
      high: 0.8,
      medium: 0.6,
      low: 0.4
    };
  }

  // Pre-task planning and strategy reasoning
  async planStrategy(task, context = {}) {
    const planningStart = Date.now();
    
    const strategyPlan = {
      task_analysis: this.analyzeTask(task),
      approach_options: this.generateApproachOptions(task, context),
      selected_strategy: null,
      reasoning: '',
      confidence: 0,
      estimated_complexity: 'medium',
      resource_requirements: [],
      success_criteria: [],
      potential_challenges: [],
      mitigation_strategies: [],
      planning_time_ms: 0
    };

    // Analyze task complexity and requirements
    strategyPlan.task_analysis = this.analyzeTask(task);
    strategyPlan.approach_options = this.generateApproachOptions(task, context);
    
    // Select optimal strategy
    const selectedStrategy = this.selectOptimalStrategy(strategyPlan.approach_options, context);
    strategyPlan.selected_strategy = selectedStrategy.strategy;
    strategyPlan.reasoning = selectedStrategy.reasoning;
    strategyPlan.confidence = selectedStrategy.confidence;
    
    // Define success criteria and challenges
    strategyPlan.success_criteria = this.defineSuccessCriteria(task, selectedStrategy.strategy);
    strategyPlan.potential_challenges = this.identifyPotentialChallenges(task, selectedStrategy.strategy);
    strategyPlan.mitigation_strategies = this.developMitigationStrategies(strategyPlan.potential_challenges);
    
    strategyPlan.planning_time_ms = Date.now() - planningStart;
    
    this.logReasoning('strategy_planning', strategyPlan);
    
    return strategyPlan;
  }

  // Self-evaluation of outputs
  async evaluateOutput(output, originalTask, strategyPlan) {
    const evaluationStart = Date.now();
    
    const evaluation = {
      output_quality: this.assessOutputQuality(output, originalTask),
      completeness: this.assessCompleteness(output, strategyPlan.success_criteria),
      accuracy: this.assessAccuracy(output, originalTask),
      relevance: this.assessRelevance(output, originalTask),
      clarity: this.assessClarity(output),
      confidence_score: 0,
      strengths: [],
      weaknesses: [],
      improvement_suggestions: [],
      meets_success_criteria: false,
      overall_rating: 'pending',
      evaluation_time_ms: 0
    };

    // Calculate overall confidence score
    evaluation.confidence_score = this.calculateOverallConfidence([
      evaluation.output_quality,
      evaluation.completeness,
      evaluation.accuracy,
      evaluation.relevance,
      evaluation.clarity
    ]);

    // Determine if success criteria are met
    evaluation.meets_success_criteria = this.checkSuccessCriteria(output, strategyPlan.success_criteria);
    
    // Identify strengths and weaknesses
    evaluation.strengths = this.identifyStrengths(output, evaluation);
    evaluation.weaknesses = this.identifyWeaknesses(output, evaluation);
    evaluation.improvement_suggestions = this.generateImprovementSuggestions(evaluation.weaknesses);
    
    // Overall rating
    evaluation.overall_rating = this.determineOverallRating(evaluation.confidence_score);
    
    evaluation.evaluation_time_ms = Date.now() - evaluationStart;
    
    this.logReasoning('self_evaluation', evaluation);
    
    return evaluation;
  }

  // Reflection and continuous improvement
  async reflect(taskHistory, performanceMetrics) {
    const reflectionStart = Date.now();
    
    const reflection = {
      performance_trends: this.analyzePerformanceTrends(performanceMetrics),
      common_challenges: this.identifyCommonChallenges(taskHistory),
      successful_strategies: this.identifySuccessfulStrategies(taskHistory),
      areas_for_improvement: [],
      learning_insights: [],
      strategy_adjustments: [],
      confidence_calibration: this.calibrateConfidence(taskHistory),
      reflection_time_ms: 0
    };

    // Identify improvement areas
    reflection.areas_for_improvement = this.identifyImprovementAreas(taskHistory, performanceMetrics);
    reflection.learning_insights = this.extractLearningInsights(taskHistory, reflection.performance_trends);
    reflection.strategy_adjustments = this.recommendStrategyAdjustments(reflection);
    
    reflection.reflection_time_ms = Date.now() - reflectionStart;
    
    this.logReasoning('reflection', reflection);
    
    return reflection;
  }

  // Task analysis
  analyzeTask(task) {
    const taskStr = typeof task === 'string' ? task : JSON.stringify(task);
    
    return {
      type: this.classifyTaskType(taskStr),
      complexity: this.assessTaskComplexity(taskStr),
      domain: this.identifyDomain(taskStr),
      requirements: this.extractRequirements(taskStr),
      constraints: this.identifyConstraints(taskStr),
      expected_output_type: this.determineExpectedOutputType(taskStr)
    };
  }

  // Generate approach options
  generateApproachOptions(task, context) {
    const approaches = [];
    
    // Direct approach
    approaches.push({
      name: 'direct',
      description: 'Straightforward execution based on task requirements',
      pros: ['Fast execution', 'Simple implementation'],
      cons: ['May miss nuances', 'Limited creativity'],
      estimated_time: 'short',
      confidence: 0.7
    });

    // Analytical approach
    approaches.push({
      name: 'analytical',
      description: 'Deep analysis before execution with structured methodology',
      pros: ['Thorough understanding', 'High accuracy'],
      cons: ['Longer execution time', 'May over-analyze'],
      estimated_time: 'medium',
      confidence: 0.8
    });

    // Creative approach
    approaches.push({
      name: 'creative',
      description: 'Innovative problem-solving with multiple perspectives',
      pros: ['Novel solutions', 'Comprehensive coverage'],
      cons: ['Unpredictable results', 'Resource intensive'],
      estimated_time: 'long',
      confidence: 0.6
    });

    // Iterative approach
    approaches.push({
      name: 'iterative',
      description: 'Step-by-step refinement with continuous improvement',
      pros: ['Adaptive execution', 'Quality improvement'],
      cons: ['Multiple iterations needed', 'Time consuming'],
      estimated_time: 'variable',
      confidence: 0.75
    });

    return approaches;
  }

  // Select optimal strategy
  selectOptimalStrategy(approaches, context) {
    let bestStrategy = approaches[0];
    let bestScore = 0;
    let reasoning = '';

    for (const approach of approaches) {
      let score = approach.confidence;
      
      // Adjust score based on context
      if (context.time_constraint === 'urgent' && approach.estimated_time === 'short') {
        score += 0.2;
      }
      if (context.quality_priority === 'high' && approach.name === 'analytical') {
        score += 0.15;
      }
      if (context.creativity_needed === true && approach.name === 'creative') {
        score += 0.1;
      }

      if (score > bestScore) {
        bestScore = score;
        bestStrategy = approach;
      }
    }

    reasoning = `Selected ${bestStrategy.name} approach with score ${bestScore.toFixed(2)}. ` +
               `Key factors: ${bestStrategy.pros.join(', ')}. ` +
               `Considerations: ${bestStrategy.cons.join(', ')}.`;

    return {
      strategy: bestStrategy,
      confidence: bestScore,
      reasoning: reasoning
    };
  }

  // Assessment methods
  assessOutputQuality(output, task) {
    // Simple heuristic-based quality assessment
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
    let score = 0.5; // Base score

    // Length appropriateness
    if (outputStr.length > 50 && outputStr.length < 5000) score += 0.1;
    
    // Structure indicators
    if (outputStr.includes('\n') || typeof output === 'object') score += 0.1;
    
    // Content richness
    const sentences = outputStr.split(/[.!?]+/).length;
    if (sentences > 3) score += 0.1;
    
    // Relevance keywords (basic check)
    const taskStr = typeof task === 'string' ? task : JSON.stringify(task);
    const taskWords = taskStr.toLowerCase().split(/\s+/);
    const outputWords = outputStr.toLowerCase().split(/\s+/);
    const overlap = taskWords.filter(word => outputWords.includes(word)).length;
    const relevanceScore = Math.min(overlap / Math.max(taskWords.length, 1), 0.2);
    score += relevanceScore;

    return Math.min(score, 1.0);
  }

  assessCompleteness(output, successCriteria) {
    if (!successCriteria || successCriteria.length === 0) return 0.7;
    
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
    let metCriteria = 0;
    
    for (const criterion of successCriteria) {
      if (outputStr.toLowerCase().includes(criterion.toLowerCase())) {
        metCriteria++;
      }
    }
    
    return metCriteria / successCriteria.length;
  }

  assessAccuracy(output, task) {
    // Placeholder for accuracy assessment
    // In a real implementation, this would involve domain-specific validation
    return 0.75;
  }

  assessRelevance(output, task) {
    const taskStr = typeof task === 'string' ? task : JSON.stringify(task);
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
    
    const taskWords = new Set(taskStr.toLowerCase().split(/\s+/));
    const outputWords = outputStr.toLowerCase().split(/\s+/);
    
    const relevantWords = outputWords.filter(word => taskWords.has(word));
    return Math.min(relevantWords.length / Math.max(outputWords.length, 1), 1.0);
  }

  assessClarity(output) {
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
    let score = 0.5;
    
    // Sentence structure
    const sentences = outputStr.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;
    
    if (avgSentenceLength > 5 && avgSentenceLength < 25) score += 0.2;
    
    // Paragraph structure
    if (outputStr.includes('\n\n') || outputStr.includes('\n-') || outputStr.includes('\n•')) score += 0.1;
    
    // Avoid excessive complexity
    const complexWords = outputStr.match(/\b\w{10,}\b/g) || [];
    if (complexWords.length / outputStr.split(/\s+/).length < 0.1) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  calculateOverallConfidence(scores) {
    const validScores = scores.filter(score => typeof score === 'number' && !isNaN(score));
    if (validScores.length === 0) return 0.5;
    
    const average = validScores.reduce((sum, score) => sum + score, 0) / validScores.length;
    return Math.min(Math.max(average, 0), 1);
  }

  // Helper methods
  classifyTaskType(taskStr) {
    const taskLower = taskStr.toLowerCase();
    
    if (taskLower.includes('research') || taskLower.includes('find') || taskLower.includes('analyze')) {
      return 'research';
    } else if (taskLower.includes('create') || taskLower.includes('generate') || taskLower.includes('write')) {
      return 'creative';
    } else if (taskLower.includes('plan') || taskLower.includes('organize') || taskLower.includes('schedule')) {
      return 'planning';
    } else if (taskLower.includes('execute') || taskLower.includes('run') || taskLower.includes('implement')) {
      return 'execution';
    } else {
      return 'general';
    }
  }

  assessTaskComplexity(taskStr) {
    let complexity = 0;
    
    // Word count
    const wordCount = taskStr.split(/\s+/).length;
    if (wordCount > 50) complexity += 0.3;
    else if (wordCount > 20) complexity += 0.2;
    else complexity += 0.1;
    
    // Multiple requirements
    const requirements = (taskStr.match(/\band\b|\bor\b|\balso\b|\badditionally\b/gi) || []).length;
    complexity += Math.min(requirements * 0.1, 0.3);
    
    // Technical terms
    const technicalTerms = (taskStr.match(/\b(algorithm|database|api|framework|architecture|implementation)\b/gi) || []).length;
    complexity += Math.min(technicalTerms * 0.1, 0.2);
    
    if (complexity > 0.7) return 'high';
    if (complexity > 0.4) return 'medium';
    return 'low';
  }

  identifyDomain(taskStr) {
    const taskLower = taskStr.toLowerCase();
    
    if (taskLower.match(/\b(code|programming|software|development|algorithm)\b/)) return 'technology';
    if (taskLower.match(/\b(business|market|strategy|finance|revenue)\b/)) return 'business';
    if (taskLower.match(/\b(research|analysis|data|study|investigation)\b/)) return 'research';
    if (taskLower.match(/\b(creative|design|content|writing|art)\b/)) return 'creative';
    if (taskLower.match(/\b(plan|project|manage|organize|coordinate)\b/)) return 'management';
    
    return 'general';
  }

  extractRequirements(taskStr) {
    const requirements = [];
    
    // Look for explicit requirements
    const reqPatterns = [
      /must\s+([^.!?]+)/gi,
      /should\s+([^.!?]+)/gi,
      /need\s+to\s+([^.!?]+)/gi,
      /require[sd]?\s+([^.!?]+)/gi
    ];
    
    for (const pattern of reqPatterns) {
      const matches = taskStr.match(pattern);
      if (matches) {
        requirements.push(...matches.map(match => match.trim()));
      }
    }
    
    return requirements.slice(0, 5); // Limit to 5 requirements
  }

  identifyConstraints(taskStr) {
    const constraints = [];
    const taskLower = taskStr.toLowerCase();
    
    if (taskLower.includes('quickly') || taskLower.includes('urgent') || taskLower.includes('asap')) {
      constraints.push('time_sensitive');
    }
    if (taskLower.includes('budget') || taskLower.includes('cost') || taskLower.includes('cheap')) {
      constraints.push('budget_limited');
    }
    if (taskLower.includes('simple') || taskLower.includes('basic') || taskLower.includes('minimal')) {
      constraints.push('simplicity_required');
    }
    if (taskLower.includes('detailed') || taskLower.includes('comprehensive') || taskLower.includes('thorough')) {
      constraints.push('detail_required');
    }
    
    return constraints;
  }

  determineExpectedOutputType(taskStr) {
    const taskLower = taskStr.toLowerCase();
    
    if (taskLower.includes('list') || taskLower.includes('bullet')) return 'list';
    if (taskLower.includes('report') || taskLower.includes('document')) return 'document';
    if (taskLower.includes('code') || taskLower.includes('script')) return 'code';
    if (taskLower.includes('plan') || taskLower.includes('strategy')) return 'plan';
    if (taskLower.includes('analysis') || taskLower.includes('evaluation')) return 'analysis';
    
    return 'text';
  }

  defineSuccessCriteria(task, strategy) {
    const criteria = [];
    const taskStr = typeof task === 'string' ? task : JSON.stringify(task);
    
    // Basic criteria based on task type
    if (strategy.name === 'analytical') {
      criteria.push('thorough analysis', 'evidence-based conclusions', 'structured presentation');
    } else if (strategy.name === 'creative') {
      criteria.push('innovative approach', 'multiple perspectives', 'engaging content');
    } else if (strategy.name === 'direct') {
      criteria.push('clear answer', 'concise delivery', 'addresses main points');
    }
    
    // Task-specific criteria
    if (taskStr.toLowerCase().includes('research')) {
      criteria.push('credible sources', 'comprehensive coverage');
    }
    if (taskStr.toLowerCase().includes('plan')) {
      criteria.push('actionable steps', 'realistic timeline');
    }
    
    return criteria.slice(0, 5);
  }

  identifyPotentialChallenges(task, strategy) {
    const challenges = [];
    
    // Strategy-specific challenges
    if (strategy.name === 'analytical') {
      challenges.push('analysis paralysis', 'information overload', 'time constraints');
    } else if (strategy.name === 'creative') {
      challenges.push('scope creep', 'quality consistency', 'resource requirements');
    } else if (strategy.name === 'direct') {
      challenges.push('oversimplification', 'missing nuances', 'incomplete coverage');
    }
    
    return challenges;
  }

  developMitigationStrategies(challenges) {
    const mitigations = [];
    
    for (const challenge of challenges) {
      switch (challenge) {
        case 'analysis paralysis':
          mitigations.push('Set clear analysis boundaries and time limits');
          break;
        case 'information overload':
          mitigations.push('Prioritize most relevant information sources');
          break;
        case 'scope creep':
          mitigations.push('Define clear project boundaries upfront');
          break;
        case 'time constraints':
          mitigations.push('Break down into smaller, manageable tasks');
          break;
        default:
          mitigations.push(`Monitor and address ${challenge} proactively`);
      }
    }
    
    return mitigations;
  }

  checkSuccessCriteria(output, criteria) {
    if (!criteria || criteria.length === 0) return true;
    
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output);
    let metCriteria = 0;
    
    for (const criterion of criteria) {
      // Simple keyword matching - could be enhanced with NLP
      if (outputStr.toLowerCase().includes(criterion.toLowerCase()) ||
          this.semanticMatch(outputStr, criterion)) {
        metCriteria++;
      }
    }
    
    return metCriteria >= Math.ceil(criteria.length * 0.7); // 70% threshold
  }

  semanticMatch(text, criterion) {
    // Simple semantic matching based on related terms
    const semanticMaps = {
      'thorough analysis': ['detailed', 'comprehensive', 'in-depth', 'extensive'],
      'evidence-based': ['data', 'research', 'studies', 'facts', 'statistics'],
      'structured presentation': ['organized', 'sections', 'headings', 'bullet points'],
      'innovative approach': ['creative', 'novel', 'unique', 'original'],
      'actionable steps': ['steps', 'actions', 'tasks', 'implementation']
    };
    
    const relatedTerms = semanticMaps[criterion] || [];
    return relatedTerms.some(term => text.toLowerCase().includes(term));
  }

  identifyStrengths(output, evaluation) {
    const strengths = [];
    
    if (evaluation.output_quality > 0.8) strengths.push('High output quality');
    if (evaluation.completeness > 0.8) strengths.push('Comprehensive coverage');
    if (evaluation.accuracy > 0.8) strengths.push('High accuracy');
    if (evaluation.relevance > 0.8) strengths.push('Highly relevant content');
    if (evaluation.clarity > 0.8) strengths.push('Clear and well-structured');
    
    return strengths;
  }

  identifyWeaknesses(output, evaluation) {
    const weaknesses = [];
    
    if (evaluation.output_quality < 0.6) weaknesses.push('Output quality needs improvement');
    if (evaluation.completeness < 0.6) weaknesses.push('Incomplete coverage of requirements');
    if (evaluation.accuracy < 0.6) weaknesses.push('Accuracy concerns identified');
    if (evaluation.relevance < 0.6) weaknesses.push('Limited relevance to task');
    if (evaluation.clarity < 0.6) weaknesses.push('Clarity and structure issues');
    
    return weaknesses;
  }

  generateImprovementSuggestions(weaknesses) {
    const suggestions = [];
    
    for (const weakness of weaknesses) {
      switch (weakness) {
        case 'Output quality needs improvement':
          suggestions.push('Focus on content depth and detail enhancement');
          break;
        case 'Incomplete coverage of requirements':
          suggestions.push('Review all task requirements and ensure comprehensive coverage');
          break;
        case 'Accuracy concerns identified':
          suggestions.push('Implement additional fact-checking and validation steps');
          break;
        case 'Limited relevance to task':
          suggestions.push('Improve task analysis and maintain focus on core objectives');
          break;
        case 'Clarity and structure issues':
          suggestions.push('Enhance organization with clear headings and logical flow');
          break;
        default:
          suggestions.push(`Address ${weakness} through targeted improvements`);
      }
    }
    
    return suggestions;
  }

  determineOverallRating(confidenceScore) {
    if (confidenceScore >= this.confidenceThresholds.high) return 'excellent';
    if (confidenceScore >= this.confidenceThresholds.medium) return 'good';
    if (confidenceScore >= this.confidenceThresholds.low) return 'acceptable';
    return 'needs_improvement';
  }

  // Placeholder methods for reflection (would be enhanced with actual data)
  analyzePerformanceTrends(metrics) {
    return {
      trend: 'stable',
      average_confidence: 0.75,
      improvement_rate: 0.05,
      consistency: 'high'
    };
  }

  identifyCommonChallenges(taskHistory) {
    return ['time_management', 'complexity_assessment', 'resource_allocation'];
  }

  identifySuccessfulStrategies(taskHistory) {
    return ['analytical_approach', 'iterative_refinement', 'structured_planning'];
  }

  identifyImprovementAreas(taskHistory, metrics) {
    return ['confidence_calibration', 'strategy_selection', 'output_evaluation'];
  }

  extractLearningInsights(taskHistory, trends) {
    return [
      'Analytical approaches yield higher accuracy',
      'Time constraints affect output quality',
      'Structured planning improves success rates'
    ];
  }

  recommendStrategyAdjustments(reflection) {
    return [
      'Increase time allocation for complex tasks',
      'Implement more rigorous self-evaluation',
      'Enhance strategy selection criteria'
    ];
  }

  calibrateConfidence(taskHistory) {
    return {
      overconfidence_bias: 0.1,
      underconfidence_bias: 0.05,
      calibration_accuracy: 0.8,
      recommended_adjustment: 'slight_decrease'
    };
  }

  // Logging and debugging
  logReasoning(type, data) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      agent: this.agentName,
      type: type,
      data: data
    };
    
    this.reasoningLogs.push(logEntry);
    
    // Log to system logger for debugging
    logger.info(`Reasoning [${this.agentName}] ${type}`, {
      confidence: data.confidence || data.confidence_score,
      summary: this.summarizeReasoning(type, data)
    });
  }

  summarizeReasoning(type, data) {
    switch (type) {
      case 'strategy_planning':
        return `Selected ${data.selected_strategy?.name} strategy with ${(data.confidence * 100).toFixed(1)}% confidence`;
      case 'self_evaluation':
        return `Output rated ${data.overall_rating} with ${(data.confidence_score * 100).toFixed(1)}% confidence`;
      case 'reflection':
        return `Identified ${data.areas_for_improvement?.length || 0} improvement areas`;
      default:
        return 'Reasoning completed';
    }
  }

  getReasoningLogs() {
    return this.reasoningLogs;
  }

  clearReasoningLogs() {
    this.reasoningLogs = [];
  }
}

module.exports = { ReasoningFramework };
