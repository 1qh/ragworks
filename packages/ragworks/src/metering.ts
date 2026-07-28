type BillingMode = 'free' | 'metered'
interface Price {
  readonly inputPerToken: number
  readonly outputPerToken: number
}
interface StageMetric {
  readonly billingMode: BillingMode
  readonly cacheHit: boolean
  readonly costUsd: number
  readonly durationMs: number
  readonly error: null | string
  readonly inputTokens: number
  readonly outputTokens: number
  readonly stage: string
}
const costOf = (args: {
  billingMode: BillingMode
  inputTokens: number
  outputTokens: number
  price: null | Price
}): number => {
  const { billingMode, inputTokens, outputTokens, price } = args
  if (billingMode === 'free') return 0
  if (price === null) throw new Error('a metered stage requires a price — refusing to bill zero (fail-fast)')
  return inputTokens * price.inputPerToken + outputTokens * price.outputPerToken
}
const estimateOf = (args: { billingMode: BillingMode; inputTokens: number; price: null | Price }): number => {
  const { billingMode, inputTokens, price } = args
  if (billingMode === 'free') return 0
  if (price === null) throw new Error('a metered estimate requires a price — refusing to estimate zero (fail-fast)')
  return inputTokens * price.inputPerToken
}
const meterStage = async <T>(args: {
  billingMode: BillingMode
  price: null | Price
  run: () => Promise<{ inputTokens?: number; outputTokens?: number; value: T }>
  stage: string
}): Promise<{ metric: StageMetric; value: T }> => {
  const { billingMode, price, run, stage } = args
  const started = performance.now()
  try {
    const { inputTokens = 0, outputTokens = 0, value } = await run()
    const durationMs = performance.now() - started
    return {
      metric: {
        billingMode,
        cacheHit: false,
        costUsd: costOf({ billingMode, inputTokens, outputTokens, price }),
        durationMs,
        error: null,
        inputTokens,
        outputTokens,
        stage
      },
      value
    }
  } catch (stageError) {
    const durationMs = performance.now() - started
    const metric: StageMetric = {
      billingMode,
      cacheHit: false,
      costUsd: 0,
      durationMs,
      error: String(stageError),
      inputTokens: 0,
      outputTokens: 0,
      stage
    }
    throw Object.assign(new Error(`stage ${stage} failed: ${String(stageError)}`, { cause: stageError }), {
      metric
    })
  }
}
const cacheHitMetric = (stage: string, durationMs: number): StageMetric => ({
  billingMode: 'free',
  cacheHit: true,
  costUsd: 0,
  durationMs,
  error: null,
  inputTokens: 0,
  outputTokens: 0,
  stage
})
export { cacheHitMetric, costOf, estimateOf, meterStage }
export type { BillingMode, Price, StageMetric }
