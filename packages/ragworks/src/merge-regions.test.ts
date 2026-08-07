import { expect, test } from 'bun:test'
import type { Region } from './lib'
import { mergeRegions } from './bridge'

const line = (top: number, page = 1): Region => ({ bbox: [10, top, 200, top + 10], page })
const height = (r: Region | undefined): number => (r ? Math.abs(r.bbox[1] - r.bbox[3]) : Number.POSITIVE_INFINITY)
test('unions contiguous line-boxes on one page into a single tight box', () => {
  const merged = mergeRegions([line(10), line(20), line(30)])
  expect(merged).toHaveLength(1)
  const [r] = merged
  expect(r?.page).toBe(1)
  expect(r?.bbox[1]).toBe(10)
  expect(r?.bbox[3]).toBe(40)
  expect(r?.bbox[0]).toBe(10)
  expect(r?.bbox[2]).toBe(200)
})
test('drops a lone stray line far from the cluster, so the box hugs the content not the gap', () => {
  const merged = mergeRegions([line(10), line(20), line(30), line(600)])
  expect(merged).toHaveLength(1)
  expect(height(merged[0])).toBeLessThan(50)
  expect(merged[0]?.bbox[3]).toBe(40)
})
test('keeps a genuine second cluster of real lines rather than under-covering', () => {
  const merged = mergeRegions([line(10), line(20), line(600), line(610)])
  expect(merged).toHaveLength(2)
})
test('never unions across pages', () => {
  const merged = mergeRegions([line(10, 1), line(20, 1), line(10, 2)])
  const pages = merged.map(r => r.page).toSorted((a, b) => a - b)
  expect(pages).toEqual([1, 2])
})
test('preserves bbox orientation when top has the larger coordinate', () => {
  const merged = mergeRegions([
    { bbox: [10, 40, 200, 30], page: 1 },
    { bbox: [10, 30, 200, 20], page: 1 }
  ])
  expect(merged).toHaveLength(1)
  const [r] = merged
  expect(r?.bbox[1]).toBe(40)
  expect(r?.bbox[3]).toBe(20)
})
