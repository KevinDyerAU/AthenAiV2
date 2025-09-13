const BaseProcessor = require('./BaseProcessor');
const winston = require('winston');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const fs = require('fs').promises;
const path = require('path');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/document_processor.log' }),
    new winston.transports.Console()
  ]
});

class DocumentProcessor extends BaseProcessor {
  constructor() {
    super();
    this.supportedFormats = ['.pdf', '.docx', '.doc', '.txt', '.md', '.html', '.rtf'];
  }

  async processDocument(filePath, metadata = {}) {
    try {
      logger.info('Starting document processing', { filePath, metadata });

      // Extract text content based on file type
      const fileExtension = path.extname(filePath).toLowerCase();
      const content = await this.extractTextContent(filePath, fileExtension);

      if (!content || content.trim().length === 0) {
        throw new Error('No text content could be extracted from the document');
      }

      // Enhance metadata with document-specific information
      const enhancedMetadata = await this.enhanceDocumentMetadata(filePath, metadata, content);

      // Process using base processor with document-specific options
      const result = await this.processContent(content, enhancedMetadata, {
        maxChunkSize: 1200, // Larger chunks for documents
        overlapSize: 250,
        preserveStructure: true,
        contentType: 'document'
      });

      logger.info('Document processing completed', { 
        filePath, 
        processingId: result.processingId,
        chunksProcessed: result.chunksProcessed
      });

      return result;

    } catch (error) {
      logger.error('Error processing document:', error);
      throw error;
    }
  }

  async extractTextContent(filePath, fileExtension) {
    switch (fileExtension) {
      case '.pdf':
        return await this.extractPdfText(filePath);
      case '.docx':
      case '.doc':
        return await this.extractWordText(filePath);
      case '.txt':
      case '.md':
        return await this.extractPlainText(filePath);
      case '.html':
        return await this.extractHtmlText(filePath);
      default:
        throw new Error(`Unsupported file format: ${fileExtension}`);
    }
  }

  async extractPdfText(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer);
      return data.text;
    } catch (error) {
      logger.error('Error extracting PDF text:', error);
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }

  async extractWordText(filePath) {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer: dataBuffer });
      return result.value;
    } catch (error) {
      logger.error('Error extracting Word document text:', error);
      throw new Error(`Failed to extract text from Word document: ${error.message}`);
    }
  }

  async extractPlainText(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      logger.error('Error reading plain text file:', error);
      throw new Error(`Failed to read text file: ${error.message}`);
    }
  }

  async extractHtmlText(filePath) {
    try {
      const htmlContent = await fs.readFile(filePath, 'utf-8');
      // Simple HTML tag removal - could be enhanced with proper HTML parser
      const textContent = htmlContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      
      return textContent;
    } catch (error) {
      logger.error('Error extracting HTML text:', error);
      throw new Error(`Failed to extract text from HTML: ${error.message}`);
    }
  }

  async enhanceDocumentMetadata(filePath, originalMetadata, content) {
    try {
      const stats = await fs.stat(filePath);
      const fileName = path.basename(filePath);
      const fileExtension = path.extname(filePath);

      // Extract document structure information
      const structure = this.analyzeDocumentStructure(content);

      return {
        ...originalMetadata,
        source_type: 'document',
        file_name: fileName,
        file_path: filePath,
        file_extension: fileExtension,
        file_size: stats.size,
        created_at: stats.birthtime,
        modified_at: stats.mtime,
        content_length: content.length,
        word_count: this.countWords(content),
        line_count: content.split('\n').length,
        structure: structure,
        processing_timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error enhancing document metadata:', error);
      return {
        ...originalMetadata,
        source_type: 'document',
        processing_timestamp: new Date().toISOString()
      };
    }
  }

  analyzeDocumentStructure(content) {
    const structure = {
      has_headings: false,
      heading_count: 0,
      has_lists: false,
      list_count: 0,
      has_tables: false,
      paragraph_count: 0,
      sections: []
    };

    // Detect headings (markdown style or numbered)
    const headingMatches = content.match(/^#{1,6}\s+.+$/gm) || content.match(/^\d+\.\s+.+$/gm);
    if (headingMatches) {
      structure.has_headings = true;
      structure.heading_count = headingMatches.length;
      structure.sections = headingMatches.map(heading => heading.trim());
    }

    // Detect lists
    const listMatches = content.match(/^[\s]*[-*+]\s+.+$/gm) || content.match(/^\d+\.\s+.+$/gm);
    if (listMatches) {
      structure.has_lists = true;
      structure.list_count = listMatches.length;
    }

    // Detect tables (simple detection)
    const tableMatches = content.match(/\|.+\|/g);
    if (tableMatches && tableMatches.length > 2) {
      structure.has_tables = true;
    }

    // Count paragraphs
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    structure.paragraph_count = paragraphs.length;

    return structure;
  }

  countWords(text) {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  // Process multiple documents in batch
  async processBatch(filePaths, batchMetadata = {}) {
    const results = [];
    const errors = [];

    logger.info('Starting batch document processing', { 
      fileCount: filePaths.length 
    });

    for (const filePath of filePaths) {
      try {
        const result = await this.processDocument(filePath, {
          ...batchMetadata,
          batch_id: batchMetadata.batch_id || crypto.randomUUID(),
          batch_index: filePaths.indexOf(filePath)
        });
        results.push(result);
      } catch (error) {
        logger.error(`Error processing file ${filePath}:`, error);
        errors.push({
          filePath,
          error: error.message
        });
      }
    }

    logger.info('Batch processing completed', { 
      successful: results.length,
      failed: errors.length
    });

    return {
      successful: results,
      failed: errors,
      summary: {
        total_files: filePaths.length,
        successful_count: results.length,
        failed_count: errors.length,
        total_chunks: results.reduce((sum, r) => sum + r.chunksProcessed, 0),
        total_entities: results.reduce((sum, r) => sum + r.entitiesExtracted, 0)
      }
    };
  }

  // Search for documents by content similarity
  async searchDocuments(query, options = {}) {
    try {
      const results = await this.searchSimilarContent(query, {
        ...options,
        source_type: 'document'
      });

      return results.map(result => ({
        ...result,
        document_metadata: result.source_metadata
      }));
    } catch (error) {
      logger.error('Error searching documents:', error);
      return [];
    }
  }

  // Get document processing statistics
  async getDocumentStats(timeframe = '24 hours') {
    try {
      const stats = await this.getProcessingStats(timeframe);
      
      if (!stats) return null;

      // Filter for document-specific stats
      const documentStats = {
        ...stats,
        by_file_type: {},
        average_file_size: 0,
        average_chunks_per_document: 0
      };

      // This would need to be implemented with proper database queries
      // For now, return the basic stats
      return documentStats;
    } catch (error) {
      logger.error('Error getting document stats:', error);
      return null;
    }
  }

  // Validate file before processing
  isValidDocument(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    return this.supportedFormats.includes(extension);
  }

  getSupportedFormats() {
    return [...this.supportedFormats];
  }
}

module.exports = DocumentProcessor;
