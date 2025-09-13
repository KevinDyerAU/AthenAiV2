const { EmailAgentTools } = require('./agent_tools');
const { EmailDatabase } = require('./utils/supabase');
const { EmailKnowledgeGraph } = require('./utils/neo4j');
const { createGmailClient } = require('./gmail_client');
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
    new winston.transports.File({ filename: 'logs/email_processor.log' }),
    new winston.transports.Console()
  ]
});

class EmailProcessor {
  constructor() {
    this.db = new EmailDatabase();
    this.kg = new EmailKnowledgeGraph();
    this.gmail = createGmailClient();
    this.tools = new EmailAgentTools(this.db, this.kg, this.gmail);
    
    // Configure tools to prioritize knowledge substrate
    this.tools.setSearchPriority('knowledge_first');
  }

  async processEmail(emailId) {
    let currentState = {
      email_id: emailId,
      processing_stage: 'initial',
      gathered_data: {},
      actions_taken: []
    };

    logger.info('Starting email processing', { email_id: emailId });

    // Create agent session record
    let session;
    try {
      const { data, error } = await this.db.client
        .from('agent_sessions')
        .insert({
          session_type: 'email_processing',
          initial_context: { email_id: emailId },
          current_state: currentState,
          status: 'active'
        })
        .select()
        .single();

      if (error) {
        throw error;
      }
      session = data;
      logger.info('Agent session created', { session_id: session.id });
    } catch (error) {
      logger.error('Failed to create agent session:', error);
      throw error;
    }

    let maxIterations = 10;
    let iteration = 0;

    while (iteration < maxIterations && currentState.processing_stage !== 'completed') {
      try {
        logger.info(`Processing iteration ${iteration + 1}`, { 
          stage: currentState.processing_stage,
          session_id: session.id 
        });

        // Use the thinking function to decide next action
        const decision = await this.tools.think(currentState);
        logger.info('Agent decision made', { 
          tool: decision.tool, 
          reasoning: decision.reasoning 
        });
        
        // Execute the decided tool
        const result = await this.tools[decision.tool](decision.parameters);
        
        // Update state based on result
        if (result.next_stage) {
          currentState.processing_stage = result.next_stage;
        }

        // Store tool result in gathered data
        if (result.email) {
          currentState.gathered_data.email = result.email;
          currentState.gathered_data.email_log_id = result.email_log_id;
        }
        if (result.embedding) {
          currentState.gathered_data.embedding = result.embedding;
        }
        if (result.similar_emails) {
          currentState.gathered_data.similar_emails = result.similar_emails;
        }
        if (result.contacts) {
          currentState.gathered_data.contacts = result.contacts;
        }
        if (result.knowledge_entity_id) {
          currentState.gathered_data.knowledge_entity_id = result.knowledge_entity_id;
        }

        // Record action taken
        currentState.actions_taken.push({
          tool: decision.tool,
          parameters: decision.parameters,
          result: result,
          timestamp: new Date().toISOString(),
          reasoning: decision.reasoning
        });

        // Update processing stage based on the tool used
        if (decision.tool === 'finish') {
          currentState.processing_stage = 'completed';
          
          // Update email log status
          if (currentState.gathered_data.email_log_id) {
            await this.db.updateEmailProcessingStatus(
              currentState.gathered_data.email_log_id,
              result.status === 'completed' ? 'completed' : 'failed',
              currentState.actions_taken
            );
          }
        }

        // Update session in database
        await this.db.client
          .from('agent_sessions')
          .update({
            current_state: currentState,
            agent_sequence: currentState.actions_taken,
            status: currentState.processing_stage === 'completed' ? 'completed' : 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', session.id);

        logger.info('Session state updated', { 
          session_id: session.id,
          stage: currentState.processing_stage,
          actions_count: currentState.actions_taken.length
        });

        iteration++;
      } catch (error) {
        logger.error('Error in email processing iteration:', error);
        currentState.processing_stage = 'failed';
        
        // Update session with error status
        await this.db.client
          .from('agent_sessions')
          .update({
            current_state: currentState,
            status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', session.id);

        // Update email log status if available
        if (currentState.gathered_data.email_log_id) {
          await this.db.updateEmailProcessingStatus(
            currentState.gathered_data.email_log_id,
            'failed',
            currentState.actions_taken
          );
        }

        break;
      }
    }

    if (iteration >= maxIterations && currentState.processing_stage !== 'completed') {
      logger.warn('Email processing reached maximum iterations', { 
        email_id: emailId,
        final_stage: currentState.processing_stage 
      });
      
      currentState.processing_stage = 'timeout';
      await this.db.client
        .from('agent_sessions')
        .update({
          current_state: currentState,
          status: 'timeout',
          updated_at: new Date().toISOString()
        })
        .eq('id', session.id);
    }

    logger.info('Email processing completed', { 
      email_id: emailId,
      final_stage: currentState.processing_stage,
      iterations: iteration,
      session_id: session.id
    });

    return currentState;
  }

  async processEmailBatch(emailIds) {
    logger.info('Starting batch email processing', { count: emailIds.length });
    
    const results = [];
    
    for (const emailId of emailIds) {
      try {
        const result = await this.processEmail(emailId);
        results.push({
          email_id: emailId,
          success: result.processing_stage === 'completed',
          result: result
        });
      } catch (error) {
        logger.error(`Failed to process email ${emailId}:`, error);
        results.push({
          email_id: emailId,
          success: false,
          error: error.message
        });
      }
    }

    logger.info('Batch email processing completed', { 
      total: emailIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });

    return results;
  }

  async getProcessingStatus(sessionId) {
    try {
      const { data, error } = await this.db.client
        .from('agent_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error('Error getting processing status:', error);
      throw error;
    }
  }

  async cleanup() {
    try {
      await this.kg.close();
      logger.info('Email processor cleanup completed');
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }
}

module.exports = {
  EmailProcessor
};
