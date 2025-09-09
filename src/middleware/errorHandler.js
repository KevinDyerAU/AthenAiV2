// src/middleware/errorHandler.js
const { logger } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json({
    error: message,
    timestamp: new Date().toISOString()
  });
};

module.exports = { errorHandler };
