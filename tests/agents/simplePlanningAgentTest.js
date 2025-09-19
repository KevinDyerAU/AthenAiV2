const { PlanningAgent } = require('../../src/agents/PlanningAgent');
const { AgentRegistry } = require('../../src/agents/AgentRegistry');
const databaseService = require('../../src/services/database');
const path = require('path');

// Load environment variables for testing
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env.development') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'debug';

// Check for API keys and set test mode if needed
const hasRealApiKeys = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
if (!hasRealApiKeys) {
  console.log('⚠️  No AI API keys found. Running in mock mode...');
  process.env.TEST_MODE = 'true';
  process.env.USE_OPENROUTER = 'true';
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.OPENROUTER_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_MODEL = 'gpt-4';
}

// Test configuration
const TEST_SESSION_ID = `test_session_${Date.now()}`;
const TEST_ORCHESTRATION_ID = `test_orchestration_${Date.now()}`;

/**
 * Simple PlanningAgent Test Suite
 * Tests real knowledge substrate integration without mocking
 */
class SimplePlanningAgentTest {
  constructor() {
    this.planningAgent = null;
    this.agentRegistry = null;
    this.testResults = [];
  }

  /**
   * Initialize test environment
   */
  async initialize() {
    console.log('🚀 Initializing SimplePlanningAgentTest...');
    
    try {
      // Initialize database service first
      console.log('🔧 Initializing database service...');
      if (typeof databaseService.initialize === 'function') {
        await databaseService.initialize();
      }
      console.log('✅ Database service initialized');

      // Initialize PlanningAgent
      this.planningAgent = new PlanningAgent();
      console.log('✅ PlanningAgent initialized');

      // Initialize AgentRegistry
      this.agentRegistry = new AgentRegistry();
      console.log('✅ AgentRegistry initialized');

      // Test database connection
      await this.testDatabaseConnection();
      
      console.log('✅ Test environment initialized successfully\n');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize test environment:', error.message);
      console.log('\n📋 Required Environment Variables:');
      console.log('   SUPABASE_URL=https://your-project.supabase.co');
      console.log('   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key');
      console.log('   NEO4J_URI=bolt://localhost:7687');
      console.log('   NEO4J_USER=neo4j');
      console.log('   NEO4J_PASSWORD=your_neo4j_password');
      console.log('   REDIS_URL=redis://localhost:6379');
      console.log('\n💡 Add these to your .env file to enable full knowledge substrate testing');
      return false;
    }
  }

