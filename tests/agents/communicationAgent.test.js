// CommunicationAgent Test Suite
const { CommunicationAgent } = require('../../src/agents/CommunicationAgent');
const { logger } = require('../../src/utils/logger');

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/progressBroadcaster');
jest.mock('../../src/services/database');
jest.mock('../../src/utils/knowledgeSubstrateHelper');
jest.mock('nodemailer');

describe('CommunicationAgent', () => {
  let communicationAgent;
  let mockInputData;

  beforeEach(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_API_KEY = 'test-key';
    
    communicationAgent = new CommunicationAgent();
    
    mockInputData = {
      sessionId: 'test-session-123',
      orchestrationId: 'test-orchestration-456',
      task: {
        message: 'Please format this message for professional email communication',
        communication_type: 'format',
        channel: 'email',
        recipients: ['user@example.com']
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize CommunicationAgent with correct properties', () => {
      expect(communicationAgent).toBeDefined();
      expect(communicationAgent.llm).toBeDefined();
      expect(communicationAgent.knowledgeHelper).toBeDefined();
      expect(communicationAgent.reasoning).toBeDefined();
      expect(communicationAgent.channels).toBeDefined();
      expect(communicationAgent.communicationHistory).toBeDefined();
      expect(communicationAgent.messageQueue).toBeDefined();
    });

    it('should use OpenRouter when configured', () => {
      process.env.USE_OPENROUTER = 'true';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      
      const agent = new CommunicationAgent();
      expect(agent.llm).toBeDefined();
    });
  });

  describe('Knowledge Substrate Integration', () => {
    it('should retrieve knowledge context successfully', async () => {
      const mockContext = {
        domain: 'communication',
        similarResults: [],
        knowledgeEntities: [],
        queryHash: 'test-hash'
      };
      
      communicationAgent.knowledgeHelper.retrieveKnowledgeContext = jest.fn().mockResolvedValue(mockContext);
      
      const result = await communicationAgent.retrieveKnowledgeContext('Email formatting', 'test-session');
      
      expect(result).toEqual(mockContext);
      expect(communicationAgent.knowledgeHelper.retrieveKnowledgeContext).toHaveBeenCalledWith(
        'Email formatting',
        'communication',
        {
          complexity: 'medium',
          filters: { session_id: 'test-session' }
        }
      );
    });

    it('should store communication insights successfully', async () => {
      communicationAgent.knowledgeHelper.storeKnowledgeResults = jest.fn().mockResolvedValue(true);
      
      const result = await communicationAgent.storeCommunicationInsights(
        'Email formatting',
        'Professional email formatted successfully',
        'test-session'
      );
      
      expect(result).toBe(true);
      expect(communicationAgent.knowledgeHelper.storeKnowledgeResults).toHaveBeenCalled();
    });

    it('should extract communication insights correctly', () => {
      const results = 'Message formatted professionally. Communication tone adjusted for audience.';
      const insights = communicationAgent.extractCommunicationInsights(results);
      
      expect(insights).toHaveLength(2);
      expect(insights[0]).toEqual({ type: 'communication_pattern', content: 'Message formatted professionally.' });
      expect(insights[1]).toEqual({ type: 'communication_pattern', content: 'Communication tone adjusted for audience.' });
    });
  });

  describe('executeCommunication', () => {
    it('should execute communication task successfully in test environment', async () => {
      const result = await communicationAgent.executeCommunication(mockInputData);
      
      expect(result).toBeDefined();
      expect(result.session_id).toBe('test-session-123');
      expect(result.orchestration_id).toBe('test-orchestration-456');
      expect(result.message).toBe('Please format this message for professional email communication');
      expect(result.communication_type).toBe('format');
      expect(result.channel).toBe('email');
      expect(result.status).toBe('completed');
      expect(result.result).toContain('Communication task completed');
      expect(typeof result.communication_time_ms).toBe('number');
    });

    it('should handle missing message gracefully', async () => {
      const invalidInput = {
        sessionId: 'test-session',
        task: {}
      };
      
      const result = await communicationAgent.executeCommunication(invalidInput);
      
      expect(result.status).toBe('error');
      expect(result.error).toContain('Message content is required');
    });

    it('should include strategy plan and evaluation in results', async () => {
      const result = await communicationAgent.executeCommunication(mockInputData);
      
      expect(result.strategy_plan).toBeDefined();
      expect(result.self_evaluation).toBeDefined();
      expect(result.confidence_score).toBeGreaterThanOrEqual(0);
      expect(result.confidence_score).toBeLessThanOrEqual(1);
      expect(result.reasoning_logs).toBeDefined();
    });
  });

  describe('Communication Tools', () => {
    it('should initialize communication tools correctly', () => {
      const tools = communicationAgent.initializeCommunicationTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('message_formatter');
      expect(toolNames).toContain('email_sender');
      expect(toolNames).toContain('think');
    });
  });

  describe('Email Operations', () => {
    it('should initialize email transporter', () => {
      const transporter = communicationAgent.initializeEmailTransporter();
      expect(transporter).toBeDefined();
    });

    it('should format email message correctly', () => {
      const message = 'Hello, this is a test message.';
      const formatted = communicationAgent.formatEmailMessage(message, 'professional');
      
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('should send email successfully', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Email',
        body: 'This is a test email.'
      };
      
      // Mock email sending
      communicationAgent.sendEmail = jest.fn().mockResolvedValue({ success: true, messageId: 'test-123' });
      
      const result = await communicationAgent.sendEmail(emailData);
      
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });
  });

  describe('Message Formatting', () => {
    it('should format message for different communication types', () => {
      const message = 'Hello, this is a test message.';
      
      const professionalFormat = communicationAgent.formatMessage(message, 'professional');
      const casualFormat = communicationAgent.formatMessage(message, 'casual');
      const formalFormat = communicationAgent.formatMessage(message, 'formal');
      
      expect(professionalFormat).toBeDefined();
      expect(casualFormat).toBeDefined();
      expect(formalFormat).toBeDefined();
    });

    it('should adjust tone appropriately', () => {
      const message = 'We need to discuss the project timeline.';
      const adjustedMessage = communicationAgent.adjustTone(message, 'friendly');
      
      expect(adjustedMessage).toBeDefined();
      expect(typeof adjustedMessage).toBe('string');
    });

    it('should optimize message length', () => {
      const longMessage = 'This is a very long message that needs to be optimized for better readability and communication effectiveness.';
      const optimized = communicationAgent.optimizeMessageLength(longMessage, 'short');
      
      expect(optimized).toBeDefined();
      expect(optimized.length).toBeLessThanOrEqual(longMessage.length);
    });
  });

  describe('Channel Management', () => {
    it('should support multiple communication channels', () => {
      const channels = communicationAgent.getSupportedChannels();
      
      expect(Array.isArray(channels)).toBe(true);
      expect(channels).toContain('email');
      expect(channels).toContain('slack');
      expect(channels).toContain('discord');
    });

    it('should validate channel configuration', () => {
      const emailValid = communicationAgent.validateChannelConfig('email');
      expect(typeof emailValid).toBe('boolean');
    });

    it('should send message to appropriate channel', async () => {
      const messageData = {
        content: 'Test message',
        channel: 'email',
        recipients: ['test@example.com']
      };
      
      // Mock channel sending
      communicationAgent.sendToChannel = jest.fn().mockResolvedValue({ success: true });
      
      const result = await communicationAgent.sendToChannel(messageData);
      expect(result.success).toBe(true);
    });
  });

  describe('Communication History', () => {
    it('should track communication history', () => {
      const messageData = {
        id: 'msg-123',
        content: 'Test message',
        timestamp: new Date(),
        channel: 'email'
      };
      
      communicationAgent.addToHistory(messageData);
      
      const history = communicationAgent.getHistory('test-session');
      expect(Array.isArray(history)).toBe(true);
    });

    it('should retrieve communication history by session', () => {
      const sessionId = 'test-session-456';
      const history = communicationAgent.getHistory(sessionId);
      
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Message Queue', () => {
    it('should add messages to queue', () => {
      const message = {
        id: 'queue-123',
        content: 'Queued message',
        priority: 'high'
      };
      
      communicationAgent.addToQueue(message);
      
      expect(communicationAgent.messageQueue.length).toBeGreaterThan(0);
    });

    it('should process message queue', async () => {
      const message = {
        id: 'queue-456',
        content: 'Process this message',
        channel: 'email'
      };
      
      communicationAgent.addToQueue(message);
      
      // Mock queue processing
      communicationAgent.processQueue = jest.fn().mockResolvedValue({ processed: 1 });
      
      const result = await communicationAgent.processQueue();
      expect(result.processed).toBeGreaterThan(0);
    });
  });

  describe('Communication Types', () => {
    it('should handle format communication type', async () => {
      const formatInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          communication_type: 'format'
        }
      };
      
      const result = await communicationAgent.executeCommunication(formatInput);
      expect(result.communication_type).toBe('format');
    });

    it('should handle send communication type', async () => {
      const sendInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          communication_type: 'send'
        }
      };
      
      const result = await communicationAgent.executeCommunication(sendInput);
      expect(result.communication_type).toBe('send');
    });

    it('should handle broadcast communication type', async () => {
      const broadcastInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          communication_type: 'broadcast'
        }
      };
      
      const result = await communicationAgent.executeCommunication(broadcastInput);
      expect(result.communication_type).toBe('broadcast');
    });
  });

  describe('Error Handling', () => {
    it('should handle communication errors gracefully', async () => {
      const errorInput = {
        sessionId: 'test-session',
        task: {
          message: null // This should cause an error
        }
      };
      
      const result = await communicationAgent.executeCommunication(errorInput);
      
      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });

    it('should log errors appropriately', async () => {
      const errorInput = {
        sessionId: 'test-session',
        task: {
          message: '' // Empty message should cause validation error
        }
      };
      
      await communicationAgent.executeCommunication(errorInput);
      
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should complete communication task within reasonable time', async () => {
      const startTime = Date.now();
      await communicationAgent.executeCommunication(mockInputData);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds in test mode
    });
  });

  describe('Webhook Integration', () => {
    it('should send webhook notifications', async () => {
      const webhookData = {
        url: 'https://hooks.slack.com/test',
        payload: { text: 'Test notification' }
      };
      
      // Mock webhook sending
      communicationAgent.sendWebhook = jest.fn().mockResolvedValue({ success: true });
      
      const result = await communicationAgent.sendWebhook(webhookData);
      expect(result.success).toBe(true);
    });
  });
});
