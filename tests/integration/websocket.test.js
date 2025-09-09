// tests/integration/websocket.test.js
const Client = require('socket.io-client');
const http = require('http');
const { Server } = require('socket.io');
const { app } = require('../../src/app');

describe('WebSocket Integration Tests', () => {
  let server;
  let io;
  let clientSocket;

  beforeAll((done) => {
    server = http.createServer(app);
    io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    // Add basic socket event handlers for testing
    io.on('connection', (socket) => {
      socket.on('join_room', (data) => {
        socket.join(data.roomId);
        socket.emit('user_joined', {
          username: data.username,
          roomId: data.roomId,
          userId: data.userId
        });
      });

      socket.on('send_message', (data) => {
        // Emit to all clients in the room including sender
        io.to(data.roomId).emit('new_message', {
          message: data.message,
          username: data.username,
          userId: data.userId,
          timestamp: new Date().toISOString()
        });
        
        // Simulate AI response for AI queries
        if (data.message && data.message.toLowerCase().includes('research')) {
          setTimeout(() => {
            socket.emit('ai_response', {
              type: 'ai_response',
              content: 'AI research response',
              timestamp: new Date().toISOString()
            });
          }, 100);
        }
      });

      socket.on('leave_room', (data) => {
        socket.leave(data.roomId);
        socket.emit('user_left', {
          userId: data.userId,
          roomId: data.roomId
        });
      });
    });
    
    server.listen(() => {
      const port = server.address().port;
      clientSocket = new Client(`http://localhost:${port}`);
      clientSocket.on('connect', done);
    });
  });

  afterAll((done) => {
    if (clientSocket) {
      clientSocket.removeAllListeners();
      clientSocket.disconnect();
    }
    if (io) {
      io.close();
    }
    if (server) {
      server.close(() => {
        // Add a small delay to ensure all connections are properly closed
        setTimeout(() => {
          done();
        }, 100);
      });
    } else {
      done();
    }
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

    // Remove any existing listeners to avoid interference
    clientSocket.removeAllListeners('new_message');
    clientSocket.removeAllListeners('ai_response');

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
