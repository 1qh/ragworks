import type { Bbox } from './lib'
import { ocrCropText, renderCrop, requireVlm } from './chandra'
/** Read a drawn page region as text — the region-to-content bridge behind authoring a chunk by drawing
 * a box on the page.
 *
 * It exists as ONE capability rather than as the three pieces that implement it, because a consumer
 * given the pieces has to know the order to call them in, which projection the crop uses and which
 * model the reader needs — knowledge that belongs to whoever owns the pieces. Publishing the pieces
 * would also freeze them: an internal exposed as contract is an internal that can no longer change,
 * so the surface would harden around today's implementation of a thing whose implementation is exactly
 * what should stay free to move.
 *
 * A region is resolved from pixels, so a vision model is required to read one — but the reference is
 * accepted as POSSIBLY ABSENT and refused here, because a deployment can legitimately run without a
 * vision model configured and the caller then holds an optional value. Declaring it non-optional would
 * push that check outward to every call site, which is how one clear failure becomes several
 * inconsistent ones; the capability that needs the model is the right place to insist on it. */
const readRegion = async (args: {
  readonly bbox: Bbox
  readonly bytes: Uint8Array<ArrayBuffer>
  readonly contentType: string
  /** One-based, matching how a page is numbered everywhere a reader sees one. */
  readonly page: number
  /** Absent means no vision model is configured, which this refuses with a named error. */
  readonly vlm: string | undefined
}): Promise<string> => {
  const { bbox, bytes, contentType, page, vlm } = args
  /** Resolved FIRST and deliberately not inline: as an argument it evaluates after the crop, so a
   * caller with no model configured would pay for a full page render before being refused. */
  const model = requireVlm(vlm)
  const text = await ocrCropText(renderCrop({ bbox, bytes, contentType, pageIndex: page - 1 }), model)
  return text
}
export { readRegion }
