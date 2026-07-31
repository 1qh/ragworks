import { expect, test } from 'bun:test'
import { assert, property, string } from 'fast-check'
import { containedIn, dropCoveredDuplicates, hamming, simhash, wordsOf } from './simhash'

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
const OPTS = { containedFraction: 0.9, hammingDistance: 3 }
const item = (id: string, text: string) => ({ id, text })
test('a passage wholly inside a kept one is dropped', () => {
  const kept = dropCoveredDuplicates(
    [item('wide', 'alpha beta gamma delta epsilon zeta'), item('narrow', 'alpha beta gamma')],
    i => i.text,
    OPTS
  )
  expect(kept.map(k => k.id)).toEqual(['wide'])
})
test('containment is ASYMMETRIC — a wider passage arriving later still survives', () => {
  /** The narrow one is kept first; the wide one shares only half ITS OWN words with the narrow, so it
   * is not covered and survives. A symmetric test would delete the passage carrying more evidence. */
  const kept = dropCoveredDuplicates(
    [item('narrow', 'alpha beta gamma'), item('wide', 'alpha beta gamma delta epsilon zeta')],
    i => i.text,
    OPTS
  )
  expect(kept.map(k => k.id)).toEqual(['narrow', 'wide'])
})
test('a distinct passage is kept', () => {
  const kept = dropCoveredDuplicates([item('a', 'alpha beta'), item('b', 'wholly other words')], i => i.text, OPTS)
  expect(kept.map(k => k.id)).toEqual(['a', 'b'])
})
test('empty text is never a duplicate', () => {
  const kept = dropCoveredDuplicates([item('a', 'alpha beta'), item('e', '')], i => i.text, OPTS)
  expect(kept.map(k => k.id)).toEqual(['a', 'e'])
})
test('containedIn reports the fraction of the CANDIDATE covered, and an empty candidate covers nothing', () => {
  expect(containedIn(wordsOf('alpha beta'), wordsOf('alpha beta gamma'))).toBe(1)
  expect(containedIn(wordsOf(''), wordsOf('alpha'))).toBe(0)
})
