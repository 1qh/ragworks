import { expect, test } from 'bun:test'
import { assert, property, string } from 'fast-check'
import { hamming, simhash } from './simhash'

const near = 'the transformer relies entirely on self attention layers to relate tokens'
const nearEdited = 'the transformer relies entirely on self attention layers to relate every token'
const unrelated = 'a spreadsheet cell keeps its row and column when the sheet is read as a grid'
test('the same text always fingerprints to the same value, whatever the surrounding whitespace', () => {
  expect(simhash(near)).toBe(simhash(near))
  expect(simhash(near)).toBe(simhash(`  ${near.replaceAll(' ', '\n')}  `))
})
test('the fingerprint ignores case, because a dedup that treats a title as a new passage is no dedup', () => {
  expect(simhash(near)).toBe(simhash(near.toUpperCase()))
})
test('a near-duplicate sits closer than an unrelated passage, which is the whole property dedup rests on', () => {
  const edited = hamming(simhash(near), simhash(nearEdited))
  const different = hamming(simhash(near), simhash(unrelated))
  expect(edited).toBeLessThan(different)
})
test('hamming is zero only for an identical fingerprint and is symmetric', () => {
  assert(
    property(string(), string(), (a, b) => {
      const [x, y] = [simhash(a), simhash(b)]
      expect(hamming(x, y)).toBe(hamming(y, x))
      expect(hamming(x, x)).toBe(0)
      return true
    }),
    { numRuns: 200 }
  )
})
test('a fingerprint never exceeds 64 bits, so a stored value cannot silently widen', () => {
  assert(
    property(string(), s => {
      const h = simhash(s)
      expect(h).toBeGreaterThanOrEqual(0n)
      expect(h).toBeLessThan(2n ** 64n)
      return true
    }),
    { numRuns: 200 }
  )
})
test('an empty text fingerprints to zero rather than throwing, so an empty chunk is comparable', () => {
  expect(simhash('')).toBe(0n)
  expect(hamming(simhash(''), simhash(''))).toBe(0)
})
