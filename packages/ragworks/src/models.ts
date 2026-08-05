import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { embedMany } from 'ai'
import { z } from 'zod'
import type { Provider, Role } from './providers'
import { cachedVectors, storeVectors } from './embed-cache'
import { log } from './log'
import { cacheHitMetric } from './metering'
import { authHeaders, providersForRole, resolveRef, roleAllowsModel } from './providers'
import { resilient } from './resilience'
import { stubbed } from './stub'
import { recordStage } from './telemetry'
import { vertexEmbed, vertexFetch } from './vertex'
// oxlint-disable-next-line unicorn/max-nested-calls
const providerModelsSchema = z.object({ data: z.array(z.object({ id: z.string() })) })
const stubVector = (text: string) => Array.from({ length: 8 }, (_, i) => ((text.length + i) % 7) / 7)
/** Merges a provider's declared chat_body into every chat request it serves. One wrapper rather than a
 * parameter threaded through each call: the fields belong to the SERVER, so a call site has no business
 * knowing them, and a knob added to a provider file reaches every stage without touching code. */
const withChatBody = (extra: Record<string, unknown>): typeof fetch =>
  /** `typeof fetch` carries a `preconnect` member under some runtimes, so a bare arrow does not satisfy it
   * — delegate that to the real fetch rather than widening the type and losing the contract. */
  Object.assign(
    async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      if (init?.body === undefined || typeof init.body !== 'string') {
        const passthrough = await fetch(input, init)
        return passthrough
      }
      const body = JSON.parse(init.body) as Record<string, unknown>
      const merged = await fetch(input, { ...init, body: JSON.stringify({ ...body, ...extra }) })
      return merged
    },
    { preconnect: fetch.preconnect }
  )
const sdk = (provider: Provider) => {
  const extra = provider.chatBody
  return createOpenAICompatible(
    provider.auth === 'vertex'
      ? { baseURL: provider.baseUrl, fetch: vertexFetch, includeUsage: true, name: provider.id }
      : {
          apiKey: provider.key,
          baseURL: provider.baseUrl,
          includeUsage: true,
          name: provider.id,
          ...(extra ? { fetch: withChatBody(extra) } : {})
        }
  )
}
interface Identity {
  baseUrl: string
  provider: string
}
const STUB_IDENTITY: Identity = { baseUrl: 'stub', provider: 'stub' }
const identityOf = (provider: Provider): Identity => ({ baseUrl: provider.baseUrl, provider: provider.id })
interface Embedded {
  dim: number
  identity: Identity
  vectors: number[][]
}
const partitionCache = (
  unique: string[],
  cached: (null | number[])[]
): { byText: Map<string, number[]>; misses: string[] } => {
  const byText = new Map<string, number[]>()
  const misses: string[] = []
  for (const [i, t] of unique.entries()) {
    const hit = cached[i]
    if (hit) byText.set(t, hit)
    else misses.push(t)
  }
  return { byText, misses }
}
/** A batch pads every input to its longest member, and chunk lengths are wildly uneven (median 37 characters, p90 400, max in the thousands), so a mixed batch spends most of its compute on padding. Embedding length-sorted and restoring the caller's order measures 1.9x faster end to end, and the gain grows with batch size — an unsorted batch gets SLOWER as the batch grows. */
const byLength = (texts: string[]): { index: number; text: string }[] =>
  texts.map((text, index) => ({ index, text })).toSorted((a, b) => a.text.length - b.text.length)
