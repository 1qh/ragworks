import { reconcileBlocks } from './reconcile'
/** Reconcile an engine's reported geometry against the page as actually rendered, so a region drawn
 * from a parse sits over the glyphs rather than the whitespace an engine reported around them. It
 * renders to compare, so it lives beside the adapters rather than in the core. */
export { reconcileBlocks }
