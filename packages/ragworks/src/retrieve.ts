import type { Candidate, ChunkId, FusionTechnique } from './domain'
import type { Embedder, Hit, Reranker, SearchScope, VectorStore } from './ports'
import { hamming, simhash } from './simhash'
/** Retrieval over a consumer's OWN store, which is what "any vector database" has to mean to be true.
 *
 * A store port that nothing reads is a NAME rather than a capability, so this is the function that makes
 * it one. It requires only the vector half — search, plus the ids the core reconciles against — because
 * most stores have no keyword index, and it FUSES the two result lists here rather than asking the store
 * to. That placement is deliberate: fusion is ranking arithmetic over two lists, it needs nothing a store
 * knows, and demanding a native hybrid query would exclude every store that lacks one.
 *
 * Everything here is pure. It reaches no network and no environment; the collaborators arrive as
 * arguments, so a consumer can drive the whole path in a test with three functions and no services.
 */
const RRF_K = 60
const NEAR_DUP_BITS = 3
/** Rank positions are ONE-based and a missing method is null, never 0 — a method that did not surface a
 * chunk and a method that ranked it first must never read the same. */
const rankOf = (hits: readonly Hit[]): Map<ChunkId, { rank: number; score: null | number }> =>
  new Map(hits.map((h, i) => [h.chunkId, { rank: i + 1, score: h.score }]))
const normalise = (scores: readonly number[]): number[] => {
  const lo = Math.min(...scores)
  const hi = Math.max(...scores)
  return scores.map(s => (hi === lo ? 1 : (s - lo) / (hi - lo)))
}
const combine = (technique: FusionTechnique, a: number, b: number): number => {
  if (technique === 'geometric_mean') return Math.sqrt(a * b)
  if (technique === 'harmonic_mean') return a + b === 0 ? 0 : (2 * a * b) / (a + b)
  return (a + b) / 2
}
interface Fused {
  id: ChunkId
  score: number
}
/** Named rather than inline: a spread written inside an iteration callback is rewritten by the formatter
 * into a MUTATING assign over the first argument, which would edit the very objects the fused ranking
 * still indexes. A top-level function keeps the copy a copy. */
const withRerank = (f: Fused, rerank: null | number): { id: ChunkId; rerank: null | number; score: number } => ({
  ...f,
  rerank
})
/** Drops a passage whose own words a kept passage already covers, so overlapping windows over one table
 * stop spending the budget that decides answers. Passages with no text available are always kept. */
const dedupe = (text: (id: ChunkId) => string): ((f: Fused) => boolean) => {
  const seen: bigint[] = []
  return (f: Fused): boolean => {
    const t = text(f.id)
    if (t === '') return true
    const h = simhash(t)
    if (seen.some(x => hamming(x, h) <= NEAR_DUP_BITS)) return false
    seen.push(h)
    return true
  }
}
interface RetrieveArgs {
  readonly embedder?: Embedder
  /** Weight on the keyword leg, 0 to 1; the vector leg takes the remainder. */
  readonly keywordWeight?: number
  readonly query: string
  readonly reranker?: Reranker
  readonly scope: SearchScope
  readonly store: VectorStore
  readonly technique?: FusionTechnique
  readonly textOf?: (id: ChunkId) => string
  readonly topK?: number
  /** Supply a query vector directly when the caller already has one; otherwise an embedder is required. */
  readonly vector?: readonly number[]
}
/** Resolved without a non-null assertion: the branch narrows, where an assertion would only silence the
 * compiler about a case that genuinely occurs when a consumer supplies neither. */
const queryVector = async (args: RetrieveArgs): Promise<readonly number[]> => {
  if (args.vector) return args.vector
  const { embedder } = args
  if (!embedder) throw new Error('retrieve needs either a query vector or an embedder')
  const out = await embedder.embed([args.query])
  const first = out[0]
  if (!first) throw new Error('the embedder returned no vector for the query')
  return first
}
const legs = async (a: {
  args: RetrieveArgs
  model: string
  topK: number
  vector: readonly number[]
}): Promise<{ keyword: readonly Hit[]; vector: readonly Hit[] }> => {
  const { args, model, topK, vector } = a
  const vectorHits = await args.store.search({ model, scope: args.scope, topK, vector })
  /** A store with no text index is a legitimate store, so its absence degrades to vector-only rather
   * than failing — the optional method IS how a store advertises the capability. */
  const keywordHits = args.store.keywordSearch
    ? await args.store.keywordSearch({ query: args.query, scope: args.scope, topK })
    : []
  return { keyword: keywordHits, vector: vectorHits }
}
const retrieve = async (args: RetrieveArgs): Promise<Candidate[]> => {
  const topK = args.topK ?? 20
  const technique = args.technique ?? 'arithmetic_mean'
  const kw = Math.min(Math.max(args.keywordWeight ?? 0.3, 0), 1)
  const vector = await queryVector(args)
  const model = args.embedder?.dimension === undefined ? 'default' : String(args.embedder.dimension)
  const { keyword, vector: vec } = await legs({ args, model, topK, vector })
  const vecRank = rankOf(vec)
  const kwRank = rankOf(keyword)
  const ids = [...new Set([...vec.map(h => h.chunkId), ...keyword.map(h => h.chunkId)])]
  const vScores = normalise(ids.map(id => vecRank.get(id)?.score ?? 0))
  const kScores = normalise(ids.map(id => kwRank.get(id)?.score ?? 0))
  const fused = ids.map((id, i) => {
    const v = vScores[i] ?? 0
    const k = kScores[i] ?? 0
    const score =
      technique === 'reciprocal_rank_fusion'
        ? (1 - kw) / (RRF_K + (vecRank.get(id)?.rank ?? topK * 2)) + kw / (RRF_K + (kwRank.get(id)?.rank ?? topK * 2))
        : combine(technique, v * (1 - kw) * 2, k * kw * 2)
    return { id, score }
  })
  fused.sort((a, b) => b.score - a.score)
  const text = args.textOf ?? ((): string => '')
  /** Near-duplicate removal AFTER fusion and BEFORE rerank: two windows over one table otherwise spend
   * the budget that decides answers, and dropping them later would waste the reranker on both. */
  const kept = fused.filter(dedupe(text))
  const order = args.reranker ? await args.reranker.rerank({ query: args.query, texts: kept.map(f => text(f.id)) }) : []
  const ranked = args.reranker
    ? kept.map((f, i) => withRerank(f, order[i] ?? 0)).toSorted((a, b) => (b.rerank ?? 0) - (a.rerank ?? 0))
    : kept.map(f => withRerank(f, null))
  const hitOf = new Map([...vec, ...keyword].map(h => [h.chunkId, h]))
  return ranked.map((f, i) => ({
    assembled: false,
    bm25Rank: kwRank.get(f.id)?.rank ?? null,
    bm25Score: kwRank.get(f.id)?.score ?? null,
    chunkId: f.id,
    chunkText: text(f.id),
    documentId: hitOf.get(f.id)?.documentId ?? null,
    documentName: '',
    /** Delivery order, which ascends with gaps where the duplicate filter removed a member; the fused
     * rank travels with its candidate and carries no ordering once a reranker has sorted by score. */
    finalRank: i + 1,
    fusedRank: fused.findIndex(x => x.id === f.id) + 1,
    rerankScore: f.rerank,
    vectorRank: vecRank.get(f.id)?.rank ?? null,
    vectorScore: vecRank.get(f.id)?.score ?? null
  }))
}
export { retrieve }
export type { RetrieveArgs }
