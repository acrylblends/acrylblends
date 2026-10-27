import { defineConfig } from 'vitest/config'

// The framework packages (plugins/acryl-*, packages/framework) test themselves: `pnpm -r run test` runs each package's own suite with its own vitest settings.
// This one covers the packages that scaffold apps (the CLI and create-acrylblends) and the docs. The templates' own tests run inside each scaffolded project:
// see scripts/verify-scaffolder.mjs.
export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 10_000,
    include: [
      'packages/cli/test/**/*.test.ts',
      'packages/create/test/**/*.test.ts',
      'docs/test/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**'],
  },
})