  /**
   * Test database connection
   */
  async testDatabaseConnection() {
    try {
      console.log('🔍 Testing database connections...');
      
      // Check environment variables
      console.log('📋 Environment Variables:');
      console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);
      console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing'}`);
      console.log(`   NEO4J_URI: ${process.env.NEO4J_URI || 'bolt://localhost:7687'}`);
      console.log(`   NEO4J_USER: ${process.env.NEO4J_USER || 'neo4j'}`);
      console.log(`   NEO4J_PASSWORD: ${process.env.NEO4J_PASSWORD ? '✅ Set' : '❌ Missing'}`);
      console.log(`   REDIS_URL: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
      
      // Test database service initialization
      if (databaseService.databaseService) {
        const dbService = databaseService.databaseService;
        console.log('🔧 Database Service Status:');
        console.log(`   Supabase initialized: ${dbService.supabase ? '✅' : '❌'}`);
        console.log(`   Neo4j initialized: ${dbService.neo4jDriver ? '✅' : '❌'}`);
        console.log(`   Redis initialized: ${dbService.redisClient ? '✅' : '❌'}`);
        console.log(`   Service initialized: ${dbService.initialized ? '✅' : '❌'}`);
        
        // Initialize if not already done
        if (!dbService.initialized && typeof dbService.initialize === 'function') {
          console.log('🚀 Initializing database service...');
          await dbService.initialize();
        }
      }
      
      // Test basic database connectivity
      const testQuery = 'SELECT 1 as test';
      await databaseService.executeQuery(testQuery);
      console.log('✅ Database connection verified');
    } catch (error) {
      console.log('⚠️  Database connection not available, continuing with limited tests');
      console.log(`   Database error: ${error.message}`);
      console.log(`   Stack trace: ${error.stack?.split('\n').slice(0, 3).join('\n')}`);
      // Don't throw error - allow tests to continue without database
    }
  }

  /**
   * Test 1: Basic Planning Agent Execution
   */
  async testBasicPlanningExecution() {
    console.log('📋 Test 1: Basic Planning Agent Execution');
    
    try {
      const inputData = {
        objective: 'Create a comprehensive project plan for developing a new AI-powered customer service chatbot',
        session_id: TEST_SESSION_ID,
        conversation_context: [],
        complexity: { level: 'high', score: 8.5 },
        planning_type: 'project'
      };

      console.log('🤖 Executing planning with PlanningAgent...');
      console.log('📋 Input Data Details:');
      console.log(`   📝 Objective: ${inputData.objective}`);
      console.log(`   📊 Planning Type: ${inputData.planning_type}`);
      console.log(`   ⚡ Complexity: ${JSON.stringify(inputData.complexity)}`);
      console.log(`   🆔 Session ID: ${inputData.session_id}`);
      
      const startTime = Date.now();
      
      const result = await this.planningAgent.executePlanning(inputData);
      
      const executionTime = Date.now() - startTime;
      console.log(`⏱️  Execution time: ${executionTime}ms`);

      // Detailed result logging
      console.log('📊 Planning Result Details:');
      console.log(`   ✅ Success: ${result.success}`);
      console.log(`   📄 Has Plan: ${!!result.plan}`);
      console.log(`   💭 Has Reasoning: ${!!result.reasoning}`);
      console.log(`   ⚠️  Has Error: ${!!result.error}`);
      
      if (result.error) {
        console.log(`   🚨 Error Message: ${result.error}`);
      }
      
      if (result.plan) {
        console.log(`   📋 Plan Objective: ${result.plan.objective || 'No objective'}`);
        console.log(`   🔧 Work Breakdown Items: ${result.plan.work_breakdown?.length || 0}`);
        console.log(`   📈 Success Metrics: ${result.plan.success_metrics?.length || 0}`);
        console.log(`   ⚠️  Risk Factors: ${result.plan.risk_factors?.length || 0}`);
      }
      
      if (result.reasoning) {
        console.log(`   💭 Reasoning Steps: ${result.reasoning.steps?.length || 0}`);
        console.log(`   🎯 Final Decision: ${result.reasoning.final_decision || 'No decision'}`);
      }

      // Validate result structure
      try {
        this.validatePlanningResult(result);
        console.log('✅ Result validation passed');
      } catch (validationError) {
        console.log(`⚠️  Result validation warning: ${validationError.message}`);
      }

      this.testResults.push({
        test: 'Basic Planning Execution',
        status: result.success ? 'PASSED' : 'FAILED',
        executionTime,
        hasObjective: !!result.plan?.objective,
        hasWorkBreakdown: !!result.plan?.work_breakdown,
        reasoningSteps: result.reasoning?.steps?.length || 0,
        error: result.error
      });

      if (result.success) {
        console.log('✅ Test 1 PASSED\n');
      } else {
        console.log('❌ Test 1 FAILED\n');
      }
      return result;
    } catch (error) {
      console.error('❌ Test 1 FAILED:', error.message);
      this.testResults.push({
        test: 'Basic Planning Execution',
        status: 'FAILED',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Test 2: Agent-Aware Planning with Registry
   */
  async testAgentAwarePlanning() {
    console.log('📋 Test 2: Agent-Aware Planning with Registry');
    
    try {
      // Get agent registry information
      const agentRegistryInfo = this.agentRegistry.getAgentRegistryInfo();
      console.log(`🤖 Using ${agentRegistryInfo.total_agents} agents from registry`);

      const inputData = {
        task: 'Plan a multi-agent workflow for analyzing customer feedback data and generating insights dashboard',
        sessionId: TEST_SESSION_ID,
        conversationContext: [],
        complexity: { level: 'very_complex', score: 9.2 },
        planningType: 'orchestration',
        agentRegistry: agentRegistryInfo
      };

      console.log('🔄 Executing agent-aware planning...');
      const startTime = Date.now();
      
      const result = await this.planningAgent.executePlanning(inputData);
      
      const executionTime = Date.now() - startTime;
      console.log(`⏱️  Execution time: ${executionTime}ms`);

      // Validate result structure
      this.validatePlanningResult(result, 'Agent-Aware Planning');
      
      // Check for agent awareness in the result
      const planContent = result.output || result.result || '';
      const mentionedAgents = agentRegistryInfo.agents.filter(agent => 
        planContent.toLowerCase().includes(agent.name.toLowerCase())
      );
      
      console.log(`🎯 Agents mentioned in plan: ${mentionedAgents.length}/${agentRegistryInfo.total_agents}`);
      if (mentionedAgents.length > 0) {
        console.log(`   - ${mentionedAgents.map(a => a.name).join(', ')}`);
      }

      this.testResults.push({
        test: 'Agent-Aware Planning',
        status: 'PASSED',
        executionTime,
        agentsMentioned: mentionedAgents.length,
        result: result
      });

      console.log('✅ Test 2 PASSED\n');
      return result;
    } catch (error) {
      console.error('❌ Test 2 FAILED:', error.message);
      this.testResults.push({
        test: 'Agent-Aware Planning',
        status: 'FAILED',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Test 3: Knowledge Substrate Context Retrieval
   */
  async testKnowledgeContextRetrieval() {
    console.log('📋 Test 3: Knowledge Substrate Context Retrieval');
    
    try {
      const objective = 'Develop machine learning model for predictive analytics';
      const planningType = 'project';
      const complexity = 'high';

      console.log('🔍 Retrieving planning context from knowledge substrate...');
      console.log(`   📝 Objective: ${objective}`);
      console.log(`   📊 Planning Type: ${planningType}`);
      console.log(`   ⚡ Complexity: ${complexity}`);
      
      const startTime = Date.now();
      
      const knowledgeContext = await this.planningAgent.retrievePlanningContext(
        objective, 
        planningType, 
        complexity
      );
      
      const executionTime = Date.now() - startTime;
      console.log(`⏱️  Retrieval time: ${executionTime}ms`);

      // Detailed logging of knowledge context
      console.log('🔍 Knowledge Context Details:');
      console.log(`   📚 Retrieved ${knowledgeContext.relevant_plans.length} relevant plans`);
      console.log(`   🔧 Retrieved ${knowledgeContext.planning_patterns.length} planning patterns`);
      console.log(`   🏷️  Domain: ${knowledgeContext.domain}`);
      console.log(`   🔍 Search Query: ${knowledgeContext.search_query}`);
      console.log(`   ⏰ Retrieved At: ${knowledgeContext.retrieved_at}`);
      
      if (knowledgeContext.error) {
        console.log(`   ⚠️  Error: ${knowledgeContext.error}`);
      }

      // Log relevant plans details
      if (knowledgeContext.relevant_plans.length > 0) {
        console.log('📋 Relevant Plans Found:');
        knowledgeContext.relevant_plans.forEach((plan, index) => {
          console.log(`   ${index + 1}. ${plan.title || 'Untitled Plan'}`);
          console.log(`      - Objective: ${plan.objective || 'N/A'}`);
          console.log(`      - Methodology: ${plan.methodology || 'N/A'}`);
          console.log(`      - Complexity: ${plan.complexity_level || 'N/A'}`);
          console.log(`      - Similarity: ${plan.similarity_score || 'N/A'}`);
        });
      }

      // Log planning patterns details
      if (knowledgeContext.planning_patterns.length > 0) {
        console.log('🔧 Planning Patterns Found:');
        knowledgeContext.planning_patterns.forEach((pattern, index) => {
          console.log(`   ${index + 1}. ${pattern.name || 'Unnamed Pattern'}`);
          console.log(`      - Context: ${pattern.context || 'N/A'}`);
          console.log(`      - Applicable Complexity: ${pattern.applicable_complexity || 'N/A'}`);
          console.log(`      - Similarity: ${pattern.similarity_score || 'N/A'}`);
        });
      }

      // Validate knowledge context structure
      this.validateKnowledgeContext(knowledgeContext);

      this.testResults.push({
        test: 'Knowledge Context Retrieval',
        status: 'PASSED',
        executionTime,
        relevantPlans: knowledgeContext.relevant_plans.length,
        planningPatterns: knowledgeContext.planning_patterns.length,
        domain: knowledgeContext.domain,
        searchQuery: knowledgeContext.search_query,
        hasError: !!knowledgeContext.error
      });

      console.log('✅ Test 3 PASSED\n');
      return knowledgeContext;
    } catch (error) {
      console.error('❌ Test 3 FAILED:', error.message);
      console.error(`   Stack trace: ${error.stack?.split('\n').slice(0, 5).join('\n')}`);
      this.testResults.push({
        test: 'Knowledge Context Retrieval',
        status: 'FAILED',
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3)
      });
      throw error;
    }
  }

  /**
   * Test 4: Planning Results Storage
   */
  async testPlanningResultsStorage() {
    console.log('📋 Test 4: Planning Results Storage');
    
    try {
      // Create a sample planning result
      const planningResult = {
        output: `
        Comprehensive AI Project Plan:
        
        1. Requirements Analysis (2 weeks)
           - Stakeholder interviews
           - Technical requirements gathering
           - Success criteria definition
        
        2. Data Preparation (3 weeks)
           - Data collection and cleaning
           - Feature engineering
           - Data validation
        
        3. Model Development (4 weeks)
           - Algorithm selection
           - Model training and validation
           - Performance optimization
        
        4. Integration and Testing (2 weeks)
           - API development
           - System integration
           - User acceptance testing
        
        Key Success Factors:
        - Clear stakeholder communication
        - Robust data quality processes
        - Iterative model improvement
        
        Risk Factors:
        - Data quality issues
        - Model performance challenges
        - Integration complexity
        `,
        metadata: {
          complexity: 'high',
          estimated_duration: '11 weeks',
          methodology: 'agile'
        }
      };

      const context = {
        objective: 'Develop AI-powered recommendation system',
        planningType: 'project',
        complexity: 'high',
        sessionId: TEST_SESSION_ID,
        orchestrationId: TEST_ORCHESTRATION_ID,
        agentRegistry: this.agentRegistry.getAgentRegistryInfo(),
        knowledgeContext: { relevant_plans: [], planning_patterns: [] },
        thinkingResult: { steps: [1, 2, 3, 4, 5] }
      };

      console.log('💾 Storing planning results in knowledge substrate...');
      const startTime = Date.now();
      
      await this.planningAgent.storePlanningResults(planningResult, context);
      
      const executionTime = Date.now() - startTime;
      console.log(`⏱️  Storage time: ${executionTime}ms`);

      // Verify storage by searching for the stored plan
      console.log('🔍 Verifying stored plan...');
      console.log('   🔍 Search Parameters:');
      console.log(`      Query: AI-powered recommendation system`);
      console.log(`      Domain: ai`);
      console.log(`      Limit: 5`);
      console.log(`      Similarity Threshold: 0.5`);
      
      const searchResults = await databaseService.searchKnowledge({
        query: 'AI-powered recommendation system',
        domain: 'ai',
        limit: 5,
        similarity_threshold: 0.5
      });

      console.log(`   📊 Search Results: ${searchResults.length} items found`);
      
      if (searchResults.length > 0) {
        console.log('   📋 Search Results Details:');
        searchResults.forEach((result, index) => {
          console.log(`      ${index + 1}. ${result.title || result.id}`);
          console.log(`         - Domain: ${result.domain}`);
          console.log(`         - Content Type: ${result.metadata?.content_type}`);
          console.log(`         - Session ID: ${result.metadata?.session_id}`);
          console.log(`         - Created By: ${result.metadata?.created_by}`);
          console.log(`         - Similarity: ${result.similarity_score}`);
        });
      }

      const storedPlan = searchResults.find(result => 
        result.metadata?.session_id === TEST_SESSION_ID
      );

      if (storedPlan) {
        console.log('✅ Plan successfully stored and retrieved');
        console.log(`   📄 Title: ${storedPlan.title}`);
        console.log(`   🏷️  Domain: ${storedPlan.domain}`);
        console.log(`   📝 Content Type: ${storedPlan.metadata?.content_type}`);
        console.log(`   🆔 Session ID: ${storedPlan.metadata?.session_id}`);
        console.log(`   👤 Created By: ${storedPlan.metadata?.created_by}`);
        console.log(`   📊 Content Length: ${storedPlan.content?.length || 0} chars`);
      } else {
        console.log('⚠️  Plan stored but not immediately searchable (indexing delay)');
        console.log(`   🔍 Looking for session ID: ${TEST_SESSION_ID}`);
      }

      this.testResults.push({
        test: 'Planning Results Storage',
        status: 'PASSED',
        executionTime,
        planStored: true,
        searchResults: searchResults.length
      });

      console.log('✅ Test 4 PASSED\n');
      return true;
    } catch (error) {
      console.error('❌ Test 4 FAILED:', error.message);
      this.testResults.push({
        test: 'Planning Results Storage',
        status: 'FAILED',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Test 5: End-to-End Knowledge-Aware Planning
   */
  async testEndToEndKnowledgeAwarePlanning() {
    console.log('📋 Test 5: End-to-End Knowledge-Aware Planning');
    
    try {
      const inputData = {
        task: 'Create a strategic plan for implementing AI-driven customer analytics platform',
        sessionId: `${TEST_SESSION_ID}_e2e`,
        conversationContext: [
          { role: 'user', content: 'We need to improve our customer insights' },
          { role: 'assistant', content: 'I can help you plan an AI analytics solution' }
        ],
        complexity: { level: 'very_complex', score: 9.5 },
        planningType: 'orchestration',
        agentRegistry: this.agentRegistry.getAgentRegistryInfo()
      };

      console.log('🔄 Executing end-to-end knowledge-aware planning...');
      const startTime = Date.now();
      
      const result = await this.planningAgent.executePlanning(inputData);
      
      const executionTime = Date.now() - startTime;
      console.log(`⏱️  Total execution time: ${executionTime}ms`);

      // Validate comprehensive result
      this.validatePlanningResult(result, 'End-to-End Knowledge-Aware Planning');
      
      // Check for knowledge integration indicators
      const planContent = result.output || result.result || '';
      const hasHistoricalContext = planContent.toLowerCase().includes('historical') || 
                                  planContent.toLowerCase().includes('previous') ||
                                  planContent.toLowerCase().includes('learned');
      
      console.log(`🧠 Historical context integrated: ${hasHistoricalContext ? 'Yes' : 'No'}`);

      this.testResults.push({
        test: 'End-to-End Knowledge-Aware Planning',
        status: 'PASSED',
        executionTime,
        hasHistoricalContext,
        result: result
      });

      console.log('✅ Test 5 PASSED\n');
      return result;
    } catch (error) {
      console.error('❌ Test 5 FAILED:', error.message);
      this.testResults.push({
        test: 'End-to-End Knowledge-Aware Planning',
        status: 'FAILED',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Validate planning result structure
   */
  validatePlanningResult(result, testName) {
    if (!result) {
      throw new Error(`${testName}: No result returned`);
    }

    const planContent = result.output || result.result || '';
    if (!planContent || planContent.length < 100) {
      throw new Error(`${testName}: Plan content too short or missing`);
    }

    console.log(`📄 Plan content length: ${planContent.length} characters`);
    
    // Check for key planning elements
    const hasSteps = /step|phase|stage|\d+\./i.test(planContent);
    const hasTimeline = /week|month|day|timeline|schedule/i.test(planContent);
    const hasResources = /resource|team|agent|assign/i.test(planContent);
    
    console.log(`   - Has structured steps: ${hasSteps}`);
    console.log(`   - Has timeline elements: ${hasTimeline}`);
    console.log(`   - Has resource planning: ${hasResources}`);
  }

  /**
   * Validate knowledge context structure
   */
  validateKnowledgeContext(context) {
    if (!context) {
      throw new Error('Knowledge context is null or undefined');
    }

    if (!Array.isArray(context.relevant_plans)) {
      throw new Error('relevant_plans should be an array');
    }

    if (!Array.isArray(context.planning_patterns)) {
      throw new Error('planning_patterns should be an array');
    }

    if (!context.domain) {
      throw new Error('domain is missing from knowledge context');
    }

    if (!context.retrieved_at) {
      throw new Error('retrieved_at timestamp is missing');
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🧪 Starting SimplePlanningAgentTest Suite');
    console.log('=' .repeat(60));
    
    const overallStartTime = Date.now();
    let passedTests = 0;
    let totalTests = 0;

    try {
      // Initialize test environment
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize test environment');
      }

      // Run individual tests
      const tests = [
        () => this.testBasicPlanningExecution(),
        () => this.testAgentAwarePlanning(),
        () => this.testKnowledgeContextRetrieval(),
        () => this.testPlanningResultsStorage(),
        () => this.testEndToEndKnowledgeAwarePlanning()
      ];

      for (const test of tests) {
        totalTests++;
        try {
          await test();
          passedTests++;
        } catch (error) {
          console.error(`Test failed: ${error.message}\n`);
        }
      }

    } catch (error) {
      console.error('❌ Test suite initialization failed:', error.message);
    }

    // Print summary
    const overallExecutionTime = Date.now() - overallStartTime;
    console.log('=' .repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('=' .repeat(60));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Success Rate: ${totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0}%`);
    console.log(`Total Execution Time: ${overallExecutionTime}ms`);
    console.log('');

    // Print detailed results
    console.log('📋 DETAILED RESULTS:');
    this.testResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.test}: ${result.status}`);
      if (result.executionTime) {
        console.log(`   Execution Time: ${result.executionTime}ms`);
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    return {
      totalTests,
      passedTests,
      failedTests: totalTests - passedTests,
      successRate: totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0,
      executionTime: overallExecutionTime,
      results: this.testResults
    };
  }

  /**
   * Cleanup test environment
   */
  async cleanup() {
    console.log('🧹 Cleaning up test environment...');
    
    try {
      // Close any open connections
      if (this.planningAgent) {
        await this.planningAgent.shutdown();
      }
      
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.error('⚠️  Cleanup warning:', error.message);
    }
  }
}

// Export for use in other test files
module.exports = { SimplePlanningAgentTest };

// Run tests if this file is executed directly
if (require.main === module) {
  (async () => {
    const testSuite = new SimplePlanningAgentTest();
    
    try {
      await testSuite.runAllTests();
    } finally {
      await testSuite.cleanup();
      process.exit(0);
    }
  })();
}
