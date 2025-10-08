module.exports = {
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    transform: {
        '^.+\\.(js|jsx)$': 'babel-jest',
    },
    testMatch: [
        '<rootDir>/tests/**/*.test.js'
    ],
    moduleFileExtensions: ['js', 'json'],
    collectCoverageFrom: [
        'src/**/*.{ts,js}',
        '!src/**/*.d.ts',
        '!src/types/**/*'
    ],
    // Allow importing the standalone ESM build in tests
    transformIgnorePatterns: [
        'node_modules/(?!(d3|internmap)/)'
    ]
};
