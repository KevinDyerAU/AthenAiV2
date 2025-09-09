// Unit Tests for Quality Assurance Agent
const { QualityAssuranceAgent } = require('../../src/agents/QualityAssuranceAgent');
const { databaseService } = require('../../src/services/database');

// Mock dependencies
jest.mock('../../src/services/database');
jest.mock('../../src/utils/logger');

describe('QualityAssuranceAgent', () => {
  let qaAgent;

  beforeEach(() => {
    qaAgent = new QualityAssuranceAgent();
    jest.clearAllMocks();
  });

  describe('executeQualityAssurance', () => {
    it('should execute QA task successfully', async () => {
      const inputData = {
        task: {
          content: 'This is a sample document for quality review',
          qa_type: 'comprehensive',
          standards: { accuracy: 0.9, completeness: 0.8 }
        },
        sessionId: 'test_session',
        orchestrationId: 'test_orchestration'
      };

      databaseService.createKnowledgeNode.mockResolvedValue({ success: true });
      databaseService.cacheSet.mockResolvedValue({ success: true });

      const result = await qaAgent.executeQualityAssurance(inputData);

      expect(result).toBeDefined();
      expect(result.session_id).toBe('test_session');
      expect(result.orchestration_id).toBe('test_orchestration');
      expect(result.status).toBe('completed');
      expect(result.qa_type).toBe('comprehensive');
      expect(result.original_content).toBe('This is a sample document for quality review');
    });

    it('should handle missing content', async () => {
      const inputData = {
        task: {},
        sessionId: 'test_session'
      };

      const result = await qaAgent.executeQualityAssurance(inputData);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('Content is required for quality assurance');
    });

    it('should use default values when not provided', async () => {
      const inputData = {
        task: {
          content: 'Sample content for review'
        }
      };

      databaseService.createKnowledgeNode.mockResolvedValue({ success: true });
      databaseService.cacheSet.mockResolvedValue({ success: true });

      const result = await qaAgent.executeQualityAssurance(inputData);

      expect(result.qa_type).toBe('comprehensive');
      expect(result.standards).toEqual(qaAgent.qualityStandards);
      expect(result.session_id).toMatch(/^qa_session_\d+$/);
    });
  });

  describe('validateContent', () => {
    it('should validate content accuracy', async () => {
      const content = 'The Earth orbits around the Sun in approximately 365.25 days';
      const validationType = 'accuracy';
      const references = ['NASA', 'Scientific journals'];

      const result = await qaAgent.validateContent(content, validationType, references);

      expect(result.content_length).toBe(content.length);
      expect(result.validation_type).toBe(validationType);
      expect(result.validation_result).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should use default validation type', async () => {
      const content = 'Sample content to validate';

      const result = await qaAgent.validateContent(content);

      expect(result.validation_type).toBe('general');
    });
  });

  describe('assessCompleteness', () => {
    it('should assess content completeness', async () => {
      const content = 'Project documentation including overview, requirements, and implementation details';
      const requirements = ['overview', 'requirements', 'implementation', 'testing'];
      const checklist = ['introduction', 'methodology', 'results', 'conclusion'];

      const result = await qaAgent.assessCompleteness(content, requirements, checklist);

      expect(result.requirements_count).toBe(4);
      expect(result.checklist_items).toBe(4);
      expect(result.completeness_assessment).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should handle empty requirements and checklist', async () => {
      const content = 'Basic content';

      const result = await qaAgent.assessCompleteness(content);

      expect(result.requirements_count).toBe(0);
      expect(result.checklist_items).toBe(0);
    });
  });

  describe('analyzeClarity', () => {
    it('should analyze content clarity', async () => {
      const content = 'This document provides clear instructions for setting up the development environment';
      const audience = 'developers';
      const complexity = 'intermediate';

      const result = await qaAgent.analyzeClarity(content, audience, complexity);

      expect(result.content_length).toBe(content.length);
      expect(result.target_audience).toBe(audience);
      expect(result.complexity_level).toBe(complexity);
      expect(result.clarity_analysis).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should use default audience and complexity', async () => {
      const content = 'Sample content for clarity analysis';

      const result = await qaAgent.analyzeClarity(content);

      expect(result.target_audience).toBe('general');
      expect(result.complexity_level).toBe('medium');
    });
  });

  describe('checkConsistency', () => {
    it('should check consistency with previous content', async () => {
      const content = 'Current version of the document with updated information';
      const previousContent = 'Previous version of the document with original information';
      const standards = { terminology: 'consistent', style: 'formal' };

      const result = await qaAgent.checkConsistency(content, previousContent, standards);

      expect(result.has_previous_content).toBe(true);
      expect(result.standards_provided).toBe(true);
      expect(result.consistency_check).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should handle no previous content', async () => {
      const content = 'Standalone document content';

      const result = await qaAgent.checkConsistency(content);

      expect(result.has_previous_content).toBe(false);
      expect(result.standards_provided).toBe(false);
    });
  });

  describe('assessSecurity', () => {
    it('should assess security implications', async () => {
      const content = 'API endpoint that handles user authentication and data access';
      const contentType = 'code';
      const securityLevel = 'high';

      const result = await qaAgent.assessSecurity(content, contentType, securityLevel);

      expect(result.content_type).toBe(contentType);
      expect(result.security_level).toBe(securityLevel);
      expect(result.security_assessment).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should use default content type and security level', async () => {
      const content = 'General content for security assessment';

      const result = await qaAgent.assessSecurity(content);

      expect(result.content_type).toBe('general');
      expect(result.security_level).toBe('standard');
    });
  });

  describe('evaluatePerformance', () => {
    it('should evaluate performance aspects', async () => {
      const content = 'Database query optimization and caching strategy implementation';
      const metrics = ['response_time', 'throughput', 'resource_usage'];
      const benchmarks = { response_time: '< 100ms', throughput: '> 1000 req/s' };

      const result = await qaAgent.evaluatePerformance(content, metrics, benchmarks);

      expect(result.metrics_count).toBe(3);
      expect(result.benchmarks_provided).toBe(true);
      expect(result.performance_evaluation).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should handle empty metrics and benchmarks', async () => {
      const content = 'Performance-related content';

      const result = await qaAgent.evaluatePerformance(content);

      expect(result.metrics_count).toBe(0);
      expect(result.benchmarks_provided).toBe(false);
    });
  });

  describe('calculateQualityScore', () => {
    it('should calculate overall quality score', async () => {
      const assessments = {
        accuracy: 0.95,
        completeness: 0.90,
        clarity: 0.85,
        consistency: 0.92,
        security: 0.88,
        performance: 0.80
      };
      const weights = {
        accuracy: 0.3,
        completeness: 0.2,
        clarity: 0.2,
        consistency: 0.15,
        security: 0.1,
        performance: 0.05
      };
      const standards = {
        accuracy: 0.9,
        completeness: 0.8,
        clarity: 0.8
      };

      const result = await qaAgent.calculateQualityScore(assessments, weights, standards);

      expect(result.overall_score).toBeGreaterThan(0);
      expect(result.overall_score).toBeLessThanOrEqual(1);
      expect(result.quality_level).toBeDefined();
      expect(result.dimension_scores).toEqual(assessments);
      expect(result.weights_used).toEqual(weights);
      expect(result.standards_met).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should determine correct quality levels', async () => {
      const excellentAssessments = {
        accuracy: 0.95,
        completeness: 0.92,
        clarity: 0.90
      };

      const result = await qaAgent.calculateQualityScore(excellentAssessments);

      expect(result.quality_level).toBe('excellent');
      expect(result.overall_score).toBeGreaterThanOrEqual(0.9);
    });

    it('should handle poor quality scores', async () => {
      const poorAssessments = {
        accuracy: 0.5,
        completeness: 0.4,
        clarity: 0.3
      };

      const result = await qaAgent.calculateQualityScore(poorAssessments);

      expect(result.quality_level).toBe('poor');
      expect(result.overall_score).toBeLessThan(0.6);
    });
  });

  describe('generateRecommendations', () => {
    it('should generate improvement recommendations', async () => {
      const issues = [
        { type: 'clarity', severity: 'medium', description: 'Technical jargon needs explanation' },
        { type: 'completeness', severity: 'high', description: 'Missing implementation details' }
      ];
      const context = { document_type: 'technical_spec', audience: 'developers' };
      const priorities = ['high', 'medium'];

      const result = await qaAgent.generateRecommendations(issues, context, priorities);

      expect(result.issues_count).toBe(2);
      expect(result.priorities_provided).toBe(2);
      expect(result.recommendations).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should handle object-based issues', async () => {
      const issues = {
        clarity: 'Needs improvement',
        accuracy: 'Some factual errors found'
      };
      const context = {};
      const priorities = [];

      const result = await qaAgent.generateRecommendations(issues, context, priorities);

      expect(result.issues_count).toBe(2);
      expect(result.priorities_provided).toBe(0);
    });
  });

  describe('checkStandardsCompliance', () => {
    it('should check standards compliance correctly', () => {
      const assessments = {
        accuracy: 0.95,
        completeness: 0.85,
        clarity: 0.75
      };
      const standards = {
        accuracy: 0.9,
        completeness: 0.8,
        clarity: 0.8
      };

      const compliance = qaAgent.checkStandardsCompliance(assessments, standards);

      expect(compliance.accuracy).toBe(true);  // 0.95 >= 0.9
      expect(compliance.completeness).toBe(true);  // 0.85 >= 0.8
      expect(compliance.clarity).toBe(false);  // 0.75 < 0.8
    });

    it('should handle missing assessments', () => {
      const assessments = {
        accuracy: 0.9
      };
      const standards = {
        accuracy: 0.8,
        completeness: 0.8
      };

      const compliance = qaAgent.checkStandardsCompliance(assessments, standards);

      expect(compliance.accuracy).toBe(true);
      expect(compliance.completeness).toBeUndefined();
    });

    it('should handle empty standards', () => {
      const assessments = {
        accuracy: 0.9,
        completeness: 0.8
      };
      const standards = {};

      const compliance = qaAgent.checkStandardsCompliance(assessments, standards);

      expect(Object.keys(compliance)).toHaveLength(0);
    });
  });

  describe('quality standards', () => {
    it('should have default quality standards', () => {
      expect(qaAgent.qualityStandards).toBeDefined();
      expect(qaAgent.qualityStandards.accuracy).toBe(0.95);
      expect(qaAgent.qualityStandards.completeness).toBe(0.90);
      expect(qaAgent.qualityStandards.clarity).toBe(0.85);
      expect(qaAgent.qualityStandards.relevance).toBe(0.90);
      expect(qaAgent.qualityStandards.consistency).toBe(0.95);
    });
  });
});
