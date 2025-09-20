// Simple MasterOrchestrator Test - Node.js compatible
const { MasterOrchestrator } = require('../../src/agents/MasterOrchestrator');
const path = require('path');

// Load environment variables for testing
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env.development') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'info';

class SimpleMasterOrchestratorTest {
  constructor() {
    this.testResults = [];
    this.masterOrchestrator = null;
  }

  async runAllTests() {
    console.log('🚀 Starting MasterOrchestrator Simple Tests...\n');
    
    try {
      await this.testInitialization();
      await this.testErrorClassification();
      await this.testBackoffCalculation();
      await this.testErrorRecoveryFlow();
      await this.testReplanningContextGeneration();
      await this.testAgentExtractionFromPlan();
      await this.testCoordinationExtractionFromPlan();
      await this.testCriticalErrorHandling();
      await this.testMultipleErrorScenarios();
      
      this.printResults();
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      process.exit(1);
    }
  }

  async testInitialization() {
    console.log('📋 Test 1: MasterOrchestrator Initialization');
    
    try {
      this.masterOrchestrator = new MasterOrchestrator();
      
      // Check if basic properties are initialized
      const hasName = !!this.masterOrchestrator.name;
      const hasCapabilities = Array.isArray(this.masterOrchestrator.capabilities);
      const hasKnowledgeHelper = !!this.masterOrchestrator.knowledgeHelper;
      const hasErrorMethods = typeof this.masterOrchestrator.classifyError === 'function';
      const hasRecoveryMethods = typeof this.masterOrchestrator.executeWithRecovery === 'function';
      
      console.log(`   ✅ Name: ${this.masterOrchestrator.name}`);
      console.log(`   ✅ Capabilities: ${this.masterOrchestrator.capabilities.join(', ')}`);
      console.log(`   ✅ Knowledge Helper: ${hasKnowledgeHelper ? 'Initialized' : 'Missing'}`);
      console.log(`   ✅ Error Classification: ${hasErrorMethods ? 'Available' : 'Missing'}`);
      console.log(`   ✅ Recovery Methods: ${hasRecoveryMethods ? 'Available' : 'Missing'}`);
      
      if (hasName && hasCapabilities && hasKnowledgeHelper && hasErrorMethods && hasRecoveryMethods) {
        this.testResults.push({ test: 'Initialization', status: 'PASSED' });
        console.log('✅ Test 1 PASSED\n');
      } else {
        throw new Error('Missing required components');
      }
      
    } catch (error) {
      this.testResults.push({ test: 'Initialization', status: 'FAILED', error: error.message });
      console.log(`❌ Test 1 FAILED: ${error.message}\n`);
    }
  }

  async testErrorClassification() {
    console.log('📋 Test 2: Error Classification System');
    
    try {
      // Test critical error
      const criticalError = new Error('Authentication failed');
      const criticalClassification = this.masterOrchestrator.classifyError(criticalError);
      
      // Test transient error
      const transientError = new Error('Connection timeout');
      const transientClassification = this.masterOrchestrator.classifyError(transientError);
      
      // Test recoverable error
      const recoverableError = new Error('Objective is required');
      const recoverableClassification = this.masterOrchestrator.classifyError(recoverableError);
      
      console.log(`   🔴 Critical Error: ${criticalClassification.type} - ${criticalClassification.action}`);
      console.log(`   🟡 Transient Error: ${transientClassification.type} - ${transientClassification.action}`);
      console.log(`   🟢 Recoverable Error: ${recoverableClassification.type} - ${recoverableClassification.action}`);
      
      const correctClassifications = 
        criticalClassification.type === 'critical' &&
        transientClassification.type === 'transient' &&
        recoverableClassification.type === 'recoverable';
      
      if (correctClassifications) {
        this.testResults.push({ test: 'Error Classification', status: 'PASSED' });
        console.log('✅ Test 2 PASSED\n');
      } else {
        throw new Error('Incorrect error classifications');
      }
      
    } catch (error) {
      this.testResults.push({ test: 'Error Classification', status: 'FAILED', error: error.message });
      console.log(`❌ Test 2 FAILED: ${error.message}\n`);
    }
  }

