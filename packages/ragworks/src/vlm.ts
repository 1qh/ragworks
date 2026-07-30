import { ocrPage, pageBlocks, parsePdfVlm, requireVlm } from './chandra'
/** The vision-language parse engine as an optional adapter, beside the digital and structure engines.
 *
 * Two capabilities rather than the module behind them: parse a whole document by reading its rendered
 * pages, and turn one page's vision output into blocks. A consumer reaches for the first when a
 * document has no usable text layer at all, and for the second when they drive the rendering
 * themselves and want the block shape the rest of the pipeline speaks.
 *
 * It lives at its own entry because it needs a vision model to run: a consumer with no such model
 * takes the digital path and never resolves this, which is the whole point of an adapter being
 * optional rather than a dependency of the core. */
export { ocrPage, pageBlocks, parsePdfVlm, requireVlm }
