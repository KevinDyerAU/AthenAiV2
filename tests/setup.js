// tests/setup.js
// Global test setup and configuration

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
process.env.NEO4J_URI = 'neo4j://localhost:7687';
process.env.NEO4J_USER = 'neo4j';
process.env.NEO4J_PASSWORD = 'test-password';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.OPENAI_API_KEY = 'test-openai-key';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
  generateTestId: () => `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  
  mockApiResponse: (data) => ({
    status: 200,
    body: data,
    json: () => Promise.resolve(data)
  }),
  
  createMockSocket: () => ({
    emit: jest.fn(),
    on: jest.fn(),
    disconnect: jest.fn(),
    connected: true
  })
};

// Mock external services for unit tests
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      insert: jest.fn(() => Promise.resolve({ data: {}, error: null })),
      select: jest.fn(() => Promise.resolve({ data: [], error: null })),
      update: jest.fn(() => Promise.resolve({ data: {}, error: null })),
      delete: jest.fn(() => Promise.resolve({ data: {}, error: null }))
    }))
  }))
}));

jest.mock('neo4j-driver', () => ({
  driver: jest.fn(() => ({
    session: jest.fn(() => ({
      run: jest.fn(() => Promise.resolve({ records: [] })),
      close: jest.fn()
    })),
    close: jest.fn()
  })),
  auth: {
    basic: jest.fn()
  }
}));

jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    quit: jest.fn()
  }))
}));
