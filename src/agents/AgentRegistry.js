const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/agent_registry.log' }),
    new winston.transports.Console()
  ]
});

// Define agent capabilities
const AGENT_CAPABILITIES = {
  WEB_SEARCH: 'web_search',
  DATABASE_SEARCH: 'database_search',
  CODE_GENERATION: 'code_generation',
  DOCUMENT_ANALYSIS: 'document_analysis',
  EMAIL_PROCESSING: 'email_processing',
  RESEARCH_SYNTHESIS: 'research_synthesis',
  PLANNING: 'planning',
  QUALITY_ASSURANCE: 'quality_assurance',
  DATA_ANALYSIS: 'data_analysis',
  CREATIVE_WRITING: 'creative_writing',
  COMMUNICATION: 'communication',
  TASK_EXECUTION: 'task_execution',
  KNOWLEDGE_EXTRACTION: 'knowledge_extraction',
  PATTERN_RECOGNITION: 'pattern_recognition',
  PROBLEM_SOLVING: 'problem_solving'
};

// Define complexity levels
const COMPLEXITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  EXPERT: 'expert'
};

// Define domain classifications
const DOMAINS = {
  AI: 'ai',
  SOFTWARE: 'software',
  SECURITY: 'security',
  PERFORMANCE: 'performance',
  DATA: 'data',
  BUSINESS: 'business',
  RESEARCH: 'research',
  CREATIVE: 'creative',
  GENERAL: 'general'
};

