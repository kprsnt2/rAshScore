const nextJest = require("next/jest");

const createJestConfig = nextJest({
    // Provide the path to your Next.js app
    dir: "./",
});

/** @type {import('jest').Config} */
const customConfig = {
    // Test environment
    testEnvironment: "jsdom",

    // Setup files
    setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],

    // Module name mapping for path aliases
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
    },

    // Test patterns
    testMatch: [
        "**/__tests__/**/*.test.ts",
        "**/__tests__/**/*.test.tsx",
    ],

    // Coverage configuration
    collectCoverageFrom: [
        "src/**/*.{ts,tsx}",
        "!src/**/*.d.ts",
        "!src/**/__tests__/**",
    ],

    // Ignore patterns
    testPathIgnorePatterns: [
        "<rootDir>/node_modules/",
        "<rootDir>/.next/",
    ],
};

module.exports = createJestConfig(customConfig);
