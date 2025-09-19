module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 30000,
  forceExit: true,
  maxWorkers: 1,
  detectOpenHandles: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};