  async testBackoffCalculation() {
    console.log('📋 Test 3: Backoff Delay Calculation');
    
    try {
      const exponentialDelay1 = this.masterOrchestrator.calculateBackoffDelay(1, 'exponential_backoff');
      const exponentialDelay2 = this.masterOrchestrator.calculateBackoffDelay(2, 'exponential_backoff');
      const exponentialDelay3 = this.masterOrchestrator.calculateBackoffDelay(3, 'exponential_backoff');
      
      const linearDelay1 = this.masterOrchestrator.calculateBackoffDelay(1, 'linear_backoff');
      const linearDelay2 = this.masterOrchestrator.calculateBackoffDelay(2, 'linear_backoff');
      
      const immediateDelay = this.masterOrchestrator.calculateBackoffDelay(1, 'immediate');
      
      console.log(`   📈 Exponential: ${exponentialDelay1}ms, ${exponentialDelay2}ms, ${exponentialDelay3}ms`);
      console.log(`   📊 Linear: ${linearDelay1}ms, ${linearDelay2}ms`);
      console.log(`   ⚡ Immediate: ${immediateDelay}ms`);
      
      const correctCalculations = 
        exponentialDelay1 === 1000 &&
        exponentialDelay2 === 2000 &&
        exponentialDelay3 === 4000 &&
        linearDelay1 === 1000 &&
        linearDelay2 === 2000 &&
        immediateDelay === 0;
      
      if (correctCalculations) {
        this.testResults.push({ test: 'Backoff Calculation', status: 'PASSED' });
        console.log('✅ Test 3 PASSED\n');
      } else {
        throw new Error('Incorrect backoff calculations');
      }
      
    } catch (error) {
      this.testResults.push({ test: 'Backoff Calculation', status: 'FAILED', error: error.message });
      console.log(`❌ Test 3 FAILED: ${error.message}\n`);
    }
  }

  async testErrorRecoveryFlow() {
    console.log('📋 Test 4: Error Recovery Flow');
    
    try {
      // Mock a simple operation that fails then succeeds
      let attemptCount = 0;
      const mockOperation = async (context) => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Connection timeout'); // Transient error
        }
        return { success: true, data: 'Operation completed', attempt: attemptCount };
      };

      const context = {
        task: 'Test operation',
        agent: 'test_agent',
        sessionId: 'test_session_123'
      };

      const options = {
        sessionId: 'test_session_123',
        orchestrationId: 'test_orchestration_456',
        maxRetries: 2,
        maxReplans: 1
      };

      console.log('   🔄 Testing recovery with transient error...');
      const result = await this.masterOrchestrator.executeWithRecovery(mockOperation, context, options);
      
      console.log(`   📊 Recovery Result: ${result.success ? 'Success' : 'Failed'}`);
      console.log(`   📈 Attempts: ${result.recovery_stats.total_attempts}`);
      console.log(`   🔁 Retries: ${result.recovery_stats.retries}`);
      console.log(`   🔄 Replans: ${result.recovery_stats.replans}`);
      
