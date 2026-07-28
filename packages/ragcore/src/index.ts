/** The RAG engine minus the store: a document in, retrievable chunks with provenance out, and the
 * retrieval logic that ranks them.
 *
 * This is deliberately NOT a whole RAG engine. Retrieval — query understanding, hybrid search,
 * fusion, reranking and the graph index — needs a store interface and a record store, and neither
 * belongs here. What this package owns is everything upstream of the index: deciding how each page
 * should be read, reading it, splitting it, and keeping every chunk pointing back at the pixels it
 * came from.
 *
 * Each step stands alone, so a consumer that already parses its own documents can take only the
 * chunker, and one that already chunks can take only the provenance bridge:
 *
 *   configureEngine({ DOCLING_URL: '…', PROVIDERS_FILE: './providers.toml' })
 *   const parsed = await parseDocument({ bytes, name: 'policy.pdf' })
 *   const chunks = await buildChunks({
 *     blocks: parsed.blocks,
 *     markdown: parsed.markdown,
 *     maxSize: 800,
 *     overlap: 120,
 *     strategy: 'recursive'
 *   })
 *   const { vectors } = await embedTexts(model, chunks.map(c => c.text))
 *
 * Every chunk carries its `charspan` into the markdown and its `regions` on the page, so a citation
 * resolves to a box a reader can be shown rather than to a number they must trust.
 */
export { buildChunks, checksumOf, chunkerVersion } from './chunker'
export type { EngineConfig } from './engine-config'
/** Supply the world the engine reads — service URLs and the provider registry — so nothing here
 * reaches for a database url, an auth secret or a search endpoint it never uses. */
export { configureEngine } from './engine-config'
/** The domain vocabulary every stage speaks. `Geometry` decides which anchors are legal: a spatial
 * parse admits region anchors, a grid parse admits cell anchors, and a text-only parse admits neither. */
export type { Anchor, Bbox, Block, Charspan, ChunkStrategy, Geometry, PageDim, Region } from './lib'
/** The offset-to-region bridge — the one capability here no library owns. It joins a chunker's
 * character offsets to a parser's element geometry, which is what makes a chunk locatable on a page. */
export {
  blockChunks,
  buildRegionIndex,
  locateChunks,
  markdownOf,
  MIN_REGION_WIDTH,
  positionBlocks,
  regionsFor
} from './lib'
export type { Positioned, RegionIndex } from './lib'
export { embedTexts, listModelsByRole } from './models'
export {
  bm25Rank,
  doubleWeights,
  ensureIndex,
  ensureVectorField,
  hybridSearch,
  indexChunkDoc,
  knnSearch,
  refresh,
  searchBm25
} from './opensearch'
export { parseDocument } from './parse'
export { lostInTheMiddle } from './rerank-order'
/** Per-page routing and the thresholds behind it, exposed so a consumer can inspect or override the
 * decision. `routePage` reports WHY a page escalated, never only that it did. */
export { CHAR_MIN, CTRL_MAX, MOJIBAKE_MAX, routePage, VALID_MIN, withoutMinerU } from './router'
export { hamming, simhash } from './simhash'
