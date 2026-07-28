/** biome-ignore-all lint/performance/noAwaitInLoops: the Datalab job poll is inherently sequential — wait, poll, repeat */
/* eslint-disable no-await-in-loop */
import type { HTMLElement } from 'node-html-parser'
import { parse as parseHtml } from 'node-html-parser'
import { z } from 'zod'

const BBOX_GRID = 1000
const esc = (s: string): string => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const toGrid = (v: number, span: number): number => Math.round((v / span) * BBOX_GRID)
const SUBMIT_TIMEOUT_MS = 60_000
const POLL_MS = 3000
const sleep = async (ms: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, ms)
  })
const submitSchema = z.object({
  error: z.string().nullable().optional(),
  request_check_url: z.url(),
  success: z.boolean()
})
const pollSchema = z.object({ error: z.string().nullable().optional(), html: z.string().optional(), status: z.string() })
const WS = /\s+/u
const pngDims = (bytes: Uint8Array): { h: number; w: number } => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { h: view.getUint32(20), w: view.getUint32(16) }
}
const BLOCK_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'P', 'TD', 'TH'])
const nearestBlock = (span: HTMLElement): HTMLElement => {
  let node: HTMLElement | null = span.parentNode
  let block = span
  while (node) {
    if (BLOCK_TAGS.has(node.tagName)) block = node
    node = node.parentNode
  }
  return block
}
interface SpanGroup {
  text: string[]
  x0: number
  x1: number
  y0: number
  y1: number
}
const accumulateSpan = (groups: Map<HTMLElement, SpanGroup>, span: HTMLElement): void => {
  const coords = (span.attributes['data-bbox'] ?? '').split(WS).map(Number)
  if (coords.length !== 4 || !coords.every(n => Number.isFinite(n))) return
  const [px0 = 0, py0 = 0, px1 = 0, py1 = 0] = coords
  const key = nearestBlock(span)
  const prev = groups.get(key)
  const word = span.text.trim()
  if (prev) {
    prev.x0 = Math.min(prev.x0, px0, px1)
    prev.y0 = Math.min(prev.y0, py0, py1)
    prev.x1 = Math.max(prev.x1, px0, px1)
    prev.y1 = Math.max(prev.y1, py0, py1)
    if (word.length > 0) prev.text.push(word)
  } else
    groups.set(key, {
      text: word.length > 0 ? [word] : [],
      x0: Math.min(px0, px1),
      x1: Math.max(px0, px1),
      y0: Math.min(py0, py1),
      y1: Math.max(py0, py1)
    })
}
const toChandraHtml = (html: string, imgW: number, imgH: number): string => {
  if (imgW <= 0 || imgH <= 0) return html
  const groups = new Map<HTMLElement, SpanGroup>()
  for (const span of parseHtml(html).querySelectorAll('[data-bbox]')) accumulateSpan(groups, span)
  const blocks = [...groups.values()]
    .filter(g => g.text.length > 0)
    .map(g => {
      const bbox = `${String(toGrid(g.x0, imgW))} ${String(toGrid(g.y0, imgH))} ${String(toGrid(g.x1, imgW))} ${String(toGrid(g.y1, imgH))}`
      return `<div data-bbox="${bbox}" data-label="text">${esc(g.text.join(' '))}</div>`
    })
  return blocks.join('\n')
}
const datalabOcr = async ({
  base,
  key,
  pngBase64,
  timeoutMs
}: {
  base: string
  key: string
  pngBase64: string
  timeoutMs: number
}): Promise<string> => {
  const bytes = new Uint8Array(Buffer.from(pngBase64, 'base64'))
  const { h: imgH, w: imgW } = pngDims(bytes)
  const form = new FormData()
  form.set('file', new Blob([bytes], { type: 'image/png' }), 'page.png')
  form.set('output_format', 'html')
  form.set('word_bboxes', 'true')
  const submit = await fetch(`${base}/convert`, {
    body: form,
    headers: { 'X-API-Key': key },
    method: 'POST',
    signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS)
  })
  if (!submit.ok) throw new Error(`datalab submit ${String(submit.status)}`)
  const { request_check_url: checkUrl } = submitSchema.parse(await submit.json())
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await sleep(POLL_MS)
    const res = await fetch(checkUrl, { headers: { 'X-API-Key': key }, signal: AbortSignal.timeout(SUBMIT_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`datalab poll ${String(res.status)}`)
    const poll = pollSchema.parse(await res.json())
    if (poll.status === 'failed') throw new Error(`datalab job failed: ${poll.error ?? 'unknown'}`)
    if (poll.status !== 'processing') return toChandraHtml(poll.html ?? '', imgW, imgH)
  }
  throw new Error(`datalab poll timeout after ${String(timeoutMs)}ms`)
}
export { datalabOcr, toChandraHtml }
