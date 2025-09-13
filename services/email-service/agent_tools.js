const { EmailDatabase } = require('./utils/supabase');
const { EmailKnowledgeGraph } = require('./utils/neo4j');
const { EmbeddingService } = require('./utils/embeddings');
const { GmailClient } = require('./gmail_client');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/agent_tools.log' }),
    new winston.transports.Console()
  ]
});

class EmailAgentTools {
  constructor(supabase, neo4j, gmail) {
    this.db = supabase || new EmailDatabase();
    this.kg = neo4j || new EmailKnowledgeGraph();
    this.gmail = gmail || new GmailClient();
    this.embeddings = new EmbeddingService();
    this.searchPriority = 'knowledge_first'; // 'knowledge_first' or 'gmail_first'
  }

  setSearchPriority(priority) {
    this.searchPriority = priority;
    logger.info(`Search priority set to: ${priority}`);
  }

  async think(currentState) {
    try {
      logger.info('Agent thinking phase started', { stage: currentState.processing_stage });

      // Analyze current state and decide next action
      const context = {
        stage: currentState.processing_stage,
        email_id: currentState.email_id,
        gathered_data: currentState.gathered_data,
        actions_taken: currentState.actions_taken
      };

      // Decision logic based on current processing stage
      switch (currentState.processing_stage) {
        case 'initial':
          return {
            tool: 'fetch_email',
            parameters: { email_id: currentState.email_id },
            reasoning: 'Need to fetch email content to begin processing'
          };

        case 'email_fetched':
          if (!currentState.gathered_data.embedding) {
            return {
              tool: 'generate_embedding',
              parameters: { email_data: currentState.gathered_data.email },
              reasoning: 'Generate embedding for similarity search'
            };
          }
          return {
            tool: 'search_similar_emails',
            parameters: { 
              embedding: currentState.gathered_data.embedding,
              threshold: 0.8 
            },
            reasoning: 'Search for similar emails in knowledge base'
          };

        case 'similarity_searched':
          return {
            tool: 'extract_contacts',
            parameters: { email_data: currentState.gathered_data.email },
            reasoning: 'Extract and store contact information'
          };

        case 'contacts_extracted':
          if (currentState.gathered_data.email.attachments?.length > 0) {
            return {
              tool: 'process_attachments',
              parameters: { 
                email_id: currentState.email_id,
                attachments: currentState.gathered_data.email.attachments 
              },
              reasoning: 'Process email attachments'
            };
          }
          return {
            tool: 'create_knowledge_entity',
            parameters: { email_data: currentState.gathered_data.email },
            reasoning: 'Create knowledge entity from email content'
          };

        case 'knowledge_created':
          return {
            tool: 'update_knowledge_graph',
            parameters: { 
              email_id: currentState.email_id,
              knowledge_id: currentState.gathered_data.knowledge_entity_id 
            },
            reasoning: 'Update knowledge graph with relationships'
          };

        case 'graph_updated':
          return {
            tool: 'finish',
            parameters: { status: 'completed' },
            reasoning: 'Email processing completed successfully'
          };

        default:
          return {
            tool: 'finish',
            parameters: { status: 'failed', error: 'Unknown processing stage' },
            reasoning: 'Unknown processing stage encountered'
          };
      }
    } catch (error) {
      logger.error('Error in thinking phase:', error);
      return {
        tool: 'finish',
        parameters: { status: 'failed', error: error.message },
        reasoning: 'Error occurred during thinking phase'
      };
    }
  }

  async fetch_email(parameters) {
    try {
      logger.info('Fetching email', { email_id: parameters.email_id });

      const email = await this.gmail.getMessage(parameters.email_id);
      
      // Store email in database
      const emailLog = await this.db.storeEmailLog({
        gmail_id: email.id,
        from_address: email.from,
        to_address: email.to,
        subject: email.subject,
        body_text: email.body.text,
        body_html: email.body.html,
        received_at: email.internalDate.toISOString()
      });

      logger.info('Email fetched and stored successfully', { email_id: emailLog.id });

      return {
        success: true,
        email: email,
        email_log_id: emailLog.id,
        next_stage: 'email_fetched'
      };
    } catch (error) {
      logger.error('Error fetching email:', error);
      throw error;
    }
  }

  async generate_embedding(parameters) {
    try {
      logger.info('Generating embedding for email');

      const embedding = await this.embeddings.generateEmailEmbedding(parameters.email_data);

      logger.info('Email embedding generated successfully');

      return {
        success: true,
        embedding: embedding,
        next_stage: 'embedding_generated'
      };
    } catch (error) {
      logger.error('Error generating embedding:', error);
      throw error;
    }
  }

  async search_similar_emails(parameters) {
    try {
      logger.info('Searching for similar emails', { threshold: parameters.threshold });

      const similarEmails = await this.db.searchSimilarEmails(
        parameters.embedding,
        parameters.threshold,
        5
      );

      logger.info(`Found ${similarEmails.length} similar emails`);

      return {
        success: true,
        similar_emails: similarEmails,
        next_stage: 'similarity_searched'
      };
    } catch (error) {
      logger.error('Error searching similar emails:', error);
      throw error;
    }
  }

