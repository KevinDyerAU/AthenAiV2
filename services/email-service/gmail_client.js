const { google } = require('googleapis');
const fs = require('fs').promises;
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
    new winston.transports.File({ filename: 'logs/gmail.log' }),
    new winston.transports.Console()
  ]
});

class GmailClient {
  constructor() {
    this.gmail = null;
    this.auth = null;
  }

  async initialize() {
    try {
      // Load credentials from file
      const credentialsPath = process.env.GMAIL_CREDENTIALS_PATH || '/app/gmail_credentials.json';
      const credentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));

      // Set up OAuth2 client
      const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
      this.auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

      // Load or request access token
      const tokenPath = process.env.GMAIL_TOKEN_PATH || '/app/gmail_token.json';
      try {
        const token = JSON.parse(await fs.readFile(tokenPath, 'utf8'));
        this.auth.setCredentials(token);
      } catch (error) {
        logger.warn('Gmail token not found. Manual authorization required.');
        throw new Error('Gmail token not found. Please run authorization flow.');
      }

      // Initialize Gmail API
      this.gmail = google.gmail({ version: 'v1', auth: this.auth });
      
      logger.info('Gmail client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Gmail client:', error);
      throw error;
    }
  }

  async getMessages(query = '', maxResults = 10) {
    try {
      if (!this.gmail) {
        await this.initialize();
      }

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: maxResults
      });

      const messages = response.data.messages || [];
      logger.info(`Retrieved ${messages.length} messages from Gmail`);
      
      return messages;
    } catch (error) {
      logger.error('Error getting Gmail messages:', error);
      throw error;
    }
  }

  async getMessage(messageId) {
    try {
      if (!this.gmail) {
        await this.initialize();
      }

      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      const message = response.data;
      logger.info(`Retrieved Gmail message: ${messageId}`);
      
      return this.parseMessage(message);
    } catch (error) {
      logger.error(`Error getting Gmail message ${messageId}:`, error);
      throw error;
    }
  }

  parseMessage(message) {
    try {
      const headers = message.payload.headers;
      const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const parsed = {
        id: message.id,
        threadId: message.threadId,
        labelIds: message.labelIds,
        snippet: message.snippet,
        historyId: message.historyId,
        internalDate: new Date(parseInt(message.internalDate)),
        from: getHeader('From'),
        to: getHeader('To'),
        cc: getHeader('Cc'),
        bcc: getHeader('Bcc'),
        subject: getHeader('Subject'),
        date: getHeader('Date'),
        messageId: getHeader('Message-ID'),
        body: {
          text: '',
          html: ''
        },
        attachments: []
      };

      // Extract body content
      this.extractBody(message.payload, parsed);

      logger.info(`Parsed Gmail message: ${parsed.subject}`);
      return parsed;
    } catch (error) {
      logger.error('Error parsing Gmail message:', error);
      throw error;
    }
  }

  extractBody(payload, parsed) {
    try {
      if (payload.body && payload.body.size > 0) {
        const data = payload.body.data;
        if (data) {
          const content = Buffer.from(data, 'base64').toString('utf8');
          if (payload.mimeType === 'text/plain') {
            parsed.body.text = content;
          } else if (payload.mimeType === 'text/html') {
            parsed.body.html = content;
          }
        }
      }

      if (payload.parts) {
        payload.parts.forEach(part => {
          if (part.mimeType === 'text/plain' && part.body.data) {
            parsed.body.text = Buffer.from(part.body.data, 'base64').toString('utf8');
          } else if (part.mimeType === 'text/html' && part.body.data) {
            parsed.body.html = Buffer.from(part.body.data, 'base64').toString('utf8');
          } else if (part.filename && part.filename.length > 0) {
            // Handle attachments
            parsed.attachments.push({
              filename: part.filename,
              mimeType: part.mimeType,
              size: part.body.size,
              attachmentId: part.body.attachmentId
            });
          } else if (part.parts) {
            // Recursive extraction for nested parts
            this.extractBody(part, parsed);
          }
        });
      }
    } catch (error) {
      logger.error('Error extracting message body:', error);
    }
  }

  async getAttachment(messageId, attachmentId) {
    try {
      if (!this.gmail) {
        await this.initialize();
      }

      const response = await this.gmail.users.messages.attachments.get({
        userId: 'me',
        messageId: messageId,
        id: attachmentId
      });

      const attachmentData = Buffer.from(response.data.data, 'base64');
      logger.info(`Retrieved attachment: ${attachmentId} (${attachmentData.length} bytes)`);
      
      return attachmentData;
    } catch (error) {
      logger.error(`Error getting attachment ${attachmentId}:`, error);
      throw error;
    }
  }

  async sendMessage(to, subject, body, attachments = []) {
    try {
      if (!this.gmail) {
        await this.initialize();
      }

      // Create email message
      let message = [
        `To: ${to}`,
        `Subject: ${subject}`,
        '',
        body
      ].join('\n');

      // TODO: Handle attachments if needed
      if (attachments.length > 0) {
        logger.warn('Attachment sending not yet implemented');
      }

      const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage
        }
      });

      logger.info(`Email sent successfully: ${response.data.id}`);
      return response.data;
    } catch (error) {
      logger.error('Error sending email:', error);
      throw error;
    }
  }

  async markAsRead(messageId) {
    try {
      if (!this.gmail) {
        await this.initialize();
      }

      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD']
        }
      });

      logger.info(`Marked message as read: ${messageId}`);
    } catch (error) {
      logger.error(`Error marking message as read ${messageId}:`, error);
      throw error;
    }
  }

  async addLabel(messageId, labelId) {
    try {
      if (!this.gmail) {
        await this.initialize();
      }

      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: [labelId]
        }
      });

      logger.info(`Added label ${labelId} to message: ${messageId}`);
    } catch (error) {
      logger.error(`Error adding label to message ${messageId}:`, error);
      throw error;
    }
  }
}

function createGmailClient() {
  return new GmailClient();
}

module.exports = {
  createGmailClient,
  GmailClient
};
