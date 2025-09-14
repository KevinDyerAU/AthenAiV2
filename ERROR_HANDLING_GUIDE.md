# AthenAI Error Handling Guide

## Overview

AthenAI implements comprehensive error handling with specific error types, proper propagation to the UI, and robust fallback mechanisms. This guide covers the error handling architecture and testing procedures.

## Error Handling Architecture

### Core Components

#### 1. AthenAI Error Classes
- **AthenAIError**: Base error class with user-friendly messages
- **AgentExecutionError**: Agent-specific errors with context
- **DatabaseError**: Database operation failures
- **AIAPIError**: AI service errors (rate limits, quotas, timeouts)
- **ValidationError**: Input validation failures
- **WebSocketError**: Real-time communication errors

#### 2. Error Handler Utility
- **Centralized error processing** with context preservation
- **User-friendly message generation** based on error types
- **Retry logic** for transient failures
- **Fallback response creation** for graceful degradation

### Error Types and User Messages

| Error Type | User Message | Status Code |
|------------|--------------|-------------|
| `AGENT_EXECUTION_ERROR` | "The AI agent encountered an issue while processing your request. Please try again." | 500 |
| `DATABASE_CONNECTION_ERROR` | "Unable to connect to the database. Please check your connection and try again." | 500 |
| `AI_API_RATE_LIMIT` | "Too many requests to the AI service. Please wait a moment before trying again." | 503 |
| `AI_API_QUOTA_EXCEEDED` | "AI service quota exceeded. Please contact support or try again later." | 503 |
| `VALIDATION_ERROR` | "The provided data is invalid. Please check your input and try again." | 400 |
| `WEBSOCKET_ERROR` | "Connection issue occurred. Please refresh the page and try again." | 500 |
| `KNOWLEDGE_SUBSTRATE_ERROR` | "Knowledge processing failed. The system will continue with basic functionality." | 500 |
| `RESEARCH_ERROR` | "Research service encountered an issue. Please try a different query." | 500 |
| `ANALYSIS_ERROR` | "Analysis processing failed. Please check your data and try again." | 500 |
| `DOCUMENT_PROCESSING_ERROR` | "Document processing failed. Please check the file format and try again." | 500 |
| `TIMEOUT_ERROR` | "The request timed out. Please try again with a simpler query." | 408 |

## Implementation Details

### 1. Agent Error Handling

```javascript
// Example: ResearchAgent error handling
try {
  const result = await this.performResearch(query);
  return result;
} catch (error) {
  const agentError = ErrorHandler.handleAgentError(error, 'research', sessionId, { 
    query: query?.substring(0, 100) 
  });
  return ErrorHandler.createFallbackResponse(agentError, 
    'Research service temporarily unavailable. Please try a different query.');
}
```

### 2. WebSocket Error Handling

```javascript
// WebSocket error propagation with room broadcasting
socket.on('send_message', async (data) => {
  try {
    // Process message
  } catch (error) {
    const wsError = ErrorHandler.handleWebSocketError(error, 'send_message', socket.id, { 
      roomId: data?.roomId, 
      userId: data?.userId,
      messagePreview: data?.message?.substring(0, 100)
    });
    
    // Send error to specific user
    socket.emit('error', ErrorHandler.sanitizeErrorForClient(wsError));
    
    // Broadcast to room that processing failed
    if (data?.roomId) {
      io.to(data.roomId).emit('message_error', {
        error: true,
        message: wsError.userMessage,
        timestamp: new Date().toISOString()
      });
    }
  }
});
```

### 3. Database Error Handling

```javascript
// Database operations with specific error handling
try {
  const result = await this.supabase.from('table').select('*');
  return result;
} catch (error) {
  const dbError = ErrorHandler.handleDatabaseError(error, 'select_operation', { 
    table: 'table_name' 
  });
  throw dbError; // Propagate with context
}
```

### 4. API Route Error Handling

