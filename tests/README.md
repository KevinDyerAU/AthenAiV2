# AthenAI Agent Testing Framework

This directory contains the testing framework for the AthenAI agent functions extracted from the n8n workflows. The tests allow you to validate agent functionality independently of the n8n environment.

## 📁 Directory Structure

```
tests/
├── README.md                 # This file
├── agents/
│   └── testRunner.js         # Main test runner for all agents
└── [future test directories]
```

## 🚀 Quick Start

### Prerequisites

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Verify Installation**
   ```bash
   node -e "console.log('Node.js is working!')"
   ```

### Running Tests

#### Run All Agent Tests
```bash
npm test
# or
npm run test:agents
# or directly
node tests/agents/testRunner.js
```

#### Run Specific Agent Tests
```bash
# Test only Master Orchestrator
node -e "
const { AgentTestRunner } = require('./tests/agents/testRunner');
const runner = new AgentTestRunner();
runner.testMasterOrchestrator().then(() => runner.printResults());
"

# Test only Research Agent
node -e "
const { AgentTestRunner } = require('./tests/agents/testRunner');
const runner = new AgentTestRunner();
runner.testResearchAgent().then(() => runner.printResults());
"
```

## 🧪 Test Coverage

### Master Orchestrator Tests
- ✅ Task complexity analysis
- ✅ Agent routing logic
- ✅ Detailed plan creation
- ✅ Error handling

### Research Agent Tests
- ✅ Data point extraction
- ✅ Trend identification
- ✅ Source reliability assessment
- ✅ Confidence score calculation

### Analysis Agent Tests
- ✅ Numerical data parsing
- ✅ Statistical calculations
- ✅ Trend analysis
- ✅ Pattern detection

### Creative Agent Tests
- ✅ Content structure analysis
- ✅ Tone analysis
- ✅ Readability assessment
- ✅ Engagement scoring

## 🔧 How to Use Individual Agent Functions

### Master Orchestrator Example

```javascript
const { MasterOrchestrator } = require('../src/agents');

// Initialize without LangSmith for testing
const orchestrator = new MasterOrchestrator('test-key', { enabled: false });

// Test task complexity analysis
const complexity = orchestrator.analyzeTaskComplexity("Create a comprehensive market analysis");
console.log(`Complexity: ${complexity.level}, Score: ${complexity.score}`);

// Test agent routing
const routing = orchestrator.determineAgentRouting("Research AI trends", complexity);
console.log(`Primary Agent: ${routing.primary}`);
console.log(`Collaborators: ${routing.collaborators.join(', ')}`);
```

### Research Agent Example

```javascript
const { ResearchAgent } = require('../src/agents');

const researchAgent = new ResearchAgent('test-key', { enabled: false }, {});

// Extract data points from text
const text = "Sales increased by 25% to $2.5 million in Q4 2024";
const dataPoints = researchAgent.extractDataPoints(text);
console.log('Data Points:', dataPoints);

// Assess source reliability
const reliability = researchAgent.assessSourceReliability('wikipedia');
console.log('Source Reliability:', reliability);
```

### Analysis Agent Example

```javascript
const { AnalysisAgent } = require('../src/agents');

const analysisAgent = new AnalysisAgent('test-key', { enabled: false });

// Parse numerical data
const data = "Values: 100, 150, 200, 175, 225";
const numbers = analysisAgent.parseNumericalData(data);
console.log('Parsed Numbers:', numbers);

// Calculate statistics
const stats = analysisAgent.calculateStatistics(numbers);
console.log(`Mean: ${stats.mean}, StdDev: ${stats.stdDev}`);
```

### Creative Agent Example

```javascript
const { CreativeAgent } = require('../src/agents');

const creativeAgent = new CreativeAgent('test-key', { enabled: false });

// Analyze content structure
const content = "Introduction. Main points follow. Conclusion at the end.";
const structure = creativeAgent.analyzeContentStructure(content);
console.log('Content Structure:', structure);

// Calculate readability
const readability = creativeAgent.calculateReadability(content);
console.log('Readability:', readability);
```

## 🛠 Creating Custom Tests

### Adding New Test Cases

1. **Extend the Test Runner**
   ```javascript
   // In testRunner.js
   async testCustomFunction() {
     console.log('🔧 Testing Custom Function...');
     
     try {
       const agent = new YourAgent('test-key', this.mockConfig);
       const result = agent.yourCustomFunction('test input');
       
       console.log(`  ✅ Custom test passed: ${result}`);
       this.testResults.push({ agent: 'YourAgent', status: 'PASS', tests: 1 });
       
     } catch (error) {
       console.log(`  ❌ Custom test failed: ${error.message}`);
       this.testResults.push({ agent: 'YourAgent', status: 'FAIL', error: error.message });
     }
   }
   ```

