/** biome-ignore-all lint/style/noProcessEnv: provider secrets are read by the name the registry declares */
import { readFileSync } from 'node:fs'
import { parse } from 'smol-toml'
import { z } from 'zod'
import { engineEnv as env } from './engine-config'
import { invariant } from './lib'
import { openApiBase } from './vertex'

type Role = 'chat' | 'embed' | 'rerank' | 'vlm'
const resolveKey = (keyEnv: string | undefined): string => {
  if (keyEnv === undefined) return 'none'
  const value = process.env[keyEnv]
  invariant(typeof value === 'string' && value.length > 0, `provider key env ${keyEnv} is not set`)
  return value
}
const normalizeBaseUrl = (url: string): string => {
  let end = url.length
  while (end > 0 && url[end - 1] === '/') end -= 1
  return url.slice(0, end)
}
const providerSchema = z
  .object({
    auth: z.enum(['vertex', 'datalab']).optional(),
    base_url: z.url().optional(),
    id: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/u),
    key_env: z.string().min(1).optional(),
    metered: z.boolean().optional(),
    models: z.array(z.string().min(1)).min(1).optional(),
    roles: z.array(z.enum(['chat', 'embed', 'rerank', 'vlm'])).min(1),
    served_as: z.record(z.string(), z.string()).optional(),
    supports_seed: z.boolean().optional()
  })
  .refine(p => (p.auth === 'vertex') !== (p.base_url !== undefined), {
    message: 'provider needs exactly one of base_url or auth = "vertex"'
  })
  .refine(p => p.served_as === undefined || Object.keys(p.served_as).every(m => p.models?.includes(m)), {
    message: 'served_as keys must each be a declared model id'
  })
  .transform(p => ({
    auth: p.auth,
    baseUrl: p.auth === 'vertex' ? openApiBase() : normalizeBaseUrl(p.base_url ?? ''),
    id: p.id,
    key: p.auth === 'vertex' ? 'none' : resolveKey(p.key_env),
    metered: p.metered ?? false,
    models: p.models,
    roles: p.roles,
    servedAs: p.served_as,
    supportsSeed: p.supports_seed ?? (p.base_url !== undefined && !p.base_url.includes('generativelanguage'))
  }))
type Provider = z.infer<typeof providerSchema>
const fileSchema = z.object({ providers: z.array(providerSchema).min(1) })
interface Ref {
  readonly model: string
  readonly provider: Provider
  readonly wire: string
}
let cached: null | Provider[] = null
const providers = (): Provider[] => {
  if (cached === null) {
    // oxlint-disable-next-line node/no-sync
    const parsed: unknown = parse(readFileSync(env.PROVIDERS_FILE, 'utf8'))
    const list = fileSchema.parse(parsed).providers
    const seen = new Set<string>()
    for (const p of list) {
      invariant(!seen.has(p.id), `duplicate provider id ${p.id}`)
      seen.add(p.id)
    }
    cached = list
  }
  return cached
}
const providerById = (id: string): Provider => {
  const found = providers().find(p => p.id === id)
  invariant(found !== undefined, `unknown provider ${id}`)
  return found
}
const resolveRef = (ref: string, role?: Role): Ref => {
  const sep = ref.indexOf(':')
  invariant(sep > 0 && sep < ref.length - 1, `model ref must be provider:model, got ${ref}`)
  const model = ref.slice(sep + 1)
  const provider = providerById(ref.slice(0, sep))
  if (role !== undefined) {
    invariant(provider.roles.includes(role), `provider ${provider.id} does not serve role ${role}`)
    invariant(
      provider.models === undefined || provider.models.includes(model),
      `provider ${provider.id} has no model ${model}`
    )
  }
  return { model, provider, wire: provider.servedAs?.[model] ?? model }
}
const providersForRole = (role: Role): Provider[] => providers().filter(p => p.roles.includes(role))
const defaultRefForRole = (role: Role): string | undefined => {
  for (const p of providersForRole(role)) {
    const model = p.models?.[0]
    if (model !== undefined) return `${p.id}:${model}`
  }
}
const EMBED_MARKER = /embed/iu
const RERANK_MARKER = /rerank|ranker/iu
const NON_GENERATIVE_MARKER =
  /embed|rerank|ranker|imagen|image|veo|video|lyria|tts|audio|aqa|robotics|computer-use|live|realtime/iu
const roleAllowsModel = (role: Role, modelId: string): boolean => {
  if (role === 'embed') return EMBED_MARKER.test(modelId)
  if (role === 'rerank') return RERANK_MARKER.test(modelId)
  return !NON_GENERATIVE_MARKER.test(modelId)
}
const authHeaders = (provider: { key: string }): Record<string, string> =>
  provider.key === 'none' ? {} : { authorization: `Bearer ${provider.key}` }
export type { Provider, Ref, Role }
export {
  authHeaders,
  defaultRefForRole,
  normalizeBaseUrl,
  providerById,
  providers,
  providersForRole,
  resolveRef,
  roleAllowsModel
}
