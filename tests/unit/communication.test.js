// Unit Tests for Communication Agent
const { CommunicationAgent } = require('../../src/agents/CommunicationAgent');
const { databaseService } = require('../../src/services/database');
const axios = require('axios');

// Mock dependencies
jest.mock('../../src/services/database');
jest.mock('../../src/utils/logger');
jest.mock('axios');
jest.mock('nodemailer');

describe('CommunicationAgent', () => {
  let communicationAgent;

  beforeEach(() => {
    communicationAgent = new CommunicationAgent();
    jest.clearAllMocks();
  });

  describe('executeCommunication', () => {
    it('should execute communication task successfully', async () => {
      const inputData = {
        task: {
          message: 'Test message',
          communication_type: 'format',
          channel: 'email'
        },
        sessionId: 'test_session',
        orchestrationId: 'test_orchestration'
      };

      databaseService.createKnowledgeNode.mockResolvedValue({ success: true });
      databaseService.cacheSet.mockResolvedValue({ success: true });

      const result = await communicationAgent.executeCommunication(inputData);

      expect(result).toBeDefined();
      expect(result.session_id).toBe('test_session');
      expect(result.orchestration_id).toBe('test_orchestration');
      expect(result.status).toBe('completed');
      expect(result.original_message).toBe('Test message');
      expect(result.communication_type).toBe('format');
      expect(result.channel).toBe('email');
    });

    it('should handle missing message', async () => {
      const inputData = {
        task: {},
        sessionId: 'test_session'
      };

      const result = await communicationAgent.executeCommunication(inputData);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Message content is required');
    });

    it('should generate session ID if not provided', async () => {
      const inputData = {
        task: {
          message: 'Test message'
        }
      };

      databaseService.createKnowledgeNode.mockResolvedValue({ success: true });
      databaseService.cacheSet.mockResolvedValue({ success: true });

      const result = await communicationAgent.executeCommunication(inputData);

      expect(result.session_id).toMatch(/^comm_session_\d+$/);
      expect(result.orchestration_id).toMatch(/^comm_orchestration_\d+$/);
    });
  });

  describe('formatMessage', () => {
    it('should format message for email channel', async () => {
      const message = 'Hello, this is a test message';
      const channel = 'email';
      const audience = 'professional';
      const tone = 'formal';

      const result = await communicationAgent.formatMessage(message, channel, audience, tone);

      expect(result.original_message).toBe(message);
      expect(result.channel).toBe(channel);
      expect(result.audience).toBe(audience);
      expect(result.tone).toBe(tone);
      expect(result.formatted_message).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should format message for slack channel', async () => {
      const message = 'Quick update on the project';
      const channel = 'slack';
      const audience = 'team';
      const tone = 'casual';

      const result = await communicationAgent.formatMessage(message, channel, audience, tone);

      expect(result.channel).toBe(channel);
      expect(result.tone).toBe(tone);
      expect(result.formatted_message).toBeDefined();
    });
  });

  describe('sendSlackMessage', () => {
    it('should send slack message successfully', async () => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      communicationAgent.channels.slack = process.env.SLACK_WEBHOOK_URL;

      axios.post.mockResolvedValue({ status: 200 });

      const message = 'Test slack message';
      const channel = '#general';

      const result = await communicationAgent.sendSlackMessage(message, channel);

      expect(result.status).toBe('sent');
      expect(result.message).toBe(message);
      expect(result.channel).toBe(channel);
      expect(result.timestamp).toBeDefined();
      expect(axios.post).toHaveBeenCalledWith(
        process.env.SLACK_WEBHOOK_URL,
        expect.objectContaining({
          text: message,
          channel: channel,
          username: 'AthenAI'
        })
      );
    });

    it('should handle missing slack webhook URL', async () => {
      communicationAgent.channels.slack = null;

      const message = 'Test message';

      await expect(communicationAgent.sendSlackMessage(message)).rejects.toThrow('Slack webhook URL not configured');
    });

    it('should handle slack API error', async () => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      communicationAgent.channels.slack = process.env.SLACK_WEBHOOK_URL;

      axios.post.mockRejectedValue(new Error('Network error'));

      const message = 'Test message';

      await expect(communicationAgent.sendSlackMessage(message)).rejects.toThrow('Network error');
    });
  });

  describe('sendDiscordMessage', () => {
    it('should send discord message successfully', async () => {
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test';
      communicationAgent.channels.discord = process.env.DISCORD_WEBHOOK_URL;

      axios.post.mockResolvedValue({ status: 204 });

      const message = 'Test discord message';
      const embeds = [{ title: 'Test', description: 'Test embed' }];

      const result = await communicationAgent.sendDiscordMessage(message, embeds);

      expect(result.status).toBe('sent');
      expect(result.message).toBe(message);
      expect(result.embeds_count).toBe(1);
      expect(result.timestamp).toBeDefined();
    });

    it('should handle missing discord webhook URL', async () => {
      communicationAgent.channels.discord = null;

      const message = 'Test message';

      await expect(communicationAgent.sendDiscordMessage(message)).rejects.toThrow('Discord webhook URL not configured');
    });
  });

  describe('createMessageTemplate', () => {
    it('should create message template successfully', async () => {
      const templateName = 'welcome_email';
      const content = 'Welcome {{name}} to our platform!';
      const variables = ['name'];
      const category = 'onboarding';

      databaseService.cacheSet.mockResolvedValue({ success: true });

      const result = await communicationAgent.createMessageTemplate(templateName, content, variables, category);

      expect(result.name).toBe(templateName);
      expect(result.content).toBe(content);
      expect(result.variables).toEqual(variables);
      expect(result.category).toBe(category);
      expect(result.usage_count).toBe(0);
      expect(result.created_at).toBeDefined();
    });
  });

  describe('analyzeMessage', () => {
    it('should analyze message sentiment and tone', async () => {
      const message = 'I am very excited about this new feature!';
      const context = { audience: 'customers', purpose: 'announcement' };

      const result = await communicationAgent.analyzeMessage(message, context);

      expect(result.message).toBe(message);
      expect(result.context).toEqual(context);
      expect(result.analysis).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('broadcastMessage', () => {
    it('should broadcast message across multiple channels', async () => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/test';
      
      communicationAgent.channels.slack = process.env.SLACK_WEBHOOK_URL;
      communicationAgent.channels.discord = process.env.DISCORD_WEBHOOK_URL;

      axios.post.mockResolvedValue({ status: 200 });

      const message = 'Important announcement';
      const channels = ['slack', 'discord'];
      const customization = {
        slack_channel: '#announcements'
      };

      const result = await communicationAgent.broadcastMessage(message, channels, customization);

      expect(result.broadcast_id).toMatch(/^broadcast_\d+$/);
      expect(result.channels).toEqual(channels);
      expect(result.results).toHaveLength(2);
      expect(result.timestamp).toBeDefined();
    });

    it('should handle mixed success and failure in broadcast', async () => {
      process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
      communicationAgent.channels.slack = process.env.SLACK_WEBHOOK_URL;
      communicationAgent.channels.discord = null; // Discord not configured

      axios.post.mockResolvedValue({ status: 200 });

      const message = 'Test broadcast';
      const channels = ['slack', 'discord'];

      const result = await communicationAgent.broadcastMessage(message, channels);

      expect(result.results).toHaveLength(2);
      expect(result.results[0].status).toBe('sent'); // Slack success
      expect(result.results[1].status).toBe('failed'); // Discord failure
    });
  });

  describe('routeMessage', () => {
    it('should analyze and route incoming message', async () => {
      const message = 'I need help with billing issues';
      const sender = 'customer@example.com';
      const channel = 'email';
      const metadata = { priority: 'normal' };

      const result = await communicationAgent.routeMessage(message, sender, channel, metadata);

      expect(result.message).toBe(message);
      expect(result.sender).toBe(sender);
      expect(result.channel).toBe(channel);
      expect(result.routing_analysis).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('initializeEmailTransporter', () => {
    it('should return null when email config is incomplete', () => {
      delete process.env.EMAIL_HOST;
      delete process.env.EMAIL_USER;
      delete process.env.EMAIL_PASS;

      const transporter = communicationAgent.initializeEmailTransporter();

      expect(transporter).toBeNull();
    });

    it('should create transporter when config is complete', () => {
      process.env.EMAIL_HOST = 'smtp.example.com';
      process.env.EMAIL_USER = 'test@example.com';
      process.env.EMAIL_PASS = 'password';

      const nodemailer = require('nodemailer');
      const mockTransporter = { sendMail: jest.fn() };
      nodemailer.createTransporter = jest.fn().mockReturnValue(mockTransporter);

      const transporter = communicationAgent.initializeEmailTransporter();

      expect(transporter).toBe(mockTransporter);
      expect(nodemailer.createTransporter).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test@example.com',
          pass: 'password'
        }
      });
    });
  });
});
