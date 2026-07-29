import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: true,
  deps: { neverBundle: ['bun'] },
  dts: true,
  entry: ['src/index.ts', 'src/bridge.ts', 'src/opensearch.ts'],
  format: 'esm',
  outDir: 'dist'
})
