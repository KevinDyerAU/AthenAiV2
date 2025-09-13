require('dotenv').config();
const amqp = require('amqplib');
const { EmailProcessor } = require('./email_processor');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/email_service.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

class EmailService {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.processor = new EmailProcessor();
    this.isShuttingDown = false;
  }

  async start() {
    try {
      logger.info('Starting AthenAI Email Service...');

      // Initialize Gmail client
      await this.processor.gmail.initialize();
      logger.info('Gmail client initialized');

      // Connect to RabbitMQ
      await this.connectToRabbitMQ();
      
      // Set up queue consumers
      await this.setupQueues();

      logger.info('AthenAI Email Service started successfully');
      
      // Handle graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('Failed to start email service:', error);
      process.exit(1);
    }
  }

  async connectToRabbitMQ() {
    const maxRetries = 10;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        this.connection = await amqp.connect(process.env.RABBITMQ_URI);
        this.channel = await this.connection.createChannel();
        
        logger.info('Connected to RabbitMQ successfully');
        
        // Handle connection errors
        this.connection.on('error', (error) => {
          logger.error('RabbitMQ connection error:', error);
          if (!this.isShuttingDown) {
            setTimeout(() => this.connectToRabbitMQ(), 5000);
          }
        });

        this.connection.on('close', () => {
          logger.warn('RabbitMQ connection closed');
          if (!this.isShuttingDown) {
            setTimeout(() => this.connectToRabbitMQ(), 5000);
          }
        });

        break;
      } catch (error) {
        retries++;
        logger.error(`Failed to connect to RabbitMQ (attempt ${retries}/${maxRetries}):`, error);
        
        if (retries >= maxRetries) {
          throw new Error('Max RabbitMQ connection retries exceeded');
        }
        
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  async setupQueues() {
    try {
      // Email processing queue
      const emailQueue = 'email_processing_queue';
      await this.channel.assertQueue(emailQueue, { 
        durable: true,
        arguments: {
          'x-message-ttl': 3600000, // 1 hour TTL
          'x-max-retries': 3
        }
      });

      // Email batch processing queue
      const batchQueue = 'email_batch_processing_queue';
      await this.channel.assertQueue(batchQueue, { 
        durable: true,
        arguments: {
          'x-message-ttl': 7200000, // 2 hours TTL
          'x-max-retries': 2
        }
      });

      // Set prefetch count for fair distribution
      await this.channel.prefetch(1);

      // Consume single email processing messages
      this.channel.consume(emailQueue, async (msg) => {
        if (msg !== null) {
          await this.handleEmailMessage(msg);
        }
      });

      // Consume batch email processing messages
      this.channel.consume(batchQueue, async (msg) => {
        if (msg !== null) {
          await this.handleBatchMessage(msg);
        }
      });

      logger.info('Queue consumers set up successfully');
    } catch (error) {
      logger.error('Failed to setup queues:', error);
      throw error;
    }
  }

  async handleEmailMessage(msg) {
    const startTime = Date.now();
    let messageData;

    try {
      messageData = JSON.parse(msg.content.toString());
      const { emailId, priority = 'normal' } = messageData;

      logger.info('Processing email message', { 
        emailId, 
        priority,
        deliveryTag: msg.fields.deliveryTag 
      });

      // Process the email
      const result = await this.processor.processEmail(emailId);

      // Acknowledge message on success
      this.channel.ack(msg);

      const processingTime = Date.now() - startTime;
      logger.info('Email processed successfully', { 
        emailId, 
        status: result.processing_stage,
        processingTime: `${processingTime}ms`,
        actionsCount: result.actions_taken.length
      });

    } catch (error) {
      logger.error('Failed to process email message:', error, { 
        messageData,
        processingTime: `${Date.now() - startTime}ms`
      });

      // Check retry count
      const retryCount = msg.properties.headers?.['x-retry-count'] || 0;
      const maxRetries = 3;

      if (retryCount < maxRetries) {
        // Requeue with retry count
        const retryMessage = Buffer.from(JSON.stringify({
          ...messageData,
          retryCount: retryCount + 1,
          lastError: error.message,
          lastRetryAt: new Date().toISOString()
        }));

        await this.channel.sendToQueue(
          msg.fields.routingKey,
          retryMessage,
          {
            persistent: true,
            headers: {
              'x-retry-count': retryCount + 1
            }
          }
        );

        logger.info('Message requeued for retry', { 
          emailId: messageData?.emailId,
          retryCount: retryCount + 1 
        });
      } else {
        logger.error('Message exceeded max retries, sending to DLQ', { 
          emailId: messageData?.emailId,
          retryCount 
        });
        
        // TODO: Send to dead letter queue or error handling service
      }

      this.channel.ack(msg);
    }
  }

  async handleBatchMessage(msg) {
    const startTime = Date.now();
    let messageData;

    try {
      messageData = JSON.parse(msg.content.toString());
      const { emailIds, batchId } = messageData;

      logger.info('Processing email batch', { 
        batchId,
        emailCount: emailIds.length,
        deliveryTag: msg.fields.deliveryTag 
      });

      // Process the email batch
      const results = await this.processor.processEmailBatch(emailIds);

      // Acknowledge message on success
      this.channel.ack(msg);

      const processingTime = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;
      
      logger.info('Email batch processed', { 
        batchId,
        totalEmails: emailIds.length,
        successfulEmails: successCount,
        failedEmails: emailIds.length - successCount,
        processingTime: `${processingTime}ms`
      });

    } catch (error) {
      logger.error('Failed to process email batch:', error, { 
        messageData,
        processingTime: `${Date.now() - startTime}ms`
      });

      // For batch processing, we don't retry - just log and acknowledge
      this.channel.ack(msg);
    }
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      this.isShuttingDown = true;

      try {
        // Close RabbitMQ connection
        if (this.channel) {
          await this.channel.close();
        }
        if (this.connection) {
          await this.connection.close();
        }

        // Cleanup processor
        await this.processor.cleanup();

        logger.info('Email service shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon
  }

  // Health check endpoint (if needed)
  getHealthStatus() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      rabbitMQ: this.connection ? 'connected' : 'disconnected',
      uptime: process.uptime()
    };
  }
}

// Start the service
async function main() {
  const service = new EmailService();
  await service.start();
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

if (require.main === module) {
  main().catch((error) => {
    logger.error('Failed to start email service:', error);
    process.exit(1);
  });
}

module.exports = { EmailService };
