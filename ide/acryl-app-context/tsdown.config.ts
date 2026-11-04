import { defineConfig } from 'tsdown'

export default defineConfig({
  name: 'acryl-app-context',
  entry: { index: 'src/index.ts', router: 'src/router.ts', lookup: 'src/lookup.ts' },
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: true,
  sourcemap: true,
})
