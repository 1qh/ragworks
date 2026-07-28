/** biome-ignore-all lint/performance/noAwaitInLoops: embeddings batch sequentially to respect the predict quota */
/* eslint-disable no-await-in-loop -- embeddings batch sequentially to respect the predict quota */
import { JWT } from 'google-auth-library'
import { z } from 'zod'
import { engineEnv as env } from './engine-config'
import { invariant } from './lib'

const SCOPE = 'https://www.googleapis.com/auth/cloud-platform'
const EMBED_BATCH = 5
const need = (value: string | undefined, name: string): string => {
  invariant(typeof value === 'string' && value.length > 0, `${name} is required for the vertex provider`)
  return value
}
const location = (): string => env.VERTEX_LOCATION ?? 'us-central1'
const openApiBase = (): string => {
  const loc = location()
  return `https://${loc}-aiplatform.googleapis.com/v1beta1/projects/${need(env.VERTEX_PROJECT, 'VERTEX_PROJECT')}/locations/${loc}/endpoints/openapi`
}
let jwt: JWT | null = null
const client = (): JWT => {
  jwt ??= new JWT({
    email: need(env.VERTEX_CLIENT_EMAIL, 'VERTEX_CLIENT_EMAIL'),
    key: need(env.VERTEX_PRIVATE_KEY, 'VERTEX_PRIVATE_KEY').replaceAll(String.raw`\n`, '\n'),
    scopes: [SCOPE]
  })
  return jwt
}
const bearer = async (): Promise<string> => {
  const { token } = await client().getAccessToken()
  invariant(typeof token === 'string' && token.length > 0, 'vertex access token mint failed')
  return token
}
const vertexAuthHeader = async (): Promise<Record<string, string>> => ({ authorization: `Bearer ${await bearer()}` })
const vertexFetch: typeof globalThis.fetch = Object.assign(
  async (
    input: Parameters<typeof globalThis.fetch>[0],
    init?: Parameters<typeof globalThis.fetch>[1]
  ): Promise<Response> => {
    const headers = new Headers(init?.headers)
    headers.set('authorization', `Bearer ${await bearer()}`)
    return fetch(input, { ...init, headers })
  },
  { preconnect: globalThis.fetch.preconnect }
)
const embeddingSchema = z.object({ values: z.array(z.number()) })
const predictionSchema = z.object({ embeddings: embeddingSchema })
const predictSchema = z.object({ predictions: z.array(predictionSchema) })
const predictUrl = (model: string): string => {
  const loc = location()
  return `https://${loc}-aiplatform.googleapis.com/v1/projects/${need(env.VERTEX_PROJECT, 'VERTEX_PROJECT')}/locations/${loc}/publishers/google/models/${model}:predict`
}
const vertexEmbed = async (model: string, texts: string[]): Promise<number[][]> => {
  const out: number[][] = []
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH)
    const res = await fetch(predictUrl(model), {
      body: JSON.stringify({ instances: batch.map(content => ({ content })) }),
      headers: { authorization: `Bearer ${await bearer()}`, 'content-type': 'application/json' },
      method: 'POST',
      signal: AbortSignal.timeout(120_000)
    })
    invariant(res.ok, `vertex embed ${model} failed with ${String(res.status)}`)
    const body: unknown = await res.json()
    for (const p of predictSchema.parse(body).predictions) out.push(p.embeddings.values)
  }
  invariant(
    out.length === texts.length,
    `vertex embed returned ${String(out.length)} vectors for ${String(texts.length)} inputs`
  )
  return out
}
export { openApiBase, vertexAuthHeader, vertexEmbed, vertexFetch }
