import { expect, test } from 'bun:test'
import { readRegion } from './region'
/** The capability owns the missing-model refusal so every caller inherits ONE named failure instead of
 * writing its own check. A deployment with no vision model is a legitimate deployment, so this path is
 * reached in normal operation rather than only under misuse. */
const args = {
  bbox: [0, 0, 10, 10] as const,
  bytes: new Uint8Array([1, 2, 3]),
  contentType: 'application/pdf',
  page: 1
}
test('an absent vision model is refused by name, never resolved to a default', async () => {
  await expect(readRegion({ ...args, vlm: undefined })).rejects.toThrow()
})
test('the refusal happens before any rendering, so a caller with no model pays nothing for it', async () => {
  /** The bytes here are NOT a document, so reaching the renderer fails on that instead — which makes
   * the model's own message the proof that the check ran first. Asserting merely that something threw
   * would pass either way, and the ordering is the whole point: as an inline argument the crop is
   * evaluated before the model is resolved, and a caller with no model renders a page for nothing. */
  const err = await readRegion({ ...args, vlm: undefined }).catch((error: unknown) => error)
  expect(String(err)).toContain('vlm-role model is required')
})