const inCallerOrder = (order: { index: number; text: string }[], vectors: number[][]): number[][] => {
  const restored: number[][] = Array.from({ length: order.length })
  for (const [position, o] of order.entries()) {
    const vector = vectors[position]
    if (vector) restored[o.index] = vector
  }
  return restored
}
const embedMisses = async (provider: Provider, wireModel: string, misses: string[]): Promise<number[][]> => {
  const order = byLength(misses)
  const sorted = order.map(o => o.text)
  const embeddings =
    provider.auth === 'vertex'
      ? await vertexEmbed(wireModel, sorted)
      : (
          await embedMany({
            abortSignal: AbortSignal.timeout(120_000),
            model: sdk(provider).embeddingModel(wireModel),
            values: sorted
          })
        ).embeddings
  if (embeddings.length !== misses.length)
    throw new Error(`embed returned ${String(embeddings.length)} vectors for ${String(misses.length)} inputs`)
  return inCallerOrder(order, embeddings)
}
const embedTexts = async (ref: string, inputTexts: string[]): Promise<Embedded> => {
  const texts = inputTexts.map(t => t.normalize('NFC'))
  if (stubbed()) {
    if (texts.some(t => t.includes('FAILEMBED'))) throw new Error('stub embed failure')
    const vectors = texts.map(stubVector)
    return { dim: vectors[0]?.length ?? 0, identity: STUB_IDENTITY, vectors }
  }
  const { model, provider, wire } = resolveRef(ref, 'embed')
  const unique = [...new Set(texts)]
  const started = Date.now()
  const cached = await cachedVectors(ref, unique)
  const { byText, misses } = partitionCache(unique, cached)
  if (misses.length < unique.length) recordStage({ metric: cacheHitMetric('embed', Date.now() - started), model })
  if (misses.length > 0) {
    const embeddings = await embedMisses(provider, wire, misses)
    for (const [i, t] of misses.entries()) {
      const v = embeddings[i]
      if (v) byText.set(t, v)
    }
    await storeVectors(ref, misses, embeddings)
  }
  const vectors: number[][] = []
  for (const t of texts) {
    const v = byText.get(t)
    if (!v) throw new Error('embed cache assembly miss')
    vectors.push(v)
  }
  if (new Set(vectors.map(v => v.length)).size > 1)
    throw new Error('embedding dimension mismatch — stale cached vectors for this ref')
  return { dim: vectors[0]?.length ?? 0, identity: identityOf(provider), vectors }
}
const listModelsByRole = async (role: Role): Promise<string[]> => {
  if (stubbed()) return [`stub:${role}-model`]
  const settled = await Promise.allSettled(
    providersForRole(role).map(async provider => {
      if (provider.models) return provider.models.map(m => `${provider.id}:${m}`)
      const res = await resilient(async () =>
        fetch(`${provider.baseUrl}/models`, {
          headers: authHeaders(provider),
          signal: AbortSignal.timeout(10_000)
        })
      )
      if (!res.ok) throw new Error(`models ${provider.id} ${res.status}`)
      const json = providerModelsSchema.parse(await res.json())
      return json.data.filter(m => roleAllowsModel(role, m.id)).map(m => `${provider.id}:${m.id}`)
    })
  )
  for (const r of settled) if (r.status === 'rejected') log.warn({ error: r.reason, role }, 'provider model list failed')
  return settled.flatMap(r => (r.status === 'fulfilled' ? r.value : []))
}
const assertServed = async (refs: {
  chat?: string
  embed?: string
  rerank?: string
  vlm?: string
}): Promise<null | string> => {
  const entries = (['chat', 'embed', 'rerank', 'vlm'] as const).flatMap(role =>
    refs[role] === undefined ? [] : [[role, refs[role]] as const]
  )
  const verdicts = await Promise.all(
    entries.map(async ([role, ref]) => ({ ok: (await listModelsByRole(role)).includes(ref), ref, role }))
  )
  const bad = verdicts.find(v => !v.ok)
  return bad ? `${bad.role} model unavailable: ${bad.ref} — pick another in the panel` : null
}
const modelIdentity = (ref: string): { baseUrl: string; provider: string } => {
  if (stubbed()) return { baseUrl: 'stub', provider: 'stub' }
  const { provider } = resolveRef(ref)
  return { baseUrl: provider.baseUrl, provider: provider.id }
}
export type { Embedded, Identity }
export { assertServed, byLength, embedTexts, inCallerOrder, listModelsByRole, modelIdentity }
