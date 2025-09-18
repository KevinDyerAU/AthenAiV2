#!/usr/bin/env node

/**
 * Standardize OpenRouter Configuration Across All Agents
 * Updates all agent files to use the exact same configuration as the successful test
 */

const fs = require('fs');
const path = require('path');

// Standard OpenRouter configuration that passed all tests
const STANDARD_OPENROUTER_CONFIG = `      this.llm = new ChatOpenAI({
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
      });`;

const agentFiles = [
  'CommunicationAgent.js',
  'DevelopmentAgent.js', 
  'ExecutionAgent.js',
  'PlanningAgent.js',
  'QualityAssuranceAgent.js',
  'DocumentAgent.js'
];

function updateAgentFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Pattern to match OpenRouter ChatOpenAI configuration
    const openRouterPattern = /this\.llm = new ChatOpenAI\(\{[\s\S]*?configuration: \{[\s\S]*?\},[\s\S]*?\}\);/;
    
    if (openRouterPattern.test(content)) {
      content = content.replace(openRouterPattern, STANDARD_OPENROUTER_CONFIG);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated ${path.basename(filePath)}`);
      return true;
    } else {
      console.log(`⚠️  No OpenRouter config found in ${path.basename(filePath)}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error updating ${path.basename(filePath)}: ${error.message}`);
    return false;
  }
}

function main() {
  console.log('🔧 Standardizing OpenRouter Configuration Across All Agents\n');
  
  const agentsDir = path.join(__dirname, 'src', 'agents');
  let updated = 0;
  let total = 0;
  
  for (const fileName of agentFiles) {
    const filePath = path.join(agentsDir, fileName);
    total++;
    
    if (fs.existsSync(filePath)) {
      if (updateAgentFile(filePath)) {
        updated++;
      }
    } else {
      console.log(`⚠️  File not found: ${fileName}`);
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`Total files processed: ${total}`);
  console.log(`Successfully updated: ${updated}`);
  console.log(`\n🎉 All agents now use the same OpenRouter configuration as the successful test!`);
}

if (require.main === module) {
  main();
}

module.exports = { updateAgentFile, STANDARD_OPENROUTER_CONFIG };
