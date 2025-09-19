// DocumentAgent Test Suite
const { DocumentAgent } = require('../../src/agents/DocumentAgent');
const { logger } = require('../../src/utils/logger');

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/progressBroadcaster');
jest.mock('../../src/services/database');
jest.mock('../../src/utils/knowledgeSubstrateHelper');

describe('DocumentAgent', () => {
  let documentAgent;
  let mockInputData;

  beforeEach(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_API_KEY = 'test-key';
    
    documentAgent = new DocumentAgent();
    
    mockInputData = {
      sessionId: 'test-session-123',
      orchestrationId: 'test-orchestration-456',
      task: {
        document: 'This is a sample document for processing and analysis.',
        operation: 'analyze',
        format: 'text'
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize DocumentAgent with correct properties', () => {
      expect(documentAgent).toBeDefined();
      expect(documentAgent.llm).toBeDefined();
      expect(documentAgent.knowledgeHelper).toBeDefined();
      expect(documentAgent.reasoning).toBeDefined();
      expect(documentAgent.name).toBe('DocumentAgent');
      expect(documentAgent.capabilities).toContain('document-processing');
      expect(documentAgent.capabilities).toContain('semantic-search');
    });

    it('should use OpenRouter when configured', () => {
      process.env.USE_OPENROUTER = 'true';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      
      const agent = new DocumentAgent();
      expect(agent.llm).toBeDefined();
    });
  });

  describe('Knowledge Substrate Integration', () => {
    it('should retrieve knowledge context successfully', async () => {
      const mockContext = {
        domain: 'document',
        similarResults: [],
        knowledgeEntities: [],
        queryHash: 'test-hash'
      };
      
      documentAgent.knowledgeHelper.retrieveKnowledgeContext = jest.fn().mockResolvedValue(mockContext);
      
      const result = await documentAgent.retrieveKnowledgeContext('Document analysis', 'test-session');
      
      expect(result).toEqual(mockContext);
      expect(documentAgent.knowledgeHelper.retrieveKnowledgeContext).toHaveBeenCalledWith(
        'Document analysis',
        'document',
        {
          complexity: 'medium',
          filters: { session_id: 'test-session' }
        }
      );
    });

    it('should store document insights successfully', async () => {
      documentAgent.knowledgeHelper.storeKnowledgeResults = jest.fn().mockResolvedValue(true);
      
      const result = await documentAgent.storeDocumentInsights(
        'Document processing',
        'Successfully processed and analyzed document',
        'test-session'
      );
      
      expect(result).toBe(true);
      expect(documentAgent.knowledgeHelper.storeKnowledgeResults).toHaveBeenCalled();
    });

    it('should extract document insights correctly', () => {
      const results = 'Document contains key information. Summary generated successfully. Semantic analysis completed.';
      const insights = documentAgent.extractDocumentInsights(results);
      
      expect(insights).toHaveLength(3);
      expect(insights[0]).toEqual({ type: 'document_pattern', content: 'Document contains key information.' });
      expect(insights[1]).toEqual({ type: 'document_pattern', content: 'Summary generated successfully.' });
      expect(insights[2]).toEqual({ type: 'document_pattern', content: 'Semantic analysis completed.' });
    });
  });

  describe('executeDocument', () => {
    it('should execute document task successfully in test environment', async () => {
      const result = await documentAgent.executeDocument(mockInputData);
      
      expect(result).toBeDefined();
      expect(result.session_id).toBe('test-session-123');
      expect(result.orchestration_id).toBe('test-orchestration-456');
      expect(result.document).toBe('This is a sample document for processing and analysis.');
      expect(result.operation).toBe('analyze');
      expect(result.format).toBe('text');
      expect(result.status).toBe('completed');
      expect(result.result).toContain('Document processing completed');
      expect(typeof result.document_time_ms).toBe('number');
    });

    it('should handle missing document gracefully', async () => {
      const invalidInput = {
        sessionId: 'test-session',
        task: {}
      };
      
      const result = await documentAgent.executeDocument(invalidInput);
      
      expect(result.status).toBe('error');
      expect(result.error).toContain('Document content is required');
    });

    it('should include strategy plan and evaluation in results', async () => {
      const result = await documentAgent.executeDocument(mockInputData);
      
      expect(result.strategy_plan).toBeDefined();
      expect(result.self_evaluation).toBeDefined();
      expect(result.confidence_score).toBeGreaterThanOrEqual(0);
      expect(result.confidence_score).toBeLessThanOrEqual(1);
      expect(result.reasoning_logs).toBeDefined();
    });
  });

  describe('Document Processing Tools', () => {
    it('should initialize document tools correctly', () => {
      const tools = documentAgent.initializeDocumentTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('document_analyzer');
      expect(toolNames).toContain('semantic_search');
      expect(toolNames).toContain('think');
    });
  });

  describe('Document Analysis', () => {
    it('should analyze document structure', () => {
      const document = 'Title: Test Document\n\nSection 1: Introduction\nThis is the introduction.\n\nSection 2: Content\nThis is the main content.';
      const analysis = documentAgent.analyzeDocumentStructure(document);
      
      expect(analysis).toBeDefined();
      expect(analysis.hasTitle).toBe(true);
      expect(analysis.sectionCount).toBeGreaterThan(0);
      expect(analysis.wordCount).toBeGreaterThan(0);
    });

    it('should extract key information from document', () => {
      const document = 'The quarterly revenue increased by 15% to $2.5 million. Customer satisfaction improved to 92%.';
      const keyInfo = documentAgent.extractKeyInformation(document);
      
      expect(keyInfo).toBeDefined();
      expect(Array.isArray(keyInfo)).toBe(true);
      expect(keyInfo.length).toBeGreaterThan(0);
    });

    it('should generate document summary', () => {
      const document = 'This is a long document with multiple paragraphs. It contains important information about various topics. The document discusses business metrics, customer feedback, and future plans.';
      const summary = documentAgent.generateSummary(document);
      
      expect(summary).toBeDefined();
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeLessThan(document.length);
    });
  });

  describe('Semantic Search', () => {
    it('should perform semantic search on document', async () => {
      const document = 'This document contains information about artificial intelligence, machine learning, and data science.';
      const query = 'AI and ML concepts';
      
      const results = await documentAgent.semanticSearch(document, query);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should find similar documents', async () => {
      const targetDocument = 'Document about machine learning algorithms';
      const documentCollection = [
        'Introduction to neural networks',
        'Deep learning fundamentals',
        'Statistical analysis methods'
      ];
      
      const similar = await documentAgent.findSimilarDocuments(targetDocument, documentCollection);
      
      expect(similar).toBeDefined();
      expect(Array.isArray(similar)).toBe(true);
    });
  });

  describe('Document Operations', () => {
    it('should handle analyze operation', async () => {
      const analyzeInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          operation: 'analyze'
        }
      };
      
      const result = await documentAgent.executeDocument(analyzeInput);
      expect(result.operation).toBe('analyze');
    });

    it('should handle summarize operation', async () => {
      const summarizeInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          operation: 'summarize'
        }
      };
      
      const result = await documentAgent.executeDocument(summarizeInput);
      expect(result.operation).toBe('summarize');
    });

    it('should handle search operation', async () => {
      const searchInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          operation: 'search',
          query: 'find specific information'
        }
      };
      
      const result = await documentAgent.executeDocument(searchInput);
      expect(result.operation).toBe('search');
    });

    it('should handle extract operation', async () => {
      const extractInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          operation: 'extract',
          extractType: 'entities'
        }
      };
      
      const result = await documentAgent.executeDocument(extractInput);
      expect(result.operation).toBe('extract');
    });
  });

  describe('Document Formats', () => {
    it('should handle text format', async () => {
      const textInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          format: 'text'
        }
      };
      
      const result = await documentAgent.executeDocument(textInput);
      expect(result.format).toBe('text');
    });

    it('should handle markdown format', async () => {
      const markdownInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          format: 'markdown',
          document: '# Title\n\nThis is **bold** text.'
        }
      };
      
      const result = await documentAgent.executeDocument(markdownInput);
      expect(result.format).toBe('markdown');
    });

    it('should handle JSON format', async () => {
      const jsonInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          format: 'json',
          document: '{"title": "Test", "content": "Sample content"}'
        }
      };
      
      const result = await documentAgent.executeDocument(jsonInput);
      expect(result.format).toBe('json');
    });
  });

  describe('Entity Extraction', () => {
    it('should extract named entities from document', () => {
      const document = 'John Smith works at Microsoft in Seattle. He started on January 15, 2023.';
      const entities = documentAgent.extractNamedEntities(document);
      
      expect(entities).toBeDefined();
      expect(Array.isArray(entities)).toBe(true);
      expect(entities.length).toBeGreaterThan(0);
    });

    it('should extract dates from document', () => {
      const document = 'The meeting is scheduled for March 15, 2024 at 2:00 PM.';
      const dates = documentAgent.extractDates(document);
      
      expect(dates).toBeDefined();
      expect(Array.isArray(dates)).toBe(true);
    });

    it('should extract numbers and metrics', () => {
      const document = 'Revenue increased by 25% to $1.5 million in Q4 2023.';
      const numbers = documentAgent.extractNumbers(document);
      
      expect(numbers).toBeDefined();
      expect(Array.isArray(numbers)).toBe(true);
    });
  });

  describe('Document Validation', () => {
    it('should validate document structure', () => {
      const validDocument = 'Title: Valid Document\n\nContent: This is valid content.';
      const isValid = documentAgent.validateDocumentStructure(validDocument);
      
      expect(isValid).toBe(true);
    });

    it('should detect invalid document structure', () => {
      const invalidDocument = '';
      const isValid = documentAgent.validateDocumentStructure(invalidDocument);
      
      expect(isValid).toBe(false);
    });

    it('should check document quality', () => {
      const document = 'This is a well-structured document with proper grammar and clear content.';
      const quality = documentAgent.assessDocumentQuality(document);
      
      expect(quality).toBeDefined();
      expect(quality.score).toBeGreaterThanOrEqual(0);
      expect(quality.score).toBeLessThanOrEqual(1);
    });
  });

  describe('Document Transformation', () => {
    it('should convert document formats', () => {
      const markdownDoc = '# Title\n\n**Bold text** and *italic text*.';
      const htmlDoc = documentAgent.convertFormat(markdownDoc, 'markdown', 'html');
      
      expect(htmlDoc).toBeDefined();
      expect(typeof htmlDoc).toBe('string');
    });

    it('should clean document content', () => {
      const dirtyDoc = 'This document has   extra   spaces and\n\n\nmultiple line breaks.';
      const cleanDoc = documentAgent.cleanDocument(dirtyDoc);
      
      expect(cleanDoc).toBeDefined();
      expect(cleanDoc.length).toBeLessThanOrEqual(dirtyDoc.length);
    });
  });

  describe('Error Handling', () => {
    it('should handle document processing errors gracefully', async () => {
      const errorInput = {
        sessionId: 'test-session',
        task: {
          document: null // This should cause an error
        }
      };
      
      const result = await documentAgent.executeDocument(errorInput);
      
      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });

    it('should log errors appropriately', async () => {
      const errorInput = {
        sessionId: 'test-session',
        task: {
          document: '' // Empty document should cause validation error
        }
      };
      
      await documentAgent.executeDocument(errorInput);
      
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle unsupported operations', async () => {
      const unsupportedInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          operation: 'unsupported_operation'
        }
      };
      
      const result = await documentAgent.executeDocument(unsupportedInput);
      
      expect(result.status).toBe('error');
      expect(result.error).toContain('Unsupported operation');
    });
  });

  describe('Performance', () => {
    it('should complete document task within reasonable time', async () => {
      const startTime = Date.now();
      await documentAgent.executeDocument(mockInputData);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds in test mode
    });

    it('should handle large documents efficiently', async () => {
      const largeDocument = 'Large document content. '.repeat(1000);
      const largeDocInput = {
        ...mockInputData,
        task: {
          ...mockInputData.task,
          document: largeDocument
        }
      };
      
      const startTime = Date.now();
      await documentAgent.executeDocument(largeDocInput);
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(10000); // Should handle large docs within 10 seconds
    });
  });

  describe('Integration Features', () => {
    it('should integrate with knowledge substrate for document indexing', async () => {
      const document = 'Important document for knowledge base integration';
      
      const indexed = await documentAgent.indexDocument(document, 'test-session');
      
      expect(indexed).toBe(true);
    });

    it('should support batch document processing', async () => {
      const documents = [
        'Document 1 content',
        'Document 2 content',
        'Document 3 content'
      ];
      
      const results = await documentAgent.processBatch(documents);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(documents.length);
    });
  });
});
