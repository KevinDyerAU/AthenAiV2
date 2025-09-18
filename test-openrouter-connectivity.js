#!/usr/bin/env node

/**
 * OpenRouter API Connectivity Test
 * Tests .env variable loading and OpenRouter API connectivity
 */

require('dotenv').config();
const { ChatOpenAI } = require('@langchain/openai');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const { PromptTemplate } = require('@langchain/core/prompts');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

async function testEnvironmentVariables() {
  logSection('🔧 Environment Variables Test');
  
  const requiredVars = [
    'USE_OPENROUTER',
    'OPENROUTER_API_KEY',
    'OPENROUTER_MODEL',
    'OPENROUTER_BASE_URL',
    'OPENROUTER_TEMPERATURE'
  ];
  
  const optionalVars = [
    'OPENAI_API_KEY',
    'OPENAI_MODEL',
    'OPENAI_TEMPERATURE'
  ];
  
  let allRequired = true;
  
  // Test required variables
  log('Required OpenRouter Variables:', 'bright');
  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (value) {
      if (varName.includes('API_KEY')) {
        log(`✅ ${varName}: ${value.substring(0, 10)}...${value.substring(value.length - 4)} (${value.length} chars)`, 'green');
      } else {
        log(`✅ ${varName}: ${value}`, 'green');
      }
    } else {
      log(`❌ ${varName}: NOT SET`, 'red');
      allRequired = false;
    }
  }
  
  // Test optional variables
  log('\nOptional OpenAI Variables:', 'bright');
  for (const varName of optionalVars) {
    const value = process.env[varName];
    if (value) {
      if (varName.includes('API_KEY')) {
        log(`✅ ${varName}: ${value.substring(0, 10)}...${value.substring(value.length - 4)} (${value.length} chars)`, 'yellow');
      } else {
        log(`✅ ${varName}: ${value}`, 'yellow');
      }
    } else {
      log(`⚠️  ${varName}: NOT SET`, 'yellow');
    }
  }
  
  return allRequired;
}

