/** biome-ignore-all lint/performance/noAwaitInLoops: page OCR runs sequentially to avoid bursting the rate-limited vlm provider */
/* eslint-disable no-await-in-loop -- page OCR runs sequentially to avoid bursting the rate-limited vlm provider */
import type { HTMLElement } from 'node-html-parser'
import { ExponentialBackoff } from 'cockatiel'
import { ColorSpace, Document, Matrix } from 'mupdf'
import { parse as parseHtml } from 'node-html-parser'
import { z } from 'zod'
import type { Tuple4 } from './docling'
import type { ParseResult } from './domain'
import type { Bbox, Block } from './lib'
import type { GridCell } from './table-grid'
import { markdownOf } from './bridge'
import { stubResult } from './docling'
import { geometryOf } from './domain'
import { log } from './log'
import { estimateOf, meterStage } from './metering'
import { priceOf } from './pricing'
import { authHeaders, resolveRef } from './providers'
import { makeResilient } from './resilience'
import { stubbed } from './stub'
import { describeGrid } from './table-grid'
import { recordStage } from './telemetry'
import { vertexAuthHeader } from './vertex'

const PROMPT = 'Convert this document to markdown.'
const SCALE = 2
const VLM_MAX_DIM = 1600
const isDegenerate = (html: string): boolean => {
  const texts = parseHtml(html)
    .querySelectorAll('div')
    .map(d => d.text.replaceAll(/\s+/gu, ' ').trim())
    .filter(t => t.length > 0)
  if (texts.length < 12) return false
  return new Set(texts).size / texts.length < 0.6
}
const MD_FENCE = /^```(?:markdown|md)?[^\S\n]*\n(?<body>[\s\S]*?)\n?```$/u
const PAGE_PACE_MS = 700
const sleep = async (ms: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, ms)
  })
const ocrResilient = makeResilient(undefined, {
  backoff: new ExponentialBackoff({ initialDelay: 2000, maxDelay: 30_000 }),
  maxAttempts: 2
})
const noop = (): void => undefined
let vlmGate: Promise<void> = Promise.resolve()
const vlmSingleFlight = async <T>(fn: () => Promise<T>): Promise<T> => {
  const prev = vlmGate
  let release = noop
  vlmGate = new Promise<void>(resolve => {
    release = resolve
  })
  try {
    await prev
  } catch {
    /* a prior OCR failure must not block the next one */
  }
  try {
    return await fn()
  } finally {
    release()
  }
}
const WS = /\s+/u
const vlmResponseSchema = z.object({
  // oxlint-disable-next-line unicorn/max-nested-calls
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) }))
})
interface VlmModel {
  auth?: 'datalab' | 'vertex'
  baseUrl: string
  /** Carried from the provider so a hand-built request honours the same server knob the sdk path does —
   * a capability declared once and read on only one of two call paths is a capability that silently does
   * nothing wherever the other path runs. */
  chatBody?: Record<string, unknown>
  key: string
  metered: boolean
  model: string
  wire: string
}
const requireVlm = (ref: string | undefined): VlmModel => {
  if (!ref) throw new Error('a vlm-role model is required for the vlm parse pipeline')
  const { model, provider, wire } = resolveRef(ref, 'vlm')
  return {
    auth: provider.auth,
    baseUrl: provider.baseUrl,
    chatBody: provider.chatBody,
    key: provider.key,
    metered: provider.metered,
    model,
    wire
  }
}
const IM_END = '<|im_end|>'
const CHAT_TOKENS = /<\|im_start\|>\w*|<\|im_end\|>|<think>[\s\S]*?<\/think>/gu
const firstResponse = (content: string): string => {
  const [first = content] = content.split(IM_END)
  return first.replaceAll(CHAT_TOKENS, '').trim()
}
const chatCompletionPage = async (pngBase64: string, vlm: VlmModel): Promise<string> => {
  const auth = vlm.auth === 'vertex' ? await vertexAuthHeader() : authHeaders(vlm)
  const res = await fetch(`${vlm.baseUrl}/chat/completions`, {
    body: JSON.stringify({
      ...vlm.chatBody,
      max_tokens: 8192,
      messages: [
        {
          content: [
            { text: PROMPT, type: 'text' },
            { image_url: { url: `data:image/png;base64,${pngBase64}` }, type: 'image_url' }
          ],
          role: 'user'
        }
      ],
      model: vlm.wire,
      temperature: 0
    }),
    headers: { 'content-type': 'application/json', ...auth },
    method: 'POST',
    signal: AbortSignal.timeout(600_000)
  })
  if (!res.ok) throw new Error(`vlm ocr ${res.status}`)
  const json = vlmResponseSchema.parse(await res.json())
  const content = json.choices[0]?.message.content
  if (!content) throw new Error('vlm ocr returned no content')
  const cleaned = firstResponse(content)
  return MD_FENCE.exec(cleaned)?.[1] ?? cleaned
}
const readPage = async (pngBase64: string, vlm: VlmModel): Promise<string> => {
  if (vlm.auth !== 'datalab') return chatCompletionPage(pngBase64, vlm)
  const { datalabOcr } = await import('./datalab')
  const html = await datalabOcr({ base: vlm.baseUrl, key: vlm.key, pngBase64, timeoutMs: 600_000 })
  return html
}
const ocrPage = async (pngBase64: string, vlm: VlmModel): Promise<string> => {
  const billingMode = vlm.metered ? 'metered' : 'free'
  const price = billingMode === 'metered' ? priceOf(vlm.model) : null
  const costEstimateUsd = estimateOf({ billingMode, inputTokens: 1024, price })
  const { metric, value } = await meterStage({
    billingMode,
    price,
    run: async () => {
      const text = await vlmSingleFlight(async () =>
        ocrResilient(async () => {
          const body = await readPage(pngBase64, vlm)
          if (isDegenerate(body)) throw new Error('vlm ocr degenerate output (repetition loop)')
          return body
        })
      )
      return { inputTokens: 0, outputTokens: Math.ceil(text.length / 4), value: text }
    },
    stage: 'vlm-ocr'
  })
  recordStage({ costEstimateUsd, metric, model: vlm.model })
  return value
}
const ocrCropText = async (pngBase64: string, vlm: VlmModel): Promise<string> =>
  parseHtml(await ocrPage(pngBase64, vlm)).text.trim()
