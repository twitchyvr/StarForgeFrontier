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
      testMatch: ['**/tests/server/**/*.test.js']
    },
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      testMatch: ['**/tests/client/**/*.test.js']
    }
  ],
  verbose: true,
  testTimeout: 10000
};