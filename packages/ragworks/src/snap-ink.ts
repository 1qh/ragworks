import { ColorSpace, Document, Matrix } from 'mupdf'
import type { PixelPlane } from './cell-color'
import type { Block } from './lib'

type Tuple4 = readonly [number, number, number, number]
const RENDER_SCALE_INK = 1.5
const SCALE = RENDER_SCALE_INK
const INK_CONTRAST = 40
const MAX_LINES = 1.5
const STEP_PT = 2
const contrastOf = (args: { bbox: Tuple4; dy: number; pageHeight: number; plane: PixelPlane }): number => {
  const { bbox, dy, pageHeight, plane } = args
  const { comps, pixels, width } = plane
  const [l, t, r, b] = bbox
  const x0 = Math.max(0, Math.floor(Math.min(l, r) * SCALE))
  const x1 = Math.min(width, Math.ceil(Math.max(l, r) * SCALE))
  const y0 = Math.max(0, Math.floor((pageHeight - Math.max(t, b) - dy) * SCALE))
  const y1 = Math.min(plane.height, Math.ceil((pageHeight - Math.min(t, b) - dy) * SCALE))
  let lo = 255
  let hi = 0
  for (let y = y0; y < y1; y += 1)
    for (let x = x0; x < x1; x += 1) {
      const i = (y * width + x) * comps
      const lum = ((pixels[i] ?? 255) * 299 + (pixels[i + 1] ?? 255) * 587 + (pixels[i + 2] ?? 255) * 114) / 1000
      if (lum < lo) lo = lum
      if (lum > hi) hi = lum
    }
  return hi - lo
}
const offsetsFor = (boxHeight: number): number[] => {
  const reach = Math.max(STEP_PT, Math.round(boxHeight * MAX_LINES))
  const out: number[] = []
  for (let d = STEP_PT; d <= reach; d += STEP_PT) out.push(d, -d)
  return out
}
const snapBox = (args: { bbox: Tuple4; pageHeight: number; plane: PixelPlane }): null | Tuple4 => {
  const { bbox, pageHeight, plane } = args
  if (contrastOf({ ...args, dy: 0 }) > INK_CONTRAST) return null
  const [l, t, r, b] = bbox
  let best = { dy: 0, v: 0 }
  for (const dy of offsetsFor(Math.abs(t - b))) {
    const v = contrastOf({ bbox, dy, pageHeight, plane })
    if (v > best.v) best = { dy, v }
  }
  return best.v > INK_CONTRAST ? ([l, t + best.dy, r, b + best.dy] as const) : null
}
const planeOfPage = (doc: ReturnType<typeof Document.openDocument>, pageIndex: number): PixelPlane => {
  const pix = doc.loadPage(pageIndex).toPixmap(Matrix.scale(SCALE, SCALE), ColorSpace.DeviceRGB, false)
  return {
    comps: pix.getNumberOfComponents(),
    height: pix.getHeight(),
    pixels: new Uint8Array(pix.getPixels()),
    width: pix.getWidth()
  }
}
const classifyPage = (args: {
  blocks: readonly Block[]
  empty: Set<string>
  moved: Map<string, Tuple4>
  page: number
  pageHeight: number
  plane: PixelPlane
}): void => {
  const { blocks, empty, moved, page, pageHeight, plane } = args
  const own = (bbox: Tuple4): number => contrastOf({ bbox, dy: 0, pageHeight, plane })
  const mine = blocks.filter(b => b.page === page && b.bbox)
  const pageInked = mine.some(b => own(b.bbox ?? [0, 0, 0, 0]) > INK_CONTRAST)
  for (const block of mine) {
    const bbox = block.bbox ?? [0, 0, 0, 0]
    const key = `${String(page)}:${bbox.join(',')}`
    const next = snapBox({ bbox, pageHeight, plane })
    if (next) moved.set(key, next)
    else if (pageInked && own(bbox) <= INK_CONTRAST) empty.add(key)
  }
}
const snapBlocksToInk = (
  bytes: Uint8Array,
  blocks: readonly Block[]
): { blocks: Block[]; snapped: number; unanchored: number } => {
  const pages = [...new Set(blocks.filter(b => b.bbox).map(b => b.page))]
  if (pages.length === 0) return { blocks: [...blocks], snapped: 0, unanchored: 0 }
  const doc = Document.openDocument(bytes, 'application/pdf')
  const moved = new Map<string, Tuple4>()
  const empty = new Set<string>()
  const count = doc.countPages()
  for (const page of pages.filter(n => n >= 1 && n <= count)) {
    const index = page - 1
    const bounds = doc.loadPage(index).getBounds()
    const pageHeight = bounds[3] - bounds[1]
    const plane = planeOfPage(doc, index)
    classifyPage({ blocks, empty, moved, page, pageHeight, plane })
  }
  let snapped = 0
  let unanchored = 0
  const out: Block[] = []
  for (const block of blocks) {
    const { bbox } = block
    const key = bbox ? `${String(block.page)}:${bbox.join(',')}` : ''
    const next = bbox ? moved.get(key) : undefined
    if (next) {
      snapped += 1
      out.push({ ...block, bbox: next })
    } else if (bbox && empty.has(key)) {
      unanchored += 1
      out.push({ ...block, bbox: null })
    } else out.push(block)
  }
  return { blocks: out, snapped, unanchored }
}
export { INK_CONTRAST, RENDER_SCALE_INK, snapBlocksToInk }
