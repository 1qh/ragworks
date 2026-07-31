interface Assembled<T extends Segment> {
  contextTokens: number
  included: T[]
  text: string
}
type CountTokens = (text: string) => number
/** Assemble the context a generator reads, under a token budget.
 * This is the stage measured to change ANSWERS rather than ranking — cutting the budget loses answers
 * on a corpus that needs a wide passage to disambiguate near-duplicate rows and is the best setting on
 * a dense configuration table, so there is no safe default and the caller owns the number.
 * Token counting is a PORT rather than a dependency: what counts as a token is a property of the model
 * the context is being assembled for, so a core that hardcodes one tokenizer is a core that is wrong
 * for every other model. */
interface Segment {
  chunkId: string
  text: string
}
/** The top-ranked segment is ALWAYS included, even when it alone exceeds the budget: a context that is
 * empty because its single most relevant passage did not fit answers nothing at all, which is strictly
 * worse than a context that overruns by one passage. */
const assembleContext = <T extends Segment>(
  segments: readonly T[],
  budget: number,
  countTokens: CountTokens
): Assembled<T> => {
  const parts: string[] = []
  const included: T[] = []
  let tokens = 0
  for (const [i, seg] of segments.entries()) {
    const cost = countTokens(seg.text)
    if (i > 0 && tokens + cost > budget) break
    parts.push(seg.text)
    included.push(seg)
    tokens += cost
  }
  return { contextTokens: tokens, included, text: parts.join('\n\n') }
}
/** Interleave the hops before assembling, so each sub-question reserves slots rather than competing in
 * one flat ranking: a flat top-k over a combined multi-hop question starves the minority hop, whose
 * answer chunk is retrieved and then ranked below the majority hop's and falls out of the context. */
const assembleHops = <T extends Segment>(
  hops: readonly (readonly T[])[],
  budget: number,
  countTokens: CountTokens
): Assembled<T> => {
  const cursors = hops.map(() => 0)
  const ordered: T[] = []
  const seen = new Set<string>()
  let remaining = hops.reduce((sum, h) => sum + h.length, 0)
  while (remaining > 0)
    for (const [h, hop] of hops.entries()) {
      const idx = cursors[h] ?? 0
      const seg = hop[idx]
      cursors[h] = idx + 1
      if (seg !== undefined) {
        remaining -= 1
        if (!seen.has(seg.chunkId)) {
          seen.add(seg.chunkId)
          ordered.push(seg)
        }
      }
    }
  return assembleContext(ordered, budget, countTokens)
}
export { assembleContext, assembleHops }
export type { Assembled, CountTokens, Segment }
