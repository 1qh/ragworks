import IntervalTree from '@flatten-js/interval-tree'
import type { Bbox, Block, Charspan, Region } from './lib'
import type { GridCell } from './table-grid'
import { describeGrid } from './table-grid'

interface Positioned {
  readonly block: Block
  readonly end: number
  readonly start: number
}
const SEP = '\n\n'
const markdownOf = (blocks: readonly Block[]): string => blocks.map(b => b.text).join(SEP)
const positionBlocks = (blocks: readonly Block[]): Positioned[] => {
  const out: Positioned[] = []
  let cursor = 0
  for (const block of blocks) {
    const start = cursor
    out.push({ block, end: start + block.text.length, start })
    cursor = start + block.text.length + SEP.length
  }
  return out
}
const blockChunks = (blocks: readonly Block[]): Charspan[] => positionBlocks(blocks).map(p => [p.start, p.end])
const medianLineHeight = (positioned: readonly Positioned[]): number => {
  const heights: number[] = []
  for (const p of positioned) {
    const bb = p.block.bbox
    if (bb) {
      const h = Math.abs(bb[1] - bb[3])
      if (h > 0) heights.push(h)
    }
  }
  if (heights.length === 0) return 0
  heights.sort((a, b) => a - b)
  let split = heights.length
  let widest = 1.8
  for (let i = 1; i < heights.length; i += 1) {
    const prev = heights[i - 1] ?? 0
    const cur = heights[i] ?? 0
    if (prev > 0 && cur / prev > widest) {
      widest = cur / prev
      split = i
    }
  }
  const lower = heights.slice(0, split)
  return lower[Math.floor(lower.length / 4)] ?? lower[0] ?? 0
}
const MIN_REGION_WIDTH = 6
const MIN_REGION_FRACTION = 0.05
const widenToGlyph = (args: { hi: number; lo: number; x0: number; x1: number }): [number, number] => {
  const lo = Math.min(args.lo, args.hi)
  const hi = Math.max(args.lo, args.hi)
  const x0 = Math.min(args.x0, args.x1)
  const x1 = Math.max(args.x0, args.x1)
  const width = x1 - x0
  const room = hi - lo
  if (room <= MIN_REGION_WIDTH || width < MIN_REGION_WIDTH || width < room * MIN_REGION_FRACTION) return [lo, hi]
  return [Math.max(lo, x0), Math.min(hi, x1)]
}
const clipBlockLines = (args: { end: number; lineHeight: number; pos: Positioned; start: number }): Region[] => {
  const { end, lineHeight, pos, start } = args
  const { bbox, page } = pos.block
  if (!bbox || pos.block.text.trim() === '') return []
  const lo = Math.max(pos.start, start)
  const hi = Math.min(pos.end, end)
  if (lo >= hi) return []
  const span = pos.end - pos.start
  const [l, t, r, b] = bbox
  if (span <= 0) return [{ bbox, page }]
  const f0 = (lo - pos.start) / span
  const f1 = (hi - pos.start) / span
  if (f0 <= 0.02 && f1 >= 0.98) return [{ bbox, page }]
  const boxHeight = Math.abs(t - b)
  const singleLine = lineHeight <= 0 || boxHeight <= lineHeight * 1.5
  if (singleLine) {
    const [x0, x1] = widenToGlyph({ hi: r, lo: l, x0: l + f0 * (r - l), x1: l + f1 * (r - l) })
    return [{ bbox: [x0, t, x1, b], page }]
  }
  return [{ bbox, page }]
}
type RegionIndex = (start: number, end: number) => Region[]
const buildRegionIndex = (blocks: readonly Block[]): RegionIndex => {
  const positioned = positionBlocks(blocks)
  const tree = new IntervalTree<Positioned>()
  for (const p of positioned) tree.insert([p.start, p.end], p)
  const lineHeight = medianLineHeight(positioned)
  return (start, end) => {
    const out: Region[] = []
    for (const p of tree.search([start, end]))
      if (p.start < end && p.end > start) out.push(...clipBlockLines({ end, lineHeight, pos: p, start }))
    return out
  }
}
const regionsFor = (blocks: readonly Block[], start: number, end: number): Region[] => buildRegionIndex(blocks)(start, end)
const whitespaceRun = /\s+/u
const escapeRe = (s: string): string => s.replaceAll(/[$()*+.?[\\\]^{|}]/gu, String.raw`\$&`)
const locateChunks = (text: string, chunks: readonly string[], overlap = 0): Charspan[] => {
  const spans: Charspan[] = []
  let cursor = 0
  for (const chunkText of chunks) {
    let start = text.indexOf(chunkText, cursor)
    let { length } = chunkText
    if (start === -1) {
      const tokens = chunkText.trim().split(whitespaceRun).filter(Boolean)
      if (tokens.length > 0) {
        const m = new RegExp(tokens.map(escapeRe).join(String.raw`\s+`), 'u').exec(text.slice(cursor))
        if (m) {
          const [matched] = m
          start = cursor + m.index
          ;({ length } = matched)
        }
      }
    }
    spans.push([start, start === -1 ? -1 : start + length])
    cursor = start === -1 ? cursor : start + Math.max(1, length - overlap)
  }
  return spans
}
const EMPTY_BBOX: Bbox = [0, 0, 0, 0]
const centerY = (b: Bbox): number => (b[1] + b[3]) / 2
const boxHeight = (b: Bbox): number => Math.abs(b[1] - b[3])
const midpoint = (values: readonly number[]): number => {
  const sorted = [...values].toSorted((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}
const coverBox = (boxes: readonly Bbox[]): Bbox => {
  const head = boxes[0] ?? EMPTY_BBOX
  const topFirst = head[1] <= head[3]
  const xs = boxes.flatMap(b => [b[0], b[2]])
  const ys = boxes.flatMap(b => [b[1], b[3]])
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const ymin = Math.min(...ys)
  const ymax = Math.max(...ys)
  return topFirst ? [x0, ymin, x1, ymax] : [x0, ymax, x1, ymin]
}
const clusterByLine = (boxes: readonly Bbox[]): Bbox[][] => {
  const lineHeight = midpoint(boxes.map(boxHeight))
  if (lineHeight <= 0) return boxes.length > 0 ? [[...boxes]] : []
  const gap = lineHeight * 4
  const sorted = [...boxes].toSorted((a, b) => centerY(a) - centerY(b))
  const clusters: Bbox[][] = []
  let current: Bbox[] = []
  let prev = Number.NaN
  for (const box of sorted) {
    const c = centerY(box)
    if (current.length > 0 && Math.abs(c - prev) > gap) {
      clusters.push(current)
      current = []
    }
    current.push(box)
    prev = c
  }
  if (current.length > 0) clusters.push(current)
  return clusters
}
const mergeRegions = (regions: readonly Region[]): Region[] => {
  const byPage = new Map<number, Bbox[]>()
  for (const r of regions) {
    const boxes = byPage.get(r.page) ?? []
    boxes.push(r.bbox)
    byPage.set(r.page, boxes)
  }
  const out: Region[] = []
  for (const [page, boxes] of byPage) {
    const clusters = clusterByLine(boxes)
    const largest = Math.max(0, ...clusters.map(c => c.length))
    for (const cluster of clusters)
      if (cluster.length >= 2 || cluster.length === largest) out.push({ bbox: coverBox(cluster), page })
  }
  return out
}
export {
  blockChunks,
  buildRegionIndex,
  describeGrid,
  locateChunks,
  markdownOf,
  mergeRegions,
  MIN_REGION_WIDTH,
  positionBlocks,
  regionsFor
}
export type { GridCell, Positioned, RegionIndex }
