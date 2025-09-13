const BaseProcessor = require('./BaseProcessor');
const winston = require('winston');
const { simpleParser } = require('mailparser');
const fs = require('fs').promises;

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

class EmailProcessor extends BaseProcessor {
  constructor() {
    super();
  }

  async processEmail(emailData, metadata = {}) {
    try {
      logger.info('Starting email processing', { 
        messageId: emailData.messageId || 'unknown',
        subject: emailData.subject || 'no subject'
      });

      // Parse email if it's raw format
      let parsedEmail;
      if (typeof emailData === 'string') {
        parsedEmail = await simpleParser(emailData);
      } else {
        parsedEmail = emailData;
      }

      // Extract and combine email content
      const content = this.extractEmailContent(parsedEmail);

      if (!content || content.trim().length === 0) {
        throw new Error('No content could be extracted from the email');
      }

      // Enhance metadata with email-specific information
      const enhancedMetadata = this.enhanceEmailMetadata(parsedEmail, metadata);

      // Process using base processor with email-specific options
      const result = await this.processContent(content, enhancedMetadata, {
        maxChunkSize: 800, // Smaller chunks for emails
        overlapSize: 150,
        preserveStructure: true,
        contentType: 'email'
      });

      // Store email-specific data
      await this.storeEmailData(parsedEmail, result.processingId);

      // Process attachments if present
      if (parsedEmail.attachments && parsedEmail.attachments.length > 0) {
        const attachmentResults = await this.processEmailAttachments(
          parsedEmail.attachments, 
          result.processingId,
          enhancedMetadata
        );
        result.attachmentsProcessed = attachmentResults.length;
      }

      logger.info('Email processing completed', { 
        processingId: result.processingId,
        chunksProcessed: result.chunksProcessed,
        attachmentsProcessed: result.attachmentsProcessed || 0
      });

      return result;

    } catch (error) {
      logger.error('Error processing email:', error);
      throw error;
    }
  }

  extractEmailContent(parsedEmail) {
    let content = '';

    // Add email headers as structured content
    if (parsedEmail.subject) {
      content += `Subject: ${parsedEmail.subject}\n`;
    }

    if (parsedEmail.from) {
      const fromAddress = Array.isArray(parsedEmail.from) 
        ? parsedEmail.from.map(f => f.text || f.address).join(', ')
        : parsedEmail.from.text || parsedEmail.from.address || parsedEmail.from;
      content += `From: ${fromAddress}\n`;
    }

    if (parsedEmail.to) {
      const toAddresses = Array.isArray(parsedEmail.to)
        ? parsedEmail.to.map(t => t.text || t.address).join(', ')
        : parsedEmail.to.text || parsedEmail.to.address || parsedEmail.to;
      content += `To: ${toAddresses}\n`;
    }

    if (parsedEmail.cc && parsedEmail.cc.length > 0) {
      const ccAddresses = Array.isArray(parsedEmail.cc)
        ? parsedEmail.cc.map(c => c.text || c.address).join(', ')
        : parsedEmail.cc.text || parsedEmail.cc.address || parsedEmail.cc;
      content += `CC: ${ccAddresses}\n`;
    }

    if (parsedEmail.date) {
      content += `Date: ${parsedEmail.date}\n`;
    }

    content += '\n'; // Separator between headers and body

    // Add email body content
    if (parsedEmail.text) {
      content += parsedEmail.text;
    } else if (parsedEmail.html) {
      // Convert HTML to text (simple approach)
      const textFromHtml = parsedEmail.html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      content += textFromHtml;
    }

    return content.trim();
  }

  enhanceEmailMetadata(parsedEmail, originalMetadata) {
    const participants = this.extractParticipants(parsedEmail);
    
    return {
      ...originalMetadata,
      source_type: 'email',
      message_id: parsedEmail.messageId,
      subject: parsedEmail.subject,
      from: this.normalizeEmailAddress(parsedEmail.from),
      to: this.normalizeEmailAddresses(parsedEmail.to),
      cc: this.normalizeEmailAddresses(parsedEmail.cc),
      bcc: this.normalizeEmailAddresses(parsedEmail.bcc),
      date: parsedEmail.date ? new Date(parsedEmail.date).toISOString() : null,
      participants: participants,
      has_attachments: !!(parsedEmail.attachments && parsedEmail.attachments.length > 0),
      attachment_count: parsedEmail.attachments ? parsedEmail.attachments.length : 0,
      content_type: parsedEmail.html ? 'html' : 'text',
      priority: parsedEmail.priority || 'normal',
      processing_timestamp: new Date().toISOString()
    };
  }

