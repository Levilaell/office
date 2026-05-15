import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/integration/**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.turbo/**'],
    passWithNoTests: false,
    reporters: ['default'],
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ['./tests/setup/load-env.ts'],
  },
});
