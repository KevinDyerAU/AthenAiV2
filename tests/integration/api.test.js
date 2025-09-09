// tests/integration/api.test.js
const request = require('supertest');
const { app } = require('../../src/app');

describe('API Integration Tests', () => {
  test('Health check should return 200', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
  });

  test('Chat endpoint should process message', async () => {
    const response = await request(app)
      .post('/api/chat')
      .send({
        message: 'Test message',
        sessionId: 'test_session'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.orchestration).toBeDefined();
  });

  test('Research endpoint should return results', async () => {
    const response = await request(app)
      .post('/api/research')
      .send({
        query: 'AI developments',
        sessionId: 'test_session'
      });
    
    expect(response.status).toBe(200);
    expect(response.body.query).toBe('AI developments');
  });
});
