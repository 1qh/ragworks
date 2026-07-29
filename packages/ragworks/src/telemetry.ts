import type { ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-trace-base'
import { SpanStatusCode, trace } from '@opentelemetry/api'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BasicTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
import type { StageMetric } from './metering'
import { engineEnv as env } from './engine-config'

const SPAN_CAP = 256
const recent: ReadableSpan[] = []
// eslint-disable-next-line @typescript-eslint/promise-function-async
const noop = (): Promise<void> => Promise.resolve()
const boundedProcessor: SpanProcessor = {
  forceFlush: noop,
  onEnd: span => {
    recent.push(span)
    if (recent.length > SPAN_CAP) recent.splice(0, recent.length - SPAN_CAP)
  },
  onStart: () => undefined,
  shutdown: noop
}
const processors: SpanProcessor[] = [boundedProcessor]
if (env.OTEL_EXPORTER_OTLP_ENDPOINT) processors.push(new SimpleSpanProcessor(new OTLPTraceExporter()))
const provider = new BasicTracerProvider({
  resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'rag-workbench' }),
  spanProcessors: processors
})
trace.setGlobalTracerProvider(provider)
/** Take the tracer from OUR provider rather than the global one. Registering a global provider is a
 * first-writer-wins operation: whoever registers first keeps it and every later registration is
 * discarded with a warning, so reading the tracer back from the global returns whichever provider
 * won — a provider whose processors do not include the bounded collector above, leaving every stage
 * span recorded nowhere. A library is the side that loses this race, because the host application
 * almost always registers its own provider first. It depends only on module load ORDER, so it is
 * invisible until something unrelated changes that order, and it fails as an ABSENCE, never an error. */
const tracer = provider.getTracer('rag-pipeline')
const recordStage = (args: {
  costEstimateUsd?: number
  metric: StageMetric
  model?: string
  workspaceId?: string
}): void => {
  const { costEstimateUsd, metric, model, workspaceId } = args
  const span = tracer.startSpan(`stage.${metric.stage}`)
  span.setAttribute('gen_ai.operation.name', metric.stage)
  if (model !== undefined) span.setAttribute('gen_ai.request.model', model)
  span.setAttribute('gen_ai.usage.input_tokens', metric.inputTokens)
  span.setAttribute('gen_ai.usage.output_tokens', metric.outputTokens)
  span.setAttribute('app.billing_mode', metric.billingMode)
  span.setAttribute('app.cache_hit', metric.cacheHit)
  if (workspaceId !== undefined) span.setAttribute('app.workspace_id', workspaceId)
  if (costEstimateUsd !== undefined) span.setAttribute('app.cost_estimate_usd', costEstimateUsd)
  span.setAttribute('app.cost_usd', metric.costUsd)
  if (metric.error !== null) span.setStatus({ code: SpanStatusCode.ERROR, message: metric.error })
  span.end()
}
const collectedSpans = (): ReadableSpan[] => recent
export { collectedSpans, recordStage }
