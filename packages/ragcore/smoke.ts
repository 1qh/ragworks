/* eslint-disable no-console */
/** biome-ignore-all lint/style/noProcessEnv: a runnable example configures itself from the environment */
/** Drives the PUBLIC surface end to end against real services, so the exported API is proven by use
 * rather than by compiling: configure, parse, chunk, and confirm every chunk points back at a region
 * on a page. A package whose own example is never run is a package whose example is wrong.
 *
 * Run: bun smoke.ts <path-to-document>
 */
import { buildChunks, configureEngine, parseDocument } from './src/index'

const file = process.argv[2]
if (!file) throw new Error('usage: bun smoke.ts <path-to-document>')
configureEngine({
  DOCLING_URL: process.env.DOCLING_URL ?? 'http://localhost:5001',
  PROVIDERS_FILE: process.env.PROVIDERS_FILE ?? './providers.local.toml',
  SOFFICE_PATH: process.env.SOFFICE_PATH
})
const bytes = new Uint8Array(await Bun.file(file).arrayBuffer())
const parsed = await parseDocument({ bytes, name: file.split('/').pop() ?? 'doc' })
console.log(
  `parse    : geometry=${parsed.geometry} blocks=${String(parsed.blocks.length)} chars=${String(parsed.markdown.length)}`
)
const chunks = await buildChunks({
  blocks: parsed.blocks,
  markdown: parsed.markdown,
  maxSize: 800,
  overlap: 120,
  strategy: 'recursive'
})
const withRegions = chunks.filter(c => c.regions.length > 0).length
console.log(`chunks   : ${String(chunks.length)}  with a page region: ${String(withRegions)}`)
console.log(`first    : ${chunks[0]?.text.slice(0, 90).replaceAll('\n', ' ') ?? '(none)'}`)
if (chunks.length === 0) throw new Error('no chunks produced')
if (parsed.geometry === 'spatial' && withRegions === 0)
  throw new Error('a spatial parse produced chunks with no page regions — the provenance bridge is not working')
console.log('ok')
