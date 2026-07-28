import type { Price } from './metering'
import prices from './model-prices.json' with { type: 'json' }

const table: Record<string, number[]> = prices
const priceOf = (model: string): Price => {
  const entry = table[model]
  if (entry?.[0] === undefined)
    throw new Error(`no price for model '${model}' in the cost map — refusing to guess (fail-fast)`)
  return { inputPerToken: entry[0], outputPerToken: entry[1] ?? 0 }
}
export { priceOf }