  extractParticipants(parsedEmail) {
    const participants = new Set();

    // Add sender
    if (parsedEmail.from) {
      const fromEmails = this.normalizeEmailAddresses(parsedEmail.from);
      fromEmails.forEach(email => participants.add(email));
    }

    // Add recipients
    ['to', 'cc', 'bcc'].forEach(field => {
      if (parsedEmail[field]) {
        const emails = this.normalizeEmailAddresses(parsedEmail[field]);
        emails.forEach(email => participants.add(email));
      }
    });

    return Array.from(participants);
  }

  normalizeEmailAddress(emailField) {
    if (!emailField) return null;
    
    if (typeof emailField === 'string') {
      return emailField;
    }
    
    if (Array.isArray(emailField)) {
      return emailField[0]?.address || emailField[0]?.text || emailField[0];
    }
    
    return emailField.address || emailField.text || emailField;
  }

  normalizeEmailAddresses(emailField) {
    if (!emailField) return [];
    
    if (typeof emailField === 'string') {
      return [emailField];
    }
    
    if (Array.isArray(emailField)) {
      return emailField.map(e => e.address || e.text || e);
    }
    
    return [emailField.address || emailField.text || emailField];
  }

  async storeEmailData(parsedEmail, processingId) {
    try {
      const emailRecord = {
        processing_id: processingId,
        message_id: parsedEmail.messageId,
        subject: parsedEmail.subject,
        from_address: this.normalizeEmailAddress(parsedEmail.from),
        to_addresses: this.normalizeEmailAddresses(parsedEmail.to),
        cc_addresses: this.normalizeEmailAddresses(parsedEmail.cc),
        bcc_addresses: this.normalizeEmailAddresses(parsedEmail.bcc),
        date_sent: parsedEmail.date ? new Date(parsedEmail.date).toISOString() : null,
        has_attachments: !!(parsedEmail.attachments && parsedEmail.attachments.length > 0),
        attachment_count: parsedEmail.attachments ? parsedEmail.attachments.length : 0,
        content_type: parsedEmail.html ? 'html' : 'text',
        raw_headers: parsedEmail.headers ? JSON.stringify(parsedEmail.headers) : null,
        created_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('email_logs')
        .insert(emailRecord);

      if (error) {
        logger.error('Error storing email data:', error);
        throw error;
      }

      // Store participant information
      await this.storeEmailParticipants(parsedEmail, processingId);

    } catch (error) {
      logger.error('Error in storeEmailData:', error);
      throw error;
    }
  }

  async storeEmailParticipants(parsedEmail, processingId) {
    try {
      const participants = this.extractParticipants(parsedEmail);
      
      for (const email of participants) {
        // Store or update contact
        const { error: contactError } = await this.supabase
          .from('contacts')
          .upsert({
            email: email,
            last_seen: new Date().toISOString(),
            email_count: 1 // This would need proper increment logic
          }, {
            onConflict: 'email'
          });

        if (contactError) {
          logger.warn('Error storing contact:', contactError);
        }
      }
    } catch (error) {
      logger.error('Error storing email participants:', error);
    }
  }

  async processEmailAttachments(attachments, processingId, emailMetadata) {
    const results = [];

    for (const attachment of attachments) {
      try {
        if (this.isProcessableAttachment(attachment)) {
          const attachmentResult = await this.processAttachment(
            attachment, 
            processingId, 
            emailMetadata
          );
          results.push(attachmentResult);
        } else {
          // Store attachment metadata even if not processable
          await this.storeAttachmentMetadata(attachment, processingId);
        }
      } catch (error) {
        logger.error('Error processing attachment:', error);
      }
    }

    return results;
  }

  isProcessableAttachment(attachment) {
    const processableTypes = [
      'text/plain',
      'text/html',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    return processableTypes.includes(attachment.contentType);
  }

  async processAttachment(attachment, emailProcessingId, emailMetadata) {
    try {
      // Create temporary file for attachment processing
      const tempFilePath = `/tmp/${attachment.filename || 'attachment_' + Date.now()}`;
      await fs.writeFile(tempFilePath, attachment.content);

      // Use DocumentProcessor for document attachments
      const DocumentProcessor = require('./DocumentProcessor');
      const docProcessor = new DocumentProcessor();

      const attachmentMetadata = {
        ...emailMetadata,
        source_type: 'email_attachment',
        parent_processing_id: emailProcessingId,
        attachment_filename: attachment.filename,
        attachment_content_type: attachment.contentType,
        attachment_size: attachment.size
      };

      const result = await docProcessor.processDocument(tempFilePath, attachmentMetadata);

      // Store attachment record
      await this.storeAttachmentRecord(attachment, emailProcessingId, result.processingId);

      // Clean up temporary file
      try {
        await fs.unlink(tempFilePath);
      } catch (unlinkError) {
        logger.warn('Could not delete temporary file:', unlinkError);
      }

      return result;

    } catch (error) {
      logger.error('Error processing attachment:', error);
      throw error;
    }
  }

  async storeAttachmentMetadata(attachment, emailProcessingId) {
    try {
      const { error } = await this.supabase
        .from('email_attachments')
        .insert({
          email_processing_id: emailProcessingId,
          filename: attachment.filename,
          content_type: attachment.contentType,
          size: attachment.size,
          content_id: attachment.cid,
          is_processed: false,
          created_at: new Date().toISOString()
        });

      if (error) {
        logger.error('Error storing attachment metadata:', error);
      }
    } catch (error) {
      logger.error('Error in storeAttachmentMetadata:', error);
    }
  }

  async storeAttachmentRecord(attachment, emailProcessingId, attachmentProcessingId) {
    try {
      const { error } = await this.supabase
        .from('email_attachments')
        .insert({
          email_processing_id: emailProcessingId,
          attachment_processing_id: attachmentProcessingId,
          filename: attachment.filename,
          content_type: attachment.contentType,
          size: attachment.size,
          content_id: attachment.cid,
          is_processed: true,
          created_at: new Date().toISOString()
        });

      if (error) {
        logger.error('Error storing attachment record:', error);
      }
    } catch (error) {
      logger.error('Error in storeAttachmentRecord:', error);
    }
  }

  // Search emails by content similarity
  async searchEmails(query, options = {}) {
    try {
      const results = await this.searchSimilarContent(query, {
        ...options,
        source_type: 'email'
      });

      return results.map(result => ({
        ...result,
        email_metadata: result.source_metadata
      }));
    } catch (error) {
      logger.error('Error searching emails:', error);
      return [];
    }
  }

  // Get email processing statistics
  async getEmailStats(timeframe = '24 hours') {
    try {
      const stats = await this.getProcessingStats(timeframe);
      
      if (!stats) return null;

      // Add email-specific statistics
      const { data: emailData, error } = await this.supabase
        .from('email_logs')
        .select('*')
        .gte('created_at', new Date(Date.now() - this.parseTimeframe(timeframe)).toISOString());

      if (error) {
        logger.error('Error getting email stats:', error);
        return stats;
      }

      return {
        ...stats,
        unique_senders: new Set(emailData.map(e => e.from_address)).size,
        emails_with_attachments: emailData.filter(e => e.has_attachments).length,
        total_attachments: emailData.reduce((sum, e) => sum + (e.attachment_count || 0), 0)
      };
    } catch (error) {
      logger.error('Error getting email stats:', error);
      return null;
    }
  }

  // Process email thread/conversation
  async processEmailThread(emails, threadMetadata = {}) {
    const results = [];
    const errors = [];

    logger.info('Starting email thread processing', { 
      emailCount: emails.length,
      threadId: threadMetadata.thread_id
    });

    for (const email of emails) {
      try {
        const result = await this.processEmail(email, {
          ...threadMetadata,
          thread_position: emails.indexOf(email),
          is_thread: true
        });
        results.push(result);
      } catch (error) {
        logger.error('Error processing email in thread:', error);
        errors.push({
          email: email.messageId || 'unknown',
          error: error.message
        });
      }
    }

    return {
      successful: results,
      failed: errors,
      summary: {
        total_emails: emails.length,
        successful_count: results.length,
        failed_count: errors.length
      }
    };
  }
}

module.exports = EmailProcessor;
