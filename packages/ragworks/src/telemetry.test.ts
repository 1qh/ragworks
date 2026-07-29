import { expect, test } from 'bun:test'
import { collectedSpans, recordStage } from './telemetry'

test('recordStage emits a GenAI-semconv span carrying the cost + billing + cache attributes', () => {
  recordStage({
    costEstimateUsd: 0.002,
    metric: {
      billingMode: 'metered',
      cacheHit: false,
      costUsd: 0.005,
      durationMs: 12,
      error: null,
      inputTokens: 100,
      outputTokens: 20,
      stage: 'embed'
    },
    model: 'gemini-2.5-flash',
    workspaceId: 'ws-1'
  })
  const span = collectedSpans().find(s => s.name === 'stage.embed')
  expect(span).toBeDefined()
  expect(span?.attributes['gen_ai.request.model']).toBe('gemini-2.5-flash')
  expect(span?.attributes['gen_ai.usage.input_tokens']).toBe(100)
  expect(span?.attributes['app.cost_usd']).toBeCloseTo(0.005)
  expect(span?.attributes['app.cost_estimate_usd']).toBeCloseTo(0.002)
  expect(span?.attributes['app.billing_mode']).toBe('metered')
  expect(span?.attributes['app.cache_hit']).toBe(false)
})
