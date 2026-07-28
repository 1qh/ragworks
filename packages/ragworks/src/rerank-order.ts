const wordSplit = /[^a-z0-9]+/u
interface MmrArgs {
  items: readonly MmrItem[]
  lambda: number
  topK: number
}
interface MmrItem {
  id: string
  score: number
  text: string
}
const lostInTheMiddle = <T>(items: readonly T[]): T[] => {
  const head: T[] = []
  const tail: T[] = []
  for (const [i, item] of items.entries())
    if (i % 2 === 0) head.push(item)
    else tail.push(item)
  tail.reverse()
  return [...head, ...tail]
}
const wordSet = (text: string): Set<string> => {
  const out = new Set<string>()
  for (const word of text.toLowerCase().split(wordSplit)) if (word.length > 0) out.add(word)
  return out
}
const jaccard = (a: ReadonlySet<string>, b: ReadonlySet<string>): number => {
  if (a.size === 0 && b.size === 0) return 1
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const word of a) if (b.has(word)) shared += 1
  const union = a.size + b.size - shared
  return union === 0 ? 0 : shared / union
}
const clamp01 = (value: number): number => (value < 0 ? 0 : Math.min(1, value))
const maxSimilarityTo = (candidate: ReadonlySet<string>, chosen: readonly ReadonlySet<string>[]): number => {
  let worst = 0
  for (const other of chosen) {
    const similarity = jaccard(candidate, other)
    if (similarity > worst) worst = similarity
  }
  return worst
}
const bestCandidate = (args: {
  chosen: readonly ReadonlySet<string>[]
  items: readonly MmrItem[]
  sets: readonly Set<string>[]
  taken: ReadonlySet<number>
  weight: number
}): number => {
  const { chosen, items, sets, taken, weight } = args
  let bestIndex = -1
  let bestScore = Number.NEGATIVE_INFINITY
  for (const [i, candidate] of items.entries()) {
    const candidateSet = sets[i]
    if (candidateSet !== undefined && !taken.has(i)) {
      const value = weight * candidate.score - (1 - weight) * maxSimilarityTo(candidateSet, chosen)
      if (value > bestScore) {
        bestScore = value
        bestIndex = i
      }
    }
  }
  return bestIndex
}
const maximalMarginalRelevance = ({ items, lambda, topK }: MmrArgs): MmrItem[] => {
  const limit = Math.min(topK, items.length)
  if (limit <= 0) return []
  const weight = clamp01(lambda)
  const sets = items.map(item => wordSet(item.text))
  const selected: MmrItem[] = []
  const chosen: Set<string>[] = []
  const taken = new Set<number>()
  while (selected.length < limit) {
    const bestIndex = bestCandidate({ chosen, items, sets, taken, weight })
    const picked = bestIndex < 0 ? undefined : items[bestIndex]
    const pickedSet = bestIndex < 0 ? undefined : sets[bestIndex]
    if (picked === undefined || pickedSet === undefined) break
    taken.add(bestIndex)
    chosen.push(pickedSet)
    selected.push(picked)
  }
  return selected
}
export { lostInTheMiddle, maximalMarginalRelevance }
export type { MmrArgs, MmrItem }
