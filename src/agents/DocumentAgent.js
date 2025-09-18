/**
 * DocumentAgent.js - Specialized agent for document processing and email attachments
 * Integrates with unstructured.io worker and pgvector for semantic search
 */

const { ChatOpenAI } = require('@langchain/openai');
const { AgentExecutor, createOpenAIFunctionsAgent } = require('langchain/agents');
const { DynamicTool } = require('@langchain/core/tools');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');

class DocumentAgent {
    constructor(config = {}) {
        this.config = {
            openaiApiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
            openaiBaseURL: process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1',
            model: process.env.OPENROUTER_MODEL || 'gpt-4',
            temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE || '0.1'),
            workerUrl: process.env.UNSTRUCTURED_WORKER_URL || 'http://localhost:8080',
            postgresUrl: process.env.POSTGRES_URL,
            uploadDir: process.env.UPLOAD_DIR || './data/unstructured/input',
            ...config
        };

              this.llm = new ChatOpenAI({
        modelName: process.env.OPENROUTER_MODEL || 'openai/gpt-4',
        temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE) || 0.1,
        openAIApiKey: process.env.OPENROUTER_API_KEY,
        configuration: {
          baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
          defaultHeaders: {
            'HTTP-Referer': 'https://athenai.local',
            'X-Title': 'AthenAI System'
          }
        },
        timeout: 10000,
        maxRetries: 2
      });

        // PostgreSQL connection pool
        this.pgPool = new Pool({
            connectionString: this.config.postgresUrl,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        this.tools = this.createTools();
        this.agent = null;
        this.agentExecutor = null;
        this.initializeAgent();
    }

    createTools() {
        return [
            // Think tool for step-by-step document reasoning
            new DynamicTool({
                name: 'think',
                description: 'Think through complex document processing challenges step by step, evaluate different approaches, and reason about the optimal document management strategy',
                func: async (input) => {
                    try {
                        const thinkPrompt = PromptTemplate.fromTemplate(`
You are working through a complex document processing challenge. Break down your reasoning step by step.

Document Challenge: {problem}

Think through this systematically:
1. What is the core document processing objective or user need?
2. What type of document or content am I working with?
3. What processing approaches or tools would be most effective?
4. What are the key information extraction or search requirements?
5. How should I structure the response to be most helpful?
6. What potential issues or edge cases should I consider?

Provide your step-by-step document processing reasoning:
`);

                        const chain = thinkPrompt.pipe(this.llm).pipe(new StringOutputParser());
                        const thinking = await chain.invoke({ problem: input });
                        
                        return `DOCUMENT PROCESSING THINKING PROCESS:\n${thinking}`;
                    } catch (error) {
                        return `Thinking error: ${error.message}`;
                    }
                }
            }),

            new DynamicTool({
                name: 'upload_document',
                description: 'Upload and process a document file (PDF, DOCX, TXT, etc.). Returns document ID for tracking.',
                func: async (input) => {
                    try {
                        const { filePath, fileName, contentType, metadata = {} } = JSON.parse(input);
                        return await this.uploadDocument(filePath, fileName, contentType, metadata);
                    } catch (error) {
                        return `Error uploading document: ${error.message}`;
                    }
                }
            }),

            new DynamicTool({
                name: 'search_documents',
                description: 'Search documents using semantic similarity. Provide a query string to find relevant content.',
                func: async (input) => {
                    try {
                        const { query, limit = 10, threshold = 0.7 } = JSON.parse(input);
                        return await this.searchDocuments(query, limit, threshold);
                    } catch (error) {
                        return `Error searching documents: ${error.message}`;
                    }
                }
            }),

            new DynamicTool({
                name: 'get_document_status',
                description: 'Check the processing status of a document by ID.',
                func: async (input) => {
                    try {
                        const { documentId } = JSON.parse(input);
                        return await this.getDocumentStatus(documentId);
                    } catch (error) {
                        return `Error getting document status: ${error.message}`;
                    }
                }
            }),

            new DynamicTool({
                name: 'list_documents',
                description: 'List all processed documents with metadata and status.',
                func: async (input) => {
                    try {
                        const { limit = 20, offset = 0 } = JSON.parse(input || '{}');
                        return await this.listDocuments(limit, offset);
                    } catch (error) {
                        return `Error listing documents: ${error.message}`;
                    }
                }
            }),

            new DynamicTool({
                name: 'extract_document_summary',
                description: 'Extract and generate a summary of a document by ID.',
                func: async (input) => {
                    try {
                        const { documentId, maxLength = 500 } = JSON.parse(input);
                        return await this.extractDocumentSummary(documentId, maxLength);
                    } catch (error) {
                        return `Error extracting summary: ${error.message}`;
                    }
                }
            }),

            new DynamicTool({
                name: 'process_email_attachment',
                description: 'Process an email attachment for document analysis.',
                func: async (input) => {
                    try {
                        const { attachmentPath, emailMetadata } = JSON.parse(input);
                        return await this.processEmailAttachment(attachmentPath, emailMetadata);
                    } catch (error) {
                        return `Error processing email attachment: ${error.message}`;
                    }
                }
            })
        ];
    }

    async initializeAgent() {
        const prompt = PromptTemplate.fromTemplate(`
You are a specialized Document Processing Agent for AthenAI. Your role is to help users upload, process, search, and analyze documents using advanced AI capabilities.

Key Capabilities:
- Document upload and processing (PDF, DOCX, TXT, etc.)
- Semantic search across document content using vector embeddings
- Document summarization and content extraction
- Email attachment processing
- Document status tracking and management

Available Tools: {tools}

Current Task: {input}
Context: {context}
Session ID: {sessionId}

Think through the task step by step:
1. Understand what the user wants to accomplish
2. Determine which tools are needed
3. Execute the appropriate actions
4. Provide clear, helpful results

Agent Scratchpad: {agent_scratchpad}

Provide helpful, accurate responses about document processing and management.
`);

        this.agent = await createOpenAIFunctionsAgent({
            llm: this.llm,
            tools: this.tools,
            prompt: prompt,
        });

        this.agentExecutor = new AgentExecutor({
            agent: this.agent,
            tools: this.tools,
            verbose: false,
            maxIterations: 5,
            returnIntermediateSteps: false,
        });
    }

    async uploadDocument(filePath, fileName, contentType, metadata = {}) {
        try {
            const documentId = uuidv4();
            const targetPath = path.join(this.config.uploadDir, `${documentId}_${fileName}`);
            
            // Ensure upload directory exists
            await fs.mkdir(this.config.uploadDir, { recursive: true });
            
            // Copy file to upload directory
            await fs.copyFile(filePath, targetPath);
            
            // Send direct HTTP request to unstructured worker for processing
            const processRequest = {
                doc_id: documentId,
                file_path: targetPath,
                content_type: contentType,
                metadata: {
                    ...metadata,
                    original_filename: fileName,
                    uploaded_at: new Date().toISOString(),
                    file_size: (await fs.stat(targetPath)).size
                }
            };
            
            try {
                const response = await axios.post(`${this.config.workerUrl}/process`, processRequest, {
                    timeout: 30000,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                return JSON.stringify({
                    success: true,
                    documentId: documentId,
                    fileName: fileName,
                    status: 'processing',
                    message: 'Document uploaded and processing started',
                    processingResponse: response.data
                });
            } catch (workerError) {
                // If worker is not available, still return success but indicate async processing
                console.warn(`Worker not available, document queued: ${workerError.message}`);
                return JSON.stringify({
                    success: true,
                    documentId: documentId,
                    fileName: fileName,
                    status: 'queued_for_processing',
                    message: 'Document uploaded, will be processed when worker is available'
                });
            }
            
        } catch (error) {
            throw new Error(`Failed to upload document: ${error.message}`);
        }
    }

    async searchDocuments(query, limit = 10, threshold = 0.7) {
        try {
            // Create embedding for search query
            const embedding = await this.createEmbedding(query);
            
            const client = await this.pgPool.connect();
            try {
                const result = await client.query(`
                    SELECT 
                        id,
                        entity_type,
                        content,
                        metadata,
                        created_at,
                        1 - (embedding <=> $1::vector) as similarity
                    FROM knowledge_entities 
                    WHERE entity_type IN ('document', 'chunk')
                    AND 1 - (embedding <=> $1::vector) > $2
                    ORDER BY embedding <=> $1::vector
                    LIMIT $3
                `, [JSON.stringify(embedding), threshold, limit]);

                return JSON.stringify({
                    success: true,
                    query: query,
                    results: result.rows.map(row => ({
                        id: row.id,
                        type: row.entity_type,
                        content: row.content.substring(0, 500) + (row.content.length > 500 ? '...' : ''),
                        similarity: parseFloat(row.similarity).toFixed(3),
                        metadata: row.metadata,
                        created_at: row.created_at
                    }))
                });
            } finally {
                client.release();
            }
        } catch (error) {
            throw new Error(`Failed to search documents: ${error.message}`);
        }
    }

    async getDocumentStatus(documentId) {
        try {
            const client = await this.pgPool.connect();
            try {
                const result = await client.query(`
                    SELECT 
                        id,
                        entity_type,
                        metadata,
                        created_at,
                        updated_at,
                        version
                    FROM knowledge_entities 
                    WHERE id = $1 AND entity_type = 'document'
                `, [documentId]);

                if (result.rows.length === 0) {
                    return JSON.stringify({
                        success: false,
                        message: 'Document not found'
                    });
                }

                const doc = result.rows[0];
                return JSON.stringify({
                    success: true,
                    documentId: doc.id,
                    status: 'processed',
                    metadata: doc.metadata,
                    created_at: doc.created_at,
                    updated_at: doc.updated_at,
                    version: doc.version
                });
            } finally {
                client.release();
            }
        } catch (error) {
            throw new Error(`Failed to get document status: ${error.message}`);
        }
    }

    async listDocuments(limit = 20, offset = 0) {
        try {
            const client = await this.pgPool.connect();
            try {
                const result = await client.query(`
                    SELECT 
                        id,
                        metadata,
                        created_at,
                        updated_at,
                        LENGTH(content) as content_length
                    FROM knowledge_entities 
                    WHERE entity_type = 'document'
                    ORDER BY created_at DESC
                    LIMIT $1 OFFSET $2
                `, [limit, offset]);

                return JSON.stringify({
                    success: true,
                    documents: result.rows.map(row => ({
                        id: row.id,
                        metadata: row.metadata,
                        content_length: row.content_length,
                        created_at: row.created_at,
                        updated_at: row.updated_at
                    })),
                    count: result.rows.length
                });
            } finally {
                client.release();
            }
        } catch (error) {
            throw new Error(`Failed to list documents: ${error.message}`);
        }
    }

    async extractDocumentSummary(documentId, maxLength = 500) {
        try {
            const client = await this.pgPool.connect();
            try {
                const result = await client.query(`
                    SELECT content, metadata
                    FROM knowledge_entities 
                    WHERE id = $1 AND entity_type = 'document'
                `, [documentId]);

                if (result.rows.length === 0) {
                    throw new Error('Document not found');
                }

                const content = result.rows[0].content;
                const metadata = result.rows[0].metadata;

                // Generate summary using LLM
                const summaryPrompt = `Please provide a concise summary of the following document content (max ${maxLength} characters):

${content.substring(0, 4000)}

Summary:`;

                const summary = await this.llm.invoke(summaryPrompt);

                return JSON.stringify({
                    success: true,
                    documentId: documentId,
                    summary: summary.content.substring(0, maxLength),
                    metadata: metadata,
                    original_length: content.length
                });
            } finally {
                client.release();
            }
        } catch (error) {
            throw new Error(`Failed to extract summary: ${error.message}`);
        }
    }

    async processEmailAttachment(attachmentPath, emailMetadata) {
        try {
            const fileName = path.basename(attachmentPath);
            const contentType = this.getContentTypeFromExtension(fileName);
            
            const enhancedMetadata = {
                ...emailMetadata,
                source: 'email_attachment',
                processed_at: new Date().toISOString()
            };

            return await this.uploadDocument(attachmentPath, fileName, contentType, enhancedMetadata);
        } catch (error) {
            throw new Error(`Failed to process email attachment: ${error.message}`);
        }
    }

    async createEmbedding(text) {
        // This would typically call OpenAI's embedding API
        // For now, return a placeholder - the actual implementation would be in the worker
        const response = await fetch(`${this.config.openaiBaseURL}/embeddings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'text-embedding-3-small',
                input: text
            })
        });

        const data = await response.json();
        return data.data[0].embedding;
    }

    getContentTypeFromExtension(fileName) {
        const ext = path.extname(fileName).toLowerCase();
        const contentTypes = {
            '.pdf': 'application/pdf',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.doc': 'application/msword',
            '.txt': 'text/plain',
            '.md': 'text/markdown',
            '.html': 'text/html',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        };
        return contentTypes[ext] || 'application/octet-stream';
    }

    async processMessage(message, context = '', sessionId = '') {
        try {
            const result = await this.agentExecutor.invoke({
                input: message,
                context: context,
                sessionId: sessionId,
                tools: this.tools.map(tool => tool.name).join(', ')
            });

            return {
                success: true,
                response: result.output,
                agent: 'DocumentAgent',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('DocumentAgent processing error:', error);
            return {
                success: false,
                error: error.message,
                agent: 'DocumentAgent',
                timestamp: new Date().toISOString()
            };
        }
    }
}

module.exports = DocumentAgent;
