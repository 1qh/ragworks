import { Client, errors } from '@opensearch-project/opensearch'
import { handleWhen } from 'cockatiel'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { ChunkId, ChunkSetId, DocumentId, FusionTechnique, OwnerId } from './lib'
import { mapPool } from './concurrency'
import { engineEnv as env } from './engine-config'
import { log } from './log'
import { makeResilient } from './resilience'
/** Retrieval needs a store, and an ingest-only consumer never configures one — so these fail at the
 * point of use naming themselves, rather than being globally required or silently defaulted to an
 * endpoint nobody asked for. */
const indexName = (): string => {
  const name = env.OPENSEARCH_INDEX
  if (name === undefined) throw new Error('ragcore: OPENSEARCH_INDEX is not configured — retrieval needs an index')
  return name
}
let cached: Client | null = null
const client = (): Client => {
  const node = env.OPENSEARCH_URL
  if (node === undefined) throw new Error('ragcore: OPENSEARCH_URL is not configured — retrieval needs a store')
  cached ??= new Client({ node })
  return cached
}
interface ChunkDoc {
  chunkId: ChunkId
  chunkSetId: ChunkSetId
  documentId: DocumentId
  enabled: boolean
  ownerId: OwnerId
  text: string
  vectors: ChunkVector[]
}
interface ChunkVector {
  model: string
  vec: number[]
}
interface Hit {
  chunkId: ChunkId
  documentId: DocumentId | null
  rank: number
  score: number
}
const searchResponseSchema = z.object({
  hits: z.object({
    hits: z.array(
      // oxlint-disable-next-line unicorn/max-nested-calls
      z.object({
        // oxlint-disable-next-line unicorn/max-nested-calls
        _id: z.string(),
        // oxlint-disable-next-line unicorn/max-nested-calls
        _score: z.number().nullable().optional(),
        // oxlint-disable-next-line unicorn/max-nested-calls
        _source: z.object({ chunkId: z.string().optional(), documentId: z.string().optional() }).optional()
      })
    )
  })
})
interface RawHit {
  _id: string
  _score?: null | number
  _source?: { chunkId?: string; documentId?: string }
}
const vecField = (model: string): string => `vec_${createHash('sha256').update(model).digest('hex').slice(0, 16)}`
const chunkIdOf = (h: RawHit): ChunkId => (h._source?.chunkId as ChunkId | undefined) ?? (h._id as ChunkId)
const dedupeHits = (hits: RawHit[]): Hit[] => {
  const seen = new Set<string>()
  const out: Hit[] = []
  for (const h of hits) {
    const chunkId = chunkIdOf(h)
    if (!seen.has(chunkId)) {
      seen.add(chunkId)
      out.push({
        chunkId,
        documentId: (h._source?.documentId as DocumentId | undefined) ?? null,
        rank: out.length + 1,
        score: h._score ?? 0
      })
    }
  }
  return out
}
const is404 = (error: unknown): boolean => error instanceof errors.ResponseError && error.meta.statusCode === 404
const resilient = makeResilient(
  // oxlint-disable-next-line promise/prefer-await-to-callbacks
  handleWhen(error => !is404(error))
)
const isAlreadyExists = (error: unknown): boolean =>
  error instanceof errors.ResponseError &&
  (error.meta.body as undefined | { error?: { type?: string } })?.error?.type === 'resource_already_exists_exception'
