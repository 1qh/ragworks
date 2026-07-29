import { expect, test } from 'bun:test'
import { lostInTheMiddle, maximalMarginalRelevance } from './rerank-order'

test('lostInTheMiddle puts the strongest items at the outer edges', () => {
  expect(lostInTheMiddle(['a', 'b', 'c', 'd', 'e'])).toEqual(['a', 'c', 'e', 'd', 'b'])
})
test('lostInTheMiddle preserves every element exactly once', () => {
  const input = [1, 2, 3, 4, 5, 6, 7]
  const out = lostInTheMiddle(input)
  expect(out).toHaveLength(input.length)
  expect([...out].toSorted((a, b) => a - b)).toEqual(input)
})
test('lostInTheMiddle handles empty, single and pair inputs', () => {
  expect(lostInTheMiddle([])).toHaveLength(0)
  expect(lostInTheMiddle(['only'])).toEqual(['only'])
  expect(lostInTheMiddle(['first', 'second'])).toEqual(['first', 'second'])
})
test('lostInTheMiddle does not mutate its input', () => {
  const input = ['a', 'b', 'c']
  lostInTheMiddle(input)
  expect(input).toEqual(['a', 'b', 'c'])
})
const duplicates = [
  { id: 'a', score: 0.9, text: 'the cat sat on the mat' },
  { id: 'b', score: 0.88, text: 'the cat sat on the mat' },
  { id: 'c', score: 0.4, text: 'quantum tunnelling in semiconductors' }
]
test('maximalMarginalRelevance returns at most topK items', () => {
  expect(maximalMarginalRelevance({ items: duplicates, lambda: 0.5, topK: 2 })).toHaveLength(2)
  expect(maximalMarginalRelevance({ items: duplicates, lambda: 0.5, topK: 99 })).toHaveLength(3)
})
test('maximalMarginalRelevance prefers a diverse text over a near duplicate at low lambda', () => {
  const picked = maximalMarginalRelevance({ items: duplicates, lambda: 0.1, topK: 2 })
  expect(picked.map(item => item.id)).toEqual(['a', 'c'])
})
test('maximalMarginalRelevance follows pure relevance at lambda one', () => {
  const picked = maximalMarginalRelevance({ items: duplicates, lambda: 1, topK: 3 })
  expect(picked.map(item => item.id)).toEqual(['a', 'b', 'c'])
})
test('maximalMarginalRelevance clamps lambda outside the unit interval', () => {
  const picked = maximalMarginalRelevance({ items: duplicates, lambda: 4, topK: 3 })
  expect(picked.map(item => item.id)).toEqual(['a', 'b', 'c'])
})
test('maximalMarginalRelevance handles empty input and non positive topK', () => {
  expect(maximalMarginalRelevance({ items: [], lambda: 0.5, topK: 5 })).toEqual([])
  expect(maximalMarginalRelevance({ items: duplicates, lambda: 0.5, topK: 0 })).toEqual([])
})
test('maximalMarginalRelevance keeps identical texts without dropping any', () => {
  const identical = [
    { id: 'x', score: 0.5, text: 'same words here' },
    { id: 'y', score: 0.4, text: 'same words here' }
  ]
  const picked = maximalMarginalRelevance({ items: identical, lambda: 0.5, topK: 2 })
  expect(picked.map(item => item.id).toSorted((a, b) => a.localeCompare(b))).toEqual(['x', 'y'])
})
