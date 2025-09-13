const BaseProcessor = require('./BaseProcessor');
const DocumentProcessor = require('./DocumentProcessor');
const winston = require('winston');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/attachment_processor.log' }),
    new winston.transports.Console()
  ]
});

class AttachmentProcessor extends BaseProcessor {
  constructor() {
    super();
    this.documentProcessor = new DocumentProcessor();
    
    // Define supported attachment types and their processing strategies
    this.processingStrategies = {
      'text/plain': 'text',
      'text/html': 'html',
      'text/markdown': 'markdown',
      'text/csv': 'csv',
      'application/json': 'json',
      'application/xml': 'xml',
      'application/pdf': 'document',
      'application/msword': 'document',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
      'application/vnd.ms-excel': 'spreadsheet',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
      'image/jpeg': 'image',
      'image/png': 'image',
      'image/gif': 'image',
      'image/svg+xml': 'image_text'
    };
  }

  async processAttachment(attachmentData, metadata = {}) {
    try {
      logger.info('Starting attachment processing', { 
        filename: attachmentData.filename,
        contentType: attachmentData.contentType,
        size: attachmentData.size
      });

      // Determine processing strategy
      const strategy = this.getProcessingStrategy(attachmentData.contentType);
      
      if (!strategy) {
        return await this.handleUnsupportedAttachment(attachmentData, metadata);
      }

      // Create temporary file for processing
      const tempFilePath = await this.createTempFile(attachmentData);

      try {
        // Process based on strategy
        let result;
        switch (strategy) {
          case 'document':
            result = await this.processDocumentAttachment(tempFilePath, attachmentData, metadata);
            break;
          case 'text':
          case 'html':
          case 'markdown':
            result = await this.processTextAttachment(tempFilePath, attachmentData, metadata, strategy);
            break;
          case 'csv':
            result = await this.processCsvAttachment(tempFilePath, attachmentData, metadata);
            break;
          case 'json':
            result = await this.processJsonAttachment(tempFilePath, attachmentData, metadata);
            break;
          case 'xml':
            result = await this.processXmlAttachment(tempFilePath, attachmentData, metadata);
            break;
          case 'spreadsheet':
            result = await this.processSpreadsheetAttachment(tempFilePath, attachmentData, metadata);
            break;
          case 'image':
            result = await this.processImageAttachment(tempFilePath, attachmentData, metadata);
            break;
          case 'image_text':
            result = await this.processImageTextAttachment(tempFilePath, attachmentData, metadata);
            break;
          default:
            result = await this.handleUnsupportedAttachment(attachmentData, metadata);
        }

        logger.info('Attachment processing completed', { 
          filename: attachmentData.filename,
          processingId: result.processingId,
          strategy: strategy
        });

        return result;

      } finally {
        // Clean up temporary file
        await this.cleanupTempFile(tempFilePath);
      }

    } catch (error) {
      logger.error('Error processing attachment:', error);
      throw error;
    }
  }

  getProcessingStrategy(contentType) {
    return this.processingStrategies[contentType] || null;
  }

  async createTempFile(attachmentData) {
    const tempDir = '/tmp/attachments';
    await fs.mkdir(tempDir, { recursive: true });
    
    const filename = attachmentData.filename || `attachment_${crypto.randomUUID()}`;
    const tempFilePath = path.join(tempDir, filename);
    
    await fs.writeFile(tempFilePath, attachmentData.content);
    return tempFilePath;
  }

