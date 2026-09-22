import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    setupFiles: ['tests/setup/env.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/lib/**', 'src/modules/**', 'src/app/api/**', 'src/jobs/**', 'src/mcp/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
