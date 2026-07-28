type Anchor = 'cell' | 'charspan' | 'region'
type Bbox = readonly [number, number, number, number]
interface Block {
  readonly bbox: Bbox | null
  readonly cell?: Cell
  readonly kind?: string
  readonly page: number
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
export { chunkStrategies, fusionTechniques, PUBLICATION_CAPABILITIES }
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
  ParseStatus,
  PoolStatus,
  ProjectId,
  PublicationCapability,
  PublicationId,
  Region,
  SeedStatus,
  TurnId
}
