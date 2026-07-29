import { expect, test } from 'bun:test'
import { array, assert, constant, integer, oneof, property, record, string, tuple } from 'fast-check'
import { blockChunks, locateChunks, markdownOf, positionBlocks, regionsFor } from './lib'

const coord = integer({ max: 1000, min: 0 })
const blockArb = record({
  bbox: oneof(constant(null), tuple(coord, coord, coord, coord)),
  page: integer({ max: 20, min: 1 }),
  text: string({ maxLength: 40, minLength: 1 })
})
const blocksArb = array(blockArb, { maxLength: 30 })
test('positionBlocks: every block slices back to its exact text in the canonical markdown', () => {
  assert(
    property(blocksArb, blocks => {
      const md = markdownOf(blocks)
      for (const p of positionBlocks(blocks)) expect(md.slice(p.start, p.end)).toBe(p.block.text)
    })
  )
})
test('blockChunks: spans equal positionBlocks start and end', () => {
  assert(
    property(blocksArb, blocks => {
      const pos = positionBlocks(blocks)
      const spans = blockChunks(blocks)
      expect(spans).toHaveLength(pos.length)
      for (const [i, span] of spans.entries()) {
        const p = pos[i]
        if (p) {
          expect(span[0]).toBe(p.start)
          expect(span[1]).toBe(p.end)
        }
      }
    })
  )
})
test('locateChunks: block texts locate back to their canonical spans', () => {
  assert(
    property(blocksArb, blocks => {
      const md = markdownOf(blocks)
      const texts = blocks.map(b => b.text)
      const spans = locateChunks(md, texts)
      for (const [i, span] of spans.entries()) {
        const t = texts[i]
        if (span[0] !== -1 && t !== undefined) expect(md.slice(span[0], span[1])).toBe(t)
      }
    })
  )
})
test('regionsFor: every region for spatial blocks carries a bbox', () => {
  assert(
    property(blocksArb, blocks => {
      const md = markdownOf(blocks)
      for (const region of regionsFor(blocks, 0, Math.max(1, md.length))) expect(region.bbox).toBeDefined()
    })
  )
})
test('regionsFor: a partial chunk of a multi-line paragraph block returns one whole-block region, never an estimated line grid or a vertical sub-band', () => {
  const para = 'dòng một dòng hai dòng ba dòng bốn dòng năm dòng sáu'
  const paraBox = [50, 700, 550, 584] as const
  const singles = Array.from({ length: 12 }, (_v, i) => ({
    bbox: [50, 760 - i * 18, 550, 742 - i * 18],
    page: 1,
    text: `mục ${i}`
  }))
  const blocks = [{ bbox: paraBox, page: 1, text: para }, ...singles] as unknown as Parameters<typeof regionsFor>[0]
  const regions = regionsFor(blocks, 0, Math.floor(para.length / 2))
  expect(regions).toHaveLength(1)
  expect(regions[0]?.bbox).toEqual(paraBox)
})
test('regionsFor: a partial chunk of a single-line block clips horizontally and keeps full line height', () => {
  const line = 'một dòng đơn ngắn gọn nằm ngang trên trang giấy'
  const blocks = [
    { bbox: [100, 500, 500, 482], page: 1, text: line },
    { bbox: [100, 470, 500, 452], page: 1, text: 'dòng kế tiếp bên dưới' },
    { bbox: [100, 440, 500, 422], page: 1, text: 'và một dòng nữa ở đây' }
  ] as unknown as Parameters<typeof regionsFor>[0]
  const regions = regionsFor(blocks, 0, Math.floor(line.length / 2))
  expect(regions).toHaveLength(1)
  const box = regions[0]?.bbox
  expect(box?.[1]).toBe(500)
  expect(box?.[3]).toBe(482)
  expect(box?.[0]).toBe(100)
  expect(box?.[2]).toBeLessThan(500)
})
test('regionsFor: a chunk covering a full multi-line block returns one block-bbox region, never misaligning per-line slices', () => {
  const title = 'Tiêu đề dài bao trùm nhiều dòng khi xuống hàng trên trang chiếu rộng'
  const blocks = [
    { bbox: [10, 200, 400, 60], page: 1, text: title },
    { bbox: [10, 40, 400, 20], page: 1, text: 'a' },
    { bbox: [10, 300, 400, 282], page: 1, text: 'b' },
    { bbox: [10, 480, 400, 462], page: 1, text: 'c' }
  ] as unknown as Parameters<typeof regionsFor>[0]
  const regions = regionsFor(blocks, 0, title.length)
  expect(regions).toHaveLength(1)
  expect(regions[0]?.bbox).toEqual([10, 200, 400, 60])
})
test('regionsFor: a clip narrower than one glyph falls back to the whole block', () => {
  const blocks = [{ bbox: [100, 700, 120, 690] as [number, number, number, number], page: 1, text: 'abcdefghij' }]
  const [region] = regionsFor(blocks, 3, 4)
  expect(region?.bbox).toEqual([100, 700, 120, 690])
})
test('regionsFor: a block narrower than one glyph clips to the whole block, never a sliver', () => {
  const blocks = [{ bbox: [100, 700, 104, 690] as [number, number, number, number], page: 1, text: 'abcdefghij' }]
  const [region] = regionsFor(blocks, 3, 4)
  expect(region?.bbox).toEqual([100, 700, 104, 690])
})
test('regionsFor: a whitespace-only block draws no region', () => {
  const blocks = [
    { bbox: [100, 700, 400, 690] as [number, number, number, number], page: 1, text: 'hello there friend' },
    { bbox: [100, 680, 400, 670] as [number, number, number, number], page: 1, text: '   ' }
  ]
  const regions = regionsFor(blocks, 0, 40)
  expect(regions).toHaveLength(1)
  expect(regions[0]?.bbox).toEqual([100, 700, 400, 690])
})
test('regionsFor: a clip covering a sliver of a wide block falls back to the whole block', () => {
  const blocks = [{ bbox: [100, 700, 400, 690] as [number, number, number, number], page: 1, text: 'x'.repeat(200) }]
  const [region] = regionsFor(blocks, 0, 5)
  expect(region?.bbox).toEqual([100, 700, 400, 690])
})
