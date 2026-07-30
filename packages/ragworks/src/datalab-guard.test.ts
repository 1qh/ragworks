import { afterAll, describe, expect, test } from 'bun:test'
import { crc32, deflateSync } from 'node:zlib'
import { ocrPage } from './chandra'
/** `crc32` resolves untyped here, so it is narrowed once at this boundary rather than suppressed at
 * each use — a cast through a typed facade keeps the call sites checked. */
const checksum = crc32 as unknown as (data: Uint8Array) => number
const pngChunk = (type: string, data: Uint8Array): Buffer => {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)])
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(checksum(body))
  return Buffer.concat([len, body, crc])
}
const pngOf = (w: number, h: number): string => {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  const raw = Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0xff)])))
  // oxlint-disable-next-line node/no-sync -- in-memory compression of a fixture, not blocking io
  const idat = deflateSync(raw)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', new Uint8Array())
  ]).toString('base64')
}
const PAGE_PNG = pngOf(100, 200)
const vlm = {
  auth: 'datalab',
  baseUrl: 'https://datalab.test',
  key: 'k',
  metered: false,
  model: 'chandra',
  wire: 'chandra'
} as const
const realFetch = globalThis.fetch
const hrefOf = (input: RequestInfo | URL): string => (input instanceof Request ? input.url : input.toString())
const stubDatalab = (html: string): void => {
  globalThis.fetch = (async (input: RequestInfo | URL) =>
    hrefOf(input).endsWith('/convert')
      ? Response.json({ request_check_url: 'https://datalab.test/check/1', success: true })
      : Response.json({ html, status: 'complete' })) as typeof globalThis.fetch
}
const page = (body: string): string => `<html><body>${body}</body></html>`
describe('the degenerate guard covers the hosted-vlm branch', () => {
  afterAll(() => {
    globalThis.fetch = realFetch
  })
  test('a Datalab page that loops one element is rejected, never shipped as a parse', async () => {
    stubDatalab(page(Array.from({ length: 40 }, () => '<div data-bbox="0 0 100 20">Com ga 120</div>').join('')))
    await expect(ocrPage(PAGE_PNG, vlm)).rejects.toThrow(/degenerate/u)
  }, 30_000)
  test('a healthy Datalab page passes the guard', async () => {
    const rows = Array.from({ length: 40 }, (_, i) => `<div data-bbox="0 ${i * 20} 100 ${i * 20 + 18}">row ${i}</div>`)
    stubDatalab(page(rows.join('')))
    const out = await ocrPage(PAGE_PNG, vlm)
    expect(out).toContain('row 7')
  }, 30_000)
})
