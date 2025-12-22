import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'services/**/tests/**/*.test.ts',
      'packages/**/src/**/*.test.ts'
    ],
    coverage: {
      reporter: ['text', 'html'],
      reportsDirectory: './coverage'
    },
  }
});
