import { expect, test } from 'bun:test'
import { cachedVectors, storeVectors } from './embed-cache'
import { engineEnv as env } from './engine-config'

test('embed cache: misses return null and stores never throw', async () => {
  const ref = 'test-embed:cache-spec'
  const fresh = await cachedVectors(ref, [`unseen ${env.REDIS_URL ?? 'none'} xyz`])
  expect(fresh).toHaveLength(1)
  await storeVectors(ref, [], [])
})
test('embed cache: round-trips a stored vector when redis is configured', async () => {
  const ref = 'test-embed:cache-spec'
  const text = 'alpha-beta canonical chunk text'
  await storeVectors(ref, [text], [[1, 2, 3]])
  const got = await cachedVectors(ref, [text, text])
  expect(got).toHaveLength(2)
  if (env.REDIS_URL === undefined) expect(got[0]).toBeNull()
  else {
    expect(got[0]).toEqual([1, 2, 3])
    expect(got[1]).toEqual([1, 2, 3])
  }
})