```javascript
// Express route with comprehensive error handling
router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      const validationError = new ValidationError('Message is required', 'message');
      return res.status(validationError.statusCode)
        .json(ErrorHandler.sanitizeErrorForClient(validationError));
    }
    
    // Process request
  } catch (error) {
    const handledError = ErrorHandler.handleAgentError(error, 'chat_orchestration', 
      sessionId, { userId, message: message?.substring(0, 100) });
    res.status(handledError.statusCode)
      .json(ErrorHandler.sanitizeErrorForClient(handledError));
  }
});
```

## Error Propagation Flow

### 1. Agent Level
```
Agent Error → ErrorHandler.handleAgentError() → Structured Error → Fallback Response
```

### 2. WebSocket Level
```
WebSocket Error → ErrorHandler.handleWebSocketError() → User Notification + Room Broadcast
```

### 3. HTTP API Level
```
Route Error → ErrorHandler.sanitizeErrorForClient() → JSON Response with User Message
```

### 4. Database Level
```
DB Error → ErrorHandler.handleDatabaseError() → Context Preservation → Propagation
```

## Retry Logic

### Retryable Errors
- `AI_API_RATE_LIMIT`
- `NETWORK_ERROR`
- `TIMEOUT_ERROR`
- `DATABASE_CONNECTION_ERROR`

### Retry Implementation
```javascript
const result = await ErrorHandler.retryOperation(
  async () => await apiCall(),
  maxRetries = 3,
  delay = 1000
);
```

## Fallback Mechanisms

### 1. Agent Fallbacks
- **Research Agent**: Basic web search if knowledge substrate fails
- **Analysis Agent**: Simple statistical analysis if AI processing fails
- **All Agents**: Generic helpful response if complete failure

### 2. Service Fallbacks
- **Redis Cache**: Continue without caching if Redis unavailable
- **Knowledge Substrate**: Basic functionality if AI processing fails
- **AI APIs**: Fallback to alternative models or simple responses

## Testing Error Scenarios

### 1. Agent Errors
```bash
# Test agent execution failure
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "test invalid agent scenario"}'
```

### 2. Database Errors
```bash
# Test with invalid database connection
# Temporarily disable database in environment
```

### 3. AI API Errors
```bash
# Test with invalid API key
# Set OPENAI_API_KEY=invalid_key
```

### 4. WebSocket Errors
```javascript
// Test WebSocket error handling in browser console
socket.emit('send_message', { 
  roomId: 'invalid', 
  message: null, 
  userId: 'test' 
});
```

### 5. Validation Errors
```bash
# Test missing required fields
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Error Monitoring

### 1. Logging
- All errors logged with context and stack traces
- User actions and error patterns tracked
- Performance impact of error handling measured

### 2. Metrics
- Error rates by type and agent
- Recovery success rates
- User experience impact

### 3. Alerting
- Critical error thresholds
- Service degradation detection
- User impact monitoring

## Best Practices

### 1. Error Context
- Always include relevant context (sessionId, userId, operation)
- Preserve original error information for debugging
- Limit sensitive data in error messages

### 2. User Experience
- Provide specific, actionable error messages
- Avoid technical jargon in user-facing messages
- Offer alternative actions when possible

### 3. Graceful Degradation
- Continue operation with reduced functionality
- Clear communication about service limitations
- Automatic recovery when services restore

### 4. Error Prevention
- Input validation at all entry points
- Proactive health checks for external services
- Circuit breaker patterns for unreliable services

## Configuration

### Environment Variables
```bash
# Error handling configuration
ERROR_RETRY_MAX_ATTEMPTS=3
ERROR_RETRY_DELAY_MS=1000
ERROR_LOG_LEVEL=error
ERROR_SANITIZE_PRODUCTION=true
```

### Error Thresholds
```javascript
// Configurable error thresholds
const ERROR_THRESHOLDS = {
  AGENT_FAILURE_RATE: 0.1,      // 10% failure rate threshold
  API_TIMEOUT_MS: 30000,        // 30 second timeout
  RETRY_MAX_ATTEMPTS: 3,        // Maximum retry attempts
  CIRCUIT_BREAKER_THRESHOLD: 5  // Failures before circuit opens
};
```

This comprehensive error handling system ensures AthenAI provides robust, resilient operation with clear user feedback and graceful degradation under all error conditions.