const createChunkIndex = async (index: string): Promise<void> => {
  try {
    await client().indices.create({
      body: {
        mappings: {
          properties: {
            chunkId: { type: 'keyword' },
            chunkSetId: { type: 'keyword' },
            documentId: { type: 'keyword' },
            enabled: { type: 'boolean' },
            ownerId: { type: 'keyword' },
            text: { analyzer: 'standard', type: 'text' }
          }
        },
        settings: { index: { knn: true } }
      },
      index
    })
  } catch (createError) {
    if (!isAlreadyExists(createError)) throw createError
  }
}
const ensureIndex = async (): Promise<void> => {
  const exists = await client().indices.exists({ index: indexName() })
  if (exists.body) return
  await createChunkIndex(indexName())
}
const idsForChunk = async (chunkId: ChunkId): Promise<string[]> => {
  try {
    const res = await resilient(async () =>
      client().search({ body: { _source: false, query: { term: { chunkId } }, size: 100 }, index: indexName() })
    )
    return searchResponseSchema.parse(res.body).hits.hits.map(h => h._id)
  } catch (lookupError) {
    if (is404(lookupError)) return []
    throw lookupError
  }
}
let refreshUnsupported = false
const safeRefresh = async (): Promise<void> => {
  if (refreshUnsupported) return
  try {
    await client().indices.refresh({ index: indexName() })
  } catch (refreshError) {
    if (is404(refreshError)) {
      let indexPresent = false
      try {
        indexPresent = (await client().indices.exists({ index: indexName() })).body
      } catch {
        /* exists-check failed — treat as absent and do not latch */
      }
      if (indexPresent) {
        refreshUnsupported = true
        log.info('index refresh disabled — serverless vector collection refreshes automatically')
      }
      return
    }
    log.warn({ refreshError }, 'index refresh failed')
  }
}
const isRefreshUnsupported = (): boolean => refreshUnsupported
const deleteByIds = async (ids: string[], withRefresh: boolean): Promise<void> => {
  if (ids.length === 0) return
  await resilient(async () => client().bulk({ body: ids.flatMap(id => [{ delete: { _id: id, _index: indexName() } }]) }))
  if (withRefresh) await safeRefresh()
}
const vectorFields = (vectors: ChunkVector[]): Record<string, number[]> =>
  Object.fromEntries(vectors.map(v => [vecField(v.model), v.vec]))
const indexChunkDoc = async (doc: ChunkDoc, withRefresh = false): Promise<void> => {
  await deleteByIds(await idsForChunk(doc.chunkId), false)
  await resilient(async () =>
    client().index({
      body: {
        chunkId: doc.chunkId,
        chunkSetId: doc.chunkSetId,
        documentId: doc.documentId,
        enabled: doc.enabled,
        ownerId: doc.ownerId,
        text: doc.text,
        ...vectorFields(doc.vectors)
      },
      index: indexName()
    })
  )
  if (withRefresh) await safeRefresh()
}
const BULK_INDEX_BATCH = 250
const BULK_INDEX_POOL = 6
const bulkDocBody = (doc: ChunkDoc): Record<string, unknown> => ({
  chunkId: doc.chunkId,
  chunkSetId: doc.chunkSetId,
  documentId: doc.documentId,
  enabled: doc.enabled,
  ownerId: doc.ownerId,
  text: doc.text,
  ...vectorFields(doc.vectors)
})
const bulkIndexNewChunkDocs = async (docs: readonly ChunkDoc[]): Promise<void> => {
  const batches: ChunkDoc[][] = []
  for (let i = 0; i < docs.length; i += BULK_INDEX_BATCH) batches.push(docs.slice(i, i + BULK_INDEX_BATCH))
  await mapPool(batches, BULK_INDEX_POOL, async slice => {
    const body = slice.flatMap(doc => [{ index: { _index: indexName() } }, bulkDocBody(doc)])
    const res = await resilient(async () => client().bulk({ body }))
    const parsed = res.body as { errors?: boolean; items?: { index?: { error?: unknown } }[] }
    if (parsed.errors === true) {
      const firstErr = parsed.items?.find(it => it.index?.error !== undefined)?.index?.error
      throw new Error(`bulk index reported errors: ${JSON.stringify(firstErr)}`)
    }
  })
  await safeRefresh()
}
const deleteChunk = async (chunkId: ChunkId, withRefresh = false): Promise<void> => {
  await safeRefresh()
  await deleteByIds(await idsForChunk(chunkId), withRefresh)
}
const deleteBySetIds = async (chunkSetIds: ChunkSetId[]): Promise<void> => {
  if (chunkSetIds.length === 0) return
  try {
    await resilient(async () =>
      client().deleteByQuery({ body: { query: { terms: { chunkSetId: chunkSetIds } } }, index: indexName() })
    )
    await safeRefresh()
  } catch (deleteError) {
    if (is404(deleteError)) return
    throw new Error(
      `delete-by-query failed for ${String(chunkSetIds.length)} chunk set(s): the caller must not proceed to delete their rows, or the index docs become orphans no reconcile can find — ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`,
      { cause: deleteError }
    )
  }
}
const setTerm = (chunkSetIds: ChunkSetId[]): Record<string, unknown> =>
  chunkSetIds.length === 1 ? { term: { chunkSetId: chunkSetIds[0] } } : { terms: { chunkSetId: chunkSetIds } }
