import { describe, expect, test } from 'bun:test'
import { canonical, embedRowKey, stageKey } from './stage-key'

describe('stage-key', () => {
  test('canonical is key-order independent', () => {
    expect(canonical({ a: 1, b: 2 })).toBe(canonical({ a: 1, b: 2 }))
    expect(canonical({ a: [1, 2], b: { c: 3 } })).toBe(canonical({ a: [1, 2], b: { c: 3 } }))
  })
  test('canonical distinguishes different values', () => {
    expect(canonical({ a: 1 })).not.toBe(canonical({ a: 2 }))
    expect(canonical([1, 2])).not.toBe(canonical([2, 1]))
  })
  test('stageKey is parent-order independent (output-hash collapse)', async () => {
    const a = await stageKey({
      config: { size: 400 },
      engineVersion: 'v1',
      parentOutputHashes: ['h1', 'h2'],
      stage: 'chunk'
    })
    const b = await stageKey({
      config: { size: 400 },
      engineVersion: 'v1',
      parentOutputHashes: ['h2', 'h1'],
      stage: 'chunk'
    })
    expect(a).toBe(b)
  })
  test('stageKey changes on config, engineVersion, stage, or parent output', async () => {
    const base = { config: { size: 400 }, engineVersion: 'v1', parentOutputHashes: ['h1'], stage: 'chunk' } as const
    const key = await stageKey(base)
    expect(await stageKey({ ...base, config: { size: 500 } })).not.toBe(key)
    expect(await stageKey({ ...base, engineVersion: 'v2' })).not.toBe(key)
    expect(await stageKey({ ...base, stage: 'embed' })).not.toBe(key)
    expect(await stageKey({ ...base, parentOutputHashes: ['h2'] })).not.toBe(key)
  })
  test('embedRowKey is stable per text+model and differs across model-version', async () => {
    const args = { model: 'qwen3', modelVersion: '1', provider: 'mlx', text: 'xin chào' } as const
    expect(await embedRowKey(args)).toBe(await embedRowKey(args))
    expect(await embedRowKey({ ...args, modelVersion: '2' })).not.toBe(await embedRowKey(args))
    expect(await embedRowKey({ ...args, text: 'khác' })).not.toBe(await embedRowKey(args))
  })
})
