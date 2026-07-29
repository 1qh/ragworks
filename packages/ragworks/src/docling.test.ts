import { expect, test } from 'bun:test'
import { flatten, swatchOf, tableRowBlocks, toBottomLeft, withBackgroundColor } from './docling'

const noHeight = () => 0
test('flatten: a body referencing one node many times yields a single block, not a duplicated stack', () => {
  const prov = [{ bbox: { b: 80, coord_origin: 'BOTTOMLEFT', l: 10, r: 200, t: 100 }, page_no: 1 }]
  const doc = {
    body: { children: [{ $ref: '#/texts/0' }, { $ref: '#/texts/0' }, { $ref: '#/texts/0' }], self_ref: '#/body' },
    pages: { '1': { page_no: 1, size: { height: 800, width: 600 } } },
    schema_name: 'DoclingDocument',
    texts: [{ children: [], label: 'text', prov, self_ref: '#/texts/0', text: 'Điều lệ Quỹ Lumen' }]
  } as unknown as Parameters<typeof flatten>[0]
  const { blocks } = flatten(doc)
  expect(blocks).toHaveLength(1)
  expect(blocks[0]?.text).toBe('Điều lệ Quỹ Lumen')
})
test('tableRowBlocks: a col-spanning cell is emitted once, not duplicated across the columns it covers', () => {
  const grid = [
    [
      { start_col_offset_idx: 0, start_row_offset_idx: 0, text: 'Name' },
      { col_span: 2, start_col_offset_idx: 1, start_row_offset_idx: 0, text: 'Score' },
      { col_span: 2, start_col_offset_idx: 1, start_row_offset_idx: 0, text: 'Score' }
    ]
  ]
  const blocks = tableRowBlocks({ heightFor: noHeight, node: { data: { grid } } })
  expect(blocks).toHaveLength(1)
  expect(blocks[0]?.text).toBe('Name │ Score')
})
test('tableRowBlocks: a row-spanning group header stays in its origin row and never bleeds into the next', () => {
  const grid = [
    [
      { start_col_offset_idx: 0, start_row_offset_idx: 0, text: 'Group' },
      { start_col_offset_idx: 1, start_row_offset_idx: 0, text: 'Person' }
    ],
    [
      { row_span: 2, start_col_offset_idx: 0, start_row_offset_idx: 1, text: 'A' },
      { start_col_offset_idx: 1, start_row_offset_idx: 1, text: 'Alice' }
    ],
    [
      { row_span: 2, start_col_offset_idx: 0, start_row_offset_idx: 1, text: 'A' },
      { start_col_offset_idx: 1, start_row_offset_idx: 2, text: 'Bob' }
    ]
  ]
  const texts = tableRowBlocks({ heightFor: noHeight, node: { data: { grid } } }).map(b => b.text)
  expect(texts).toEqual(['A │ Person: Alice', 'Person: Bob'])
})
test('tableRowBlocks: cell text has its internal newlines and runs collapsed to single spaces', () => {
  const grid = [[{ start_col_offset_idx: 0, start_row_offset_idx: 0, text: 'Multi\n  line   cell' }]]
  expect(tableRowBlocks({ heightFor: noHeight, node: { data: { grid } } })[0]?.text).toBe('Multi line cell')
})
test('tableRowBlocks: a grid with no start offsets falls back to positional origin (no crash, no duplication)', () => {
  const grid = [[{ text: 'a' }, { text: 'b' }]]
  expect(tableRowBlocks({ heightFor: noHeight, node: { data: { grid } } })[0]?.text).toBe('a │ b')
})
test('toBottomLeft flips a top-left box (t < b) into the bottom-left envelope every Block carries', () => {
  expect(toBottomLeft([50, 70, 560, 116], 792)).toEqual([50, 722, 560, 676])
})
test('toBottomLeft passes an already-bottom-left box (t > b) through untouched', () => {
  expect(toBottomLeft([50, 722, 560, 676], 792)).toEqual([50, 722, 560, 676])
})
test('toBottomLeft leaves a box alone when the page height is unknown, never inverting it to a negative y', () => {
  expect(toBottomLeft([50, 70, 560, 116], 0)).toEqual([50, 70, 560, 116])
})
test('a short label on a saturated fill carries its colour, so a legend decodes the grid it explains', () => {
  const plane = {
    comps: 3,
    height: 20,
    pixels: new Uint8Array(Array.from({ length: 40 * 20 * 3 }, (_, i) => [197, 223, 180][i % 3] ?? 0)),
    width: 40
  }
  const block = { bbox: [0, 20, 40, 0] as [number, number, number, number], page: 1, text: 'Đang áp dụng' }
  const out = withBackgroundColor(
    block,
    () => 20,
    () => plane
  )
  expect(out.text).toBe('Đang áp dụng [green]')
})
test('a label on plain white keeps its text untouched', () => {
  const plane = { comps: 3, height: 20, pixels: new Uint8Array(40 * 20 * 3).fill(255), width: 40 }
  const block = { bbox: [0, 20, 40, 0] as [number, number, number, number], page: 1, text: 'Đang áp dụng' }
  expect(
    withBackgroundColor(
      block,
      () => 20,
      () => plane
    ).text
  ).toBe('Đang áp dụng')
})
test('a heading that introduces a legend is never itself a status in the vocabulary', () => {
  const plane = {
    comps: 3,
    height: 20,
    pixels: new Uint8Array(Array.from({ length: 40 * 20 * 3 }, (_, i) => [197, 223, 180][i % 3] ?? 0)),
    width: 40
  }
  const heading = { bbox: [0, 20, 40, 0] as [number, number, number, number], page: 1, text: 'Chú thích màu sắc:' }
  expect(
    swatchOf(
      heading,
      () => 20,
      () => plane
    )
  ).toBeNull()
})
test('page furniture on unsaturated shading never becomes a legend swatch', () => {
  const shade = (rgb: readonly number[]) => ({
    comps: 3,
    height: 20,
    pixels: new Uint8Array(Array.from({ length: 40 * 20 * 3 }, (_, i) => rgb[i % 3] ?? 0)),
    width: 40
  })
  const furniture = { bbox: [0, 20, 40, 0] as [number, number, number, number], page: 1, text: '6/8' }
  for (const neutral of [
    [255, 255, 255],
    [237, 237, 237],
    [204, 205, 204]
  ])
    expect(
      swatchOf(
        furniture,
        () => 20,
        () => shade(neutral)
      )
    ).toBeNull()
  const legend = { bbox: [0, 20, 40, 0] as [number, number, number, number], page: 1, text: 'Đang áp dụng' }
  expect(
    swatchOf(
      legend,
      () => 20,
      () => shade([197, 223, 180])
    )
  ).not.toBeNull()
})
test('a status label attaches to a mark whose meaning is its colour, never to a cell that carries words', () => {
  const grid = [
    [
      { start_col_offset_idx: 0, start_row_offset_idx: 0, text: 'Thị trường' },
      { start_col_offset_idx: 1, start_row_offset_idx: 0, text: 'Indo' }
    ],
    [
      { start_col_offset_idx: 0, start_row_offset_idx: 1, text: 'A.1 DỊCH VỤ VẬN CHUYỂN' },
      { start_col_offset_idx: 1, start_row_offset_idx: 1, text: 'x' }
    ]
  ]
  const blocks = tableRowBlocks({ heightFor: noHeight, node: { data: { grid } } })
  expect(blocks[0]?.text).toContain('A.1 DỊCH VỤ VẬN CHUYỂN')
  expect(blocks[0]?.text).not.toContain('[')
})
