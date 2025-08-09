module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!jest.config.js',
    '!**/tests/**'
  ],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  projects: [
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: ['**/tests/server/**/*.test.js'],
      // Force single worker for Node.js 16 compatibility
      maxWorkers: 1
    },
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      testMatch: ['**/tests/client/**/*.test.js'],
      // Force single worker for Node.js 16 compatibility
      maxWorkers: 1
    }
  ],
  verbose: true,
  testTimeout: 10000,
  // Global maxWorkers for Node.js 16 compatibility
  maxWorkers: 1
};