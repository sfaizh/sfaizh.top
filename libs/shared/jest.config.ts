import type { Config } from 'jest';

/**
 * The shared library is pure logic — codec, frontmatter, markdown, sanitiser —
 * so it runs in a plain Node environment with no framework harness.
 */
const config: Config = {
  displayName: 'shared',
  testEnvironment: 'node',
  rootDir: '.',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: {
    '^@sfaizh/shared$': '<rootDir>/src/index.ts',
  },
  coverageDirectory: '../../coverage/libs/shared',
  collectCoverageFrom: ['<rootDir>/src/**/*.ts', '!<rootDir>/src/**/*.spec.ts'],
};

export default config;