const ownerTerm = (): Record<string, unknown>[] => {
  const owner = env.currentOwner?.() ?? null
  return owner ? [{ term: { ownerId: owner } }] : []
}
const searchBm25 = async (chunkSetIds: ChunkSetId[], queryText: string, topK: number): Promise<Hit[]> => {
  try {
    const res = await resilient(async () =>
      client().search({
        body: {
          _source: ['documentId', 'chunkId'],
          query: {
            bool: {
              filter: [setTerm(chunkSetIds), { term: { enabled: true } }, ...ownerTerm()],
              must: [{ match: { text: queryText } }]
            }
          },
          size: topK
        },
        index: indexName()
      })
    )
    const body = searchResponseSchema.parse(res.body)
    return dedupeHits(body.hits.hits)
  } catch (searchError) {
    if (is404(searchError)) return []
    throw searchError
  }
}
const searchCorpus = async (queryText: string, topK: number): Promise<Hit[]> => {
  try {
    const res = await resilient(async () =>
      client().search({
        body: {
          _source: ['documentId', 'chunkId'],
          query: {
            bool: {
              filter: [{ term: { enabled: true } }, ...ownerTerm()],
              must: [{ match: { text: queryText } }]
            }
          },
          size: topK
        },
        index: indexName()
      })
    )
    return dedupeHits(searchResponseSchema.parse(res.body).hits.hits)
  } catch (searchError) {
    if (is404(searchError)) return []
    throw searchError
  }
}
const bm25Rank = async ({
  chunkId,
  chunkSetIds,
  queryText,
  topK
}: {
  chunkId: ChunkId
  chunkSetIds: ChunkSetId[]
  queryText: string
  topK: number
}): Promise<Hit | null> => (await searchBm25(chunkSetIds, queryText, topK)).find(h => h.chunkId === chunkId) ?? null
const setChunkIds = async (chunkSetId: ChunkSetId): Promise<ChunkId[]> => {
  try {
    const res = await resilient(async () =>
      client().search({
        body: { _source: ['chunkId'], query: { term: { chunkSetId } }, size: 10_000 },
        index: indexName()
      })
    )
    const body = searchResponseSchema.parse(res.body)
    if (body.hits.hits.length >= 10_000)
      log.warn({ chunkSetId }, 'setChunkIds hit the 10k index window — reconcile may miss orphans')
    return [...new Set(body.hits.hits.map(chunkIdOf))]
  } catch (listError) {
    if (is404(listError)) return []
    throw listError
  }
}
const refresh = async (): Promise<void> => {
  await safeRefresh()
}
const searchReachable = async (): Promise<void> => {
  await client().indices.exists({ index: indexName() })
}
const infoSchema = z.object({
  version: z.object({ distribution: z.string().optional(), number: z.string().optional() }).optional()
})
const storeInfo = async (): Promise<{
  distribution: string
  flavor: string
  refreshSupported: boolean
  version: string
}> => {
  let distribution = 'unknown'
  let version = 'unknown'
  try {
    const info = await client().info()
    const v = infoSchema.parse(info.body).version
    distribution = v?.distribution ?? 'opensearch'
    version = v?.number ?? 'unknown'
  } catch (infoError) {
    log.warn({ infoError }, 'search store info unavailable')
  }
  await safeRefresh()
  const refreshSupported = !isRefreshUnsupported()
  return { distribution, flavor: refreshSupported ? 'self-managed' : 'managed-serverless', refreshSupported, version }
}
const countResponseSchema = z.object({ count: z.number() })
const searchableCount = async (chunkSetIds: ChunkSetId[]): Promise<number> => {
  if (chunkSetIds.length === 0) return 0
  try {
    const res = await resilient(async () =>
      client().count({ body: { query: { terms: { chunkSetId: chunkSetIds } } }, index: indexName() })
    )
    return countResponseSchema.parse(res.body).count
  } catch (countError) {
    if (is404(countError)) return 0
    throw countError
  }
}
const indexMappingSchema = z.record(
  z.string(),
  z.object({
    // oxlint-disable-next-line unicorn/max-nested-calls
    mappings: z.object({ properties: z.record(z.string(), z.unknown()).default({}) }).optional()
  })
)
const hasVectorField = async (field: string): Promise<boolean> => {
  const res = await client().indices.getMapping({ index: indexName() })
  const props = indexMappingSchema.parse(res.body)[indexName()]?.mappings?.properties ?? {}
  return field in props
}
const putVectorField = async (index: string, model: string, dim: number): Promise<void> => {
  const field = vecField(model)
  await client().indices.putMapping({
    body: {
      properties: {
        [field]: {
          dimension: dim,
          method: {
            engine: 'faiss',
            name: 'hnsw',
            parameters: { encoder: { name: 'sq', parameters: { type: 'fp16' } } },
            space_type: 'cosinesimil'
          },
          type: 'knn_vector'
        }
      }
    },
    index
  })
}
const ensureVectorField = async (model: string, dim: number): Promise<void> => {
  await ensureIndex()
  if (await hasVectorField(vecField(model))) return
  await putVectorField(indexName(), model, dim)
}
const asIdRecord = (m: ReadonlyMap<string, string>): Record<string, string> => Object.fromEntries(m)
const reindexOwnerChunks = async (input: {
  chunkMap: ReadonlyMap<string, string>
  documentMap: ReadonlyMap<string, string>
  setMap: ReadonlyMap<string, string>
  source: string
  target: string
  vectors: readonly { dim: number; model: string }[]
}): Promise<void> => {
  const live = indexName()
  const scratch = `${live}_clone_${input.target
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/gu, '')
    .slice(0, 20)}`
  await safeRefresh()
  await resilient(async () => client().indices.delete({ ignore_unavailable: true, index: scratch }))
  await createChunkIndex(scratch)
  await Promise.all(input.vectors.map(async v => putVectorField(scratch, v.model, v.dim)))
  try {
    await resilient(async () =>
      client().reindex({
        body: {
          dest: { index: scratch },
          script: {
            lang: 'painless',
            params: {
              chunks: asIdRecord(input.chunkMap),
              docs: asIdRecord(input.documentMap),
              owner: input.target,
              sets: asIdRecord(input.setMap)
            },
            source: `
              if (!params.chunks.containsKey(ctx._source.chunkId)) { ctx.op = 'noop'; }
              else {
                ctx._id = null;
                ctx._source.ownerId = params.owner;
                ctx._source.chunkId = params.chunks.get(ctx._source.chunkId);
                if (ctx._source.chunkSetId != null && params.sets.containsKey(ctx._source.chunkSetId)) {
                  ctx._source.chunkSetId = params.sets.get(ctx._source.chunkSetId);
                }
                if (ctx._source.documentId != null && params.docs.containsKey(ctx._source.documentId)) {
                  ctx._source.documentId = params.docs.get(ctx._source.documentId);
                }
              }`
          },
          source: { index: live, query: { term: { ownerId: input.source } }, size: 1000 }
        },
        refresh: true,
        wait_for_completion: true
      })
    )
    await resilient(async () =>
      client().reindex({
        body: { dest: { index: live }, source: { index: scratch, size: 1000 } },
        refresh: true,
        wait_for_completion: true
      })
    )
  } finally {
    await resilient(async () => client().indices.delete({ ignore_unavailable: true, index: scratch }))
  }
}
const scopeFilter = (chunkSetIds: ChunkSetId[]): Record<string, unknown>[] => [
  setTerm(chunkSetIds),
  { term: { enabled: true } },
  ...ownerTerm()
]
const knnClause = (args: {
  efSearch?: number
  filter: Record<string, unknown>[]
  model: string
  queryVec: number[]
  topK: number
}): Record<string, unknown> => ({
  [vecField(args.model)]: {
    filter: { bool: { filter: args.filter } },
    k: args.topK,
    ...(args.efSearch === undefined ? {} : { method_parameters: { ef_search: args.efSearch } }),
    vector: args.queryVec
  }
})
const RRF_RANK_CONSTANT = 60
const WEIGHT_EPSILON = 1e-6
const asDouble = (n: number): number =>
  Number.isInteger(n) ? Math.min(1 - WEIGHT_EPSILON, Math.max(WEIGHT_EPSILON, n)) : n