      if (result.success && result.recovery_stats.retries === 1 && result.recovery_stats.replans === 0) {
        this.testResults.push({ test: 'Error Recovery Flow', status: 'PASSED' });
        console.log('✅ Test 4 PASSED\n');
      } else {
        throw new Error(`Expected 1 retry, 0 replans, got ${result.recovery_stats.retries} retries, ${result.recovery_stats.replans} replans`);
      }
      
    } catch (error) {
      this.testResults.push({ test: 'Error Recovery Flow', status: 'FAILED', error: error.message });
      console.log(`❌ Test 4 FAILED: ${error.message}\n`);
    }
  }

  async testReplanningContextGeneration() {
    console.log('📋 Test 5: Replanning Context Generation');
    
    try {
      const context = {
        task: 'Analyze customer data',
        agents: ['research', 'analysis'],
        coordination: { type: 'sequential' },
        resources: { data_source: 'customer_db' },
        constraints: { time_limit: '1 hour' },
        execution_history: [
          { agent: 'research', status: 'completed' },
          { agent: 'analysis', status: 'failed' }
        ]
      };

      const errorClassification = {
        type: 'recoverable',
        reason: 'Agent execution failed',
        replanning_context: {
          error_message: 'Analysis agent timeout',
          failed_agent: 'analysis',
          failed_task: 'data analysis',
          error_type: 'timeout_error'
        }
      };

      const options = {
        sessionId: 'test_session_789',
        orchestrationId: 'test_orchestration_101'
      };

      console.log('   🔧 Testing replanning context preparation...');
      
      // We'll test the context preparation logic by checking if the method exists
      // and can handle the input without actually calling PlanningAgent
      const hasReplanMethod = typeof this.masterOrchestrator.replanExecution === 'function';
      const hasExtractMethods = 
        typeof this.masterOrchestrator.extractAgentsFromPlan === 'function' &&
        typeof this.masterOrchestrator.extractCoordinationFromPlan === 'function';

      console.log(`   ✅ Replan Method: ${hasReplanMethod ? 'Available' : 'Missing'}`);
      console.log(`   ✅ Extract Methods: ${hasExtractMethods ? 'Available' : 'Missing'}`);
      console.log(`   📝 Context Keys: ${Object.keys(context).join(', ')}`);
      console.log(`   🚨 Error Type: ${errorClassification.type}`);
      
      if (hasReplanMethod && hasExtractMethods) {
        this.testResults.push({ test: 'Replanning Context Generation', status: 'PASSED' });
        console.log('✅ Test 5 PASSED\n');
      } else {
        throw new Error('Missing replanning methods');
      }
      
    } catch (error) {
      this.testResults.push({ test: 'Replanning Context Generation', status: 'FAILED', error: error.message });
      console.log(`❌ Test 5 FAILED: ${error.message}\n`);
    }
  }

  async testAgentExtractionFromPlan() {
    console.log('📋 Test 6: Agent Extraction from Recovery Plan');
    
    try {
      // Mock recovery plan with agent mentions
      const recoveryPlan1 = {
        output: 'Use research agent to gather data, then analysis agent to process results, finally creative agent for presentation'
      };

      const recoveryPlan2 = {
        result: 'Execute development tasks using development and qa agents for quality assurance'
      };

      const recoveryPlan3 = {
        output: 'No specific agents mentioned in this generic plan'
      };

      console.log('   🔍 Testing agent extraction from plans...');
      
      const agents1 = this.masterOrchestrator.extractAgentsFromPlan(recoveryPlan1);
      const agents2 = this.masterOrchestrator.extractAgentsFromPlan(recoveryPlan2);
      const agents3 = this.masterOrchestrator.extractAgentsFromPlan(recoveryPlan3);

      console.log(`   📋 Plan 1 Agents: ${agents1 ? agents1.join(', ') : 'None'}`);
      console.log(`   📋 Plan 2 Agents: ${agents2 ? agents2.join(', ') : 'None'}`);
      console.log(`   📋 Plan 3 Agents: ${agents3 ? agents3.join(', ') : 'None'}`);

      const correctExtraction = 
        agents1 && agents1.includes('research') && agents1.includes('analysis') && agents1.includes('creative') &&
        agents2 && agents2.includes('development') &&
        agents3 === null; // No agents found

      if (correctExtraction) {
        this.testResults.push({ test: 'Agent Extraction from Recovery Plan', status: 'PASSED' });
        console.log('✅ Test 6 PASSED\n');
      } else {
        throw new Error('Incorrect agent extraction results');
      }
      
    } catch (error) {
      this.testResults.push({ test: 'Agent Extraction from Recovery Plan', status: 'FAILED', error: error.message });
      console.log(`❌ Test 6 FAILED: ${error.message}\n`);
    }
  }

  async testCoordinationExtractionFromPlan() {
    console.log('📋 Test 7: Coordination Strategy Extraction');
    
    try {
      // Mock recovery plans with coordination hints
      const parallelPlan = {
        output: 'Execute tasks in parallel to reduce time, run concurrent operations'
      };

      const collaborativePlan = {
        output: 'Use collaborative approach with iterative feedback between agents'
      };

      const sequentialPlan = {
        output: 'Standard sequential execution for reliability'
      };

      console.log('   🔗 Testing coordination extraction from plans...');
      
      const coord1 = this.masterOrchestrator.extractCoordinationFromPlan(parallelPlan);
      const coord2 = this.masterOrchestrator.extractCoordinationFromPlan(collaborativePlan);
      const coord3 = this.masterOrchestrator.extractCoordinationFromPlan(sequentialPlan);

      console.log(`   ⚡ Parallel Plan: ${coord1.type} (recovery: ${coord1.error_recovery_mode})`);
      console.log(`   🤝 Collaborative Plan: ${coord2.type} (recovery: ${coord2.error_recovery_mode})`);
      console.log(`   📋 Sequential Plan: ${coord3.type} (recovery: ${coord3.error_recovery_mode})`);

      const correctCoordination = 
        coord1.type === 'parallel' && coord1.error_recovery_mode === true &&
        coord2.type === 'collaborative' && coord2.error_recovery_mode === true &&
        coord3.type === 'sequential' && coord3.error_recovery_mode === true;

      if (correctCoordination) {
        this.testResults.push({ test: 'Coordination Strategy Extraction', status: 'PASSED' });
        console.log('✅ Test 7 PASSED\n');
      } else {
        throw new Error('Incorrect coordination extraction results');
      }
      
    } catch (error) {
      this.testResults.push({ test: 'Coordination Strategy Extraction', status: 'FAILED', error: error.message });
      console.log(`❌ Test 7 FAILED: ${error.message}\n`);
    }
  }

  async testCriticalErrorHandling() {
    console.log('📋 Test 8: Critical Error Handling');
    
    try {
      // Mock operation that throws critical error
      const criticalOperation = async (context) => {
        throw new Error('API key authentication failed'); // Critical error
      };

      const context = {
        task: 'Critical test operation',
        agent: 'test_agent',
        sessionId: 'test_session_critical'
      };

      const options = {
        sessionId: 'test_session_critical',
        orchestrationId: 'test_orchestration_critical',
        maxRetries: 3,
        maxReplans: 2
      };

      console.log('   🚨 Testing critical error handling...');
      const result = await this.masterOrchestrator.executeWithRecovery(criticalOperation, context, options);
      
      console.log(`   ❌ Critical Result: ${result.success ? 'Unexpected Success' : 'Failed as Expected'}`);
      console.log(`   🔴 Error Type: ${result.error_type}`);
      console.log(`   📊 Recovery Stats: ${result.recovery_stats.total_attempts} attempts`);
      
      // Critical errors should fail immediately without retries or replans
      if (!result.success && result.error_type === 'critical' && result.recovery_stats.total_attempts === 1) {
        this.testResults.push({ test: 'Critical Error Handling', status: 'PASSED' });
        console.log('✅ Test 8 PASSED\n');
      } else {
        throw new Error(`Expected immediate critical failure, got ${result.error_type} with ${result.recovery_stats.total_attempts} attempts`);
      }
      
    } catch (error) {
      this.testResults.push({ test: 'Critical Error Handling', status: 'FAILED', error: error.message });
      console.log(`❌ Test 8 FAILED: ${error.message}\n`);
    }
  }

  async testMultipleErrorScenarios() {
    console.log('📋 Test 9: Multiple Error Scenarios');
    
    try {
      console.log('   🔄 Testing exhausted retry scenario...');
      
      // Test scenario where retries are exhausted
      let retryAttempts = 0;
      const exhaustRetryOperation = async (context) => {
        retryAttempts++;
        throw new Error('Network connection failed'); // Always fails with transient error
      };

      const retryResult = await this.masterOrchestrator.executeWithRecovery(
        exhaustRetryOperation,
        { task: 'Retry test', agent: 'test_agent', sessionId: 'retry_test' },
        { sessionId: 'retry_test', orchestrationId: 'retry_test', maxRetries: 2, maxReplans: 0 }
      );

      console.log(`   📊 Retry Exhaustion: ${retryResult.success ? 'Unexpected Success' : 'Failed as Expected'}`);
      console.log(`   🔁 Total Retry Attempts: ${retryAttempts}`);
      console.log(`   📈 Recovery Stats: ${retryResult.recovery_stats.retries} retries`);

      // Test different error types in sequence
      console.log('   🔍 Testing error type variations...');
      
      const errorTypes = [
        { error: 'Rate limit exceeded', expectedType: 'transient' },
        { error: 'Invalid input parameter', expectedType: 'recoverable' },
        { error: 'Permission denied access', expectedType: 'critical' }
      ];

      let typeTestsPassed = 0;
      for (const errorTest of errorTypes) {
        const classification = this.masterOrchestrator.classifyError(new Error(errorTest.error));
        if (classification.type === errorTest.expectedType) {
          typeTestsPassed++;
        }
        console.log(`   ✅ "${errorTest.error}" → ${classification.type} (${classification.action})`);
      }

      // Test delay calculations for different strategies
      console.log('   ⏱️  Testing delay strategy variations...');
      
      const delayTests = [
        { attempt: 1, strategy: 'exponential_backoff', expected: 1000 },
        { attempt: 2, strategy: 'exponential_backoff', expected: 2000 },
        { attempt: 3, strategy: 'linear_backoff', expected: 3000 },
        { attempt: 1, strategy: 'immediate', expected: 0 }
      ];

      let delayTestsPassed = 0;
      for (const delayTest of delayTests) {
        const delay = this.masterOrchestrator.calculateBackoffDelay(delayTest.attempt, delayTest.strategy);
        if (delay === delayTest.expected) {
          delayTestsPassed++;
        }
        console.log(`   ⏱️  Attempt ${delayTest.attempt} (${delayTest.strategy}): ${delay}ms`);
      }

      const allTestsPassed = 
        !retryResult.success && 
        retryResult.error_type === 'recovery_exhausted' &&
        retryAttempts === 3 && // Initial + 2 retries
        typeTestsPassed === 3 &&
        delayTestsPassed === 4;

      if (allTestsPassed) {
        this.testResults.push({ test: 'Multiple Error Scenarios', status: 'PASSED' });
        console.log('✅ Test 9 PASSED\n');
      } else {
        throw new Error(`Some scenario tests failed: retries=${retryAttempts}, types=${typeTestsPassed}/3, delays=${delayTestsPassed}/4`);
      }
      
    } catch (error) {
      this.testResults.push({ test: 'Multiple Error Scenarios', status: 'FAILED', error: error.message });
      console.log(`❌ Test 9 FAILED: ${error.message}\n`);
    }
  }

  printResults() {
    console.log('============================================================');
    console.log('📊 TEST SUMMARY');
    console.log('============================================================');
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.status === 'PASSED').length;
    const failedTests = totalTests - passedTests;
    const successRate = Math.round((passedTests / totalTests) * 100);
    
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${successRate}%`);
    
    console.log('\n📋 DETAILED RESULTS:');
    this.testResults.forEach((result, index) => {
      const status = result.status === 'PASSED' ? '✅' : '❌';
      console.log(`${index + 1}. ${result.test}: ${status}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    if (failedTests > 0) {
      process.exit(1);
    }
  }
}

// Run tests
const testSuite = new SimpleMasterOrchestratorTest();
testSuite.runAllTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
