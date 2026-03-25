import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/components/__tests__/setup.ts'],
    environmentMatchGlobs: [
      // Component tests use jsdom
      ['src/components/**/*.test.tsx', 'jsdom'],
      // Everything else uses node
      ['src/**/*.test.ts', 'node'],
    ],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/components/**/*.tsx'],
      exclude: [
        'src/lib/ai-prompts.ts',
        'src/lib/types.ts',
        'src/lib/db.ts',
        'src/components/ui/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
