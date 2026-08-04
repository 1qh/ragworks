import { Document } from 'mupdf'
/** The born-digital text-layer extractor: a page's own text layer read straight from mupdf's structured
 * text into per-line boxed blocks, with no parser service and no vision model. It sits beside the docling
 * and vlm parse paths because a consumer that already trusts a page's embedded text — reverse-mapping a
 * foreign chunk set onto the rendered page, say — needs geometry without paying for a full parse. Office
 * inputs are converted to pdf first through the shared soffice bridge; an input with no text layer yields
 * no blocks rather than a guess. */
import type { Block } from './lib'
import { mupdfInput } from './office-render'

type Box = [number, number, number, number]
interface MuBlock {
  lines?: MuLine[]
  type?: string
}
interface MuLine {
  bbox: { h: number; w: number; x: number; y: number }
  text?: string
}
interface TextLayerResult {
  blocks: Block[]
  contentType: string
  pageCount: number
  pdfBytes: Uint8Array<ArrayBuffer>
}
const COMBINING = /^\p{Mn}+$/v
const area = (b: Box): number => Math.abs((b[2] - b[0]) * (b[1] - b[3]))
const insideFrac = (a: Box, big: Box): number => {
  const ix = Math.max(0, Math.min(a[2], big[2]) - Math.max(a[0], big[0]))
  const iy = Math.max(0, Math.min(a[1], big[1]) - Math.max(a[3], big[3]))
  return (ix * iy) / Math.max(1, area(a))
}
const furnitureKey = (block: Block): string =>
  block.bbox ? `${Math.round(block.bbox[0] / 5)}:${Math.round(block.bbox[1] / 5)}:${block.text}` : ''
const linesOfPage = (json: string, heightPt: number, pageNo: number): Block[] => {
  const parsed = JSON.parse(json) as { blocks?: MuBlock[] }
  const raw: { bbox: Box; text: string }[] = []
  const textBlocks = (parsed.blocks ?? []).filter(blk => !blk.type || blk.type === 'text')
  for (const blk of textBlocks)
    for (const line of blk.lines ?? []) {
      const text = (line.text ?? '').trim()
      const { h, w, x, y } = line.bbox
      if (text.length > 0 && w >= 2 && h >= 2 && !COMBINING.test(text))
        raw.push({ bbox: [x, heightPt - y, x + w, heightPt - (y + h)], text })
    }

  const kept = raw.filter((line, i) => {
    if (line.text.length > 2) return true

    const thr = line.text.length === 1 ? 0.3 : 0.6
    return !raw.some(
      (other, j) => j !== i && area(other.bbox) > area(line.bbox) && insideFrac(line.bbox, other.bbox) > thr
    )
  })
  return kept.map(line => ({ bbox: line.bbox, kind: 'text', page: pageNo, text: line.text }))
}
const dropFurniture = (blocks: Block[], pageCount: number): Block[] => {
  if (pageCount < 3) return blocks

  const pagesByKey = new Map<string, Set<number>>()
  for (const block of blocks)
    if (block.bbox) {
      const key = furnitureKey(block)
      const set = pagesByKey.get(key) ?? new Set<number>()
      set.add(block.page)
      pagesByKey.set(key, set)
    }

  const threshold = Math.max(3, Math.ceil(pageCount / 2))
  return blocks.filter(block => (pagesByKey.get(furnitureKey(block))?.size ?? 0) < threshold)
}
const blocksFromDoc = (doc: Document): Block[] => {
  const count = doc.countPages()
  const collected: Block[] = []
  for (let i = 0; i < count; i += 1) {
    const page = doc.loadPage(i)
    const bounds = page.getBounds()
    const heightPt = bounds[3] - bounds[1]
    for (const block of linesOfPage(page.toStructuredText('preserve-whitespace').asJSON(), heightPt, i + 1))
      collected.push(block)
  }
  return dropFurniture(collected, count)
}
const textLayerBlocks = (pdfBytes: Uint8Array<ArrayBuffer>): Block[] =>
  blocksFromDoc(Document.openDocument(pdfBytes, 'application/pdf'))
const parseTextLayer = async (raw: Uint8Array<ArrayBuffer>, name: string): Promise<TextLayerResult> => {
  const { bytes, contentType } = await mupdfInput(raw, name)
  if (contentType !== 'application/pdf') return { blocks: [], contentType, pageCount: 0, pdfBytes: bytes }

  const doc = Document.openDocument(bytes, 'application/pdf')
  return { blocks: blocksFromDoc(doc), contentType, pageCount: doc.countPages(), pdfBytes: bytes }
}
export type { TextLayerResult }
export { parseTextLayer, textLayerBlocks }
