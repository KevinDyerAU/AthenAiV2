const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/chunking.log' }),
    new winston.transports.Console()
  ]
});

class IntelligentChunker {
  constructor() {
    this.defaultOptions = {
      maxChunkSize: 1000,
      overlapSize: 200,
      preserveStructure: true,
      contentType: 'text'
    };
  }

  async intelligentChunking(content, options = {}) {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      logger.info('Starting intelligent chunking', { 
        contentLength: content.length,
        contentType: opts.contentType 
      });

      // Choose chunking strategy based on content type
      switch (opts.contentType) {
        case 'email':
          return this.chunkEmail(content, opts);
        case 'document':
          return this.chunkDocument(content, opts);
        case 'code':
          return this.chunkCode(content, opts);
        case 'markdown':
          return this.chunkMarkdown(content, opts);
        default:
          return this.chunkGenericText(content, opts);
      }
    } catch (error) {
      logger.error('Error in intelligent chunking:', error);
      throw error;
    }
  }

  chunkEmail(content, options) {
    const chunks = [];
    const lines = content.split('\n');
    
    // Identify email structure
    let subjectEnd = -1;
    let bodyStart = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('Subject:')) {
        subjectEnd = i;
      }
      if (lines[i].trim() === '' && subjectEnd !== -1 && bodyStart === -1) {
        bodyStart = i + 1;
        break;
      }
    }

    // Chunk subject separately if found
    if (subjectEnd !== -1) {
      chunks.push({
        text: lines.slice(0, subjectEnd + 1).join('\n'),
        index: 0,
        start: 0,
        end: lines.slice(0, subjectEnd + 1).join('\n').length,
        type: 'email_header'
      });
    }

    // Chunk body content
    if (bodyStart !== -1) {
      const bodyContent = lines.slice(bodyStart).join('\n');
      const bodyChunks = this.chunkGenericText(bodyContent, options);
      
      bodyChunks.forEach((chunk, index) => {
        chunks.push({
          ...chunk,
          index: chunks.length,
          type: 'email_body'
        });
      });
    }

    return chunks;
  }

  chunkDocument(content, options) {
    // Try to identify document structure (headings, paragraphs, etc.)
    const chunks = [];
    const paragraphs = content.split(/\n\s*\n/);
    
    let currentChunk = '';
    let chunkIndex = 0;
    let startPos = 0;

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      if (!trimmedParagraph) continue;

      // Check if adding this paragraph would exceed chunk size
      if (currentChunk.length + trimmedParagraph.length > options.maxChunkSize && currentChunk.length > 0) {
        // Finalize current chunk
        chunks.push({
          text: currentChunk.trim(),
          index: chunkIndex++,
          start: startPos,
          end: startPos + currentChunk.length,
          type: 'document_section'
        });

        // Start new chunk with overlap if configured
        if (options.overlapSize > 0) {
          const overlapText = this.getOverlapText(currentChunk, options.overlapSize);
          currentChunk = overlapText + '\n\n' + trimmedParagraph;
          startPos = startPos + currentChunk.length - overlapText.length - trimmedParagraph.length - 2;
        } else {
          currentChunk = trimmedParagraph;
          startPos = startPos + currentChunk.length;
        }
      } else {
        // Add paragraph to current chunk
        if (currentChunk.length > 0) {
          currentChunk += '\n\n' + trimmedParagraph;
        } else {
          currentChunk = trimmedParagraph;
        }
      }
    }

    // Add final chunk if there's remaining content
    if (currentChunk.trim().length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex,
        start: startPos,
        end: startPos + currentChunk.length,
        type: 'document_section'
      });
    }

    return chunks;
  }

  chunkCode(content, options) {
    const chunks = [];
    const lines = content.split('\n');
    
    let currentChunk = '';
    let chunkIndex = 0;
    let startLine = 0;
    let braceLevel = 0;
    let inFunction = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentChunk += line + '\n';

      // Track code structure
      braceLevel += (line.match(/\{/g) || []).length;
      braceLevel -= (line.match(/\}/g) || []).length;

      // Detect function boundaries
      if (line.match(/function\s+\w+|class\s+\w+|def\s+\w+/)) {
        inFunction = true;
      }

      // Check for natural break points
      const isNaturalBreak = braceLevel === 0 && !inFunction && line.trim() === '';
      const exceedsSize = currentChunk.length > options.maxChunkSize;

      if ((isNaturalBreak || exceedsSize) && currentChunk.trim().length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          index: chunkIndex++,
          start: startLine,
          end: i,
          type: 'code_block'
        });

        currentChunk = '';
        startLine = i + 1;
        inFunction = false;
      }
    }

    // Add final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex,
        start: startLine,
        end: lines.length - 1,
        type: 'code_block'
      });
    }

    return chunks;
  }

  chunkMarkdown(content, options) {
    const chunks = [];
    const sections = content.split(/^#{1,6}\s+/m);
    
    let chunkIndex = 0;
    let position = 0;

    for (const section of sections) {
      if (!section.trim()) continue;

      const sectionChunks = this.chunkGenericText(section, {
        ...options,
        maxChunkSize: options.maxChunkSize * 0.8 // Slightly smaller for markdown
      });

      sectionChunks.forEach(chunk => {
        chunks.push({
          ...chunk,
          index: chunkIndex++,
          start: position,
          end: position + chunk.text.length,
          type: 'markdown_section'
        });
        position += chunk.text.length;
      });
    }

    return chunks;
  }

  chunkGenericText(content, options) {
    const chunks = [];
    const sentences = this.splitIntoSentences(content);
    
    let currentChunk = '';
    let chunkIndex = 0;
    let startPos = 0;

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;

      // Check if adding this sentence would exceed chunk size
      if (currentChunk.length + trimmedSentence.length > options.maxChunkSize && currentChunk.length > 0) {
        // Finalize current chunk
        chunks.push({
          text: currentChunk.trim(),
          index: chunkIndex++,
          start: startPos,
          end: startPos + currentChunk.length,
          type: 'text_chunk'
        });

        // Start new chunk with overlap
        if (options.overlapSize > 0) {
          const overlapText = this.getOverlapText(currentChunk, options.overlapSize);
          currentChunk = overlapText + ' ' + trimmedSentence;
          startPos = startPos + currentChunk.length - overlapText.length - trimmedSentence.length - 1;
        } else {
          currentChunk = trimmedSentence;
          startPos = startPos + currentChunk.length;
        }
      } else {
        // Add sentence to current chunk
        if (currentChunk.length > 0) {
          currentChunk += ' ' + trimmedSentence;
        } else {
          currentChunk = trimmedSentence;
        }
      }
    }

    // Add final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        index: chunkIndex,
        start: startPos,
        end: startPos + currentChunk.length,
        type: 'text_chunk'
      });
    }

    return chunks;
  }

  splitIntoSentences(text) {
    // Simple sentence splitting - could be enhanced with NLP libraries
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => s + '.');
  }

  getOverlapText(text, overlapSize) {
    if (text.length <= overlapSize) {
      return text;
    }

    // Try to find a natural break point near the overlap size
    const targetStart = text.length - overlapSize;
    const searchText = text.substring(targetStart);
    
    // Look for sentence boundaries
    const sentenceMatch = searchText.match(/[.!?]\s+/);
    if (sentenceMatch) {
      return text.substring(targetStart + sentenceMatch.index + sentenceMatch[0].length);
    }

    // Fallback to word boundaries
    const wordMatch = searchText.match(/\s+/);
    if (wordMatch) {
      return text.substring(targetStart + wordMatch.index + wordMatch[0].length);
    }

    // Last resort: character-based overlap
    return text.substring(targetStart);
  }
}

// Export singleton instance
const chunker = new IntelligentChunker();

module.exports = {
  intelligentChunking: (content, options) => chunker.intelligentChunking(content, options),
  IntelligentChunker
};
