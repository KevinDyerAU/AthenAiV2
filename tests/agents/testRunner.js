// Test Runner for Agent Functions
const { MasterOrchestrator, ResearchAgent, AnalysisAgent, CreativeAgent } = require('../../src/agents');

class AgentTestRunner {
  constructor() {
    this.testResults = [];
    this.mockConfig = {
      enabled: false, // Disable LangSmith for testing
      project: 'test-project'
    };
  }

  async runAllTests() {
    console.log('🧪 Starting Agent Function Tests...\n');
    
    await this.testMasterOrchestrator();
    await this.testResearchAgent();
    await this.testAnalysisAgent();
    await this.testCreativeAgent();
    
    this.printResults();
  }

  async testMasterOrchestrator() {
    console.log('🎯 Testing Master Orchestrator...');
    
    try {
      const orchestrator = new MasterOrchestrator('test-key', this.mockConfig);
      
      // Test task complexity analysis
      const complexity = orchestrator.analyzeTaskComplexity('Create a comprehensive analysis of market trends');
      console.log(`  ✅ Task complexity analysis: ${complexity.level} (score: ${complexity.score})`);
      
      // Test agent routing
      const routing = orchestrator.determineAgentRouting('Research the latest AI developments', complexity);
      console.log(`  ✅ Agent routing: ${routing.primary} with collaborators: ${routing.collaborators.join(', ')}`);
      
      // Test plan creation
      const plan = orchestrator.createDetailedPlan('Analyze market data', complexity, routing);
      console.log(`  ✅ Detailed plan created with ${plan.length} steps`);
      
      this.testResults.push({ agent: 'MasterOrchestrator', status: 'PASS', tests: 3 });
      
    } catch (error) {
      console.log(`  ❌ Master Orchestrator test failed: ${error.message}`);
      this.testResults.push({ agent: 'MasterOrchestrator', status: 'FAIL', error: error.message });
    }
  }

  async testResearchAgent() {
    console.log('🔍 Testing Research Agent...');
    
    try {
      const researchAgent = new ResearchAgent('test-key', this.mockConfig, {});
      
      // Test data extraction
      const testData = 'The market grew by 15% in 2024. Revenue increased to $2.5 million.';
      const dataPoints = researchAgent.extractDataPoints(testData);
      console.log(`  ✅ Data points extracted: ${dataPoints.length} points`);
      
      // Test trend identification
      const trends = researchAgent.identifyTrends(testData);
      console.log(`  ✅ Trends identified: ${trends.length} trends`);
      
      // Test source reliability assessment
      const reliability = researchAgent.assessSourceReliability('wikipedia');
      console.log(`  ✅ Source reliability assessment: ${reliability}`);
      
      // Test confidence score calculation
      const mockFindings = {
        key_findings: ['Finding 1', 'Finding 2', 'Finding 3'],
        data_points: [{ value: '15%' }, { value: '$2.5M' }],
        detailed_analysis: 'This is a detailed analysis with over 1000 characters. '.repeat(20),
        gaps: ['Gap 1']
      };
      const confidence = researchAgent.calculateConfidenceScore(mockFindings);
      console.log(`  ✅ Confidence score calculated: ${confidence}`);
      
      this.testResults.push({ agent: 'ResearchAgent', status: 'PASS', tests: 4 });
      
    } catch (error) {
      console.log(`  ❌ Research Agent test failed: ${error.message}`);
      this.testResults.push({ agent: 'ResearchAgent', status: 'FAIL', error: error.message });
    }
  }

