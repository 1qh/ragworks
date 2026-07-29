import type { Block, ChunkId, ChunkSetId, DocumentId, Geometry, PageDim } from './domain'
/** Text to vectors. The core batches and orders; the consumer supplies the model. */
interface Embedder {
  readonly dimension?: number
  readonly embed: (texts: readonly string[]) => Promise<readonly (readonly number[])[]>
}
/** Producing an answer from assembled context. A consumer running zero model calls omits it and uses
 * the core for retrieval alone, which is a supported way to adopt this. */
interface Generator {
  readonly generate: (args: { readonly context: string; readonly question: string }) => Promise<{ readonly text: string }>
}
/** The collaborators the core cannot compute for itself, declared as interfaces so a consumer brings
 * their own. This file is TYPES ONLY and imports nothing that runs — a port that dragged an
 * implementation in would make the core depend on the very thing it exists to abstract.
 *
 * The design point that decides whether this works against ANY vector database: most stores offer
 * vector search and nothing else. Requiring keyword search or a native hybrid query would exclude
 * them, so only the vector half is REQUIRED and the rest are optional capabilities. A store that
 * cannot fuse says so by omitting the method, and the core fuses the two result lists itself — which
 * it can, because ranking and fusion are core logic rather than store features. */
/** One retrieval result, as any store can express it. */
interface Hit {
  readonly chunkId: ChunkId
  readonly documentId?: DocumentId | null
  /** The store's own score. Left null when this method did not surface the chunk, never zero — a
   * missing method and a true zero are different facts and the trace must keep them apart. */
  readonly score: null | number
}
/** Turning bytes into blocks with geometry. The core owns what to DO with blocks; it cannot own
 * every document format, so a consumer brings the parser they already run. */
interface Parser {
  readonly parse: (args: { readonly bytes: Uint8Array; readonly name: string }) => Promise<{
    readonly blocks: readonly Block[]
    readonly geometry: Geometry
    readonly markdown: string
    readonly pages: readonly PageDim[]
  }>
}
/** Everything a consumer may supply. Every field is optional because every stage is optional: a
 * consumer who only wants chunk-with-provenance supplies nothing at all. */
interface Ports {
  readonly embedder?: Embedder
  readonly generator?: Generator
  readonly parser?: Parser
  readonly reranker?: Reranker
  readonly store?: VectorStore
}
/** Reordering candidates by relevance to the query. Absent, the core keeps the fused order — the
 * rerank stage fails open by design. */
interface Reranker {
  readonly rerank: (args: { readonly query: string; readonly texts: readonly string[] }) => Promise<readonly number[]>
}
interface SearchScope {
  readonly chunkSetIds: readonly ChunkSetId[]
  readonly owner?: null | string
}
/** One chunk as the store holds it: the text a keyword index needs, the vectors a k-NN index needs,
 * and the fields every query filters on. */
interface StoredChunk {
  readonly chunkSetId: ChunkSetId
  readonly documentId: DocumentId
  readonly enabled: boolean
  readonly id: ChunkId
  /** Scoping key for a host with per-user isolation; a single-tenant consumer leaves it undefined. */
  readonly owner?: null | string
  readonly text: string
  /** Keyed by model ref, so one chunk can carry a vector per embedding model without a second store. */
  readonly vectors: Readonly<Record<string, readonly number[]>>
}
/** What the core needs from a vector database. Implement the required half and the core works; add
 * an optional method and the core uses it in preference to doing that work itself. */
interface VectorStore {
  /** OPTIONAL. Prepare a vector field for a model at a dimension, where the store needs telling. */
  readonly ensureModel?: (model: string, dim: number) => Promise<void>
  /** OPTIONAL. A native hybrid query. Omit it and the core fuses the keyword and vector lists with
   * its own ranking, which is where fusion belongs anyway; implement it when the store fuses better
   * than two round trips can. */
  readonly hybridSearch?: (args: {
    readonly model: string
    readonly query: string
    readonly scope: SearchScope
    readonly topK: number
    readonly vector: readonly number[]
  }) => Promise<readonly Hit[]>
  /** REQUIRED. Every chunk id the store holds for one set, so the core can reconcile itself against
   * the consumer's own record store and heal drift without the store knowing what drift is. */
  readonly idsInSet: (chunkSetId: ChunkSetId) => Promise<readonly ChunkId[]>
  /** OPTIONAL. Keyword search. Omit it and the core runs vector-only rather than failing — a store
   * without a text index is a legitimate store, not a broken one. */
  readonly keywordSearch?: (args: {
    readonly query: string
    readonly scope: SearchScope
    readonly topK: number
  }) => Promise<readonly Hit[]>
  /** OPTIONAL. Make recent writes visible now. A store that is immediately consistent omits it. */
  readonly refresh?: () => Promise<void>
  /** REQUIRED. Remove one chunk by id. */
  readonly remove: (chunkId: ChunkId) => Promise<void>
  /** REQUIRED. Nearest neighbours for a query vector under one model, within scope. */
  readonly search: (args: {
    readonly model: string
    readonly scope: SearchScope
    readonly topK: number
    readonly vector: readonly number[]
  }) => Promise<readonly Hit[]>
  /** REQUIRED. Upsert one chunk, keyed by its id — the core replays, so this is idempotent. */
  readonly upsert: (chunk: StoredChunk) => Promise<void>
}
export type { Embedder, Generator, Hit, Parser, Ports, Reranker, SearchScope, StoredChunk, VectorStore }
