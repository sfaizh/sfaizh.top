import nextJest from 'next/jest.js';
import type { Config } from 'jest';

/**
 * `next/jest` gives the tests the same SWC transform and `tsconfig` path
 * aliases the app is built with, so a test imports `@sfaizh/shared` exactly the
 * way the source does.
 */
// Resolved from the workspace root, because Jest loads this config as an ES
// module where `__dirname` does not exist.
const createJestConfig = nextJest({ dir: './apps/blog' });

const config: Config = {
  displayName: 'blog',
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/src/**/*.spec.tsx'],
  setupFiles: ['<rootDir>/jest.polyfills.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  coverageDirectory: '../../coverage/apps/blog',
  collectCoverageFrom: [
    '<rootDir>/src/**/*.{ts,tsx}',
    '!<rootDir>/src/**/*.spec.{ts,tsx}',
    '!<rootDir>/src/pages/**',
  ],
};

export default createJestConfig(config);
