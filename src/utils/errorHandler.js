/**
 * Comprehensive Error Handling Utility for AthenAI
 * Provides specific error types, proper propagation, and user-friendly messages
 */

const { logger } = require('./logger');

// Define specific error types for better error handling
class AthenAIError extends Error {
  constructor(message, type = 'GENERAL_ERROR', statusCode = 500, userMessage = null, context = {}) {
    super(message);
    this.name = 'AthenAIError';
    this.type = type;
    this.statusCode = statusCode;
    this.userMessage = userMessage || this.generateUserMessage(type);
    this.context = context;
    this.timestamp = new Date().toISOString();
  }

  generateUserMessage(type) {
    const userMessages = {
      'AGENT_EXECUTION_ERROR': 'The AI agent encountered an issue while processing your request. Please try again.',
      'DATABASE_CONNECTION_ERROR': 'Unable to connect to the database. Please check your connection and try again.',
      'DATABASE_QUERY_ERROR': 'There was an issue retrieving data. Please try again in a moment.',
      'AI_API_ERROR': 'The AI service is temporarily unavailable. Please try again shortly.',
      'AI_API_RATE_LIMIT': 'Too many requests to the AI service. Please wait a moment before trying again.',
      'AI_API_QUOTA_EXCEEDED': 'AI service quota exceeded. Please contact support or try again later.',
      'VALIDATION_ERROR': 'The provided data is invalid. Please check your input and try again.',
      'AUTHENTICATION_ERROR': 'Authentication failed. Please check your credentials.',
      'AUTHORIZATION_ERROR': 'You do not have permission to perform this action.',
      'WEBSOCKET_ERROR': 'Connection issue occurred. Please refresh the page and try again.',
      'KNOWLEDGE_SUBSTRATE_ERROR': 'Knowledge processing failed. The system will continue with basic functionality.',
      'CACHE_ERROR': 'Caching service unavailable. Performance may be reduced but functionality continues.',
      'ORCHESTRATION_ERROR': 'Agent routing failed. Using fallback processing method.',
      'RESEARCH_ERROR': 'Research service encountered an issue. Please try a different query.',
      'ANALYSIS_ERROR': 'Analysis processing failed. Please check your data and try again.',
      'DOCUMENT_PROCESSING_ERROR': 'Document processing failed. Please check the file format and try again.',
      'NETWORK_ERROR': 'Network connection issue. Please check your internet connection.',
      'TIMEOUT_ERROR': 'The request timed out. Please try again with a simpler query.',
      'GENERAL_ERROR': 'An unexpected error occurred. Please try again or contact support if the issue persists.'
    };
    
    return userMessages[type] || userMessages['GENERAL_ERROR'];
  }

  toJSON() {
    return {
      error: true,
      type: this.type,
      message: this.userMessage,
      timestamp: this.timestamp,
      context: this.context
    };
  }
}

// Specific error classes for different scenarios
class AgentExecutionError extends AthenAIError {
  constructor(message, agentType, context = {}) {
    super(message, 'AGENT_EXECUTION_ERROR', 500, null, { agentType, ...context });
  }
}

class DatabaseError extends AthenAIError {
  constructor(message, operation, context = {}) {
    super(message, 'DATABASE_QUERY_ERROR', 500, null, { operation, ...context });
  }
}

class AIAPIError extends AthenAIError {
  constructor(message, provider, context = {}) {
    const type = message.includes('rate limit') ? 'AI_API_RATE_LIMIT' :
                 message.includes('quota') ? 'AI_API_QUOTA_EXCEEDED' : 'AI_API_ERROR';
    super(message, type, 503, null, { provider, ...context });
  }
}

class ValidationError extends AthenAIError {
  constructor(message, field, context = {}) {
    super(message, 'VALIDATION_ERROR', 400, null, { field, ...context });
  }
}

class WebSocketError extends AthenAIError {
  constructor(message, event, context = {}) {
    super(message, 'WEBSOCKET_ERROR', 500, null, { event, ...context });
  }
}

