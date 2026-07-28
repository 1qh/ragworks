/** The domain surface the engine needs, named explicitly rather than re-exported wholesale: the
 * geometry and anchor vocabulary every stage speaks, the pure offset-to-region bridge that joins a
 * chunker's character offsets to a parser's element geometry, and the invariant helper. Nothing
 * here knows what a database is. */
export {
  blockChunks,
  buildRegionIndex,
  locateChunks,
  markdownOf,
  MIN_REGION_WIDTH,
  positionBlocks,
  regionsFor
} from './bridge'
export type { Positioned, RegionIndex } from './bridge'
export { chunkStrategies, fusionTechniques } from './domain'
export type {
  Anchor,
  Bbox,
  Block,
  Cell,
  Charspan,
  ChunkId,
  ChunkSetId,
  ChunkStrategy,
  DocumentId,
  FusionTechnique,
  Geometry,
  OwnerId,
  PageDim,
  Region
} from './domain'
export { invariant } from './invariant'