// Agent profiles with enhanced capabilities and routing logic
const AGENT_PROFILES = {
  RESEARCH_AGENT: {
    id: 'research_agent',
    name: 'Research Specialist',
    description: 'Specializes in finding and synthesizing information from knowledge substrate first, then web sources',
    capabilities: [
      AGENT_CAPABILITIES.DATABASE_SEARCH,
      AGENT_CAPABILITIES.WEB_SEARCH,
      AGENT_CAPABILITIES.RESEARCH_SYNTHESIS,
      AGENT_CAPABILITIES.KNOWLEDGE_EXTRACTION,
      AGENT_CAPABILITIES.PATTERN_RECOGNITION
    ],
    tools: ['KnowledgeBaseTool', 'WebSearchTool', 'SynthesisTool', 'FactVerificationTool'],
    search_priority: 'knowledge_first',
    complexity_level: COMPLEXITY_LEVELS.MEDIUM,
    max_iterations: 5,
    domains: [DOMAINS.RESEARCH, DOMAINS.AI, DOMAINS.SOFTWARE, DOMAINS.GENERAL],
    routing_keywords: ['research', 'find', 'search', 'information', 'data', 'facts', 'investigate'],
    confidence_threshold: 0.7,
    performance_metrics: {
      accuracy: 0.85,
      speed: 0.75,
      thoroughness: 0.90
    }
  },

  ANALYSIS_AGENT: {
    id: 'analysis_agent',
    name: 'Data Analysis Specialist',
    description: 'Performs statistical analysis, trend detection, and data interpretation',
    capabilities: [
      AGENT_CAPABILITIES.DATA_ANALYSIS,
      AGENT_CAPABILITIES.PATTERN_RECOGNITION,
      AGENT_CAPABILITIES.DATABASE_SEARCH,
      AGENT_CAPABILITIES.PROBLEM_SOLVING
    ],
    tools: ['StatisticalAnalysisTool', 'TrendDetectionTool', 'CorrelationTool', 'VisualizationTool'],
    search_priority: 'data_first',
    complexity_level: COMPLEXITY_LEVELS.HIGH,
    max_iterations: 7,
    domains: [DOMAINS.DATA, DOMAINS.PERFORMANCE, DOMAINS.BUSINESS, DOMAINS.RESEARCH],
    routing_keywords: ['analyze', 'statistics', 'trends', 'patterns', 'metrics', 'performance', 'correlation'],
    confidence_threshold: 0.8,
    performance_metrics: {
      accuracy: 0.90,
      speed: 0.70,
      thoroughness: 0.85
    }
  },

  CREATIVE_AGENT: {
    id: 'creative_agent',
    name: 'Creative Content Specialist',
    description: 'Generates creative content, handles tone adaptation and engagement optimization',
    capabilities: [
      AGENT_CAPABILITIES.CREATIVE_WRITING,
      AGENT_CAPABILITIES.COMMUNICATION,
      AGENT_CAPABILITIES.RESEARCH_SYNTHESIS
    ],
    tools: ['ContentStructuringTool', 'ToneAdaptationTool', 'EngagementOptimizationTool'],
    search_priority: 'creative_first',
    complexity_level: COMPLEXITY_LEVELS.MEDIUM,
    max_iterations: 4,
    domains: [DOMAINS.CREATIVE, DOMAINS.BUSINESS, DOMAINS.GENERAL],
    routing_keywords: ['write', 'create', 'content', 'creative', 'story', 'marketing', 'engagement'],
    confidence_threshold: 0.6,
    performance_metrics: {
      accuracy: 0.75,
      speed: 0.85,
      thoroughness: 0.70
    }
  },

  DEVELOPMENT_AGENT: {
    id: 'development_agent',
    name: 'Software Development Specialist',
    description: 'Handles code generation, technical implementation, and software architecture',
    capabilities: [
      AGENT_CAPABILITIES.CODE_GENERATION,
      AGENT_CAPABILITIES.PROBLEM_SOLVING,
      AGENT_CAPABILITIES.DOCUMENT_ANALYSIS,
      AGENT_CAPABILITIES.PATTERN_RECOGNITION
    ],
    tools: ['CodeGenerationTool', 'ArchitectureTool', 'DebuggingTool', 'TestingTool'],
    search_priority: 'technical_first',
    complexity_level: COMPLEXITY_LEVELS.EXPERT,
    max_iterations: 8,
    domains: [DOMAINS.SOFTWARE, DOMAINS.AI, DOMAINS.SECURITY],
    routing_keywords: ['code', 'develop', 'programming', 'software', 'technical', 'implementation', 'debug'],
    confidence_threshold: 0.85,
    performance_metrics: {
      accuracy: 0.95,
      speed: 0.65,
      thoroughness: 0.90
    }
  },

  PLANNING_AGENT: {
    id: 'planning_agent',
    name: 'Project Planning Specialist',
    description: 'Handles project planning, task breakdown, and resource allocation',
    capabilities: [
      AGENT_CAPABILITIES.PLANNING,
      AGENT_CAPABILITIES.PROBLEM_SOLVING,
      AGENT_CAPABILITIES.RESEARCH_SYNTHESIS,
      AGENT_CAPABILITIES.DATA_ANALYSIS
    ],
    tools: ['ProjectPlanningTool', 'TaskBreakdownTool', 'ResourceAllocationTool', 'TimelineTool'],
    search_priority: 'structured_first',
    complexity_level: COMPLEXITY_LEVELS.HIGH,
    max_iterations: 6,
    domains: [DOMAINS.BUSINESS, DOMAINS.SOFTWARE, DOMAINS.GENERAL],
    routing_keywords: ['plan', 'project', 'organize', 'schedule', 'timeline', 'roadmap', 'strategy'],
    confidence_threshold: 0.75,
    performance_metrics: {
      accuracy: 0.80,
      speed: 0.75,
      thoroughness: 0.95
    }
  },

  EXECUTION_AGENT: {
    id: 'execution_agent',
    name: 'Task Execution Specialist',
    description: 'Manages task execution, workflow automation, and process optimization',
    capabilities: [
      AGENT_CAPABILITIES.TASK_EXECUTION,
      AGENT_CAPABILITIES.PROBLEM_SOLVING,
      AGENT_CAPABILITIES.PATTERN_RECOGNITION
    ],
    tools: ['WorkflowTool', 'AutomationTool', 'ProcessOptimizationTool', 'MonitoringTool'],
    search_priority: 'action_first',
    complexity_level: COMPLEXITY_LEVELS.MEDIUM,
    max_iterations: 5,
    domains: [DOMAINS.BUSINESS, DOMAINS.SOFTWARE, DOMAINS.GENERAL],
    routing_keywords: ['execute', 'run', 'automate', 'workflow', 'process', 'implement', 'deploy'],
    confidence_threshold: 0.70,
    performance_metrics: {
      accuracy: 0.85,
      speed: 0.90,
      thoroughness: 0.75
    }
  },

  COMMUNICATION_AGENT: {
    id: 'communication_agent',
    name: 'Communication Specialist',
    description: 'Handles external communications, message formatting, and stakeholder relations',
    capabilities: [
      AGENT_CAPABILITIES.COMMUNICATION,
      AGENT_CAPABILITIES.CREATIVE_WRITING,
      AGENT_CAPABILITIES.RESEARCH_SYNTHESIS
    ],
    tools: ['MessageFormattingTool', 'StakeholderAnalysisTool', 'CommunicationChannelTool'],
    search_priority: 'communication_first',
    complexity_level: COMPLEXITY_LEVELS.MEDIUM,
    max_iterations: 4,
    domains: [DOMAINS.BUSINESS, DOMAINS.GENERAL],
    routing_keywords: ['communicate', 'message', 'email', 'report', 'presentation', 'stakeholder'],
    confidence_threshold: 0.65,
    performance_metrics: {
      accuracy: 0.80,
      speed: 0.85,
      thoroughness: 0.75
    }
  },

  QUALITY_ASSURANCE_AGENT: {
    id: 'quality_assurance_agent',
    name: 'Quality Assurance Specialist',
    description: 'Performs output validation, testing, and quality review processes',
    capabilities: [
      AGENT_CAPABILITIES.QUALITY_ASSURANCE,
      AGENT_CAPABILITIES.PATTERN_RECOGNITION,
      AGENT_CAPABILITIES.PROBLEM_SOLVING,
      AGENT_CAPABILITIES.DATA_ANALYSIS
    ],
    tools: ['ValidationTool', 'TestingTool', 'QualityMetricsTool', 'ReviewTool'],
    search_priority: 'quality_first',
    complexity_level: COMPLEXITY_LEVELS.HIGH,
    max_iterations: 6,
    domains: [DOMAINS.SOFTWARE, DOMAINS.BUSINESS, DOMAINS.GENERAL],
    routing_keywords: ['test', 'validate', 'quality', 'review', 'check', 'verify', 'audit'],
    confidence_threshold: 0.85,
    performance_metrics: {
      accuracy: 0.95,
      speed: 0.70,
      thoroughness: 0.95
    }
  },

  DOCUMENT_AGENT: {
    id: 'document_agent',
    name: 'Document Intelligence Specialist',
    description: 'Specializes in document processing, analysis, and semantic search',
    capabilities: [
      AGENT_CAPABILITIES.DOCUMENT_ANALYSIS,
      AGENT_CAPABILITIES.KNOWLEDGE_EXTRACTION,
      AGENT_CAPABILITIES.DATABASE_SEARCH,
      AGENT_CAPABILITIES.PATTERN_RECOGNITION
    ],
    tools: ['DocumentProcessingTool', 'SemanticSearchTool', 'SummarizationTool', 'ExtractionTool'],
    search_priority: 'document_first',
    complexity_level: COMPLEXITY_LEVELS.HIGH,
    max_iterations: 5,
    domains: [DOMAINS.RESEARCH, DOMAINS.BUSINESS, DOMAINS.GENERAL],
    routing_keywords: ['document', 'file', 'text', 'extract', 'summarize', 'analyze', 'content'],
    confidence_threshold: 0.80,
    performance_metrics: {
      accuracy: 0.90,
      speed: 0.75,
      thoroughness: 0.85
    }
  },

  EMAIL_AGENT: {
    id: 'email_agent',
    name: 'Email Processing Specialist',
    description: 'Handles email processing, analysis, and automated responses',
    capabilities: [
      AGENT_CAPABILITIES.EMAIL_PROCESSING,
      AGENT_CAPABILITIES.COMMUNICATION,
      AGENT_CAPABILITIES.KNOWLEDGE_EXTRACTION,
      AGENT_CAPABILITIES.PATTERN_RECOGNITION
    ],
    tools: ['EmailProcessingTool', 'SentimentAnalysisTool', 'ResponseGenerationTool', 'ContactExtractionTool'],
    search_priority: 'email_first',
    complexity_level: COMPLEXITY_LEVELS.MEDIUM,
    max_iterations: 4,
    domains: [DOMAINS.BUSINESS, DOMAINS.COMMUNICATION, DOMAINS.GENERAL],
    routing_keywords: ['email', 'message', 'inbox', 'reply', 'contact', 'correspondence'],
    confidence_threshold: 0.75,
    performance_metrics: {
      accuracy: 0.85,
      speed: 0.80,
      thoroughness: 0.80
    }
  }
};