const doubleWeights = (weights: [number, number]): [number, number] => [asDouble(weights[0]), asDouble(weights[1])]
const normalizationPipeline = (weights: [number, number], technique: FusionTechnique) =>
  technique === 'reciprocal_rank_fusion'
    ? {
        phase_results_processors: [
          { 'score-ranker-processor': { combination: { rank_constant: RRF_RANK_CONSTANT, technique: 'rrf' } } }
        ]
      }
    : {
        phase_results_processors: [
          {
            'normalization-processor': {
              combination: { parameters: { weights: doubleWeights(weights) }, technique },
              normalization: { technique: 'min_max' }
            }
          }
        ]
      }
const rawSearch = async (body: Record<string, unknown>): Promise<Hit[]> => {
  try {
    const res = await resilient(async () =>
      client().transport.request({
        body: { _source: ['documentId', 'chunkId'], ...body },
        method: 'POST',
        path: `/${indexName()}/_search`
      })
    )
    const parsed = searchResponseSchema.parse(res.body)
    return dedupeHits(parsed.hits.hits)
  } catch (searchError) {
    if (is404(searchError)) return []
    throw searchError
  }
}
const hybridSearch = async ({
  chunkSetIds,
  efSearch,
  model,
  queryText,
  queryVec,
  technique,
  topK,
  weights
}: {
  chunkSetIds: ChunkSetId[]
  efSearch?: number
  model: string
  queryText: string
  queryVec: number[]
  technique: FusionTechnique
  topK: number
  weights: [number, number]
}): Promise<Hit[]> => {
  const filter = scopeFilter(chunkSetIds)
  const hits = await rawSearch({
    query: {
      hybrid: {
        queries: [
          { bool: { filter, must: [{ match: { text: queryText } }] } },
          { knn: knnClause({ efSearch, filter, model, queryVec, topK }) }
        ]
      }
    },
    search_pipeline: normalizationPipeline(weights, technique),
    size: topK
  })
  return hits
}
const knnSearch = async ({
  chunkSetIds,
  efSearch,
  model,
  queryVec,
  topK
}: {
  chunkSetIds: ChunkSetId[]
  efSearch?: number
  model: string
  queryVec: number[]
  topK: number
}): Promise<Hit[]> => {
  const hits = await rawSearch({
    query: { knn: knnClause({ efSearch, filter: scopeFilter(chunkSetIds), model, queryVec, topK }) },
    size: topK
  })
  return hits
}
const getChunkVector = async (chunkId: ChunkId, model: string): Promise<null | number[]> => {
  const field = vecField(model)
  try {
    const res = await resilient(async () =>
      client().search({ body: { _source: [field], query: { term: { chunkId } }, size: 1 }, index: indexName() })
    )
    const parsed = z
      // oxlint-disable-next-line unicorn/max-nested-calls
      .object({ hits: z.object({ hits: z.array(z.object({ _source: z.record(z.string(), z.unknown()).optional() })) }) })
      .parse(res.body)
    return z.array(z.number()).safeParse(parsed.hits.hits[0]?._source?.[field]).data ?? null
  } catch (vectorError) {
    if (is404(vectorError)) return null
    throw vectorError
  }
}
export type { ChunkDoc, ChunkVector, Hit }
export {
  bm25Rank,
  bulkIndexNewChunkDocs,
  client,
  deleteBySetIds,
  deleteChunk,
  doubleWeights,
  ensureIndex,
  ensureVectorField,
  getChunkVector,
  hybridSearch,
  indexChunkDoc,
  indexName,
  isAlreadyExists,
  isRefreshUnsupported,
  knnSearch,
  refresh,
  reindexOwnerChunks,
  searchableCount,
  searchBm25,
  searchCorpus,
  searchReachable,
  setChunkIds,
  storeInfo,
  vecField
}
