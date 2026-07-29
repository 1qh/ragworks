/** biome-ignore-all lint/performance/noAwaitInLoops: bounded sequential docling status poll */
/* eslint-disable no-await-in-loop */
import type { DoclingDocument } from '@docling/docling-core'
import { iterateDocumentItems } from '@docling/docling-core'
import { ColorSpace, Document, Matrix } from 'mupdf'
import type { PixelPlane } from './cell-color'
import type { ParseConfig } from './config'
import type { Block, Geometry, PageDim } from './lib'
import type { GridCell } from './table-grid'
import { cellColorName, dominantColor, fillColor, isSaturated, nearestLabel } from './cell-color'
import { geometryOf, markdownOf } from './domain'
import { engineEnv as env } from './engine-config'
import { log } from './log'
import { resilient } from './resilience'
import { stubbed } from './stub'
import { describeGrid } from './table-grid'
import { contentTypeOf } from './upload'

interface ConvertResult {
  document?: { json_content?: unknown }
}
interface DoclingBbox {
  b: number
  coord_origin?: null | string
  l: number
  r: number
  t: number
}
interface DoclingCell {
  bbox?: DoclingBbox | null
  col_span?: number
  column_header?: boolean
  row_header?: boolean
  row_span?: number
  start_col_offset_idx?: number
  start_row_offset_idx?: number
  text?: string
}
interface DoclingNode {
  data?: null | { grid?: readonly (readonly DoclingCell[])[] }
  label?: string
  prov?: readonly DoclingProv[]
  text?: string
}
interface DoclingPage {
  page_no: number
  size?: { height?: number; width?: number }
}
interface DoclingProv {
  bbox?: DoclingBbox | null
  charspan?: null | readonly number[]
  page_no?: null | number
}
interface ParseResult {
  blocks: Block[]
  engine: string
  geometry: Geometry
  markdown: string
  pages: PageDim[]
}
type Tuple4 = [number, number, number, number]
const RENDER_SCALE = 1.5
const stubBlock = (i: number, withFail: boolean): Block => ({
  bbox: [50, 60 + i * 20, 560, 78 + i * 20],
  page: 1,
  text:
    withFail && i === 18
      ? `Paragraph ${i} carries the FAILEMBED marker to force an embedding failure here.`
      : `Paragraph ${i} discusses transformer attention over token sequences in order.`
})
const stubBlocks = (withFail: boolean): Block[] => Array.from({ length: 20 }, (_, i) => stubBlock(i, withFail))
const stubResult = (withFail: boolean, engine: string): ParseResult => {
  const blocks = stubBlocks(withFail)
  return {
    blocks,
    engine,
    geometry: 'spatial',
    markdown: markdownOf(blocks),
    pages: [{ height: 792, pageNo: 1, width: 612 }]
  }
}
const toBottomLeft = (bbox: Tuple4, height: number): Tuple4 => {
  const [l, t, r, b] = bbox
  return t < b && height > 0 ? [l, height - t, r, height - b] : bbox
}
const bottomLeftY = (b: DoclingBbox, height: number): { b: number; t: number } => {
  const topLeft = b.coord_origin === 'TOPLEFT' || b.t < b.b
  return topLeft && height > 0 ? { b: height - b.b, t: height - b.t } : { b: b.b, t: b.t }
}
const bboxTuple = (b: DoclingBbox | null | undefined, height: number): null | Tuple4 => {
  if (!b) return null
  const y = bottomLeftY(b, height)
  return [b.l, y.t, b.r, y.b]
}
const unionBbox = (cells: readonly DoclingCell[], height: number): null | Tuple4 => {
  const boxes = cells
    .map(c => c.bbox)
    .filter((b): b is DoclingBbox => Boolean(b))
    .map(b => bboxTuple(b, height))
  const valid = boxes.filter((b): b is Tuple4 => b !== null)
  if (valid.length === 0) return null
  return [
    Math.min(...valid.map(b => b[0])),
    Math.max(...valid.map(b => b[1])),
    Math.max(...valid.map(b => b[2])),
    Math.min(...valid.map(b => b[3]))
  ]
}
const cellText = (c: DoclingCell): string => (c.text ?? '').replaceAll(/\s+/gu, ' ').trim()
const originCell = (c: DoclingCell, rowIdx: number, colIdx: number): boolean =>
  (c.start_row_offset_idx ?? rowIdx) === rowIdx && (c.start_col_offset_idx ?? colIdx) === colIdx
