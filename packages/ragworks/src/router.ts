const CTRL = /[\p{Cc}\p{Cf}\p{Co}�]/u
const LAYOUT_WS = /[\t\n\v\f\r]/u
const LETTER = /\p{L}/u
// eslint-disable-next-line regexp/no-obscure-range -- intentional per-script Unicode letter ranges (Latin, Latin-Extended, Greek, Cyrillic, CJK, Hangul); endpoints are the block boundaries by design
const VALID_LETTER = /[a-zA-ZÀ-ɏḀ-ỿͰ-ϿЀ-ӿ぀-ヿ㐀-鿿가-힯]/u
const CHAR_MIN = 200
const CTRL_MAX = 0.002
const VALID_MIN = 0.6
const MOJIBAKE_MAX = 0.001
interface PageSignal {
  readonly charCount: number
  readonly ctrlRatio: number
  readonly mojibakeRatio: number
  readonly route: Route
  readonly validFrac: number
}
type Route = 'fast' | 'mineru' | 'vlm'
const ctrlRatio = (text: string): number => {
  if (text.length === 0) return 0
  let ctrl = 0
  for (const ch of text) if (CTRL.test(ch) && !LAYOUT_WS.test(ch)) ctrl += 1
  return ctrl / text.length
}
const validFrac = (text: string): number => {
  let letters = 0
  let valid = 0
  for (const ch of text)
    if (LETTER.test(ch)) {
      letters += 1
      if (VALID_LETTER.test(ch)) valid += 1
    }
  return letters === 0 ? 1 : valid / letters
}
const routePage = (text: string, hasGraphics = false, mojibake = 0): PageSignal => {
  const trimmed = text.trim()
  const charCount = trimmed.length
  const ctrl = ctrlRatio(trimmed)
  const valid = validFrac(trimmed)
  const garbled = charCount < CHAR_MIN || ctrl > CTRL_MAX || valid < VALID_MIN || mojibake > MOJIBAKE_MAX
  const garbledRoute: Route = hasGraphics ? 'mineru' : 'vlm'
  const route: Route = garbled ? garbledRoute : 'fast'
  return { charCount, ctrlRatio: ctrl, mojibakeRatio: mojibake, route, validFrac: valid }
}
const withoutMinerU = (routes: readonly Route[]): Route[] => routes.map(r => (r === 'mineru' ? 'vlm' : r))
export { CHAR_MIN, CTRL_MAX, MOJIBAKE_MAX, routePage, VALID_MIN, withoutMinerU }
export type { PageSignal, Route }
