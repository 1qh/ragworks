type Anchor = 'cell' | 'charspan' | 'region'
type Bbox = readonly [number, number, number, number]
interface Block {
  readonly bbox: Bbox | null
  readonly cell?: Cell
  readonly kind?: string
  readonly page: number
  /** A table row whose text already names the column and group of every cell it holds, because the grid
   * describer writes those labels into the row itself. Such a row needs no sibling row for context, and a
   * consumer that prefixes one costs discrimination rather than adding it: on a table of near-identical
   * rows the prefixed row's figures appear in every passage, so a reader can return the wrong row's number
   * and a retriever sees passages half-composed of identical text. A row from a parse that emits a
   * separate header row carries no such labels and still wants that header prefixed. */
  readonly selfLabeled?: boolean
  readonly text: string
}
type Brand<T, B extends string> = T & { readonly __brand: B }
interface Candidate {
  readonly assembled: boolean
  readonly bm25Rank: null | number
  readonly bm25Score: null | number
  readonly chunkId: ChunkId | null
  readonly chunkText: string
  readonly documentId: DocumentId | null
  readonly documentName: string
  readonly finalRank: number
  readonly fusedRank: number
  readonly rerankScore: null | number
  readonly vectorRank: null | number
  readonly vectorScore: null | number
}
interface Cell {
  readonly col: number
  readonly page: number
  readonly row: number
  readonly table: number
}
type Charspan = readonly [number, number]
type ChunkId = Brand<string, 'ChunkId'>
type ChunkSetId = Brand<string, 'ChunkSetId'>
type ChunkStatus = 'disabled' | 'embedded' | 'embedding' | 'embedding_failed' | 'embedding_pending' | 'stale'
type ClientEventOp = 'batch' | 'delete' | 'insert' | 'update'
type ClientEventResource =
  | 'chunk'
  | 'chunkSet'
  | 'conversation'
  | 'document'
  | 'embedding'
  | 'feedback'
  | 'folder'
  | 'parse'
  | 'project'
  | 'turn'
type ConversationId = Brand<string, 'ConversationId'>
type DocumentId = Brand<string, 'DocumentId'>
type ExternalServerId = Brand<string, 'ExternalServerId'>
interface FeedbackArtifact {
  id: string
  kind: ClientEventResource
}
interface FeedbackContext {
  chunkSetId?: string
  clientState?: string
  documentId?: string
  parseId?: string
  projectId?: string
  route?: string
  sha?: string
  turnId?: string
}
type FeedbackKind = 'bug' | 'interview' | 'note' | 'wish'
interface FeedbackReproduction {
  after: string
  before: string
  reproducedAt: string
  verified: boolean
}
type FeedbackStatus = 'open' | 'reproduced' | 'resolved'
type FolderId = Brand<string, 'FolderId'>
type Geometry = 'grid' | 'none' | 'spatial'
type JobStatus = 'done' | 'failed' | 'queued' | 'running'
type Lineage = 'agent' | 'product'
type OwnerId = Brand<string, 'OwnerId'>
interface PageDim {
  readonly height: number
  readonly pageNo: number
  readonly width: number
}
type ParseId = Brand<string, 'ParseId'>
type ParseStatus = 'parse_failed' | 'parsed' | 'parsing' | 'pending'
type PoolStatus = 'building' | 'claimed' | 'failed' | 'ready'
type ProjectId = Brand<string, 'ProjectId'>
type PublicationId = Brand<string, 'PublicationId'>
interface Region {
  readonly bbox: Bbox
  readonly page: number
}
type SeedStatus = 'cloning' | 'failed' | 'indexing' | 'ready'
type TurnId = Brand<string, 'TurnId'>
const PUBLICATION_CAPABILITIES = [
  'assemble-context',
  'fetch-region',
  'get-project',
  'preview-retrieval',
  'render-page',
  'retrieve'
] as const
type PublicationCapability = (typeof PUBLICATION_CAPABILITIES)[number]
const chunkStrategies = [
  'character',
  'hierarchical',
  'markdown',
  'recursive',
  'semantic',
  'sentence',
  'structural',
  'token'
] as const
type ChunkStrategy = (typeof chunkStrategies)[number]
const fusionTechniques = ['arithmetic_mean', 'geometric_mean', 'harmonic_mean', 'reciprocal_rank_fusion'] as const
interface ChunkParentEdge {
  childId: ChunkId
  parentId: ChunkId
}
type FusionTechnique = (typeof fusionTechniques)[number]
/** What every parser returns, whoever ran it — so it sits with the types it is built from rather than
 * inside one engine's adapter, where each new engine would import a competitor to describe itself. */
interface ParseResult {
  blocks: Block[]
  engine: string
  geometry: Geometry
  markdown: string
  pages: PageDim[]
}
/** A parse's renderable-geometry class, read off the blocks themselves — grid when any block carries a
 * cell, spatial when any carries a box, else none. It decides which editor is the source of truth, so
 * it belongs beside the types it reads and NOT inside any one parser: every engine's blocks answer it
 * the same way, and an engine that owned it would make the answer depend on who parsed the page. */
const geometryOf = (blocks: readonly Block[]): Geometry => {
  if (blocks.some(b => b.cell !== undefined)) return 'grid'
  if (blocks.some(b => b.bbox !== null)) return 'spatial'
  return 'none'
}
export { chunkStrategies, fusionTechniques, geometryOf, PUBLICATION_CAPABILITIES }
export type {
  Anchor,
  Bbox,
  Block,
  Brand,
  Candidate,
  Cell,
  Charspan,
  ChunkId,
  ChunkParentEdge,
  ChunkSetId,
  ChunkStatus,
  ChunkStrategy,
  ClientEventOp,
  ClientEventResource,
  ConversationId,
  DocumentId,
  ExternalServerId,
  FeedbackArtifact,
  FeedbackContext,
  FeedbackKind,
  FeedbackReproduction,
  FeedbackStatus,
  FolderId,
  FusionTechnique,
  Geometry,
  JobStatus,
  Lineage,
  OwnerId,
  PageDim,
  ParseId,
  ParseResult,
  ParseStatus,
  PoolStatus,
  ProjectId,
  PublicationCapability,
  PublicationId,
  Region,
  SeedStatus,
  TurnId
}