  async testAnalysisAgent() {
    console.log('📊 Testing Analysis Agent...');
    
    try {
      const analysisAgent = new AnalysisAgent('test-key', this.mockConfig);
      
      // Test numerical data parsing
      const testData = 'Sales: 100, 150, 200, 175, 225';
      const numbers = analysisAgent.parseNumericalData(testData);
      console.log(`  ✅ Numerical data parsed: ${numbers.length} values`);
      
      // Test statistical calculations
      const stats = analysisAgent.calculateStatistics(numbers);
      console.log(`  ✅ Statistics calculated - Mean: ${stats.mean.toFixed(2)}, StdDev: ${stats.stdDev.toFixed(2)}`);
      
      // Test trend analysis
      const trendData = 'The market is increasing rapidly with growing demand and rising prices';
      const trends = analysisAgent.analyzeTrends(trendData);
      console.log(`  ✅ Trend analysis: ${trends.direction} trend with ${trends.strength} strength`);
      
      // Test pattern detection
      const patterns = analysisAgent.detectPatterns('Regular seasonal patterns with recurring monthly cycles');
      console.log(`  ✅ Pattern detection: ${patterns.confidence}% confidence`);
      
      this.testResults.push({ agent: 'AnalysisAgent', status: 'PASS', tests: 4 });
      
    } catch (error) {
      console.log(`  ❌ Analysis Agent test failed: ${error.message}`);
      this.testResults.push({ agent: 'AnalysisAgent', status: 'FAIL', error: error.message });
    }
  }

  async testCreativeAgent() {
    console.log('🎨 Testing Creative Agent...');
    
    try {
      const creativeAgent = new CreativeAgent('test-key', this.mockConfig);
      
      // Test content structure analysis
      const testContent = 'Introduction to the topic. First, we examine the data. Second, we analyze trends. Finally, we conclude with recommendations.';
      const structure = creativeAgent.analyzeContentStructure(testContent);
      console.log(`  ✅ Content structure analyzed: ${structure.sections.length} sections, ${structure.flow} flow`);
      
      // Test tone analysis
      const toneAnalysis = creativeAgent.analyzeTone(testContent);
      console.log(`  ✅ Tone analysis: ${toneAnalysis.current} tone, recommended: ${toneAnalysis.recommended}`);
      
      // Test readability calculation
      const readability = creativeAgent.calculateReadability(testContent);
      console.log(`  ✅ Readability assessment: ${readability}`);
      
      // Test engagement score
      const mockOutput = {
        executive_summary: 'This is a comprehensive summary of our findings and recommendations.',
        main_content: testContent,
        key_takeaways: ['Takeaway 1', 'Takeaway 2', 'Takeaway 3'],
        call_to_action: 'Implement these recommendations immediately for best results.',
        supporting_evidence: ['Evidence 1', 'Evidence 2'],
        style_assessment: { engagement: 'high', clarity: 'high' }
      };
      const engagement = creativeAgent.calculateEngagementScore(mockOutput);
      console.log(`  ✅ Engagement score calculated: ${engagement}`);
      
      this.testResults.push({ agent: 'CreativeAgent', status: 'PASS', tests: 4 });
      
    } catch (error) {
      console.log(`  ❌ Creative Agent test failed: ${error.message}`);
      this.testResults.push({ agent: 'CreativeAgent', status: 'FAIL', error: error.message });
    }
  }

  printResults() {
    console.log('\n📋 Test Results Summary:');
    console.log('========================');
    
    let totalTests = 0;
    let passedAgents = 0;
    
    this.testResults.forEach(result => {
      const status = result.status === 'PASS' ? '✅' : '❌';
      console.log(`${status} ${result.agent}: ${result.status}`);
      
      if (result.status === 'PASS') {
        console.log(`   Tests completed: ${result.tests}`);
        totalTests += result.tests;
        passedAgents++;
      } else {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log('\n📊 Overall Results:');
    console.log(`Agents Passed: ${passedAgents}/${this.testResults.length}`);
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Success Rate: ${((passedAgents / this.testResults.length) * 100).toFixed(1)}%`);
  }
}

// Run tests if called directly
if (require.main === module) {
  const testRunner = new AgentTestRunner();
  testRunner.runAllTests().catch(console.error);
}

module.exports = { AgentTestRunner };
