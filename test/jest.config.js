// Configurazione Jest per i test

module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'server*/**/*.js',
        '!**/node_modules/**',
        '!**/test/**'
    ],
    testMatch: [
        '**/test/**/*.test.js'
    ],
    testTimeout: 10000,
    setupFilesAfterEnv: ['./test/setup.js']
};

// test/setup.js
// Setup globale per i test

// Disabilita i log durante i test
console.log = jest.fn();
console.error = jest.fn();

// Mock delle variabili d'ambiente
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DB_NAME = 'evoting_test';

// Cleanup dopo i test
afterAll(() => {
    // Chiudi connessioni database
    const { sequelize } = require('../database/models');
    if (sequelize) {
        sequelize.close();
    }
});