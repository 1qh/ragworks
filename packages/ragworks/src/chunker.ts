/** biome-ignore-all lint/complexity/useMaxParams: positional chunk-split signatures */
/* eslint-disable @typescript-eslint/max-params */
import { MDocument } from '@mastra/rag'
import { generateNKeysBetween } from 'fractional-indexing'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import type { Anchor, Block, Charspan, ChunkStrategy, Positioned, Region, RegionIndex } from './lib'
import { engineEnv as env } from './engine-config'
import { buildRegionIndex, invariant, locateChunks, positionBlocks } from './lib'

const bridgeVersion = 'bridge-4'
const chunkerVersion = `mastra-rag@${(createRequire(import.meta.url) as (id: string) => { version: string })('@mastra/rag/package.json').version}+${bridgeVersion}`
interface BuildParams {
  blocks: Block[]
  markdown: string
  maxSize: number
  overlap: number
  strategy: ChunkStrategy
}
interface BuiltChunk {
  anchor: Anchor
  charspan: Charspan
  checksum: string
  rank: string
  regions: Region[]
  text: string
}
interface Located {
  span: Charspan
  text: string
}
interface Mapped {
  checksum: string
  regions: Region[]
}
const miss: Charspan = [-1, -1]
const textAnchor: Anchor = 'charspan'
const checksumOf = (text: string) => createHash('sha256').update(text).digest('hex')
const remapSpan = ({
  canonical,
  regionsAt,
  span,
  text
}: {
  canonical: string
  regionsAt: RegionIndex
  span: Charspan
  text?: string
}): Mapped => {
  const resolved = text ?? canonical.slice(span[0], span[1])
  const regions = span[0] === -1 ? [] : regionsAt(span[0], span[1])
  return { checksum: checksumOf(resolved), regions }
}
type SplitStrategy = 'character' | 'markdown' | 'recursive' | 'sentence' | 'token'
const isSplitStrategy = (strategy: ChunkStrategy): strategy is SplitStrategy =>
  strategy === 'character' ||
  strategy === 'markdown' ||
  strategy === 'recursive' ||
  strategy === 'sentence' ||
  strategy === 'token'
