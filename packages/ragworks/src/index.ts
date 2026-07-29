/** The RAG engine minus the store: a document in, retrievable chunks with provenance out, and the
 * retrieval logic that ranks them.
 *
 * The shape is a PURE core plus PORTS. The core computes and reaches for nothing — chunking, the
 * offset-to-region provenance bridge, per-page routing decisions, fusion and rerank ordering,
 * near-duplicate detection — so it runs in a browser, a worker or a test with no services standing.
 * Everything it cannot compute for itself is declared as an interface a consumer satisfies: a parser,
 * an embedder, a vector store, a reranker, a generator. That is what lets it run against ANY vector
 * database rather than the one its author happens to deploy, and only the VECTOR half of a store is
 * required — a store with no keyword index is a legitimate store, and the core fuses for it.
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
/** The document-local colour vocabulary a grid parse carries: a fill is admitted as a signal only when
 * it is saturated enough to be deliberate, so a page's own palette names its cells. */
export { cellColorName, colorName, dominantColor, fillColor, isSaturated, nearestLabel } from './cell-color'
export type { PixelPlane, Rgb } from './cell-color'
/** Semantic chunking beside the recursive splitter, and the page-quality signal the router reads. */
export { pageBadness, semanticChunk } from './chonkie'
export type { SemanticChunk } from './chonkie'
export { buildChunks, checksumOf, chunkerVersion } from './chunker'
/** A third extraction engine and the converter that puts its output in the shape the grid describer reads. */
export { datalabOcr, toChandraHtml } from './datalab'
/** What every parse path returns — the blocks, the markdown they join to, the page dimensions and the
 * engine that produced them — so a consumer can hold a parse from any engine in one type. */
export type { ParseResult } from './domain'
/** The row-level embedding cache keyed by text hash plus model, so an upstream chunk-config change
 * re-embeds only the text that actually changed. */
export { cachedContext, cachedVectors, storeContext, storeVectors } from './embed-cache'
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
/** Office and spreadsheet documents rendered to the PDF the parse path reads. */
export { mupdfInput, officeToPdf, xlsToXlsx } from './office-render'
export { parseDocument } from './parse'
/** The collaborators a consumer supplies — parser, embedder, vector store, reranker, generator —
 * declared as interfaces so the engine runs against ANY of them. Only the vector half of a store is
 * required; keyword and hybrid search are optional capabilities, and the core fuses for a store that
 * lacks them rather than refusing to work with it. */
export type { Embedder, Generator, Hit, Parser, Ports, Reranker, SearchScope, StoredChunk, VectorStore } from './ports'
/** The per-stage price table behind cost metering; a consumer-supplied stage is free, a provider one priced. */
export { priceOf } from './pricing'
export { lostInTheMiddle, maximalMarginalRelevance } from './rerank-order'
export type { MmrArgs, MmrItem } from './rerank-order'
/** Word re-spacing over a parse whose engine lost the spaces between glyphs, corroborated across
 * engines so a single engine's guess never rewrites text the others agree on. */
export { FUSED_MIN, respaceBlocks, respaceText } from './respace'
/** Per-page routing and the thresholds behind it, exposed so a consumer can inspect or override the
 * decision. `routePage` reports WHY a page escalated, never only that it did. */
export { CHAR_MIN, CTRL_MAX, MOJIBAKE_MAX, routePage, VALID_MIN, withoutMinerU } from './router'
export type { PageSignal, Route } from './router'
/** A spreadsheet read as a grid rather than rendered, so each sheet's cells keep their row and column. */
export { isSheet, parseSheet } from './sheet'
export { hamming, simhash } from './simhash'
/** Tighten a block's box onto the ink it actually contains, so a region drawn from engine geometry
 * sits over the glyphs rather than the whitespace the engine reported around them. */
export { INK_CONTRAST, RENDER_SCALE_INK, snapBlocksToInk } from './snap-ink'
