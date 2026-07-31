/* oxlint-disable unicorn/max-nested-calls -- the file is declarative: every nesting is a zod schema chain */
/** Agent-facing tool definitions for the stateless retrieval primitives.
 *
 * These are DEFINITIONS, not a server: each carries a name, a teaching description, a zod input shape
 * and a pure `run`, so a consumer registers them with whatever MCP server it already runs rather than
 * inheriting one. That keeps this free of an MCP SDK dependency and of any opinion about transport or
 * auth — the things a host owns.
 *
 * Only the stateless primitives live here. A tool that reads or writes a corpus needs the store, the
 * owner scoping and the record model this package deliberately lacks, and its guidance names the other
 * tools of whatever product exposes it; shipping those from here would either drag a store in or invent
 * a consumer that does not exist yet.
 *
 * The DESCRIPTIONS are the point. Each states what the capability is, when to reach for it, and what it
 * costs — because a bare parameter list leaves an agent guessing, and the guesses are expensive. Where a
 * claim here is measured, it says so. */
import { z } from 'zod'
import type { Segment } from './assemble'
import { assembleContext } from './assemble'
import { parseQueryList } from './query-parse'
import { autoMerge, lostInTheMiddle, maximalMarginalRelevance } from './rerank-order'

interface ToolDefinition<Shape extends z.ZodRawShape, Result> {
  description: string
  inputSchema: Shape
  name: string
  run: (args: z.infer<z.ZodObject<Shape>>) => Result
}
const define = <Shape extends z.ZodRawShape, Result>(tool: ToolDefinition<Shape, Result>): ToolDefinition<Shape, Result> =>
  tool
const orderContext = define({
  description:
    'Reorder an already-ranked passage list so the strongest sit at the OUTER edges and the weakest in the middle. A model attends worst to the middle of a long context, so a naive most-relevant-first ordering buries the best passage exactly where it is least read. Apply AFTER reranking, immediately before assembling. Pure and deterministic — no model call, no cost.',
  inputSchema: { passages: z.array(z.string()).min(1).max(200) },
  name: 'order-context',
  run: args => ({ passages: lostInTheMiddle(args.passages) })
})
const diversifyCandidates = define({
  description:
    'Trim a candidate list to the most relevant AND mutually diverse subset by maximal marginal relevance, so near-duplicate passages stop consuming the context budget a different fact could hold. lambda 1 is pure relevance, lambda 0 is pure diversity, 0.5 balances. Reach for it when retrieval returns many near-identical rows — a repeated table row, a boilerplate header. Lexical similarity only: no model call, no cost.',
  inputSchema: {
    candidates: z
      .array(z.object({ id: z.string(), score: z.number(), text: z.string() }))
      .min(1)
      .max(200),
    lambda: z.number().min(0).max(1).default(0.5),
    topK: z.number().int().positive().max(100).default(10)
  },
  name: 'diversify-candidates',
  run: args => ({ kept: maximalMarginalRelevance({ items: args.candidates, lambda: args.lambda, topK: args.topK }) })
})
const mergeToParents = define({
  description:
    "Collapse retrieved CHILD chunks back into the parent passage they came from, once enough of that parent surfaced to suggest the answer needs surrounding context rather than one precise slice. This is small-to-big retrieval: retrieve at the precision a small chunk gives, read at the completeness a parent gives. minChildRatio is the share of a parent's children that must appear before it collapses — 1 demands every child, 0.5 half, 0 collapses on a single hit. A parent below the ratio leaves its children untouched and a candidate with no parent passes through, so this only ever trades several children for the one passage containing them. Pure and deterministic. Parent edges come from your own chunk lineage: a corpus with none gets its input back unchanged.",
  inputSchema: {
    minChildRatio: z.number().min(0).max(1).default(0.5),
    parents: z
      .array(z.object({ childCount: z.number().int().positive(), chunkId: z.string(), text: z.string() }))
      .max(200),
    retrieved: z
      .array(z.object({ chunkId: z.string(), parentId: z.string().nullable(), score: z.number(), text: z.string() }))
      .min(1)
      .max(200)
  },
  name: 'merge-to-parents',
  run: args => ({
    merged: autoMerge({
      minChildRatio: args.minChildRatio,
      parents: new Map(args.parents.map(p => [p.chunkId, { childCount: p.childCount, text: p.text }])),
      retrieved: args.retrieved
    })
  })
})
const assembleContextTool = define({
  description:
    'Assemble ranked passages into the context a generator reads, under a token budget, stopping at whole passages rather than truncating one. The top-ranked passage is ALWAYS included even when it alone exceeds the budget, because a context empty of its single most relevant passage answers nothing. Measured across eight retrieval configurations on two corpora, the budget is the only knob that changes ANSWERS rather than ranking — and it moves them in BOTH directions, so there is no safe default and no direction to lean: cutting it loses answers where disambiguating near-duplicate rows needs a wide passage, and is the best setting where extra context only adds confusable neighbours. Measure it per corpus. You supply the token count so it matches the model you are about to call.',
  inputSchema: {
    budget: z.number().int().positive().max(200_000),
    segments: z
      .array(z.object({ chunkId: z.string(), text: z.string(), tokens: z.number().int().nonnegative() }))
      .min(1)
      .max(500)
  },
  name: 'assemble-context',
  run: args => {
    /** Keyed by TEXT because that is what the counter is handed, and identical text has an identical
     * count — so a duplicate collides onto the same correct value rather than needing a scan. */
    const tokensOf = new Map(args.segments.map(s => [s.text, s.tokens]))
    const out = assembleContext<Segment>(args.segments, args.budget, t => tokensOf.get(t) ?? 0)
    return { contextTokens: out.contextTokens, includedIds: out.included.map(s => s.chunkId), text: out.text }
  }
})
const parseQueryListTool = define({
  description:
    "Parse a model's list output — a JSON array, a fenced block, or a bulleted or numbered list — into clean query strings, falling back to the original question rather than returning nothing. Use it after a rewrite, multi-query or decompose step you ran yourself, so a model that answered in prose instead of JSON does not collapse the whole stage into an empty list.",
  inputSchema: { fallback: z.string().min(1), text: z.string() },
  name: 'parse-query-list',
  run: args => ({ queries: parseQueryList(args.text, args.fallback) })
})
/** Every stateless primitive, ready to register. A consumer picks the ones it wants to expose. */
const statelessTools = [
  orderContext,
  diversifyCandidates,
  mergeToParents,
  assembleContextTool,
  parseQueryListTool
] as const
export { assembleContextTool, diversifyCandidates, mergeToParents, orderContext, parseQueryListTool, statelessTools }
export type { ToolDefinition }
