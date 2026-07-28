import { z } from 'zod'
/* oxlint-disable unicorn/max-nested-calls */
import type { Block } from './lib'
import { toBottomLeft } from './docling'
import { engineEnv as env } from './engine-config'
import { resilient } from './resilience'

const minerUSchema = z.object({
  blocks: z.array(
    z.object({
      bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
      kind: z.string().optional(),
      text: z.string()
    })
  )
})
const minerUAvailable = (): boolean => env.MINERU_URL !== undefined
const minerUPage = async ({
  heightPt,
  pageNo,
  pngBase64
}: {
  heightPt: number
  pageNo: number
  pngBase64: string
}): Promise<Block[]> => {
  const base = env.MINERU_URL
  if (base === undefined) throw new Error('MINERU_URL is not configured')
  const res = await resilient(async () =>
    fetch(`${base}/parse`, {
      body: JSON.stringify({ image: pngBase64 }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      signal: AbortSignal.timeout(120_000)
    })
  )
  if (!res.ok) throw new Error(`mineru ${String(res.status)}`)
  const json = minerUSchema.parse(await res.json())
  return json.blocks.map(b => ({
    bbox: toBottomLeft(b.bbox, heightPt),
    kind: b.kind ?? 'text',
    page: pageNo,
    text: b.text
  }))
}
export { minerUAvailable, minerUPage }
