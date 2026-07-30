import { expect, test } from 'bun:test'
import type { ChunkId } from './domain'
import type { Hit, VectorStore } from './ports'
import { retrieve } from './retrieve'
/** The whole point of the store port is that a stranger can satisfy it with their own database. So this
 * drives retrieval against a store made of two array lookups — no services, no network, no engine of
 * ours — which is the only evidence that "any vector database" is a capability rather than a claim. */
const id = (s: string): ChunkId => s as ChunkId
const hits = (...pairs: [string, number][]): Hit[] => pairs.map(([c, score]) => ({ chunkId: id(c), score }))
const vectorOnly: VectorStore = {
  idsInSet: async () => Promise.resolve([]),
  remove: async () => Promise.resolve(),
  search: async () => Promise.resolve(hits(['a', 0.9], ['b', 0.5], ['c', 0.1])),
  upsert: async () => Promise.resolve()
}
const hybrid: VectorStore = {
  ...vectorOnly,
  keywordSearch: async () => Promise.resolve(hits(['c', 9], ['d', 4]))
}
test('a store offering only vector search works — the keyword leg is optional, not required', async () => {
  const out = await retrieve({ query: 'q', scope: { chunkSetIds: [] }, store: vectorOnly, vector: [1, 0] })
  expect(out.map(c => c.chunkId)).toEqual([id('a'), id('b'), id('c')])
  expect(out.every(c => c.bm25Rank === null)).toBe(true)
})
test('a store that also offers keyword search has both legs fused by the CORE, not by the store', async () => {
  const out = await retrieve({ query: 'q', scope: { chunkSetIds: [] }, store: hybrid, vector: [1, 0] })
  expect(new Set(out.map(c => c.chunkId))).toEqual(new Set([id('a'), id('b'), id('c'), id('d')]))
  const d = out.find(c => c.chunkId === id('d'))
  expect(d?.vectorRank).toBeNull()
  expect(d?.bm25Rank).toBe(2)
})
test('a chunk the vector leg never surfaced reports null rank, never 0 — absence is not a top hit', async () => {
  const out = await retrieve({ query: 'q', scope: { chunkSetIds: [] }, store: hybrid, vector: [1, 0] })
  expect(out.filter(c => c.vectorRank === 0)).toEqual([])
  expect(out.filter(c => c.bm25Rank === 0)).toEqual([])
})
test('the keyword weight moves the ranking, so the knob a consumer is given actually does something', async () => {
  const lean = await retrieve({
    keywordWeight: 0.95,
    query: 'q',
    scope: { chunkSetIds: [] },
    store: hybrid,
    vector: [1, 0]
  })
  const dense = await retrieve({
    keywordWeight: 0.05,
    query: 'q',
    scope: { chunkSetIds: [] },
    store: hybrid,
    vector: [1, 0]
  })
  expect(lean.map(c => c.chunkId)).not.toEqual(dense.map(c => c.chunkId))
})
test('a whole-number weight works at both ends of its declared range', async () => {
  for (const keywordWeight of [0, 1]) {
    const out = await retrieve({ keywordWeight, query: 'q', scope: { chunkSetIds: [] }, store: hybrid, vector: [1, 0] })
    expect(out.length).toBeGreaterThan(0)
  }
})
test('a supplied reranker decides the delivery order', async () => {
  const out = await retrieve({
    query: 'q',
    reranker: { rerank: async a => Promise.resolve(a.texts.map((_, i) => i)) },
    scope: { chunkSetIds: [] },
    store: vectorOnly,
    textOf: c => `text for ${String(c)}`,
    vector: [1, 0]
  })
  expect(out[0]?.chunkId).toBe(id('c'))
  expect(out.map(c => c.finalRank)).toEqual([1, 2, 3])
})
test('near-duplicate passages are dropped, so overlapping windows stop spending the context budget', async () => {
  const same = 'the retention policy applies to every record class held by the unit and the review cadence is stated'
  const out = await retrieve({
    query: 'q',
    scope: { chunkSetIds: [] },
    store: vectorOnly,
    textOf: c => (c === id('c') ? 'an entirely different passage about invoicing and delivery terms' : same),
    vector: [1, 0]
  })
  expect(out).toHaveLength(2)
})
test('retrieval refuses when it has neither a vector nor an embedder, rather than searching on nothing', async () => {
  await expect(retrieve({ query: 'q', scope: { chunkSetIds: [] }, store: vectorOnly })).rejects.toThrow(
    /vector or an embedder/u
  )
})
test('an embedder is used when no vector is supplied, so the consumer may bring either', async () => {
  const out = await retrieve({
    embedder: { embed: async () => Promise.resolve([[1, 0]]) },
    query: 'q',
    scope: { chunkSetIds: [] },
    store: vectorOnly
  })
  expect(out).toHaveLength(3)
})
