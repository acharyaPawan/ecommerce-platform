import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    pool: 'vmThreads',
    maxThreads: 1,
    minThreads: 1,
    testTimeout: 60000,
    hookTimeout: 60000
  }
});