// Error handling utilities
class ErrorHandler {
  static handleAgentError(error, agentType, sessionId, context = {}) {
    const agentError = error instanceof AthenAIError ? error : 
      new AgentExecutionError(error.message, agentType, { sessionId, originalError: error.name, ...context });
    
    logger.error(`Agent execution failed: ${agentType}`, {
      error: error.message,
      stack: error.stack,
      agentType,
      sessionId,
      context,
      timestamp: new Date().toISOString()
    });

    return agentError;
  }

  static handleDatabaseError(error, operation, context = {}) {
    const dbError = error instanceof AthenAIError ? error :
      new DatabaseError(error.message, operation, { originalError: error.name, ...context });
    
    logger.error(`Database operation failed: ${operation}`, {
      error: error.message,
      stack: error.stack,
      operation,
      context,
      timestamp: new Date().toISOString()
    });

    return dbError;
  }

  static handleAIAPIError(error, provider, context = {}) {
    const apiError = error instanceof AthenAIError ? error :
      new AIAPIError(error.message, provider, { originalError: error.name, ...context });
    
    logger.error(`AI API error: ${provider}`, {
      error: error.message,
      stack: error.stack,
      provider,
      context,
      timestamp: new Date().toISOString()
    });

    return apiError;
  }

  static handleWebSocketError(error, event, socketId, context = {}) {
    const wsError = error instanceof AthenAIError ? error :
      new WebSocketError(error.message, event, { socketId, originalError: error.name, ...context });
    
    logger.error(`WebSocket error: ${event}`, {
      error: error.message,
      stack: error.stack,
      event,
      socketId,
      context,
      timestamp: new Date().toISOString()
    });

    return wsError;
  }

  static createFallbackResponse(error, defaultMessage = 'Service temporarily unavailable') {
    return {
      success: false,
      error: true,
      message: error instanceof AthenAIError ? error.userMessage : defaultMessage,
      type: error instanceof AthenAIError ? error.type : 'GENERAL_ERROR',
      timestamp: new Date().toISOString(),
      fallback: true
    };
  }

  static async executeWithFallback(operation, fallbackFn, context = {}) {
    try {
      return await operation();
    } catch (error) {
      logger.warn('Operation failed, executing fallback', {
        error: error.message,
        context,
        timestamp: new Date().toISOString()
      });
      
      if (fallbackFn) {
        try {
          return await fallbackFn(error);
        } catch (fallbackError) {
          logger.error('Fallback also failed', {
            originalError: error.message,
            fallbackError: fallbackError.message,
            context
          });
          throw fallbackError;
        }
      }
      
      throw error;
    }
  }

  static sanitizeErrorForClient(error) {
    if (error instanceof AthenAIError) {
      return {
        error: true,
        message: error.userMessage,
        type: error.type,
        timestamp: error.timestamp
      };
    }

    // Don't expose internal error details to client
    return {
      error: true,
      message: 'An unexpected error occurred. Please try again.',
      type: 'GENERAL_ERROR',
      timestamp: new Date().toISOString()
    };
  }

  static isRetryableError(error) {
    const retryableTypes = [
      'AI_API_RATE_LIMIT',
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'DATABASE_CONNECTION_ERROR'
    ];
    
    return error instanceof AthenAIError && retryableTypes.includes(error.type);
  }

  static async retryOperation(operation, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (!this.isRetryableError(error) || attempt === maxRetries) {
          throw error;
        }
        
        logger.warn(`Operation failed, retrying (${attempt}/${maxRetries})`, {
          error: error.message,
          attempt,
          delay
        });
        
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
    
    throw lastError;
  }
}

// Express middleware for handling AthenAI errors
const athenAIErrorMiddleware = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const sanitizedError = ErrorHandler.sanitizeErrorForClient(err);
  
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  res.status(err.statusCode || 500).json(sanitizedError);
};

module.exports = {
  AthenAIError,
  AgentExecutionError,
  DatabaseError,
  AIAPIError,
  ValidationError,
  WebSocketError,
  ErrorHandler,
  athenAIErrorMiddleware
};