2. **Create Standalone Test Files**
   ```javascript
   // tests/agents/customTest.js
   const { YourAgent } = require('../../src/agents');
   
   async function runCustomTest() {
     const agent = new YourAgent('test-key', { enabled: false });
     
     // Your test logic here
     const result = await agent.someFunction('test data');
     
     console.log('Test Result:', result);
   }
   
   if (require.main === module) {
     runCustomTest().catch(console.error);
   }
   ```

### Mock Data Patterns

```javascript
// Mock configuration for testing (disables external APIs)
const mockConfig = {
  enabled: false,
  project: "test-project"
};

// Mock search API keys (empty for testing)
const mockSearchKeys = {};

// Sample test data structures
const mockResearchFindings = {
  key_findings: ['Finding 1', 'Finding 2', 'Finding 3'],
  data_points: [{ value: '15%' }, { value: '$2.5M' }],
  detailed_analysis: 'Comprehensive analysis text...',
  gaps: ['Gap 1']
};

const mockAnalysisResults = {
  statistical_summary: { mean: 150, median: 145 },
  pattern_analysis: { recurring: ['pattern1'], anomalies: [] },
  trend_identification: { direction: 'increasing', confidence: 0.8 }
};
```

## 🐛 Debugging and Troubleshooting

### Common Issues

1. **Module Not Found Errors**
   ```bash
   # Install missing dependencies
   npm install @langchain/openai @langchain/core @langchain/community langchain
   ```

2. **Test Failures**
   - Check that all agent files are properly exported
   - Verify mock configurations are set correctly
   - Ensure test data matches expected formats

3. **Performance Issues**
   - Tests run with mocked APIs (no external calls)
   - If tests are slow, check for infinite loops in logic
   - Use `console.log` for debugging specific functions

### Debugging Individual Functions

```javascript
// Enable verbose logging
const agent = new MasterOrchestrator('test-key', { enabled: false });

// Test with debug output
console.log('Input:', testInput);
const result = agent.someFunction(testInput);
console.log('Output:', result);
console.log('Type:', typeof result);
console.log('Length:', result.length || 'N/A');
```

### Test Data Validation

```javascript
// Validate test results
function validateTestResult(result, expectedType) {
  if (typeof result !== expectedType) {
    throw new Error(`Expected ${expectedType}, got ${typeof result}`);
  }
  
  if (expectedType === 'object' && result === null) {
    throw new Error('Result is null');
  }
  
  if (expectedType === 'array' && !Array.isArray(result)) {
    throw new Error('Expected array, got object');
  }
}
```

## 📊 Test Output Interpretation

### Success Output Example
```
🧪 Starting Agent Function Tests...

🎯 Testing Master Orchestrator...
  ✅ Task complexity analysis: medium (score: 3.5)
  ✅ Agent routing: research with collaborators: analysis
  ✅ Detailed plan created with 4 steps

📋 Test Results Summary:
========================
✅ MasterOrchestrator: PASS
   Tests completed: 3

📊 Overall Results:
Agents Passed: 4/4
Total Tests: 15
Success Rate: 100.0%
```

### Failure Output Example
```
❌ ResearchAgent: FAIL
   Error: Cannot read property 'length' of undefined

📊 Overall Results:
Agents Passed: 3/4
Total Tests: 12
Success Rate: 75.0%
```

## 🔄 Integration with n8n Workflows

### Using Tested Functions in Workflows

After testing functions locally, you can integrate them into n8n workflows:

```javascript
// In n8n LangChain Code Node
const { MasterOrchestrator } = require('/path/to/src/agents');

// Initialize with real API keys and LangSmith config
const orchestrator = new MasterOrchestrator(
  $credentials('openAi').apiKey,
  {
    enabled: true,
    project: "athenai-production"
  }
);

// Use tested function
const result = await orchestrator.executeOrchestration($json);
return [{ json: result }];
```

## 📝 Contributing

### Adding New Tests

1. Create test functions in `testRunner.js`
2. Follow the existing pattern for error handling
3. Update the `runAllTests()` method to include new tests
4. Document new test cases in this README

### Test Guidelines

- ✅ Test core logic without external API calls
- ✅ Use mock data that represents real scenarios
- ✅ Include both success and failure test cases
- ✅ Validate return types and data structures
- ✅ Keep tests fast and independent

### Code Quality

- Use consistent error handling patterns
- Include descriptive test names and output
- Comment complex test logic
- Follow existing code style and structure

## 🆘 Support

For issues with the testing framework:

1. Check this README for common solutions
2. Review the test output for specific error messages
3. Verify all dependencies are installed correctly
4. Test individual functions in isolation
5. Check the main project README for additional context

## 📚 Related Documentation

- [Main Project README](../README.md)
- [Workflow Documentation](../workflows/langchaincode/README.md)
- [Agent Source Code](../src/agents/)
- [LangChain Documentation](https://js.langchain.com/docs/)

---

**Happy Testing! 🧪✨**