const attr = (el: HTMLElement, key: string): string => el.attributes[key] ?? ''
const BBOX_SCALE = 1000
const toPdfBbox = (coords: number[], widthPt: number, heightPt: number): null | Tuple4 =>
  coords.length === 4 && coords.every(n => Number.isFinite(n))
    ? [
        ((coords[0] ?? 0) / BBOX_SCALE) * widthPt,
        heightPt - ((coords[1] ?? 0) / BBOX_SCALE) * heightPt,
        ((coords[2] ?? 0) / BBOX_SCALE) * widthPt,
        heightPt - ((coords[3] ?? 0) / BBOX_SCALE) * heightPt
      ]
    : null
const ROW = /\n|\s{3,}/u
const LOOP_RUN = 3
const blockKey = (b: Block): string => `${b.text}\u0000${b.bbox === null ? 'n' : b.bbox.join(',')}`
const collapseLoops = (blocks: readonly Block[]): Block[] => {
  const out: Block[] = []
  let i = 0
  while (i < blocks.length) {
    const first = blocks[i]
    if (first === undefined) break
    const key = blockKey(first)
    let j = i
    while (j < blocks.length) {
      const next = blocks[j]
      if (next === undefined || blockKey(next) !== key) break
      j += 1
    }
    const keep = j - i >= LOOP_RUN ? 1 : j - i
    for (let k = 0; k < keep; k += 1) out.push(first)
    i = j
  }
  return out
}
const rowsOf = (text: string): string[] =>
  text
    .split(ROW)
    .map(r => r.trim())
    .filter(r => r.length > 0)