class AgentRegistry {
  constructor() {
    this.agents = new Map();
    this.loadedAgents = new Map();
    this.performanceHistory = new Map();
    
    // Initialize registry with agent profiles
    this.initializeRegistry();
  }

  initializeRegistry() {
    Object.values(AGENT_PROFILES).forEach(profile => {
      this.agents.set(profile.id, profile);
    });

    logger.info('Agent registry initialized', { 
      agentCount: this.agents.size,
      agents: Array.from(this.agents.keys())
    });
  }

  // Find the best agent for a given task
  findBestAgentForTask(task, context = {}) {
    try {
      logger.debug('Finding best agent for task', { 
        task: task.substring(0, 100),
        contextKeys: Object.keys(context)
      });

      const candidates = this.getCandidateAgents(task, context);
      
      if (candidates.length === 0) {
        logger.warn('No suitable agents found, defaulting to research agent');
        return this.agents.get('research_agent');
      }

      // Score candidates based on multiple factors
      const scoredCandidates = candidates.map(agent => ({
        agent,
        score: this.calculateAgentScore(agent, task, context)
      }));

      // Sort by score (descending)
      scoredCandidates.sort((a, b) => b.score - a.score);

      const selectedAgent = scoredCandidates[0].agent;
      
      logger.info('Agent selected for task', { 
        selectedAgent: selectedAgent.id,
        score: scoredCandidates[0].score,
        alternatives: scoredCandidates.slice(1, 3).map(c => ({
          agent: c.agent.id,
          score: c.score
        }))
      });

      return selectedAgent;

    } catch (error) {
      logger.error('Error finding best agent:', error);
      return this.agents.get('research_agent'); // Fallback
    }
  }

