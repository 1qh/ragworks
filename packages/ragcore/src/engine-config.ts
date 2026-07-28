/** Every value the capability core reads about the world around it. The application leaves this
 * unset and the core falls through to the process environment; a consumer that embeds the core as
 * a library supplies them directly, so nothing in the pipeline demands a database url, an auth
 * secret or a search endpoint it never uses. */
interface EngineConfig {
  readonly CHONKIE_URL?: string
  /** Scopes every search to one owner. A host with per-user isolation supplies its request-scoped
   * resolver; a single-tenant consumer leaves it unset and no owner filter is applied. */
  readonly currentOwner?: () => null | string
  readonly DOCLING_URL: string
  readonly MINERU_URL?: string
  readonly OPENSEARCH_INDEX?: string
  readonly OPENSEARCH_URL?: string
  readonly OTEL_EXPORTER_OTLP_ENDPOINT?: string
  readonly PROVIDERS_FILE: string
  readonly REDIS_URL?: string
  readonly SOFFICE_PATH?: string
  readonly VERTEX_CLIENT_EMAIL?: string
  readonly VERTEX_LOCATION?: string
  readonly VERTEX_PRIVATE_KEY?: string
  readonly VERTEX_PROJECT?: string
}
/** The two values the pipeline cannot run without. Naming them rather than treating every value as
 * required keeps the guards around the optional ones meaningful. */
const REQUIRED = ['DOCLING_URL', 'PROVIDERS_FILE'] as const
let supplied: EngineConfig | null = null
const configureEngine = (config: EngineConfig): void => {
  for (const key of REQUIRED)
    if (!config[key]) throw new Error(`ragcore: ${key} is required — supply it to configureEngine()`)
  supplied = config
}
/** Reads the supplied configuration, falling back to the process environment so a consumer may set
 * these as environment variables instead. A REQUIRED value that is absent from both throws at the
 * point of use, naming itself: resolving it to a default would run the pipeline against the wrong
 * service and report success. */
const engineEnv = new Proxy({} as EngineConfig, {
  get: (_target, key: string): unknown => {
    /** biome-ignore lint/style/noProcessEnv: this module IS the configuration boundary a consumer supplies */
    const value = supplied === null ? process.env[key] : supplied[key as keyof EngineConfig]
    if (value === undefined && (REQUIRED as readonly string[]).includes(key))
      throw new Error(`ragcore: ${key} is not configured — call configureEngine() or set ${key}`)
    return value
  }
})
export { configureEngine, engineEnv }
export type { EngineConfig }