  async extract_contacts(parameters) {
    try {
      logger.info('Extracting contacts from email');

      const email = parameters.email_data;
      const contacts = [];

      // Extract from address
      if (email.from) {
        const fromContact = this.parseEmailAddress(email.from);
        if (fromContact) {
          const storedContact = await this.db.storeContact({
            email_address: fromContact.email,
            full_name: fromContact.name,
            interaction_count: 1
          });
          contacts.push(storedContact);

          // Create contact node in Neo4j
          await this.kg.createContactNode({
            email_address: fromContact.email,
            full_name: fromContact.name
          });
        }
      }

      // Extract to addresses
      if (email.to) {
        const toAddresses = email.to.split(',');
        for (const toAddr of toAddresses) {
          const toContact = this.parseEmailAddress(toAddr.trim());
          if (toContact) {
            const storedContact = await this.db.storeContact({
              email_address: toContact.email,
              full_name: toContact.name,
              interaction_count: 1
            });
            contacts.push(storedContact);

            await this.kg.createContactNode({
              email_address: toContact.email,
              full_name: toContact.name
            });
          }
        }
      }

      logger.info(`Extracted ${contacts.length} contacts`);

      return {
        success: true,
        contacts: contacts,
        next_stage: 'contacts_extracted'
      };
    } catch (error) {
      logger.error('Error extracting contacts:', error);
      throw error;
    }
  }

  async process_attachments(parameters) {
    try {
      logger.info('Processing email attachments', { count: parameters.attachments.length });

      const processedAttachments = [];

      for (const attachment of parameters.attachments) {
        try {
          // Download attachment data
          const attachmentData = await this.gmail.getAttachment(
            parameters.email_id,
            attachment.attachmentId
          );

          // Store attachment metadata
          const storedAttachment = await this.db.storeEmailAttachment({
            email_log_id: parameters.email_log_id,
            filename: attachment.filename,
            content_type: attachment.mimeType,
            size_bytes: attachment.size,
            storage_path: `attachments/${parameters.email_id}/${attachment.filename}`
          });

          // TODO: Process attachment content based on type
          // For now, just mark as processed
          processedAttachments.push({
            ...storedAttachment,
            processed: true
          });

        } catch (error) {
          logger.error(`Error processing attachment ${attachment.filename}:`, error);
          processedAttachments.push({
            filename: attachment.filename,
            error: error.message,
            processed: false
          });
        }
      }

      logger.info(`Processed ${processedAttachments.length} attachments`);

      return {
        success: true,
        processed_attachments: processedAttachments,
        next_stage: 'attachments_processed'
      };
    } catch (error) {
      logger.error('Error processing attachments:', error);
      throw error;
    }
  }

  async create_knowledge_entity(parameters) {
    try {
      logger.info('Creating knowledge entity from email');

      const email = parameters.email_data;
      const entityId = uuidv4();

      // Combine email content for knowledge entity
      const content = [
        email.subject || '',
        email.body.text || email.body.html || ''
      ].filter(text => text.length > 0).join('\n\n');

      // Generate embedding for the knowledge entity
      const embedding = await this.embeddings.generateEmbedding(content);

      // Store knowledge entity
      const knowledgeEntity = await this.db.storeKnowledgeEntity({
        external_id: entityId,
        content: content,
        entity_type: 'email_content',
        embedding: embedding,
        source_type: 'email',
        source_metadata: {
          gmail_id: email.id,
          subject: email.subject,
          from: email.from,
          to: email.to,
          date: email.internalDate
        }
      });

      logger.info('Knowledge entity created successfully', { entity_id: knowledgeEntity.id });

      return {
        success: true,
        knowledge_entity: knowledgeEntity,
        knowledge_entity_id: knowledgeEntity.id,
        next_stage: 'knowledge_created'
      };
    } catch (error) {
      logger.error('Error creating knowledge entity:', error);
      throw error;
    }
  }

  async update_knowledge_graph(parameters) {
    try {
      logger.info('Updating knowledge graph with relationships');

      // Create email node in Neo4j
      const emailNode = await this.kg.createEmailNode({
        id: parameters.email_id,
        gmail_id: parameters.gmail_id,
        subject: parameters.subject,
        from_address: parameters.from_address,
        to_address: parameters.to_address,
        received_at: parameters.received_at
      });

      // Create knowledge entity node
      await this.kg.createKnowledgeEntity({
        id: parameters.knowledge_id,
        content: parameters.content,
        entity_type: 'email_content',
        source_type: 'email'
      });

      // Link email to knowledge entity
      await this.kg.linkEmailToKnowledge(parameters.email_id, parameters.knowledge_id);

      // Link email to contacts
      if (parameters.from_address) {
        const fromContact = this.parseEmailAddress(parameters.from_address);
        if (fromContact) {
          await this.kg.linkEmailToContact(parameters.email_id, fromContact.email, 'SENT_BY');
        }
      }

      logger.info('Knowledge graph updated successfully');

      return {
        success: true,
        next_stage: 'graph_updated'
      };
    } catch (error) {
      logger.error('Error updating knowledge graph:', error);
      throw error;
    }
  }

  async finish(parameters) {
    try {
      logger.info('Finishing email processing', { status: parameters.status });

      return {
        success: true,
        status: parameters.status,
        error: parameters.error || null,
        completed: true
      };
    } catch (error) {
      logger.error('Error finishing email processing:', error);
      throw error;
    }
  }

  // Helper method to parse email addresses
  parseEmailAddress(emailString) {
    try {
      const match = emailString.match(/^(.+?)\s*<(.+?)>$/) || emailString.match(/^(.+)$/);
      if (match) {
        if (match.length === 3) {
          return {
            name: match[1].trim().replace(/['"]/g, ''),
            email: match[2].trim()
          };
        } else {
          return {
            name: '',
            email: match[1].trim()
          };
        }
      }
      return null;
    } catch (error) {
      logger.error('Error parsing email address:', error);
      return null;
    }
  }
}

module.exports = {
  EmailAgentTools
};