async function testOpenRouterClient() {
  logSection('🤖 OpenRouter Client Initialization Test');
  
  try {
    const client = new ChatOpenAI({
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
    
    log('✅ OpenRouter client initialized successfully', 'green');
    log(`   Model: ${client.modelName}`, 'blue');
    log(`   Temperature: ${client.temperature}`, 'blue');
    log(`   Base URL: ${process.env.OPENROUTER_BASE_URL}`, 'blue');
    log(`   Timeout: 10000ms`, 'blue');
    log(`   Max Retries: 2`, 'blue');
    
    return client;
  } catch (error) {
    log(`❌ Failed to initialize OpenRouter client: ${error.message}`, 'red');
    throw error;
  }
}

async function testSimpleAPICall(client) {
  logSection('📡 Simple API Call Test');
  
  try {
    const startTime = Date.now();
    log('Sending test message to OpenRouter...', 'yellow');
    
    const response = await client.invoke('Hello! Please respond with exactly: "OpenRouter connection successful"');
    
    const responseTime = Date.now() - startTime;
    
    log('✅ API call successful!', 'green');
    log(`   Response time: ${responseTime}ms`, 'blue');
    log(`   Response: "${response.content}"`, 'blue');
    log(`   Response type: ${typeof response.content}`, 'blue');
    
    return { success: true, responseTime, content: response.content };
  } catch (error) {
    log(`❌ API call failed: ${error.message}`, 'red');
    log(`   Error stack: ${error.stack}`, 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Status Text: ${error.response.statusText}`, 'red');
    }
    throw error;
  }
}

async function testAgentRoutingCall(client) {
  logSection('🎯 Agent Routing Test (AthenAI Style)');
  
  try {
    const routingPrompt = PromptTemplate.fromTemplate(`
You are an intelligent agent router for AthenAI. Analyze the user's message and determine which specialized agent should handle it.

Available agents:
- research: Information gathering, fact-checking, web searches, academic research
- analysis: Data analysis, statistical analysis, trend detection, pattern recognition
- creative: Content creation, writing, brainstorming, design concepts
- development: Code generation, technical implementation, debugging, architecture
- planning: Project planning, task breakdown, resource allocation, timeline creation
- execution: Task execution, workflow management, process automation
- communication: Message formatting, external communications, presentations
- qa: Quality assurance, testing, validation, review processes
- document: Document processing, file management, content extraction
- general: For casual conversation, greetings, simple questions

Message: "Hello! Can you help me analyze sales data trends for Q3?"

Think through your reasoning, then respond with ONLY the agent name.`);

    const chain = routingPrompt.pipe(client).pipe(new StringOutputParser());
    
    const startTime = Date.now();
    log('Testing agent routing logic...', 'yellow');
    
    const response = await chain.invoke({});
    const responseTime = Date.now() - startTime;
    
    log('✅ Agent routing test successful!', 'green');
    log(`   Response time: ${responseTime}ms`, 'blue');
    log(`   Selected agent: "${response.trim()}"`, 'blue');
    log(`   Expected: "analysis"`, 'blue');
    
    const isCorrect = response.trim().toLowerCase() === 'analysis';
    log(`   Routing accuracy: ${isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}`, isCorrect ? 'green' : 'red');
    
    return { success: true, responseTime, selectedAgent: response.trim(), isCorrect };
  } catch (error) {
    log(`❌ Agent routing test failed: ${error.message}`, 'red');
    throw error;
  }
}

async function testErrorHandling(client) {
  logSection('⚠️  Error Handling Test');
  
  try {
    log('Testing timeout handling...', 'yellow');
    
    // Create a client with very short timeout
    const timeoutClient = new ChatOpenAI({
      modelName: process.env.OPENROUTER_MODEL || 'openai/gpt-4',
      temperature: 0.1,
      openAIApiKey: process.env.OPENROUTER_API_KEY,
      configuration: {
        baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': 'https://athenai.local',
          'X-Title': 'AthenAI System'
        }
      },
      timeout: 1, // 1ms timeout to force timeout
      maxRetries: 0
    });
    
    try {
      await timeoutClient.invoke('This should timeout');
      log('⚠️  Timeout test did not timeout as expected', 'yellow');
    } catch (timeoutError) {
      log('✅ Timeout handling works correctly', 'green');
      log(`   Error type: ${timeoutError.name}`, 'blue');
      log(`   Error message: ${timeoutError.message}`, 'blue');
    }
    
    return { success: true };
  } catch (error) {
    log(`❌ Error handling test failed: ${error.message}`, 'red');
    throw error;
  }
}

async function testSimpleHelloCall(client) {
  logSection('👋 Simple Hello Call Test');
  
  try {
    const startTime = Date.now();
    log('Sending simple hello to OpenRouter...', 'yellow');
    
    const response = await client.invoke('Hello');
    const responseTime = Date.now() - startTime;
    
    log('✅ Hello call successful!', 'green');
    log(`   Response time: ${responseTime}ms`, 'blue');
    log(`   Response: "${response.content}"`, 'blue');
    log(`   Response length: ${response.content.length} characters`, 'blue');
    
    // Check if response is reasonable
    const isReasonable = response.content && response.content.length > 5 && response.content.length < 500;
    log(`   Response quality: ${isReasonable ? '✅ GOOD' : '⚠️  UNUSUAL'}`, isReasonable ? 'green' : 'yellow');
    
    return { success: true, responseTime, content: response.content, isReasonable };
  } catch (error) {
    log(`❌ Hello call failed: ${error.message}`, 'red');
    log(`   Error stack: ${error.stack}`, 'red');
    throw error;
  }
}

async function runAllTests() {
  const startTime = Date.now();
  
  log('🚀 AthenAI OpenRouter Connectivity Test Suite', 'bright');
  log(`Started at: ${new Date().toISOString()}`, 'blue');
  
  const results = {
    environmentVariables: false,
    clientInitialization: false,
    simpleAPICall: false,
    agentRouting: false,
    simpleHelloCall: false,
    errorHandling: false
  };
  
  try {
    // Test 1: Environment Variables
    results.environmentVariables = await testEnvironmentVariables();
    
    if (!results.environmentVariables) {
      throw new Error('Required environment variables are missing');
    }
    
    // Test 2: Client Initialization
    const client = await testOpenRouterClient();
    results.clientInitialization = true;
    
    // Test 3: Simple API Call
    const apiResult = await testSimpleAPICall(client);
    results.simpleAPICall = apiResult.success;
    
    // Test 4: Agent Routing
    const routingResult = await testAgentRoutingCall(client);
    results.agentRouting = routingResult.success;
    
    // Test 5: Simple Hello Call
    const helloResult = await testSimpleHelloCall(client);
    results.simpleHelloCall = helloResult.success;
    
    // Test 6: Error Handling
    const errorResult = await testErrorHandling(client);
    results.errorHandling = errorResult.success;
    
  } catch (error) {
    log(`\n❌ Test suite failed: ${error.message}`, 'red');
  }
  
  // Summary
  logSection('📊 Test Results Summary');
  
  const tests = [
    { name: 'Environment Variables', result: results.environmentVariables },
    { name: 'Client Initialization', result: results.clientInitialization },
    { name: 'Simple API Call', result: results.simpleAPICall },
    { name: 'Agent Routing', result: results.agentRouting },
    { name: 'Simple Hello Call', result: results.simpleHelloCall },
    { name: 'Error Handling', result: results.errorHandling }
  ];
  
  let passedTests = 0;
  for (const test of tests) {
    const status = test.result ? '✅ PASS' : '❌ FAIL';
    const color = test.result ? 'green' : 'red';
    log(`${test.name}: ${status}`, color);
    if (test.result) passedTests++;
  }
  
  const totalTime = Date.now() - startTime;
  log(`\nTotal tests: ${tests.length}`, 'blue');
  log(`Passed: ${passedTests}`, passedTests === tests.length ? 'green' : 'yellow');
  log(`Failed: ${tests.length - passedTests}`, tests.length - passedTests === 0 ? 'green' : 'red');
  log(`Total time: ${totalTime}ms`, 'blue');
  
  if (passedTests === tests.length) {
    log('\n🎉 All tests passed! OpenRouter connectivity is working correctly.', 'green');
    process.exit(0);
  } else {
    log('\n💥 Some tests failed. Please check your configuration.', 'red');
    process.exit(1);
  }
}

// Run the test suite
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = {
  testEnvironmentVariables,
  testOpenRouterClient,
  testSimpleAPICall,
  testAgentRoutingCall,
  testSimpleHelloCall,
  testErrorHandling,
  runAllTests
};
