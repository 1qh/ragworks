import { expect, test } from 'bun:test'
import type { Retrieved } from './rerank-order'
import { autoMerge } from './rerank-order'

const child = (chunkId: string, parentId: null | string, score: number): Retrieved => ({
  chunkId,
  parentId,
  score,
  text: `text-${chunkId}`
})
test('collapses to parent when enough children retrieved', () => {
  const out = autoMerge({
    minChildRatio: 0.5,
    parents: new Map([['p1', { childCount: 4, text: 'parent one' }]]),
    retrieved: [child('c1', 'p1', 0.4), child('c2', 'p1', 0.9)]
  })
  expect(out).toEqual([{ chunkId: 'p1', parentId: null, score: 0.9, text: 'parent one' }])
})
test('does not collapse when too few children retrieved', () => {
  const out = autoMerge({
    minChildRatio: 0.75,
    parents: new Map([['p1', { childCount: 4, text: 'parent one' }]]),
    retrieved: [child('c1', 'p1', 0.4), child('c2', 'p1', 0.9)]
  })
  expect(out.map(r => r.chunkId)).toEqual(['c2', 'c1'])
})
test('child with null parentId passes through', () => {
  const out = autoMerge({
    minChildRatio: 0,
    parents: new Map([['p1', { childCount: 1, text: 'parent one' }]]),
    retrieved: [child('orphan', null, 0.3)]
  })
  expect(out).toEqual([child('orphan', null, 0.3)])
})
test('unknown parentId passes through', () => {
  const out = autoMerge({
    minChildRatio: 0,
    parents: new Map([['p1', { childCount: 1, text: 'parent one' }]]),
    retrieved: [child('c9', 'missing', 0.7)]
  })
  expect(out).toEqual([child('c9', 'missing', 0.7)])
})
test('duplicate child ids count once', () => {
  const out = autoMerge({
    minChildRatio: 1,
    parents: new Map([['p1', { childCount: 2, text: 'parent one' }]]),
    retrieved: [child('c1', 'p1', 0.5), child('c1', 'p1', 0.5)]
  })
  expect(out.map(r => r.chunkId)).toEqual(['c1'])
})
test('output sorted by score descending', () => {
  const out = autoMerge({
    minChildRatio: 0.5,
    parents: new Map([['p1', { childCount: 2, text: 'parent one' }]]),
    retrieved: [child('a', null, 0.2), child('c1', 'p1', 0.6), child('b', null, 0.95)]
  })
  expect(out.map(r => r.chunkId)).toEqual(['b', 'p1', 'a'])
})
test('clamps ratio above one and below zero', () => {
  const parents = new Map([['p1', { childCount: 2, text: 'parent one' }]])
  const high = autoMerge({
    minChildRatio: 5,
    parents,
    retrieved: [child('c1', 'p1', 0.6)]
  })
  expect(high.map(r => r.chunkId)).toEqual(['c1'])
  const low = autoMerge({
    minChildRatio: -3,
    parents,
    retrieved: [child('c1', 'p1', 0.6)]
  })
  expect(low).toEqual([{ chunkId: 'p1', parentId: null, score: 0.6, text: 'parent one' }])
})
test('collapsed parent never coexists with its children', () => {
  const out = autoMerge({
    minChildRatio: 0.5,
    parents: new Map([['p1', { childCount: 2, text: 'parent one' }]]),
    retrieved: [child('c1', 'p1', 0.6), child('c2', 'p1', 0.1)]
  })
  expect(out).toHaveLength(1)
  expect(out[0]?.chunkId).toBe('p1')
})
