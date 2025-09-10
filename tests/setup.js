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
process.env.LANGCHAIN_CALLBACKS_BACKGROUND = 'true';

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

// Mock database service to prevent initialization issues
jest.mock('../src/services/database', () => ({
  databaseService: {
    initialize: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(true),
    
    // Conversation methods
    createConversation: jest.fn().mockResolvedValue({ 
      id: 'test_conversation_id',
      session_id: 'test_session',
      created_at: new Date().toISOString()
    }),
    getConversations: jest.fn().mockResolvedValue([]),
    updateConversation: jest.fn().mockResolvedValue({ success: true }),
    getConversation: jest.fn().mockResolvedValue({
      id: 'test_conversation_id',
      messages: []
    }),
    validateConversationData: jest.fn().mockImplementation((data) => {
      return !!(data && data.session_id);
    }),
    
    // Neo4j methods
    createKnowledgeNode: jest.fn().mockResolvedValue({ success: true }),
    createKnowledgeRelationship: jest.fn().mockResolvedValue({ success: true }),
    queryKnowledgeGraph: jest.fn().mockResolvedValue({ records: [] }),
    validateCypherQuery: jest.fn().mockImplementation((query) => {
      return typeof query === 'string' && query.trim().length > 0 && !query.includes('INVALID');
    }),
    
    // Redis methods
    cacheSet: jest.fn().mockResolvedValue({ success: true }),
    cacheGet: jest.fn().mockResolvedValue(null),
    cacheDelete: jest.fn().mockResolvedValue({ success: true }),
    validateCacheKey: jest.fn().mockImplementation((key) => {
      return typeof key === 'string' && key.trim().length > 0;
    })
  }
}));

// Mock process.exit to prevent tests from actually exiting
const originalExit = process.exit;
beforeAll(() => {
  process.exit = jest.fn();
});

afterAll(() => {
  process.exit = originalExit;
});

// Improve test cleanup to prevent worker process issues
afterEach(() => {
  // Clear all timers
  jest.clearAllTimers();
  // Clear all mocks
  jest.clearAllMocks();
});

// Set longer timeout for integration tests
jest.setTimeout(45000);
