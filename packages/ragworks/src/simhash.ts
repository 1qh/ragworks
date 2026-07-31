/** biome-ignore-all lint/suspicious/noBitwiseOperators: a 64-bit simhash is intrinsically bitwise */
/* eslint-disable no-bitwise */
import { createHash } from 'node:crypto'

const RANGE = Array.from({ length: 64 }, (_, i) => i)
const WHITESPACE = /\s+/u
const simhash = (text: string): bigint => {
  const tokens = text.toLowerCase().split(WHITESPACE).filter(Boolean)
  const acc = RANGE.map(() => 0)
  for (const tok of tokens) {
    // eslint-disable-next-line sonarjs/hashing -- non-security content fingerprint for dedup, not a cryptographic protection
    const bits = createHash('md5').update(tok).digest().readBigUInt64BE(0)
    for (const i of RANGE) acc[i] = (acc[i] ?? 0) + (((bits >> BigInt(i)) & 1n) === 1n ? 1 : -1)
  }
  let out = 0n
  for (const i of RANGE) if ((acc[i] ?? 0) > 0) out |= 1n << BigInt(i)
  return out
}
const hamming = (a: bigint, b: bigint): number => {
  let x = a ^ b
  let c = 0
  while (x > 0n) {
    c += 1
    x &= x - 1n
  }
  return c
}
/** Drop a candidate whose own words a KEPT candidate already covers.
 * Two mechanisms, because they catch different things and neither subsumes the other: a simhash
 * fingerprint catches near-identical passages, and containment catches a passage wholly inside a wider
 * one — three overlapping windows over a single table sat twelve and fourteen bits apart, far outside
 * any sane fingerprint radius, while two of them were entirely contained in the third.
 * Containment is deliberately ASYMMETRIC: it asks what fraction of the CANDIDATE's words the kept one
 * covers, so a wider passage arriving later still survives a narrow one that arrived first. Measured
 * across eight configurations, removing these lifts retrieval rank in six and recovers an answer in the
 * two most starved of context — they spend the budget that decides answers on one repeated fact.
 * Empty text is always kept: a passage with nothing to compare is not a duplicate of anything. */
const wordsOf = (text: string): Set<string> => new Set(text.toLowerCase().split(WHITESPACE).filter(Boolean))
const containedIn = (candidate: ReadonlySet<string>, kept: ReadonlySet<string>): number => {
  if (candidate.size === 0) return 0
  let shared = 0
  for (const w of candidate) if (kept.has(w)) shared += 1
  return shared / candidate.size
}
interface DedupeOptions {
  /** Fraction of a candidate's words a kept candidate must cover before the candidate is dropped. */
  containedFraction: number
  /** Maximum simhash Hamming distance at which two passages count as near-identical. */
  hammingDistance: number
}
const dropCoveredDuplicates = <T>(
  candidates: readonly T[],
  textOf: (item: T) => string,
  { containedFraction, hammingDistance }: DedupeOptions
): T[] => {
  const keptHashes: bigint[] = []
  const keptWords: Set<string>[] = []
  return candidates.filter(item => {
    const text = textOf(item)
    if (text.length === 0) return true
    const h = simhash(text)
    if (keptHashes.some(k => hamming(h, k) <= hammingDistance)) return false
    const words = wordsOf(text)
    if (keptWords.some(k => containedIn(words, k) >= containedFraction)) return false
    keptHashes.push(h)
    keptWords.push(words)
    return true
  })
}
export { containedIn, dropCoveredDuplicates, hamming, simhash, wordsOf }
export type { DedupeOptions }
