import IntervalTree from '@flatten-js/interval-tree'
import type { Block, Charspan, Region } from './lib'
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
export {
  blockChunks,
  buildRegionIndex,
  describeGrid,
  locateChunks,
  markdownOf,
  MIN_REGION_WIDTH,
  positionBlocks,
  regionsFor
}
export type { GridCell, Positioned, RegionIndex }
