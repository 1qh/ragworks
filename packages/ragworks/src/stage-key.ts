const cmpCodeUnits = (a: string, b: string): number => {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}
const canonical = (value: unknown): string => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  const keys = Object.keys(value).toSorted(cmpCodeUnits)
  const entries = keys.map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
  return `{${entries.join(',')}}`
}
const hash = async (input: string): Promise<string> => {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}
const stageKey = async (args: {
  config: unknown
  engineVersion: string
  parentOutputHashes: readonly string[]
  stage: string
}): Promise<string> => {
  const { config, engineVersion, parentOutputHashes, stage } = args
  const sortedParents = [...parentOutputHashes].toSorted(cmpCodeUnits).join(',')
  const key = await hash(`${stage}|${engineVersion}|${canonical(config)}|${sortedParents}`)
  return key
}
const embedRowKey = async (args: {
  model: string
  modelVersion: string
  provider: string
  text: string
}): Promise<string> => {
  const { model, modelVersion, provider, text } = args
  return hash(`embed|${provider}|${model}|${modelVersion}|${await hash(text)}`)
}
export { canonical, embedRowKey, hash, stageKey }