  getCandidateAgents(task, context) {
    const taskLower = task.toLowerCase();
    const candidates = [];

    // Check keyword matching
    for (const agent of this.agents.values()) {
      const keywordMatch = agent.routing_keywords.some(keyword => 
        taskLower.includes(keyword)
      );

      if (keywordMatch) {
        candidates.push(agent);
      }
    }

    // If no keyword matches, check domain and capability matching
    if (candidates.length === 0) {
      const inferredDomain = this.inferTaskDomain(task, context);
      const requiredCapabilities = this.inferRequiredCapabilities(task, context);

      for (const agent of this.agents.values()) {
        const domainMatch = agent.domains.includes(inferredDomain);
        const capabilityMatch = requiredCapabilities.some(cap => 
          agent.capabilities.includes(cap)
        );

        if (domainMatch || capabilityMatch) {
          candidates.push(agent);
        }
      }
    }

    return candidates;
  }

  calculateAgentScore(agent, task, context) {
    let score = 0;

    // Keyword relevance (30%)
    const taskLower = task.toLowerCase();
    const keywordMatches = agent.routing_keywords.filter(keyword => 
      taskLower.includes(keyword)
    ).length;
    score += (keywordMatches / agent.routing_keywords.length) * 0.3;

    // Domain relevance (25%)
    const inferredDomain = this.inferTaskDomain(task, context);
    if (agent.domains.includes(inferredDomain)) {
      score += 0.25;
    }

    // Capability match (25%)
    const requiredCapabilities = this.inferRequiredCapabilities(task, context);
    const capabilityMatches = requiredCapabilities.filter(cap => 
      agent.capabilities.includes(cap)
    ).length;
    if (requiredCapabilities.length > 0) {
      score += (capabilityMatches / requiredCapabilities.length) * 0.25;
    }

    // Performance history (10%)
    const performanceScore = this.getAgentPerformanceScore(agent.id);
    score += performanceScore * 0.1;

    // Complexity match (10%)
    const taskComplexity = this.inferTaskComplexity(task, context);
    const complexityMatch = this.getComplexityMatch(agent.complexity_level, taskComplexity);
    score += complexityMatch * 0.1;

    return Math.min(score, 1.0); // Cap at 1.0
  }

