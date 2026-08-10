import type { Config } from 'jest';

const config: Config = {
  displayName: 'api',
  testEnvironment: 'node',
  rootDir: '.',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: {
    '^@sfaizh/shared$': '<rootDir>/../../libs/shared/src/index.ts',
    '^@sfaizh/api$': '<rootDir>/src/index.ts',
  },
  coverageDirectory: '../../coverage/apps/api',
  collectCoverageFrom: ['<rootDir>/src/**/*.ts', '!<rootDir>/src/**/*.spec.ts'],
  // Nest bootstraps once per suite; give it room on a cold CI runner.
  testTimeout: 20_000,
};

export default config;
