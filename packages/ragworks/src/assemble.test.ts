import { expect, test } from 'bun:test'
import { assembleContext, assembleHops } from './assemble'

const words = (t: string): number => t.split(' ').length
const seg = (chunkId: string, text: string) => ({ chunkId, text })
test('the top-ranked segment is included even when it alone exceeds the budget', () => {
  const out = assembleContext([seg('a', 'one two three four five')], 2, words)
  /** An empty context because the single most relevant passage did not fit answers nothing at all. */
  expect(out.included.map(s => s.chunkId)).toEqual(['a'])
  expect(out.contextTokens).toBe(5)
})
test('assembly stops at the budget rather than truncating a segment', () => {
  const out = assembleContext([seg('a', 'one two'), seg('b', 'three four'), seg('c', 'five six')], 4, words)
  expect(out.included.map(s => s.chunkId)).toEqual(['a', 'b'])
  expect(out.text).toBe('one two\n\nthree four')
})
test('hops interleave so a minority hop reserves a slot instead of being starved', () => {
  const majority = [seg('m1', 'x'), seg('m2', 'x'), seg('m3', 'x')]
  const minority = [seg('n1', 'x')]
  const out = assembleHops([majority, minority], 2, words)
  /** Flat ranking would take m1,m2 and drop the minority hop entirely. */
  expect(out.included.map(s => s.chunkId)).toEqual(['m1', 'n1'])
})
test('a chunk appearing in two hops is included once', () => {
  const out = assembleHops([[seg('a', 'x')], [seg('a', 'x'), seg('b', 'x')]], 99, words)
  expect(out.included.map(s => s.chunkId)).toEqual(['a', 'b'])
})