const cellText = (s: string): string => s.replaceAll(/\s+/gu, ' ').trim()
const spanOf = (el: HTMLElement, key: string): number => {
  const n = Math.trunc(Number(el.getAttribute(key) ?? '1'))
  return Number.isFinite(n) && n > 1 ? n : 1
}
const nextFree = (row: readonly (GridCell | undefined)[], from: number): number => {
  let c = from
  while (row[c] !== undefined) c += 1
  return c
}
const ensureRow = (grid: GridCell[][], r: number): GridCell[] => {
  const row = grid[r] ?? []
  grid[r] = row
  return row
}
const placeCell = (args: { c: number; cs: number; grid: GridCell[][]; r: number; rs: number; val: GridCell }): void => {
  const { c, cs, grid, r, rs, val } = args
  for (let dr = 0; dr < rs; dr += 1) {
    const target = ensureRow(grid, r + dr)
    for (let dc = 0; dc < cs; dc += 1) target[c + dc] = val
  }
}
const tableGrid = (table: HTMLElement): GridCell[][] => {
  const grid: GridCell[][] = []
  for (const [r, tr] of table.querySelectorAll('tr').entries()) {
    const row = ensureRow(grid, r)
    let c = 0
    for (const cell of tr.querySelectorAll('th,td')) {
      c = nextFree(row, c)
      const cs = spanOf(cell, 'colspan')
      const val: GridCell = { header: cell.rawTagName.toLowerCase() === 'th', text: cellText(cell.text) }
      placeCell({ c, cs, grid, r, rs: spanOf(cell, 'rowspan'), val })
      c += cs
    }
  }
  return grid
}
const tableToRows = (table: HTMLElement): string[] => describeGrid(tableGrid(table)).map(r => r.line)
const pageBlocks = ({
  heightPt,
  html,
  pageNo,
  widthPt
}: {
  heightPt: number
  html: string
  pageNo: number
  widthPt: number
}): Block[] => {
  const boxed = collapseLoops(
    parseHtml(html)
      .querySelectorAll('[data-bbox]')
      .flatMap(div => {
        const bbox = toPdfBbox(attr(div, 'data-bbox').split(WS).map(Number), widthPt, heightPt)
        const table = div.querySelector('table')
        if (table) {
          const rows = tableToRows(table)
          if (rows.length > 0)
            return rows.map(row => ({ bbox, kind: 'table', page: pageNo, selfLabeled: true, text: row }))
        }
        const kind = attr(div, 'data-label') || 'text'
        return rowsOf(div.text).map(row => ({ bbox, kind, page: pageNo, text: row }))
      })
  )
  if (boxed.length > 0) return boxed
  const text = parseHtml(html).text.trim()
  return text.length > 0 ? [{ bbox: null, kind: 'text', page: pageNo, text }] : []
}
const renderCrop = ({
  bbox,
  bytes,
  contentType,
  pageIndex
}: {
  bbox: Bbox
  bytes: Uint8Array<ArrayBuffer>
  contentType: string
  pageIndex: number
}): string => {
  const doc = Document.openDocument(bytes, contentType)
  const pix = doc.loadPage(pageIndex).toPixmap(Matrix.scale(SCALE, SCALE), ColorSpace.DeviceRGB, false)
  const heightPt = pix.getHeight() / SCALE
  const [l, t, r, b] = bbox
  const x0 = Math.min(l, r) * SCALE
  const x1 = Math.max(l, r) * SCALE
  const yTop = (heightPt - Math.max(t, b)) * SCALE
  const yBot = (heightPt - Math.min(t, b)) * SCALE
  const w0 = Math.max(1, Math.round(x1 - x0))
  const h0 = Math.max(1, Math.round(yBot - yTop))
  const cap = Math.min(1, VLM_MAX_DIM / Math.max(w0, h0))
  const w = Math.max(1, Math.round(w0 * cap))
  const h = Math.max(1, Math.round(h0 * cap))
  const cropped = pix.warp(
    [
      [x0, yTop],
      [x1, yTop],
      [x1, yBot],
      [x0, yBot]
    ],
    w,
    h
  )
  return Buffer.from(cropped.asPNG()).toString('base64')
}
const parsePdfVlm = async ({
  bytes,
  name,
  onProgress,
  ref
}: {
  bytes: Uint8Array<ArrayBuffer>
  name: string
  onProgress?: (label: string) => void
  ref: string | undefined
}): Promise<ParseResult> => {
  if (stubbed()) {
    if (name.includes('FAILPARSE')) throw new Error('stub parse failure')
    return stubResult(name.includes('FAILEMBED'), 'vlm@stub')
  }
  const vlm = requireVlm(ref)
  const doc = Document.openDocument(bytes, 'application/pdf')
  const count = doc.countPages()
  onProgress?.(`rendering ${String(count)} pages`)
  const rendered = Array.from({ length: count }, (_, i) => {
    const page = doc.loadPage(i)
    const b = page.getBounds()
    const scale = Math.min(SCALE, VLM_MAX_DIM / Math.max(b[2] - b[0], b[3] - b[1]))
    const pix = page.toPixmap(Matrix.scale(scale, scale), ColorSpace.DeviceRGB, false)
    return {
      heightPt: pix.getHeight() / scale,
      png: Buffer.from(pix.asPNG()).toString('base64'),
      widthPt: pix.getWidth() / scale
    }
  })
  onProgress?.(`reading ${String(count)} pages`)
  const htmls: string[] = []
  const failedPages: number[] = []
  for (const [i, r] of rendered.entries()) {
    onProgress?.(`reading page ${String(i + 1)}/${String(count)}`)
    if (i > 0) await sleep(PAGE_PACE_MS)
    try {
      htmls.push(await ocrPage(r.png, vlm))
    } catch (pageError) {
      log.warn({ page: i + 1, pageError }, 'vlm ocr page failed — degraded to empty')
      failedPages.push(i + 1)
      htmls.push('')
    }
  }
  if (htmls.every(h => h.trim() === '')) throw new Error('vlm ocr produced no content for any page')
  if (failedPages.length > 0) log.warn({ failedPages, total: count }, 'vlm ocr shipped a partial document')
  const blocks = rendered.flatMap((r, i) =>
    pageBlocks({ heightPt: r.heightPt, html: htmls[i] ?? '', pageNo: i + 1, widthPt: r.widthPt })
  )
  const pages = rendered.map((r, i) => ({ height: r.heightPt, pageNo: i + 1, width: r.widthPt }))
  return { blocks, engine: `vlm@${vlm.model}`, geometry: geometryOf(blocks), markdown: markdownOf(blocks), pages }
}
export { isDegenerate, ocrCropText, ocrPage, pageBlocks, parsePdfVlm, renderCrop, requireVlm, tableToRows }
