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

export default defineConfig({
  test: {
    // The templates' own tests run inside each scaffolded project: see scripts/verify-scaffolder.mjs.
    include: [
      'packages/*/test/**/*.test.ts',
      'docs/test/**/*.test.ts',
      'plugins/acryl-*/tests/**/*.spec.ts',
    ],
    exclude: ['**/node_modules/**', ...vendoredNotRun],
    environment: 'node',
    testTimeout: 10_000,
  },
})
