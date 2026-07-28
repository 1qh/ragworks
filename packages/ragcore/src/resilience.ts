import type { IBackoffFactory } from 'cockatiel'
import { ExponentialBackoff, handleWhen, retry } from 'cockatiel'

const isDeadline = (error: unknown): boolean =>
  error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
// oxlint-disable-next-line promise/prefer-await-to-callbacks
const defaultHandle = handleWhen(error => !isDeadline(error))
const makeResilient = (
  handle: Parameters<typeof retry>[0] = defaultHandle,
  opts?: { backoff?: IBackoffFactory<unknown>; maxAttempts?: number }
) => {
  const policy = retry(handle, {
    backoff: opts?.backoff ?? new ExponentialBackoff(),
    maxAttempts: opts?.maxAttempts ?? 3
  })
  return async <T>(fn: () => Promise<T>): Promise<T> => policy.execute(fn)
}
const resilient = makeResilient()
export { makeResilient, resilient }
