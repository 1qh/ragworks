import { describe, expect, it } from 'bun:test'
import { communityText, cosine, entityText, rankBySimilarity, relationshipText, SIMILARITY_FLOOR } from './graph-vector'

describe('cosine', () => {
  it('scores an identical vector at one and an orthogonal one at zero', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1, 6)
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0, 6)
  })
  it('returns zero rather than NaN for a zero vector or a length mismatch', () => {
    expect(cosine([0, 0], [1, 1])).toBe(0)
    expect(cosine([1, 2, 3], [1, 2])).toBe(0)
    expect(cosine([], [])).toBe(0)
  })
})
describe('rankBySimilarity', () => {
  it('orders by closeness and drops anything under the floor', () => {
    const rows = [
      { name: 'far', vec: [0, 1] },
      { name: 'near', vec: [1, 0.05] },
      { name: 'mid', vec: [1, 1] }
    ]
    const ranked = rankBySimilarity(rows, [1, 0], 10)
    expect(ranked.map(r => r.row.name)).toEqual(['near', 'mid'])
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 1)
  })
  it('skips a record that carries no vector rather than scoring it as zero-distance', () => {
    const ranked = rankBySimilarity([{ name: 'unembedded', vec: null }], [1, 0], 10)
    expect(ranked).toEqual([])
  })
  it('honours the limit', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ name: `e${String(i)}`, vec: [1, i / 100] }))
    expect(rankBySimilarity(rows, [1, 0], 2)).toHaveLength(2)
  })
  it('keeps the floor strict enough to reject an orthogonal match', () => {
    expect(rankBySimilarity([{ name: 'orthogonal', vec: [0, 1] }], [1, 0], 5)).toEqual([])
    expect(SIMILARITY_FLOOR).toBeGreaterThan(0)
  })
})
describe('record text', () => {
  it('renders each graph record kind as the text that gets embedded', () => {
    expect(entityText('GSM', 'company')).toBe('GSM (company)')
    expect(relationshipText('GSM', 'VinFast')).toBe('GSM — VinFast')
    expect(communityText(['a', 'b'], null)).toBe('a, b')
    expect(communityText(['a', 'b'], 'the summary')).toBe('the summary')
  })
})
