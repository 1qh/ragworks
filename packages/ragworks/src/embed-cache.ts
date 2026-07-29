/** Bun APIs are reached through the GLOBAL here, not `import { … } from 'bun'`, and a fleet rule that
 * prefers the named form does not apply to a PUBLISHED LIBRARY. A consumer bundling for Next cannot
 * resolve the `bun` module — its build dies with "Cannot find module 'bun'" — while the global
 * resolves everywhere. A lint gate cannot see this, because it never assembles the dependency graph:
 * the engine gate passed, the consumer's typecheck passed, and only the consumer's BUILD failed. */
import { createHash } from 'node:crypto'
import { engineEnv as env } from './engine-config'
import { log } from './log'

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30
let client: null | Bun.RedisClient = null
let tried = false
const redis = (): null | Bun.RedisClient => {
  if (env.REDIS_URL === undefined) return null
  if (!(client || tried)) {
    tried = true
    try {
      client = new Bun.RedisClient(env.REDIS_URL)
    } catch (error) {
      log.warn({ error: error instanceof Error ? error.message : String(error) }, 'embed cache redis init failed')
    }
  }
  return client
}
const EMBED_ENGINE_VERSION = 'embed-1'
const keyFor = (ref: string, text: string): string => {
  const payload = `${EMBED_ENGINE_VERSION} ${ref} ${text}`
  return `emb:${createHash('sha256').update(payload).digest('hex')}`
}
const cachedVectors = async (ref: string, texts: string[]): Promise<(null | number[])[]> => {
  const c = redis()
  if (!c || texts.length === 0) return texts.map(() => null)
  try {
    const raw = (await c.send(
      'MGET',
      texts.map(t => keyFor(ref, t))
    )) as (null | string)[]
    return raw.map(s => (s ? (JSON.parse(s) as number[]) : null))
  } catch (error) {
    log.warn({ error: error instanceof Error ? error.message : String(error) }, 'embed cache read failed')
    return texts.map(() => null)
  }
}
const storeVectors = async (ref: string, texts: string[], vectors: number[][]): Promise<void> => {
  const c = redis()
  if (!c || texts.length === 0) return
  const writes: [string, string][] = []
  for (const [i, t] of texts.entries()) {
    const v = vectors[i]
    if (v) writes.push([keyFor(ref, t), JSON.stringify(v)])
  }
  if (writes.length === 0) return
  try {
    await Promise.all(
      writes.map(async ([k, v]) => c.send('SET', [k, v, 'EX', String(CACHE_TTL_SECONDS)]) as Promise<unknown>)
    )
  } catch (error) {
    log.warn({ error: error instanceof Error ? error.message : String(error) }, 'embed cache write failed')
  }
}
const CTX_ENGINE_VERSION = 'ctx-1'
const ctxKeyFor = (ref: string, docHash: string, text: string): string => {
  const payload = `${CTX_ENGINE_VERSION} ${ref} ${docHash} ${text}`
  return `ctx:${createHash('sha256').update(payload).digest('hex')}`
}
const cachedContext = async (ref: string, docHash: string, text: string): Promise<null | string> => {
  const c = redis()
  if (!c) return null
  try {
    return (await c.send('GET', [ctxKeyFor(ref, docHash, text)])) as null | string
  } catch (error) {
    log.warn({ error: error instanceof Error ? error.message : String(error) }, 'context cache read failed')
    return null
  }
}
const storeContext = async ({
  blurb,
  docHash,
  ref,
  text
}: {
  blurb: string
  docHash: string
  ref: string
  text: string
}): Promise<void> => {
  const c = redis()
  if (!c) return
  try {
    await c.send('SET', [ctxKeyFor(ref, docHash, text), blurb, 'EX', String(CACHE_TTL_SECONDS)])
  } catch (error) {
    log.warn({ error: error instanceof Error ? error.message : String(error) }, 'context cache write failed')
  }
}
export { cachedContext, cachedVectors, storeContext, storeVectors }
