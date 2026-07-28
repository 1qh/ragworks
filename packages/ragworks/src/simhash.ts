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
export { hamming, simhash }
