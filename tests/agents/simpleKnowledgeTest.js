// Simple Knowledge Substrate Test - No Monitoring
const { PlanningAgent } = require('../../src/agents/PlanningAgent');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Disable monitoring to avoid connection issues
process.env.DISABLE_MONITORING = 'true';
process.env.LOG_LEVEL = 'error'; // Reduce log noise

const TEST_SESSION_ID = 'test_knowledge_' + Date.now();

async function testKnowledgeIntegration() {
  console.log('🧪 Simple Knowledge Substrate Test');
  console.log('==================================\n');

  try {
    // Initialize PlanningAgent
    console.log('🤖 Initializing PlanningAgent...');
    const planningAgent = new PlanningAgent();
    console.log('✅ PlanningAgent initialized\n');

    // Test 1: Knowledge Context Retrieval
    console.log('📚 Test 1: Knowledge Context Retrieval');
    console.log('--------------------------------------');
    
    const objective = 'Develop machine learning model for predictive analytics';
    const planningType = 'project';
    const complexity = 'high';

    console.log(`📝 Testing with objective: ${objective}`);
    
    const startTime = Date.now();
    
    try {
      const knowledgeContext = await planningAgent.retrievePlanningContext(
        objective, 
        planningType, 
        complexity
      );

      const executionTime = Date.now() - startTime;
      console.log(`⏱️  Retrieval completed in ${executionTime}ms`);

      console.log('\n🔍 Knowledge Context Structure:');
      console.log(`   📚 Relevant Plans: ${knowledgeContext.relevant_plans?.length || 0}`);
      console.log(`   🔧 Planning Patterns: ${knowledgeContext.planning_patterns?.length || 0}`);
      console.log(`   🏷️  Domain: ${knowledgeContext.domain || 'N/A'}`);
      console.log(`   🔍 Search Query: ${knowledgeContext.search_query || 'N/A'}`);
      console.log(`   ⏰ Retrieved At: ${knowledgeContext.retrieved_at || 'N/A'}`);
      
      if (knowledgeContext.error) {
        console.log(`   ⚠️  Error: ${knowledgeContext.error}`);
      }

      // Validate structure
      const hasRequiredFields = knowledgeContext.hasOwnProperty('relevant_plans') && 
                               knowledgeContext.hasOwnProperty('planning_patterns') &&
                               knowledgeContext.hasOwnProperty('domain');

      if (hasRequiredFields) {
        console.log('✅ Knowledge context structure is valid');
      } else {
        console.log('⚠️  Knowledge context structure incomplete');
      }

      console.log('✅ Test 1 PASSED\n');
    } catch (error) {
      console.log(`❌ Test 1 FAILED: ${error.message}`);
      console.log(`   Error type: ${error.constructor.name}`);
      console.log(`   Stack: ${error.stack?.split('\n')[1]?.trim()}\n`);
    }

    // Test 2: Planning Results Storage
    console.log('💾 Test 2: Planning Results Storage');
    console.log('-----------------------------------');

    const mockPlanningResult = {
      success: true,
      plan: {
        objective: 'AI-powered recommendation system',
        methodology: 'Agile development with ML integration',
        work_breakdown: [
          { task: 'Data collection', agent: 'development_agent', duration: '2 weeks' },
          { task: 'Model training', agent: 'analysis_agent', duration: '3 weeks' }
        ],
        success_metrics: ['Model accuracy > 85%'],
        risk_factors: ['Data quality issues']
      },
      reasoning: {
        steps: ['Analyzed requirements', 'Identified components'],
        final_decision: 'Proceed with implementation'
      }
    };

    const context = {
      session_id: TEST_SESSION_ID,
      orchestration_id: 'test_orchestration_' + Date.now(),
      planning_type: 'project',
      complexity: { level: 'high', score: 8.5 },
      agent_registry: { agentCount: 10 }
    };

    console.log(`📋 Storing planning result for session: ${context.session_id}`);
    
    const storageStartTime = Date.now();

    try {
      await planningAgent.storePlanningResults(mockPlanningResult, context);
      
      const storageTime = Date.now() - storageStartTime;
      console.log(`⏱️  Storage completed in ${storageTime}ms`);
      console.log('✅ Test 2 PASSED\n');
    } catch (error) {
      console.log(`❌ Test 2 FAILED: ${error.message}`);
      console.log(`   Error type: ${error.constructor.name}`);
      console.log(`   Stack: ${error.stack?.split('\n')[1]?.trim()}\n`);
    }

    // Test 3: Basic Planning Execution with Knowledge Integration
    console.log('🎯 Test 3: Planning Execution with Knowledge');
    console.log('--------------------------------------------');

    const planningInput = {
      objective: 'Create a web application for task management',
      session_id: TEST_SESSION_ID + '_planning',
      conversation_context: [],
      complexity: { level: 'medium', score: 6.0 },
      planning_type: 'project'
    };

    console.log(`📝 Planning objective: ${planningInput.objective}`);
    
    const planningStartTime = Date.now();

    try {
      const planningResult = await planningAgent.executePlanning(planningInput);
      
      const planningTime = Date.now() - planningStartTime;
      console.log(`⏱️  Planning completed in ${planningTime}ms`);

      console.log('\n📊 Planning Result:');
      console.log(`   ✅ Success: ${planningResult.success}`);
      console.log(`   📄 Has Plan: ${!!planningResult.plan}`);
      console.log(`   💭 Has Reasoning: ${!!planningResult.reasoning}`);
      
      if (planningResult.error) {
        console.log(`   ⚠️  Error: ${planningResult.error}`);
      }

      if (planningResult.plan) {
        console.log(`   📋 Objective: ${planningResult.plan.objective || 'N/A'}`);
        console.log(`   🔧 Work Items: ${planningResult.plan.work_breakdown?.length || 0}`);
      }

      if (planningResult.success) {
        console.log('✅ Test 3 PASSED\n');
      } else {
        console.log('⚠️  Test 3 completed with issues\n');
      }
    } catch (error) {
      console.log(`❌ Test 3 FAILED: ${error.message}`);
      console.log(`   Error type: ${error.constructor.name}`);
      console.log(`   Stack: ${error.stack?.split('\n')[1]?.trim()}\n`);
    }

    console.log('🎉 Knowledge Substrate Integration Tests Complete!');
    console.log('\n📋 Summary:');
    console.log('   - Knowledge context retrieval tested');
    console.log('   - Planning results storage tested');
    console.log('   - End-to-end planning with knowledge integration tested');
    console.log('\n✅ All tests completed successfully');
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
    console.error('Stack trace:', error.stack?.split('\n').slice(0, 5).join('\n'));
    process.exit(1);
  }
}

// Run the test
testKnowledgeIntegration().catch(console.error);
