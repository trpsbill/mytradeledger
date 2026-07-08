import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.integration.test.ts'],
    setupFiles: ['src/__tests__/integration-setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Single fork so the container starts once and is shared across all integration test files
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
