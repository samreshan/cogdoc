import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

/**
 * Vitest configuration for Cogdoc.
 *
 * Single project, node environment by default. DOM-dependent tests
 * (sentence-highlight, React components) override per-file with:
 *   // @vitest-environment happy-dom
 *
 * Reuses the @/* path alias so tests import source exactly as app code does.
 *
 * Coverage gate: ≥80% lines AND branches on src/lib + src/app/api.
 * This is the sprint-advance gate (see scripts/gate.sh). Non-negotiable.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', '.next', 'examples', 'scripts/cogdoc'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/lib/**', 'src/app/api/**'],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        'src/lib/types.ts',
        // Sprint 2 (Tiptap migration) will rewrite this component; testing the
        // current one is throwaway work. Re-included in coverage in Sprint 2.
        'src/lib/engine-characters.tsx',
        // Module-level singleton initializer; exercised by every integration
        // test indirectly. No independent unit behaviour to assert.
        'src/lib/db.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
})
