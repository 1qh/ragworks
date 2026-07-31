import { expect, test } from 'bun:test'
import { readdir, readFile } from 'node:fs/promises'
/** The core's promise is that it computes and reaches for nothing: no network, no environment, no
 * filesystem. That is what lets it run in a browser, a worker or a stranger's test with no services
 * standing, and it is the difference between a library anyone can adopt and one only our deployment
 * can. A promise like that decays on the first convenient import, and it decays SILENTLY — every test
 * still passes, because the service happens to be there. So it is checked mechanically here rather
 * than trusted to review.
 *
 * Adding a module to CORE is a commitment that it stays pure. Anything that must reach a service is
 * an ADAPTER and belongs behind a port. */
const CORE = [
  'assemble.ts',
  'bridge.ts',
  'cell-color.ts',
  'concurrency.ts',
  'domain.ts',
  'graph-core.ts',
  'query-parse.ts',
  'stage-key.ts',
  'graph-vector.ts',
  'invariant.ts',
  'lib.ts',
  'mcp.ts',
  'metering.ts',
  'pricing.ts',
  'prompts.ts',
  'ports.ts',
  'rerank-order.ts',
  'retrieve.ts',
  'resilience.ts',
  'respace.ts',
  'router.ts',
  'simhash.ts',
  'snap-ink.ts',
  'table-grid.ts'
]
const REACHES: [string, RegExp][] = [
  ['network', /\bfetch\s*\(|new WebSocket|http\.request/u],
  ['environment', /process\.env|engineEnv|Bun\.env/u],
  ['filesystem', /node:fs|from 'bun'|readFileSync|writeFileSync/u],
  ['a service client', /RedisClient|opensearch|@opensearch-project/u]
]
const src = async (f: string): Promise<string> => readFile(new URL(f, import.meta.url), 'utf8')
test('the core is present — a rename that emptied this list would make every check below vacuous', async () => {
  const onDisk = new Set(await readdir(new URL('.', import.meta.url)))
  expect(CORE.filter(f => !onDisk.has(f))).toEqual([])
  expect(CORE.length).toBeGreaterThan(10)
})
test.each(REACHES)('no core module reaches %s', async (_name, re) => {
  const hits = await Promise.all(CORE.map(async f => (re.test(await src(f)) ? f : '')))
  expect(hits.filter(Boolean)).toEqual([])
})
test('the check can fail — a known adapter trips a reach, so a green run means something', async () => {
  const adapter = await src('docling.ts')
  expect(REACHES.filter(([, re]) => re.test(adapter)).length).toBeGreaterThan(0)
})
/** The main entry decides what EVERY consumer's bundle carries, so an adapter re-exported there is a
 * required dependency however unused — "any vector database" dies the moment the default entry ships a
 * store client. Each adapter stays reachable at its own subpath for a consumer who wants ours, and they
 * are listed once here so a new one is covered by adding a name rather than by copying a pair of tests:
 * a guard that must be duplicated per adapter is a guard the next adapter silently escapes. */
const SUBPATHS = ['opensearch', 'models', 'office-render', 'embed-cache', 'region', 'vlm', 'digital', 'geometry']
test.each(SUBPATHS)('the main entry re-exports no %s adapter — it is reachable only at its own subpath', async name => {
  expect((await src('index.ts')).includes(`from './${name}'`)).toBe(false)
})
/** CORE is hand-written, so on its own it is an ALLOWLIST — and an allowlist protects only what
 * somebody remembered to list. Nothing stops a module being quietly dropped from it, which reads in a
 * diff as one deleted line and removes that module from every check above. So the pure set is COMPUTED
 * and every member must be accounted for: listed as core, or named here with the reason it is not part
 * of the published pure surface. Dropping a module from CORE then fails until it is named here, where
 * it is visible. */
const NOT_CORE_SURFACE: Record<string, string> = {
  'config.ts': 'the shape a host supplies, not a capability the core computes',
  'digital.ts': 'names an adapter capability rather than computing anything itself',
  'geometry.ts': 'names an adapter capability rather than computing anything itself',
  'index.ts': 'the barrel — it re-exports adapters by design',
  'log.ts': 'plumbing a host supplies for itself',
  'parse.ts': 'orchestration that reaches its adapters dynamically',
  'reconcile.ts': 'reaches a renderer through a dynamic import',
  'region.ts': 'wires an adapter into one capability rather than computing anything itself',
  'sheet.ts': 'reads a workbook through a reader dependency',
  'test-base.ts': 'a test helper, never shipped as a capability',
  'upload.ts': 'plumbing a host supplies for itself',
  'vlm.ts': 'names an adapter capability rather than computing anything itself'
}
test('every module that reaches nothing is accounted for — CORE cannot shrink unnoticed', async () => {
  const files = (await readdir(new URL('.', import.meta.url))).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))
  const read = await Promise.all(files.map(async f => ({ name: f, text: await src(f) })))
  const pure = read.filter(m => !REACHES.some(([, re]) => re.test(m.text))).map(m => m.name)
  expect(pure.length).toBeGreaterThan(10)
  expect(pure.filter(f => !(CORE.includes(f) || f in NOT_CORE_SURFACE))).toEqual([])
})
test.each(SUBPATHS)('the %s subpath is a real declared entry, not a dangling promise', async name => {
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
    exports: Record<string, unknown>
  }
  expect(Object.keys(pkg.exports)).toContain(`./${name}`)
  const build = await readFile(new URL('../tsdown.config.ts', import.meta.url), 'utf8')
  expect(build).toContain(`src/${name}.ts`)
})
