// tests/integration/websocket.test.js
const Client = require('socket.io-client');
// const request = require('supertest'); // Unused import
const app = require('../../src/app');

describe('WebSocket Integration Tests', () => {
  let server;
  let clientSocket;

  beforeAll((done) => {
    server = app.listen(() => {
      const port = server.address().port;
      clientSocket = new Client(`http://localhost:${port}`);
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    server.close();
    clientSocket.close();
  });

  test('Should connect to websocket server', (done) => {
    expect(clientSocket.connected).toBe(true);
    done();
  });

  test('Should join a room successfully', (done) => {
    clientSocket.emit('join_room', {
      roomId: 'test_room',
      userId: 'test_user',
      username: 'TestUser'
    });

    clientSocket.on('user_joined', (data) => {
      expect(data.username).toBe('TestUser');
      expect(data.roomId).toBe('test_room');
      done();
    });
  });

  test('Should send and receive messages', (done) => {
    const testMessage = {
      roomId: 'test_room',
      userId: 'test_user',
      username: 'TestUser',
      message: 'Hello, AthenAI!'
    };

    clientSocket.emit('send_message', testMessage);

    clientSocket.on('new_message', (data) => {
      expect(data.message).toBe('Hello, AthenAI!');
      expect(data.username).toBe('TestUser');
      done();
    });
  });

  test('Should handle AI agent responses', (done) => {
    const aiQuery = {
      roomId: 'test_room',
      userId: 'test_user',
      username: 'TestUser',
      message: 'Research AI trends'
    };

    clientSocket.emit('send_message', aiQuery);

    clientSocket.on('ai_response', (data) => {
      expect(data.type).toBe('ai_response');
      expect(data.content).toBeDefined();
      done();
    });
  }, 10000); // Allow 10s for AI response

  test('Should leave room successfully', (done) => {
    clientSocket.emit('leave_room', {
      roomId: 'test_room',
      userId: 'test_user'
    });

    clientSocket.on('user_left', (data) => {
      expect(data.userId).toBe('test_user');
      done();
    });
  });
});
