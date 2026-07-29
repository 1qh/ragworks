import { afterEach, beforeEach, expect, test } from 'bun:test'
import type { Parser } from './ports'
import { parseDocument } from './parse'
/** The Parser port is the difference between an engine anyone can run and one that needs our parser
 * service standing. A declared interface nothing consumes is a NAME rather than a capability, so this
 * drives a consumer-supplied parser through the real entry point and reads back what it produced. */
const pdf = new Uint8Array([1, 2, 3])
let stub: string | undefined
beforeEach(() => {
  stub = process.env.MODELS_STUB
  process.env.MODELS_STUB = '1'
})
afterEach(() => {
  if (stub === undefined) delete process.env.MODELS_STUB
  else process.env.MODELS_STUB = stub
})
const parser: Parser = {
  parse: async ({ name }) =>
    Promise.resolve({
      blocks: [{ bbox: null, page: 1, text: `supplied by the consumer for ${name}` }],
      geometry: 'none' as const,
      markdown: 'supplied',
      pages: [{ height: 10, pageNo: 1, width: 10 }]
    })
}
test('a supplied parser produces the parse, so the engine needs no parser service of its own', async () => {
  const out = await parseDocument({ bytes: pdf, name: 'policy.pdf', parser })
  expect(out.blocks.map(b => b.text)).toEqual(['supplied by the consumer for policy.pdf'])
  expect(out.pages).toEqual([{ height: 10, pageNo: 1, width: 10 }])
})
test('the parse names who produced it, so lineage never credits an engine that did not run', async () => {
  const out = await parseDocument({ bytes: pdf, name: 'policy.pdf', parser })
  expect(out.engine).toBe('consumer-parser')
})
test('omitting the parser falls back to the reference adapter rather than failing', async () => {
  const out = await parseDocument({ bytes: pdf, name: 'policy.pdf' })
  expect(out.engine).not.toBe('consumer-parser')
  expect(out.blocks.length).toBeGreaterThan(0)
})
