const { createClient } = require('@supabase/supabase-js');
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
    new winston.transports.File({ filename: 'logs/supabase.log' }),
    new winston.transports.Console()
  ]
});

let supabaseClient = null;

function createSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }

  try {
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    logger.info('Supabase client initialized successfully');
    return supabaseClient;
  } catch (error) {
    logger.error('Failed to initialize Supabase client:', error);
    throw error;
  }
}

// Database operations for email processing
class EmailDatabase {
  constructor() {
    this.client = createSupabaseClient();
  }

  async storeEmailLog(emailData) {
    try {
      const { data, error } = await this.client
        .from('email_logs')
        .insert({
          gmail_id: emailData.gmail_id,
          from_address: emailData.from_address,
          to_address: emailData.to_address,
          subject: emailData.subject,
          body_text: emailData.body_text,
          body_html: emailData.body_html,
          received_at: emailData.received_at,
          processing_status: 'pending'
        })
        .select()
        .single();

      if (error) {
        logger.error('Error storing email log:', error);
        throw error;
      }

      logger.info(`Email log stored successfully: ${data.id}`);
      return data;
    } catch (error) {
      logger.error('Failed to store email log:', error);
      throw error;
    }
  }

  async updateEmailProcessingStatus(emailId, status, agentActions = null) {
    try {
      const updateData = {
        processing_status: status,
        processed_at: new Date().toISOString()
      };

      if (agentActions) {
        updateData.agent_actions = agentActions;
      }

      const { data, error } = await this.client
        .from('email_logs')
        .update(updateData)
        .eq('id', emailId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating email processing status:', error);
        throw error;
      }

      logger.info(`Email processing status updated: ${emailId} -> ${status}`);
      return data;
    } catch (error) {
      logger.error('Failed to update email processing status:', error);
      throw error;
    }
  }

  async storeContact(contactData) {
    try {
      const { data, error } = await this.client
        .from('contacts')
        .upsert({
          email_address: contactData.email_address,
          full_name: contactData.full_name,
          company: contactData.company,
          role: contactData.role,
          interaction_count: contactData.interaction_count || 1,
          last_interaction_at: new Date().toISOString(),
          contact_metadata: contactData.metadata || {}
        })
        .select()
        .single();

      if (error) {
        logger.error('Error storing contact:', error);
        throw error;
      }

      logger.info(`Contact stored/updated successfully: ${data.id}`);
      return data;
    } catch (error) {
      logger.error('Failed to store contact:', error);
      throw error;
    }
  }

  async storeKnowledgeEntity(entityData) {
    try {
      const { data, error } = await this.client
        .from('knowledge_entities')
        .insert({
          external_id: entityData.external_id,
          content: entityData.content,
          entity_type: entityData.entity_type,
          embedding: entityData.embedding,
          source_type: entityData.source_type,
          source_metadata: entityData.source_metadata || {}
        })
        .select()
        .single();

      if (error) {
        logger.error('Error storing knowledge entity:', error);
        throw error;
      }

      logger.info(`Knowledge entity stored successfully: ${data.id}`);
      return data;
    } catch (error) {
      logger.error('Failed to store knowledge entity:', error);
      throw error;
    }
  }

  async searchSimilarEmails(embedding, threshold = 0.8, limit = 5) {
    try {
      const { data, error } = await this.client.rpc('match_emails', {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: limit
      });

      if (error) {
        logger.error('Error searching similar emails:', error);
        throw error;
      }

      logger.info(`Found ${data?.length || 0} similar emails`);
      return data || [];
    } catch (error) {
      logger.error('Failed to search similar emails:', error);
      throw error;
    }
  }
}

module.exports = {
  createSupabaseClient,
  EmailDatabase
};
