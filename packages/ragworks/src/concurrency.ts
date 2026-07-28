/** biome-ignore-all lint/performance/noAwaitInLoops: a bounded worker awaits each item it pulls from the shared cursor */
/* eslint-disable no-await-in-loop -- a bounded worker awaits each item it pulls from the shared cursor */
const mapPool = async <T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const out = Array.from({ length: items.length }, () => undefined as R)
  const width = Math.max(1, Math.min(limit, items.length))
  let next = 0
  const worker = async (): Promise<void> => {
    for (let i = next; i < items.length; i = next) {
      next = i + 1
      const item = items[i]
      if (item !== undefined) out[i] = await fn(item, i)
    }
  }
  await Promise.all(Array.from({ length: width }, async () => worker()))
  return out
}
export { mapPool }