const rowBand = (rowCells: readonly DoclingCell[], height: number): null | { bottom: number; top: number } => {
  const boxes = rowCells
    .filter(c => (c.row_span ?? 1) === 1)
    .map(c => bboxTuple(c.bbox, height))
    .filter((b): b is Tuple4 => b !== null)
  if (boxes.length === 0) return null
  return { bottom: Math.min(...boxes.map(b => b[3])), top: Math.max(...boxes.map(b => b[1])) }
}
const clipToBand = (box: null | Tuple4, band: null | { bottom: number; top: number }): null | Tuple4 => {
  if (box === null) return null
  if (band === null) return box
  return [box[0], Math.min(box[1], band.top), box[2], Math.max(box[3], band.bottom)]
}
const cellPixelBox = (
  bb: DoclingBbox,
  height: number,
  scale: number
): { x0: number; x1: number; y0: number; y1: number } => {
  const topLeft = bb.coord_origin === 'TOPLEFT' || bb.t < bb.b
  return {
    x0: bb.l * scale,
    x1: bb.r * scale,
    y0: (topLeft ? bb.t : height - bb.t) * scale,
    y1: (topLeft ? bb.b : height - bb.b) * scale
  }
}
const MARK_MAX = 3
interface Swatch {
  label: string
  rgb: { b: number; g: number; r: number }
}
const cellColor = (args: {
  cell: DoclingCell
  height: number
  plane: PixelPlane | undefined
  vocabulary?: readonly Swatch[]
}): string | undefined => {
  const { cell: c, height, plane, vocabulary = [] } = args
  if (!(plane && c.bbox) || height <= 0) return
  const scale = plane.height / height
  const box = cellPixelBox(c.bbox, height, scale)
  const mark = (c.text ?? '').trim()
  if (vocabulary.length > 0 && mark.length <= MARK_MAX) {
    const fill = fillColor(plane, box)
    const label = fill ? nearestLabel(fill, vocabulary) : null
    if (label !== null) return label
  }
  return cellColorName(plane, box) ?? undefined
}
const LABEL_MAX = 60
const swatchOf = (
  block: Block,
  heightFor: (page: number) => number,
  planeFor?: (page: number) => PixelPlane | undefined
): null | Swatch => {
  const { bbox } = block
  const label = block.text.trim()
  if (!bbox || label.length === 0 || label.length > LABEL_MAX) return null
  const height = heightFor(block.page)
  const plane = planeFor?.(block.page)
  if (!plane || height <= 0) return null
  const scale = plane.height / height
  if (label.endsWith(':') || label.endsWith('：')) return null
  const rgb = dominantColor(plane, {
    x0: Math.min(bbox[0], bbox[2]) * scale,
    x1: Math.max(bbox[0], bbox[2]) * scale,
    y0: (height - Math.max(bbox[1], bbox[3])) * scale,
    y1: (height - Math.min(bbox[1], bbox[3])) * scale
  })
  return rgb === null || !isSaturated(rgb) ? null : { label, rgb }
}
const withBackgroundColor = (
  block: Block,
  heightFor: (page: number) => number,
  planeFor?: (page: number) => PixelPlane | undefined
): Block => {
  const { bbox } = block
  const text = block.text.trim()
  if (!bbox || text.length === 0 || text.length > LABEL_MAX) return block
  const height = heightFor(block.page)
  const plane = planeFor?.(block.page)
  if (!plane || height <= 0) return block
  const scale = plane.height / height
  const name = cellColorName(plane, {
    x0: Math.min(bbox[0], bbox[2]) * scale,
    x1: Math.max(bbox[0], bbox[2]) * scale,
    y0: (height - Math.max(bbox[1], bbox[3])) * scale,
    y1: (height - Math.min(bbox[1], bbox[3])) * scale
  })
  return name === null ? block : { ...block, text: `${block.text} [${name}]` }
}
const tableRowBlocks = (args: {
  heightFor: (page: number) => number
  node: DoclingNode
  planeFor?: (page: number) => PixelPlane | undefined
  vocabulary?: readonly Swatch[]
}): Block[] => {
  const { heightFor, node, planeFor, vocabulary = [] } = args
  const grid = node.data?.grid
  if (!grid) return []
  const page = node.prov?.[0]?.page_no ?? 1
  const height = heightFor(page)
  const plane = planeFor?.(page)
  const cells: (GridCell | undefined)[][] = grid.map((rowCells, rowIdx) =>
    rowCells.map((c, colIdx) =>
      originCell(c, rowIdx, colIdx)
        ? {
            color: cellColor({ cell: c, height, plane, vocabulary }),
            header: c.column_header ?? (c.start_row_offset_idx ?? rowIdx) === 0,
            text: cellText(c)
          }
        : undefined
    )
  )
  const out: Block[] = []
  for (const { line, rowIndex } of describeGrid(cells)) {
    const rowCells = grid[rowIndex] ?? []
    const origin = rowCells.filter((c, colIdx) => originCell(c, rowIndex, colIdx))
    out.push({
      bbox: clipToBand(unionBbox(origin, height), rowBand(rowCells, height)),
      kind: 'table',
      page,
      selfLabeled: true,
      text: line
    })
  }
  return out
}
const lazyPlanes = (bytes: Uint8Array<ArrayBuffer>): ((page: number) => PixelPlane | undefined) => {
  const cache = new Map<number, null | PixelPlane>()
  let mdoc: null | ReturnType<typeof Document.openDocument> | undefined
  const open = (): null | ReturnType<typeof Document.openDocument> | undefined => {
    if (mdoc === undefined)
      try {
        mdoc = Document.openDocument(bytes, 'application/pdf')
      } catch {
        mdoc = null
      }
    return mdoc
  }
  return (page: number): PixelPlane | undefined => {
    if (!cache.has(page)) {
      const doc = open()
      try {
        const pix = doc?.loadPage(page - 1).toPixmap(Matrix.scale(RENDER_SCALE, RENDER_SCALE), ColorSpace.DeviceRGB, false)
        cache.set(
          page,
          pix
            ? {
                comps: pix.getNumberOfComponents(),
                height: pix.getHeight(),
                pixels: new Uint8Array(pix.getPixels()),
                width: pix.getWidth()
              }
            : null
        )
      } catch (error) {
        log.warn({ err: error instanceof Error ? error.message : String(error), page }, 'cell-color render skipped')
        cache.set(page, null)
      }
    }
    return cache.get(page) ?? undefined
  }
}
const toBlock = (node: DoclingNode, heightFor: (page: number) => number): Block | null => {
  const raw = typeof node.text === 'string' ? node.text : ''
  if (raw.trim().length === 0) return null
  const first = node.prov?.[0]
  const page = first?.page_no ?? 1
  return {
    bbox: first ? bboxTuple(first.bbox, heightFor(page)) : null,
    kind: node.label ?? 'text',
    page,
    text: raw
  }
}
const flatten = (
  doc: DoclingDocument,
  planeFor?: (page: number) => PixelPlane | undefined
): { blocks: Block[]; pages: PageDim[] } => {
  const pages = Object.values((doc.pages as Record<string, DoclingPage> | undefined) ?? {})
    .map(p => ({ height: p.size?.height ?? 0, pageNo: p.page_no, width: p.size?.width ?? 0 }))
    .toSorted((a, b) => a.pageNo - b.pageNo)
  const heightByPage = new Map(pages.map(p => [p.pageNo, p.height]))
  const heightFor = (page: number): number => heightByPage.get(page) ?? 0
  const blocks: Block[] = []
  const seen = new Set<string>()
  const vocabulary: Swatch[] = []
  const tables: DoclingNode[] = []
  const keep = (b: Block): void => {
    const key = JSON.stringify(b)
    if (seen.has(key)) return
    seen.add(key)
    blocks.push(b)
  }
  for (const [node] of iterateDocumentItems(doc)) {
    const n = node as unknown as DoclingNode
    if (n.data?.grid) tables.push(n)
    else {
      const b = toBlock(n, heightFor)
      if (b) {
        const sw = swatchOf(b, heightFor, planeFor)
        if (sw) vocabulary.push(sw)
        keep(withBackgroundColor(b, heightFor, planeFor))
      }
    }
  }
  for (const n of tables) for (const b of tableRowBlocks({ heightFor, node: n, planeFor, vocabulary })) keep(b)
  return { blocks, pages }
}
interface AsyncSubmit {
  task_id: string
}
interface TaskStatus {
  task_meta?: { num_docs?: number; num_processed?: number }
  task_position?: number
  task_status: string
}
const docForm = (bytes: Uint8Array<ArrayBuffer>, name: string, options?: ParseConfig): FormData => {
  const fd = new FormData()
  fd.append('files', new Blob([bytes], { type: contentTypeOf(name) }), name)
  fd.append('to_formats', 'json')
  fd.append('document_timeout', '540')
  if (options?.ocr_engine && options.ocr_engine !== 'auto') fd.append('ocr_engine', options.ocr_engine)
  if (options?.do_ocr !== undefined) fd.append('do_ocr', String(options.do_ocr))
  if (options?.force_ocr !== undefined) fd.append('force_ocr', String(options.force_ocr))
  if (options?.pdf_backend) fd.append('pdf_backend', options.pdf_backend)
  if (options?.table_mode) fd.append('table_mode', options.table_mode)
  return fd
}
const statusLabel = (s: TaskStatus): string => {
  if (typeof s.task_position === 'number' && s.task_position > 0) return `queued · position ${String(s.task_position)}`
  if (s.task_status === 'started') {
    const total = s.task_meta?.num_docs ?? 0
    const done = s.task_meta?.num_processed ?? 0
    return total > 0 ? `parsing · ${String(done)}/${String(total)}` : 'parsing'
  }
  return s.task_status === 'pending' ? 'queued' : s.task_status
}
const parsePdf = async ({
  bytes,
  name,
  onProgress,
  options
}: {
  bytes: Uint8Array<ArrayBuffer>
  name: string
  onProgress?: (label: string) => void
  options?: ParseConfig
}): Promise<ParseResult> => {
  if (stubbed()) {
    if (name.includes('FAILPARSE')) throw new Error('stub parse failure')
    return stubResult(name.includes('FAILEMBED'), 'docling@stub')
  }
  const base = env.DOCLING_URL
  onProgress?.('queued')
  const submitted = await resilient(async () => {
    const r = await fetch(`${base}/v1/convert/file/async`, {
      body: docForm(bytes, name, options),
      method: 'POST',
      signal: AbortSignal.timeout(60_000)
    })
    if (!r.ok) throw new Error(`docling async submit ${String(r.status)}`)
    return (await r.json()) as AsyncSubmit
  })
  const taskId = submitted.task_id
  const deadline = Date.now() + 600_000
  let last = ''
  while (Date.now() < deadline) {
    const s = await resilient(async () => {
      const r = await fetch(`${base}/v1/status/poll/${taskId}?wait=5`, { signal: AbortSignal.timeout(30_000) })
      if (!r.ok) throw new Error(`docling status ${String(r.status)}`)
      return (await r.json()) as TaskStatus
    })
    last = s.task_status
    onProgress?.(statusLabel(s))
    if (last === 'success' || last === 'partial_success' || last === 'failure') break
  }
  if (last !== 'success' && last !== 'partial_success') throw new Error(`docling task ${last || 'timeout'}`)
  if (last === 'partial_success') log.warn({ name, taskId }, 'docling partial_success — parsed document may be incomplete')
  const res = await resilient(async () => {
    const result = await fetch(`${base}/v1/result/${taskId}`, { signal: AbortSignal.timeout(60_000) })
    if (!result.ok) throw new Error(`docling result ${String(result.status)}`)
    return (await result.json()) as ConvertResult
  })
  const doc = res.document?.json_content
  if (!doc) throw new Error('docling-serve returned no json_content')
  const raw = doc as DoclingDocument
  const version = typeof raw.version === 'string' ? raw.version : 'unknown'
  const { blocks, pages } = flatten(raw, lazyPlanes(bytes))
  return { blocks, engine: `docling-serve@${version}`, geometry: geometryOf(blocks), markdown: markdownOf(blocks), pages }
}
export { flatten, parsePdf, stubResult, swatchOf, tableRowBlocks, toBottomLeft, withBackgroundColor }
export type { ParseResult, Tuple4 }