  inferTaskDomain(task, context) {
    const taskLower = task.toLowerCase();

    // Domain keyword mapping
    const domainKeywords = {
      [DOMAINS.AI]: ['ai', 'machine learning', 'neural', 'model', 'algorithm'],
      [DOMAINS.SOFTWARE]: ['code', 'programming', 'software', 'development', 'bug', 'function'],
      [DOMAINS.SECURITY]: ['security', 'vulnerability', 'attack', 'encryption', 'auth'],
      [DOMAINS.PERFORMANCE]: ['performance', 'optimization', 'speed', 'efficiency', 'benchmark'],
      [DOMAINS.DATA]: ['data', 'database', 'analytics', 'statistics', 'metrics'],
      [DOMAINS.BUSINESS]: ['business', 'strategy', 'market', 'revenue', 'customer'],
      [DOMAINS.RESEARCH]: ['research', 'study', 'analysis', 'investigation', 'findings'],
      [DOMAINS.CREATIVE]: ['creative', 'design', 'content', 'writing', 'story']
    };

    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (keywords.some(keyword => taskLower.includes(keyword))) {
        return domain;
      }
    }

    return DOMAINS.GENERAL;
  }

  inferRequiredCapabilities(task, context) {
    const taskLower = task.toLowerCase();
    const capabilities = [];

    // Capability keyword mapping
    const capabilityKeywords = {
      [AGENT_CAPABILITIES.WEB_SEARCH]: ['search', 'find', 'lookup', 'web'],
      [AGENT_CAPABILITIES.DATABASE_SEARCH]: ['database', 'query', 'data', 'records'],
      [AGENT_CAPABILITIES.CODE_GENERATION]: ['code', 'program', 'implement', 'develop'],
      [AGENT_CAPABILITIES.DOCUMENT_ANALYSIS]: ['document', 'file', 'text', 'analyze'],
      [AGENT_CAPABILITIES.EMAIL_PROCESSING]: ['email', 'message', 'inbox', 'reply'],
      [AGENT_CAPABILITIES.RESEARCH_SYNTHESIS]: ['research', 'synthesize', 'combine', 'summary'],
      [AGENT_CAPABILITIES.PLANNING]: ['plan', 'organize', 'schedule', 'roadmap'],
      [AGENT_CAPABILITIES.QUALITY_ASSURANCE]: ['test', 'validate', 'check', 'quality'],
      [AGENT_CAPABILITIES.DATA_ANALYSIS]: ['analyze', 'statistics', 'trends', 'patterns'],
      [AGENT_CAPABILITIES.CREATIVE_WRITING]: ['write', 'create', 'content', 'story'],
      [AGENT_CAPABILITIES.COMMUNICATION]: ['communicate', 'message', 'report', 'present'],
      [AGENT_CAPABILITIES.TASK_EXECUTION]: ['execute', 'run', 'automate', 'process']
    };

    for (const [capability, keywords] of Object.entries(capabilityKeywords)) {
      if (keywords.some(keyword => taskLower.includes(keyword))) {
        capabilities.push(capability);
      }
    }

    return capabilities;
  }

  inferTaskComplexity(task, context) {
    const taskLength = task.length;
    const complexityIndicators = {
      high: ['complex', 'advanced', 'sophisticated', 'comprehensive', 'detailed'],
      medium: ['analyze', 'process', 'implement', 'create', 'develop'],
      low: ['simple', 'basic', 'quick', 'easy', 'straightforward']
    };

    const taskLower = task.toLowerCase();

    for (const [level, indicators] of Object.entries(complexityIndicators)) {
      if (indicators.some(indicator => taskLower.includes(indicator))) {
        return level;
      }
    }

    // Infer from task length
    if (taskLength > 200) return COMPLEXITY_LEVELS.HIGH;
    if (taskLength > 100) return COMPLEXITY_LEVELS.MEDIUM;
    return COMPLEXITY_LEVELS.LOW;
  }

  getComplexityMatch(agentComplexity, taskComplexity) {
    const complexityOrder = [
      COMPLEXITY_LEVELS.LOW,
      COMPLEXITY_LEVELS.MEDIUM,
      COMPLEXITY_LEVELS.HIGH,
      COMPLEXITY_LEVELS.EXPERT
    ];

    const agentIndex = complexityOrder.indexOf(agentComplexity);
    const taskIndex = complexityOrder.indexOf(taskComplexity);

    // Perfect match
    if (agentIndex === taskIndex) return 1.0;
    
    // Close match
    if (Math.abs(agentIndex - taskIndex) === 1) return 0.7;
    
    // Distant match
    return 0.3;
  }

  getAgentPerformanceScore(agentId) {
    const history = this.performanceHistory.get(agentId);
    if (!history || history.length === 0) {
      return 0.5; // Default neutral score
    }

    // Calculate average performance from recent history
    const recentHistory = history.slice(-10); // Last 10 executions
    const avgScore = recentHistory.reduce((sum, record) => sum + record.score, 0) / recentHistory.length;
    
    return Math.min(Math.max(avgScore, 0), 1); // Clamp between 0 and 1
  }

  // Record agent performance for future routing decisions
  recordAgentPerformance(agentId, taskResult) {
    try {
      if (!this.performanceHistory.has(agentId)) {
        this.performanceHistory.set(agentId, []);
      }

      const history = this.performanceHistory.get(agentId);
      
      // Calculate performance score based on result
      let score = 0.5; // Default
      
      if (taskResult.success) {
        score = 0.7;
        
        // Bonus for high confidence
        if (taskResult.confidence && taskResult.confidence > 0.8) {
          score += 0.2;
        }
        
        // Bonus for fast execution
        if (taskResult.executionTime && taskResult.executionTime < 5000) {
          score += 0.1;
        }
      } else {
        score = 0.2; // Penalty for failure
      }

      history.push({
        timestamp: new Date(),
        score: Math.min(score, 1.0),
        taskType: taskResult.taskType,
        executionTime: taskResult.executionTime
      });

      // Keep only recent history (last 50 records)
      if (history.length > 50) {
        history.splice(0, history.length - 50);
      }

      logger.debug('Agent performance recorded', { 
        agentId, 
        score, 
        historyLength: history.length 
      });

    } catch (error) {
      logger.error('Error recording agent performance:', error);
    }
  }

  // Get agent by ID
  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  // Get all agents
  getAllAgents() {
    return Array.from(this.agents.values());
  }

  // Get agents by capability
  getAgentsByCapability(capability) {
    return Array.from(this.agents.values()).filter(agent => 
      agent.capabilities.includes(capability)
    );
  }

  // Get agents by domain
  getAgentsByDomain(domain) {
    return Array.from(this.agents.values()).filter(agent => 
      agent.domains.includes(domain)
    );
  }

  // Get registry statistics
  getRegistryStats() {
    const stats = {
      totalAgents: this.agents.size,
      agentsByComplexity: {},
      agentsByDomain: {},
      capabilityDistribution: {},
      performanceStats: {}
    };

    // Count by complexity
    for (const agent of this.agents.values()) {
      const complexity = agent.complexity_level;
      stats.agentsByComplexity[complexity] = (stats.agentsByComplexity[complexity] || 0) + 1;
    }

    // Count by domain
    for (const agent of this.agents.values()) {
      agent.domains.forEach(domain => {
        stats.agentsByDomain[domain] = (stats.agentsByDomain[domain] || 0) + 1;
      });
    }

    // Count capabilities
    for (const agent of this.agents.values()) {
      agent.capabilities.forEach(capability => {
        stats.capabilityDistribution[capability] = (stats.capabilityDistribution[capability] || 0) + 1;
      });
    }

    // Performance statistics
    for (const [agentId, history] of this.performanceHistory.entries()) {
      if (history.length > 0) {
        const avgScore = history.reduce((sum, record) => sum + record.score, 0) / history.length;
        stats.performanceStats[agentId] = {
          averageScore: avgScore,
          totalExecutions: history.length,
          recentScore: history[history.length - 1].score
        };
      }
    }

    return stats;
  }
}

// Export singleton instance and classes
const agentRegistry = new AgentRegistry();

module.exports = {
  AgentRegistry,
  agentRegistry,
  AGENT_CAPABILITIES,
  COMPLEXITY_LEVELS,
  DOMAINS,
  AGENT_PROFILES
};
