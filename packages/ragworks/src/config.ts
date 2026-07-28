import { z } from 'zod'
import { schemas } from './generated/docling-zod'
import { chunkStrategies, fusionTechniques } from './lib'

const RETRIEVE_DEFAULTS = {
  candidateDepth: 50,
  contextBudget: 4000,
  efSearch: 100,
  fusionTechnique: 'arithmetic_mean',
  fusionWeight: 0.7,
  topK: 10
} as const
const retrieveConfig = z
  .object({
    candidateDepth: z.int().min(1).max(200).default(RETRIEVE_DEFAULTS.candidateDepth).meta({
      folder: 'Advanced',
      hint: 'Chunks the hybrid stage retrieves before rerank and cut',
      icon: 'Layers',
      unit: 'chunks'
    }),
    contextBudget: z
      .int()
      .min(500)
      .max(16_000)
      .default(RETRIEVE_DEFAULTS.contextBudget)
      .meta({ folder: 'Advanced', hint: 'Max tokens of context assembled for the answer', icon: 'Coins', unit: 'tokens' }),
    efSearch: z.int().min(1).max(1000).default(RETRIEVE_DEFAULTS.efSearch).meta({
      folder: 'Advanced',
      hint: 'HNSW search breadth — higher is more accurate vector recall, slower',
      icon: 'Radar'
    }),
    fusionTechnique: z
      .enum(fusionTechniques)
      .default(RETRIEVE_DEFAULTS.fusionTechnique)
      .meta({ folder: 'Advanced', hint: 'How the dense and keyword score lists are combined', icon: 'Combine' }),
    fusionWeight: z
      .number()
      .min(0)
      .max(1)
      .default(RETRIEVE_DEFAULTS.fusionWeight)
      .meta({ hint: 'Dense versus keyword balance — 1 is all vector, 0 is all BM25', icon: 'Scale', step: 0.05 }),
    topK: z
      .int()
      .min(1)
      .max(50)
      .default(RETRIEVE_DEFAULTS.topK)
      .meta({ hint: 'Final chunks kept after rerank, assembled into context', icon: 'Hash', unit: 'chunks' })
  })
  .extend({
    rerankModel: z.string().default('').meta({ hint: 'Cross-encoder rerank model — empty is off', icon: 'Scale' })
  })
type RetrieveConfig = z.infer<typeof retrieveConfig>
const generateConfig = z
  .object({
    maxOutputTokens: z
      .int()
      .min(1)
      .max(32_000)
      .default(2048)
      .meta({ hint: 'Cap on generated answer length', icon: 'Ruler', unit: 'tokens' }),
    seed: z
      .int()
      .min(0)
      .max(2_147_483_647)
      .default(0)
      .meta({ hint: 'Fixed seed for reproducible generation', icon: 'Dices' }),
    temperature: z
      .number()
      .min(0)
      .max(2)
      .default(0)
      .meta({ hint: 'Sampling randomness — 0 is deterministic', icon: 'Thermometer', step: 0.05 }),
    topP: z.number().min(0).max(1).default(1).meta({ hint: 'Nucleus sampling cutoff', icon: 'Filter', step: 0.05 })
  })
  .extend({ answeringModel: z.string().meta({ hint: 'Model that writes the answer' }) })
type GenerateConfig = z.infer<typeof generateConfig>
const queryConfig = retrieveConfig.extend(generateConfig.shape)
type QueryConfig = z.infer<typeof queryConfig>
const parseConfig = schemas.ConvertDocumentsOptions.pick({
  do_ocr: true,
  force_ocr: true,
  ocr_engine: true,
  pdf_backend: true,
  table_mode: true
}).extend({
  do_ocr: z.boolean().default(false),
  pipeline: z.enum(['standard', 'vlm']).default('standard'),
  vlmModel: z.string().optional()
})
type ParseConfig = z.infer<typeof parseConfig>
const chunkConfig = z.object({
  contextualRetrieval: z
    .boolean()
    .default(false)
    .meta({ hint: 'Prepend a per-chunk document-context blurb before embedding', icon: 'Sparkles' }),
  maxSize: z.int().min(1).max(8000).default(800).meta({ hint: 'Target chunk size', icon: 'Ruler', unit: 'chars' }),
  overlap: z
    .int()
    .min(0)
    .max(4000)
    .default(100)
    .meta({ hint: 'Characters shared between adjacent chunks', icon: 'Combine', unit: 'chars' }),
  strategy: z.enum(chunkStrategies).default('semantic').meta({ hint: 'Chunk boundary algorithm', icon: 'Blocks' })
})
type ChunkConfig = z.infer<typeof chunkConfig>
const goldQuestion = z.object({
  expect: z.string().min(1).max(400),
  question: z.string().min(1).max(4000),
  reject: z.string().max(400).optional()
})
const goldQuestions = z.array(goldQuestion).min(1).max(100)
type GoldQuestion = z.infer<typeof goldQuestion>
export type { ChunkConfig, GenerateConfig, GoldQuestion, ParseConfig, QueryConfig, RetrieveConfig }
export {
  chunkConfig,
  generateConfig,
  goldQuestion,
  goldQuestions,
  parseConfig,
  queryConfig,
  RETRIEVE_DEFAULTS,
  retrieveConfig
}
