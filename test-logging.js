// Test logging configuration
require('dotenv').config();
const { logger } = require('./src/utils/logger');

console.log('Environment variables:');
console.log('LOG_LEVEL:', process.env.LOG_LEVEL);
console.log('NODE_ENV:', process.env.NODE_ENV);

console.log('\nTesting logger levels:');
logger.error('Test ERROR message');
logger.warn('Test WARN message');
logger.info('Test INFO message');
logger.debug('Test DEBUG message');

console.log('\nLogger configuration:');
console.log('Logger level:', logger.level);
console.log('Transport count:', logger.transports.length);
logger.transports.forEach((transport, index) => {
  console.log(`Transport ${index}:`, transport.constructor.name, 'Level:', transport.level);
});
