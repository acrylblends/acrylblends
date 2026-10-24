import { readdirSync, readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

// The framework plugins are vendored from ACRYL with their own tests (spec 015). The tests that need packages a generated app does not have
// (the DSH web server, React) are listed in each plugin's upstream.json and left out here.
const vendoredNotRun = readdirSync('plugins', { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('acryl-'))
  .flatMap((entry) => {
    const record = JSON.parse(readFileSync(`plugins/${entry.name}/upstream.json`, 'utf8'))
    return Object.keys(record.testsNotRun).map((file) => `plugins/${entry.name}/${file}`)
  })

const exclude = ['**/node_modules/**', ...vendoredNotRun]

// The ported core and adapter suites are written for the global test functions, and the adapter suite needs a setup file and --expose-gc:
// the same settings as the plugins' own vitest.config.ts in ACRYL, one project each.
export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 10_000,
    projects: [
      {
        extends: true,
        test: {
          name: 'repo',
          // The templates' own tests run inside each scaffolded project: see scripts/verify-scaffolder.mjs.
          include: [
            'packages/*/test/**/*.test.ts',
            'docs/test/**/*.test.ts',
            'plugins/acryl-*/tests/**/*.spec.ts',
          ],
          exclude: [...exclude, 'plugins/acryl-node-server/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'router-core',
          include: ['plugins/acryl-router/src/core/**/*.test.ts'],
          // Shared case files are imported by the router suites, not run on their own.
          exclude: [...exclude, '**/*.case.test.ts'],
          globals: true,
        },
      },
      {
        extends: true,
        test: {
          name: 'node-server',
          include: [
            'plugins/acryl-node-server/tests/**/*.spec.ts',
            'plugins/acryl-node-server/tests/adapter/**/*.test.ts',
          ],
          exclude,
          globals: true,
          setupFiles: [
            './scripts/vitest-node-server-setup.ts',
            './plugins/acryl-node-server/tests/adapter/setup.ts',
          ],
          execArgv: ['--expose-gc'],
        },
      },
    ],
  },
})
