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
 * The vision model is REQUIRED here rather than optional, since a region is resolved from pixels; a
 * caller whose page has a usable text layer reads the span from the parse instead and never arrives. */
const readRegion = async (args: {
  readonly bbox: Bbox
  readonly bytes: Uint8Array<ArrayBuffer>
  readonly contentType: string
  /** One-based, matching how a page is numbered everywhere a reader sees one. */
  readonly page: number
  readonly vlm: string
}): Promise<string> => {
  const { bbox, bytes, contentType, page, vlm } = args
  const text = await ocrCropText(renderCrop({ bbox, bytes, contentType, pageIndex: page - 1 }), requireVlm(vlm))
  return text
}
export { readRegion }
