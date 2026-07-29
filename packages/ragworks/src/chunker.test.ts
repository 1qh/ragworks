import { expect, test } from 'bun:test'
import { assert, asyncProperty, integer, string } from 'fast-check'
import type { Block } from './lib'
import { buildChunks, checksumOf, remapSpan } from './chunker'
import { blockChunks, buildRegionIndex, markdownOf } from './lib'

const blocks: Block[] = [
  { bbox: [0, 0, 10, 10], page: 1, text: 'Intro' },
  { bbox: [0, 12, 10, 22], page: 1, text: 'hello world body text here' },
  { bbox: [0, 24, 10, 34], page: 2, text: 'a | b\nc | d' }
]
const markdown = markdownOf(blocks)
const firstSpan = blockChunks(blocks)[0]
if (!firstSpan) throw new Error('no block span')
test('buildChunks: consecutive table-row blocks group into a rollup plus header-prepended row chunks, each on its own row bbox', async () => {
  const tableBlocks: Block[] = [
    { bbox: [0, 30, 100, 40], kind: 'table', page: 1, text: 'Name | Age' },
    { bbox: [0, 20, 100, 30], kind: 'table', page: 1, text: 'Alice | 30' },
    { bbox: [0, 10, 100, 20], kind: 'table', page: 1, text: 'Bob | 25' }
  ]
  const built = await buildChunks({
    blocks: tableBlocks,
    markdown: markdownOf(tableBlocks),
    maxSize: 1000,
    overlap: 0,
    strategy: 'recursive'
  })
  const texts = built.map(c => c.text)
  expect(built).toHaveLength(3)
  expect(texts).toContain('Name | Age\nAlice | 30\nBob | 25')
  expect(texts).toContain('Name | Age\nAlice | 30')
  expect(texts).toContain('Name | Age\nBob | 25')
  expect(built.find(c => c.text === 'Name | Age\nAlice | 30')?.regions[0]?.bbox).toEqual([0, 20, 100, 30])
  expect(built.find(c => c.text === 'Name | Age\nBob | 25')?.regions[0]?.bbox).toEqual([0, 10, 100, 20])
})
test('buildChunks semantic without a chonkie service falls back to the character floor', async () => {
  const long = 'Sentence about transformer attention mechanisms and retrieval. '.repeat(60)
  const semBlocks: Block[] = [{ bbox: [0, 0, 100, 10], page: 1, text: long }]
  const built = await buildChunks({
    blocks: semBlocks,
    markdown: markdownOf(semBlocks),
    maxSize: 800,
    overlap: 100,
    strategy: 'semantic'
  })
  expect(built.length).toBeGreaterThan(1)
  for (const c of built) expect(c.text.length).toBeLessThanOrEqual(700)
})
test('checksumOf: deterministic, distinct, 64-hex', () => {
  expect(checksumOf('alpha')).toBe(checksumOf('alpha'))
  expect(checksumOf('alpha')).not.toBe(checksumOf('beta'))
  expect(checksumOf('alpha')).toMatch(/^[0-9a-f]{64}$/u)
})
test('remapSpan: maps a span to overlapping block regions, page, bbox, checksum', () => {
  const mapped = remapSpan({ canonical: markdown, regionsAt: buildRegionIndex(blocks), span: firstSpan })
  expect(mapped.regions[0]?.page).toBe(1)
  expect(mapped.regions[0]?.bbox).toEqual([0, 0, 10, 10])
  expect(mapped.regions).toHaveLength(1)
  expect(mapped.checksum).toBe(checksumOf(markdown.slice(firstSpan[0], firstSpan[1])))
})
test('remapSpan: a missing span (-1) yields no regions', () => {
  const mapped = remapSpan({ canonical: markdown, regionsAt: buildRegionIndex(blocks), span: [-1, -1] })
  expect(mapped.regions).toEqual([])
  expect(mapped.checksum).toBe(checksumOf(''))
})
test('remapSpan: an explicit text overrides the slice for the checksum', () => {
  const mapped = remapSpan({ canonical: markdown, regionsAt: buildRegionIndex(blocks), span: [0, 5], text: 'OVERRIDE' })
  expect(mapped.checksum).toBe(checksumOf('OVERRIDE'))
})
test('remapSpan: a -1 start short-circuits to no regions even when the end overlaps blocks', () => {
  const mapped = remapSpan({ canonical: markdown, regionsAt: buildRegionIndex(blocks), span: [-1, 5] })
  expect(mapped.regions).toHaveLength(0)
})
test('buildChunks structural: one charspan chunk per block in reading order', async () => {
  const chunks = await buildChunks({ blocks, markdown, maxSize: 800, overlap: 100, strategy: 'structural' })
  expect(chunks).toHaveLength(blocks.length)
  const ranks = chunks.map(c => c.rank)
  expect(new Set(ranks).size).toBe(ranks.length)
  expect(ranks).toEqual([...ranks].toSorted((a, b) => (a < b ? -1 : 1)))
  for (const c of chunks) {
    expect(c.anchor).toBe('charspan')
    expect(markdown.slice(c.charspan[0], c.charspan[1])).toBe(c.text)
    expect(c.checksum).toBe(checksumOf(c.text))
  }
  expect(chunks[2]?.regions[0]?.page).toBe(2)
})
test('buildChunks hierarchical: also anchors one charspan chunk per block', async () => {
  const chunks = await buildChunks({ blocks, markdown, maxSize: 800, overlap: 0, strategy: 'hierarchical' })
  expect(chunks).toHaveLength(blocks.length)
  for (const c of chunks) expect(c.anchor).toBe('charspan')
})
test('buildChunks recursive: verbatim chunks locate back into the markdown with regions', async () => {
  const chunks = await buildChunks({ blocks, markdown, maxSize: 20, overlap: 4, strategy: 'recursive' })
  const structural = await buildChunks({ blocks, markdown, maxSize: 800, overlap: 0, strategy: 'structural' })
  expect(chunks.length).toBeGreaterThan(structural.length)
  for (const c of chunks) {
    expect(c.charspan[0]).toBeGreaterThanOrEqual(0)
    expect(markdown.includes(c.text)).toBe(true)
    expect(c.checksum).toBe(checksumOf(c.text))
  }
})
const wsBlocks: Block[] = [
  { bbox: [0, 0, 10, 10], page: 1, text: '# Heading with   weird\t spacing' },
  { bbox: [0, 12, 10, 22], page: 1, text: 'line1\n\n\nline2   trailing   ' }
]
const wsMarkdown = markdownOf(wsBlocks)
test('buildChunks recursive: located chunks slice back to their stored text', async () => {
  const chunks = await buildChunks({
    blocks: wsBlocks,
    markdown: wsMarkdown,
    maxSize: 12,
    overlap: 2,
    strategy: 'recursive'
  })
  expect(chunks.length).toBeGreaterThan(0)
  for (const c of chunks) if (c.charspan[0] !== -1) expect(wsMarkdown.slice(c.charspan[0], c.charspan[1])).toBe(c.text)
})
test('buildChunks: any recursive chunking keeps spans in bounds and located starts non-decreasing', async () => {
  await assert(
    asyncProperty(
      string({ maxLength: 2000, minLength: 1 }),
      integer({ max: 400, min: 20 }),
      integer({ max: 100, min: 0 }),
      async (text, maxSize, overlap) => {
        if (overlap >= maxSize) return
        const built = await buildChunks({ blocks: [], markdown: text, maxSize, overlap, strategy: 'recursive' })
        let last = -1
        for (const c of built) {
          const [s, e] = c.charspan
          expect(s === -1 || (s >= 0 && s <= e && e <= text.length)).toBe(true)
          if (s !== -1) {
            expect(s).toBeGreaterThanOrEqual(last)
            last = s
          }
        }
      }
    ),
    { numRuns: 30 }
  )
}, 120_000)
test('buildChunks: a self-labeled table row is not prefixed with a sibling row, while a header-bearing table still is', async () => {
  const labeled: Block[] = [
    { bbox: [0, 30, 100, 40], kind: 'table', page: 1, selfLabeled: true, text: 'A1 │ Q1: 1 │ Q2: 2' },
    { bbox: [0, 20, 100, 30], kind: 'table', page: 1, selfLabeled: true, text: 'B1 │ Q1: 3 │ Q2: 4' }
  ]
  const built = await buildChunks({
    blocks: labeled,
    markdown: markdownOf(labeled),
    maxSize: 1000,
    overlap: 0,
    strategy: 'recursive'
  })
  const texts = built.map(c => c.text)
  expect(texts).toContain('B1 │ Q1: 3 │ Q2: 4')
  expect(texts.some(t => t.startsWith('A1') && t.includes('B1'))).toBe(true)
  expect(texts).not.toContain('A1 │ Q1: 1 │ Q2: 2\nB1 │ Q1: 3 │ Q2: 4\nB1 │ Q1: 3 │ Q2: 4')
}, 30_000)
