module.exports = {
    testEnvironment: 'jsdom',
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    transform: {
        '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
    },
    testMatch: [
        '<rootDir>/tests/**/*.test.js',
        '<rootDir>/tests/**/*.test.ts'
    ],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
    moduleNameMapper: {
        // d3 v7 is ESM-only ("type": "module", exports.default -> ./src/index.js)
        // and pulls in roughly 30 ESM subpackages (d3-array, d3-selection,
        // delaunator, ...). Resolving to the prebuilt UMD bundle is far cheaper
        // and more robust than babel-transforming all of node_modules.
        '^d3$': '<rootDir>/node_modules/d3/dist/d3.js',
        // Mirrors the tsconfig "paths" entries. The exact '@/types' mapping MUST
        // come before the wildcard: moduleNameMapper is evaluated in key order.
        '^@/types$': '<rootDir>/src/types/index.ts',
        '^@/(.*)$': '<rootDir>/src/$1'
    },
    // Back to the Jest default now that d3 resolves to a UMD file.
    transformIgnorePatterns: [
        '/node_modules/'
    ],
    collectCoverageFrom: [
        'src/**/*.{ts,js}',
        '!src/**/*.d.ts',
        '!src/types/**/*'
    ]
    // NOTE: never add a test that imports from dist/. `prepublishOnly` runs
    // `clean` (which deletes dist/) BEFORE `test:ci`, so such a test would break
    // publishing. Tests import from src/ through the aliases above.
};