interface ProseSeg {
  kind: 'prose'
  run: Positioned[]
}
type Segment = ProseSeg | TableSeg
interface TableSeg {
  caption?: string
  kind: 'table'
  rows: Positioned[]
}
const CAPTION_KIND = /^caption$/iu
const tableLocated = (rows: readonly Positioned[], caption?: string): Located[] => {
  const first = rows[0]
  const last = rows.at(-1)
  if (!(first && last)) return []
  const body = rows.map(r => r.block.text).join('\n')
  const rollup: Located = { span: [first.start, last.end], text: caption ? `${caption}\n${body}` : body }
  if (rows.length === 1) return [rollup]
  /** A row chunk carries the first row for context ONLY where the rows do not already name their own
   * columns. A parse that emits a separate header row gives each data row no labels of its own, so that
   * header is the context and prefixing it is what makes the row readable. A parse whose describer writes
   * every column and group label into the row itself gives the opposite: the row is already complete, and
   * prefixing a sibling adds a competing row rather than context — on a table of near-identical rows its
   * figures then appear in every passage, so a reader hands back the wrong row's number and a retriever
   * sees passages half-composed of the same text. */
  const prefixRow = first.block.selfLabeled === true ? '' : first.block.text
  const prefix = [caption, prefixRow].filter(Boolean).join('\n')
  return [
    rollup,
    ...rows.slice(1).map(r => ({
      span: [r.start, r.end] as Charspan,
      text: prefix === '' ? r.block.text : `${prefix}\n${r.block.text}`
    }))
  ]
}
const CHAR_FLOOR = 400
const CHAR_FLOOR_OVERLAP = 120
const splitSlice = async (
  slice: string,
  runStart: number,
  maxSize: number,
  overlap: number,
  strategy: SplitStrategy
): Promise<Located[]> => {
  const chunks = await MDocument.fromText(slice).chunk({ maxSize, overlap, strategy })
  const texts = chunks.map(c => c.text)
  const spans = locateChunks(slice, texts, overlap)
  return texts.map((text, i) => {
    const s = spans[i] ?? miss
    return s[0] === -1
      ? { span: miss, text }
      : { span: [runStart + s[0], runStart + s[1]] as Charspan, text: slice.slice(s[0], s[1]) }
  })
}
const proseLocated = async (
  run: readonly Positioned[],
  markdown: string,
  maxSize: number,
  overlap: number,
  strategy: ChunkStrategy
): Promise<Located[]> => {
  const first = run[0]
  const last = run.at(-1)
  if (!(first && last)) return []
  const runStart = first.start
  const slice = markdown.slice(runStart, last.end)
  if (strategy === 'semantic') {
    /** Reached at call time, so a consumer who never asks for semantic chunking never pulls the service
     * client — the strategy is an optional capability rather than a dependency of chunking itself, and
     * an unconfigured service already falls back to splitting on characters. */
    if (!env.CHONKIE_URL) return splitSlice(slice, runStart, CHAR_FLOOR, CHAR_FLOOR_OVERLAP, 'character')
    const { semanticChunk } = await import('./chonkie')
    return (await semanticChunk(slice, maxSize)).map(c => ({
      span: [runStart + c.start, runStart + c.end] as Charspan,
      text: c.text
    }))
  }
  return splitSlice(slice, runStart, maxSize, overlap, isSplitStrategy(strategy) ? strategy : 'recursive')
}
const segmentize = (positioned: readonly Positioned[]): Segment[] => {
  const segments: Segment[] = []
  let prose: Positioned[] = []
  let table: Positioned[] = []
  let caption: string | undefined
  const flushProse = () => {
    if (prose.length > 0) {
      segments.push({ kind: 'prose', run: prose })
      prose = []
    }
  }
  const flushTable = () => {
    if (table.length > 0) {
      segments.push({ caption, kind: 'table', rows: table })
      table = []
      caption = undefined
    }
  }
  for (const pos of positioned)
    if (pos.block.kind === 'table') {
      if (table.length === 0 && prose.at(-1) && CAPTION_KIND.test(prose.at(-1)?.block.kind ?? ''))
        caption = prose.pop()?.block.text
      flushProse()
      table.push(pos)
    } else {
      flushTable()
      prose.push(pos)
    }
  flushProse()
  flushTable()
  return segments
}
const locatedFor = async (params: BuildParams): Promise<Located[]> => {
  const { blocks, markdown, maxSize, overlap, strategy } = params
  const positioned = positionBlocks(blocks)
  if (strategy === 'structural' || strategy === 'hierarchical')
    return positioned.map(p => ({ span: [p.start, p.end] as Charspan, text: p.block.text }))
  const resolved = await Promise.all(
    segmentize(positioned).map(async seg =>
      seg.kind === 'table'
        ? tableLocated(seg.rows, seg.caption)
        : proseLocated(seg.run, markdown, maxSize, overlap, strategy)
    )
  )
  return resolved.flat()
}
const MAX_CHUNKS = 50_000
const buildChunks = async (params: BuildParams): Promise<BuiltChunk[]> => {
  const located = await locatedFor(params)
  if (located.length > MAX_CHUNKS)
    throw new Error(`chunking produced ${String(located.length)} chunks (max ${String(MAX_CHUNKS)}); increase maxSize`)
  const ranks = generateNKeysBetween(null, null, located.length)
  const regionsAt = buildRegionIndex(params.blocks)
  return located.map(({ span, text }, i) => {
    const rank = ranks[i]
    invariant(rank !== undefined, `missing rank at ${i}`)
    invariant(
      span[0] === -1 || (span[0] >= 0 && span[0] <= span[1] && span[1] <= params.markdown.length),
      `chunk span [${span[0]}, ${span[1]}] out of markdown bounds`
    )
    return Object.assign(remapSpan({ canonical: params.markdown, regionsAt, span, text }), {
      anchor: textAnchor,
      charspan: span,
      rank,
      text
    })
  })
}
export { buildChunks, checksumOf, chunkerVersion, remapSpan }
export type { BuiltChunk, Mapped }
