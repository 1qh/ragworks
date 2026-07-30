import { defineConfig } from 'tsdown'

export default defineConfig({
  clean: true,
  deps: { neverBundle: ['bun'] },
  dts: true,
  entry: [
    'src/index.ts',
    'src/bridge.ts',
    'src/opensearch.ts',
    'src/models.ts',
    'src/office-render.ts',
    'src/embed-cache.ts',
    'src/region.ts',
    'src/vlm.ts'
  ],
  format: 'esm',
  outDir: 'dist'
})
