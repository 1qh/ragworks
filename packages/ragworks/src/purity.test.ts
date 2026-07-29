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
  'bridge.ts',
  'cell-color.ts',
  'concurrency.ts',
  'domain.ts',
  'invariant.ts',
  'lib.ts',
  'metering.ts',
  'pricing.ts',
  'rerank-order.ts',
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
