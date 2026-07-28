import { Document } from 'mupdf'
import type { Block } from './lib'
import { log } from './log'

const FUSED_MIN = 6
const WORD_MIN = 2
const FUSED = /\p{Lu}{6,}/gu
const HAS_FUSED = /\p{Lu}{6,}/u
const WS = /\s+/gu
const squash = (s: string): string => s.replaceAll(WS, '')
const respaceToken = (token: string, words: readonly string[]): null | string => {
  for (const [i] of words.entries()) {
    let joined = ''
    const run: string[] = []
    for (let j = i; j < words.length && joined.length < token.length; j += 1) {
      const w = words[j] ?? ''
      joined += w
      run.push(w)
      if (joined === token && run.length > 1 && run.every(part => part.length >= WORD_MIN)) return run.join(' ')
    }
  }
  return null
}
const respaceText = (text: string, words: readonly string[]): string => {
  if (words.length === 0) return text
  return text.replaceAll(FUSED, m => respaceToken(m, words) ?? m)
}
const pageWords = (bytes: Uint8Array<ArrayBuffer>): Map<number, string[]> => {
  const byPage = new Map<number, string[]>()
  const doc = Document.openDocument(bytes, 'application/pdf')
  for (let i = 0; i < doc.countPages(); i += 1) {
    const raw = doc.loadPage(i).toStructuredText('preserve-whitespace').asText()
    byPage.set(
      i + 1,
      raw
        .split(WS)
        .map(w => squash(w))
        .filter(w => w !== '')
    )
  }
  return byPage
}
const respaceBlocks = (
  bytes: Uint8Array<ArrayBuffer>,
  blocks: readonly Block[]
): { blocks: Block[]; repaired: number } => {
  if (!blocks.some(b => HAS_FUSED.test(b.text))) return { blocks: [...blocks], repaired: 0 }
  let words: Map<number, string[]>
  try {
    words = pageWords(bytes)
  } catch (error) {
    log.warn({ err: error instanceof Error ? error.message : String(error) }, 'respace skipped: page text unavailable')
    return { blocks: [...blocks], repaired: 0 }
  }
  let repaired = 0
  const out = blocks.map(b => {
    const text = respaceText(b.text, words.get(b.page) ?? [])
    if (text === b.text) return b
    repaired += 1
    return { ...b, text }
  })
  return { blocks: out, repaired }
}
export { FUSED_MIN, respaceBlocks, respaceText }
