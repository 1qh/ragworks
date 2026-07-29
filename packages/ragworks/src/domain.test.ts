import { expect, test } from 'bun:test'
import type { Block } from './lib'
import { geometryOf, markdownOf } from './domain'
/** Geometry decides which editor is the source of truth for a parse, so reading it wrong routes an
 * editable surface at a read-only one. It is ordered — a block carrying a cell makes the whole parse a
 * grid even when its siblings carry only boxes — and the ordering is the part a rewrite loses. */
const block = (over: Partial<Block>): Block => ({ bbox: null, page: 1, text: 't', ...over })
test('a parse with no box and no cell is none', () => {
  expect(geometryOf([block({}), block({ text: 'u' })])).toBe('none')
})
test('a box with no cell anywhere is spatial', () => {
  expect(geometryOf([block({}), block({ bbox: [0, 1, 2, 3] })])).toBe('spatial')
})
test('one cell outranks every box — grid wins wherever a cell appears', () => {
  expect(geometryOf([block({ bbox: [0, 1, 2, 3] }), block({ cell: { col: 0, row: 0 } })])).toBe('grid')
})
test('an empty parse is none rather than a throw — a document that extracted nothing still has a class', () => {
  expect(geometryOf([])).toBe('none')
})
test('markdown joins on a blank line and keeps block order, never sorting or trimming to nothing', () => {
  expect(markdownOf([block({ text: 'b' }), block({ text: 'a' })])).toBe('b\n\na')
})
