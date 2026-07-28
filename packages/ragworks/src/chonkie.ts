import { z } from 'zod'
import { engineEnv as env } from './engine-config'
import { log } from './log'
import { resilient } from './resilience'

const chunkSchema = z.object({ end_index: z.int(), start_index: z.int(), text: z.string() })
const responseSchema = z.object({ chunks: z.array(chunkSchema) })
const badnessSchema = z.object({ ratios: z.array(z.number()) })
const pageBadness = async (texts: string[]): Promise<number[]> => {
  const base = env.CHONKIE_URL
  if (!base || texts.length === 0) return texts.map(() => 0)
  try {
    const parsed = await resilient(async () => {
      const res = await fetch(`${base}/badness`, {
        body: JSON.stringify({ texts }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
        signal: AbortSignal.timeout(30_000)
      })
      if (!res.ok) throw new Error(`chonkie badness ${String(res.status)}`)
      return badnessSchema.parse(await res.json())
    })
    return parsed.ratios.length === texts.length ? parsed.ratios : texts.map(() => 0)
  } catch (badnessError) {
    log.warn({ badnessError }, 'chonkie badness unavailable — mojibake axis degraded to zero')
    return texts.map(() => 0)
  }
}
interface SemanticChunk {
  end: number
  start: number
  text: string
}
const semanticChunk = async (text: string, chunkSize: number): Promise<SemanticChunk[]> => {
  const base = env.CHONKIE_URL
  if (!base) throw new Error('CHONKIE_URL is required for the semantic chunk strategy')
  const parsed = await resilient(async () => {
    const res = await fetch(`${base}/chunk`, {
      body: JSON.stringify({ chunk_size: chunkSize, text }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      signal: AbortSignal.timeout(120_000)
    })
    if (!res.ok) throw new Error(`chonkie chunk ${String(res.status)}`)
    return responseSchema.parse(await res.json())
  })
  return parsed.chunks.map(c => ({ end: c.end_index, start: c.start_index, text: c.text }))
}
export { pageBadness, semanticChunk }
export type { SemanticChunk }