  async cleanupTempFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      logger.warn('Could not delete temporary file:', error);
    }
  }

  async processDocumentAttachment(filePath, attachmentData, metadata) {
    const enhancedMetadata = this.enhanceAttachmentMetadata(attachmentData, metadata, 'document');
    return await this.documentProcessor.processDocument(filePath, enhancedMetadata);
  }

  async processTextAttachment(filePath, attachmentData, metadata, textType) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Process HTML content to extract text
      let processedContent = content;
      if (textType === 'html') {
        processedContent = this.extractTextFromHtml(content);
      }

      const enhancedMetadata = this.enhanceAttachmentMetadata(attachmentData, metadata, textType);

      const result = await this.processContent(processedContent, enhancedMetadata, {
        maxChunkSize: 1000,
        overlapSize: 200,
        preserveStructure: true,
        contentType: textType
      });

      return result;

    } catch (error) {
      logger.error('Error processing text attachment:', error);
      throw error;
    }
  }

  async processCsvAttachment(filePath, attachmentData, metadata) {
    try {
      const csvContent = await fs.readFile(filePath, 'utf-8');
      
      // Parse CSV and convert to structured text
      const rows = csvContent.split('\n').map(row => row.split(','));
      const headers = rows[0];
      const dataRows = rows.slice(1);

      // Create structured text representation
      let structuredContent = `CSV Data: ${attachmentData.filename}\n\n`;
      structuredContent += `Headers: ${headers.join(', ')}\n\n`;
      structuredContent += `Data Summary:\n`;
      structuredContent += `- Total rows: ${dataRows.length}\n`;
      structuredContent += `- Columns: ${headers.length}\n\n`;

      // Add sample data (first few rows)
      const sampleRows = dataRows.slice(0, 10);
      structuredContent += `Sample Data:\n`;
      sampleRows.forEach((row, index) => {
        structuredContent += `Row ${index + 1}: ${row.join(', ')}\n`;
      });

      const enhancedMetadata = this.enhanceAttachmentMetadata(attachmentData, metadata, 'csv');
      enhancedMetadata.csv_structure = {
        headers: headers,
        row_count: dataRows.length,
        column_count: headers.length
      };

      const result = await this.processContent(structuredContent, enhancedMetadata, {
        maxChunkSize: 1200,
        overlapSize: 200,
        preserveStructure: true,
        contentType: 'csv'
      });

      return result;

    } catch (error) {
      logger.error('Error processing CSV attachment:', error);
      throw error;
    }
  }

  async processJsonAttachment(filePath, attachmentData, metadata) {
    try {
      const jsonContent = await fs.readFile(filePath, 'utf-8');
      const jsonData = JSON.parse(jsonContent);

      // Convert JSON to structured text representation
      let structuredContent = `JSON Data: ${attachmentData.filename}\n\n`;
      structuredContent += `Structure Analysis:\n`;
      structuredContent += this.analyzeJsonStructure(jsonData);
      structuredContent += `\n\nContent:\n`;
      structuredContent += JSON.stringify(jsonData, null, 2);

      const enhancedMetadata = this.enhanceAttachmentMetadata(attachmentData, metadata, 'json');
      enhancedMetadata.json_structure = this.getJsonStructureMetadata(jsonData);

      const result = await this.processContent(structuredContent, enhancedMetadata, {
        maxChunkSize: 1500,
        overlapSize: 300,
        preserveStructure: true,
        contentType: 'json'
      });

      return result;

    } catch (error) {
      logger.error('Error processing JSON attachment:', error);
      throw error;
    }
  }

  async processXmlAttachment(filePath, attachmentData, metadata) {
    try {
      const xmlContent = await fs.readFile(filePath, 'utf-8');

      // Simple XML to text conversion (could be enhanced with proper XML parser)
      const textContent = xmlContent
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      let structuredContent = `XML Data: ${attachmentData.filename}\n\n`;
      structuredContent += `Content:\n${textContent}`;

      const enhancedMetadata = this.enhanceAttachmentMetadata(attachmentData, metadata, 'xml');

      const result = await this.processContent(structuredContent, enhancedMetadata, {
        maxChunkSize: 1200,
        overlapSize: 200,
        preserveStructure: true,
        contentType: 'xml'
      });

      return result;

    } catch (error) {
      logger.error('Error processing XML attachment:', error);
      throw error;
    }
  }

  async processSpreadsheetAttachment(filePath, attachmentData, metadata) {
    try {
      // For now, treat as binary and store metadata only
      // Could be enhanced with libraries like xlsx or exceljs
      const stats = await fs.stat(filePath);

      let structuredContent = `Spreadsheet: ${attachmentData.filename}\n\n`;
      structuredContent += `File Information:\n`;
      structuredContent += `- Size: ${stats.size} bytes\n`;
      structuredContent += `- Type: ${attachmentData.contentType}\n`;
      structuredContent += `- Processing: Metadata extraction only\n`;

      const enhancedMetadata = this.enhanceAttachmentMetadata(attachmentData, metadata, 'spreadsheet');

      const result = await this.processContent(structuredContent, enhancedMetadata, {
        maxChunkSize: 500,
        overlapSize: 100,
        preserveStructure: true,
        contentType: 'spreadsheet'
      });

      return result;

    } catch (error) {
      logger.error('Error processing spreadsheet attachment:', error);
      throw error;
    }
  }

  async processImageAttachment(filePath, attachmentData, metadata) {
    try {
      const stats = await fs.stat(filePath);

      let structuredContent = `Image: ${attachmentData.filename}\n\n`;
      structuredContent += `Image Information:\n`;
      structuredContent += `- Filename: ${attachmentData.filename}\n`;
      structuredContent += `- Size: ${stats.size} bytes\n`;
      structuredContent += `- Type: ${attachmentData.contentType}\n`;
      structuredContent += `- Processing: Metadata extraction only\n`;

      const enhancedMetadata = this.enhanceAttachmentMetadata(attachmentData, metadata, 'image');

      const result = await this.processContent(structuredContent, enhancedMetadata, {
        maxChunkSize: 500,
        overlapSize: 50,
        preserveStructure: true,
        contentType: 'image'
      });

      return result;

    } catch (error) {
      logger.error('Error processing image attachment:', error);
      throw error;
    }
  }

  async processImageTextAttachment(filePath, attachmentData, metadata) {
    try {
      // For SVG files, extract text content
      const svgContent = await fs.readFile(filePath, 'utf-8');
      
      // Extract text elements from SVG
      const textMatches = svgContent.match(/<text[^>]*>(.*?)<\/text>/g) || [];
      const extractedText = textMatches
        .map(match => match.replace(/<[^>]*>/g, ''))
        .join(' ');

      let structuredContent = `SVG Image with Text: ${attachmentData.filename}\n\n`;
      if (extractedText) {
        structuredContent += `Extracted Text:\n${extractedText}\n\n`;
      }
      structuredContent += `SVG Content Analysis:\n`;
      structuredContent += `- Text elements found: ${textMatches.length}\n`;

      const enhancedMetadata = this.enhanceAttachmentMetadata(attachmentData, metadata, 'image_text');
      enhancedMetadata.extracted_text_length = extractedText.length;

      const result = await this.processContent(structuredContent, enhancedMetadata, {
        maxChunkSize: 800,
        overlapSize: 150,
        preserveStructure: true,
        contentType: 'image_text'
      });

      return result;

    } catch (error) {
      logger.error('Error processing image text attachment:', error);
      throw error;
    }
  }

  async handleUnsupportedAttachment(attachmentData, metadata) {
    try {
      // Store metadata for unsupported attachments
      let structuredContent = `Unsupported Attachment: ${attachmentData.filename}\n\n`;
      structuredContent += `File Information:\n`;
      structuredContent += `- Filename: ${attachmentData.filename}\n`;
      structuredContent += `- Content Type: ${attachmentData.contentType}\n`;
      structuredContent += `- Size: ${attachmentData.size} bytes\n`;
      structuredContent += `- Status: Metadata only (unsupported format)\n`;

      const enhancedMetadata = this.enhanceAttachmentMetadata(attachmentData, metadata, 'unsupported');

      const result = await this.processContent(structuredContent, enhancedMetadata, {
        maxChunkSize: 300,
        overlapSize: 50,
        preserveStructure: true,
        contentType: 'unsupported'
      });

      return result;

    } catch (error) {
      logger.error('Error handling unsupported attachment:', error);
      throw error;
    }
  }

  enhanceAttachmentMetadata(attachmentData, originalMetadata, processingType) {
    return {
      ...originalMetadata,
      source_type: 'attachment',
      attachment_filename: attachmentData.filename,
      attachment_content_type: attachmentData.contentType,
      attachment_size: attachmentData.size,
      attachment_processing_type: processingType,
      content_id: attachmentData.cid,
      is_inline: attachmentData.inline || false,
      processing_timestamp: new Date().toISOString()
    };
  }

  extractTextFromHtml(htmlContent) {
    return htmlContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  analyzeJsonStructure(jsonData) {
    let analysis = '';
    
    if (Array.isArray(jsonData)) {
      analysis += `- Type: Array\n`;
      analysis += `- Length: ${jsonData.length}\n`;
      if (jsonData.length > 0) {
        analysis += `- First element type: ${typeof jsonData[0]}\n`;
      }
    } else if (typeof jsonData === 'object' && jsonData !== null) {
      analysis += `- Type: Object\n`;
      const keys = Object.keys(jsonData);
      analysis += `- Keys: ${keys.length}\n`;
      analysis += `- Key names: ${keys.slice(0, 10).join(', ')}${keys.length > 10 ? '...' : ''}\n`;
    } else {
      analysis += `- Type: ${typeof jsonData}\n`;
    }

    return analysis;
  }

  getJsonStructureMetadata(jsonData) {
    if (Array.isArray(jsonData)) {
      return {
        type: 'array',
        length: jsonData.length,
        element_types: [...new Set(jsonData.map(item => typeof item))]
      };
    } else if (typeof jsonData === 'object' && jsonData !== null) {
      const keys = Object.keys(jsonData);
      return {
        type: 'object',
        key_count: keys.length,
        keys: keys.slice(0, 20), // Limit to first 20 keys
        value_types: [...new Set(Object.values(jsonData).map(value => typeof value))]
      };
    } else {
      return {
        type: typeof jsonData,
        value: jsonData
      };
    }
  }

  // Process multiple attachments in batch
  async processBatch(attachments, batchMetadata = {}) {
    const results = [];
    const errors = [];

    logger.info('Starting batch attachment processing', { 
      attachmentCount: attachments.length 
    });

    for (const attachment of attachments) {
      try {
        const result = await this.processAttachment(attachment, {
          ...batchMetadata,
          batch_id: batchMetadata.batch_id || crypto.randomUUID(),
          batch_index: attachments.indexOf(attachment)
        });
        results.push(result);
      } catch (error) {
        logger.error(`Error processing attachment ${attachment.filename}:`, error);
        errors.push({
          filename: attachment.filename,
          error: error.message
        });
      }
    }

    logger.info('Batch attachment processing completed', { 
      successful: results.length,
      failed: errors.length
    });

    return {
      successful: results,
      failed: errors,
      summary: {
        total_attachments: attachments.length,
        successful_count: results.length,
        failed_count: errors.length,
        by_type: this.summarizeByType(attachments)
      }
    };
  }

  summarizeByType(attachments) {
    const summary = {};
    attachments.forEach(attachment => {
      const type = attachment.contentType || 'unknown';
      summary[type] = (summary[type] || 0) + 1;
    });
    return summary;
  }

  getSupportedTypes() {
    return Object.keys(this.processingStrategies);
  }

  isSupported(contentType) {
    return this.processingStrategies.hasOwnProperty(contentType);
  }
}

module.exports = AttachmentProcessor;
