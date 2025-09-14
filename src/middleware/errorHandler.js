// src/middleware/errorHandler.js
const { logger } = require('../utils/logger');
const { ErrorHandler, AthenAIError } = require('../utils/errorHandler');

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // Use comprehensive error handling
  const sanitizedError = ErrorHandler.sanitizeErrorForClient(err);
  
  logger.error('Request error:', {
    error: err.message,
    stack: err.stack,
    type: err instanceof AthenAIError ? err.type : 'UNKNOWN_ERROR',
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  const statusCode = err.statusCode || (err instanceof AthenAIError ? err.statusCode : 500);
  res.status(statusCode).json(sanitizedError);
};

module.exports = { errorHandler };
