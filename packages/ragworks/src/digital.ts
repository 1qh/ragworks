import { parsePdf } from './docling'
/** The digital parse engine as an optional adapter — reading a document that already carries a text
 * layer, which is the fast path most pages take. It needs its parser service running, so a consumer
 * who brings their own parser never resolves this. */
export { parsePdf }
