import { expect, test } from 'bun:test'
import { priceOf } from './pricing'

test('priceOf returns per-token input/output price for a known model', () => {
  const p = priceOf('gemini-2.5-flash')
  expect(p.inputPerToken).toBeGreaterThan(0)
  expect(p.outputPerToken).toBeGreaterThan(0)
})
test('priceOf throws on a model absent from the cost map — fail-fast, never guesses a price', () => {
  expect(() => priceOf('totally-made-up-model-xyz-000')).toThrow()
})
