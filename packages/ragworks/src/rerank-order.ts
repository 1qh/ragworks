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
interface Grouped {
  byParent: Map<string, Retrieved[]>
  passthrough: Retrieved[]
}
interface ParentInfo {
  childCount: number
  text: string
}
interface Retrieved {
  chunkId: string
  parentId: null | string
  score: number
  text: string
}
const clampRatio = (value: number): number => {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}
const dedupe = (retrieved: readonly Retrieved[]): Retrieved[] => {
  const seen = new Set<string>()
  const out: Retrieved[] = []
  for (const item of retrieved)
    if (!seen.has(item.chunkId)) {
      seen.add(item.chunkId)
      out.push(item)
    }
  return out
}
const groupByParent = (unique: readonly Retrieved[], parents: ReadonlyMap<string, ParentInfo>): Grouped => {
  const byParent = new Map<string, Retrieved[]>()
  const passthrough: Retrieved[] = []
  for (const item of unique) {
    const { parentId } = item
    if (parentId === null || !parents.has(parentId)) passthrough.push(item)
    else {
      const bucket = byParent.get(parentId)
      if (bucket === undefined) byParent.set(parentId, [item])
      else bucket.push(item)
    }
  }
  return { byParent, passthrough }
}
const maxScoreOf = (children: readonly Retrieved[]): number => {
  let best = Number.NEGATIVE_INFINITY
  for (const child of children) if (child.score > best) best = child.score
  return best
}
const collapsed = (args: {
  children: readonly Retrieved[]
  info: ParentInfo | undefined
  parentId: string
  ratio: number
}): Retrieved[] => {
  const { children, info, parentId, ratio } = args
  if (info === undefined || info.childCount <= 0 || children.length / info.childCount < ratio) return [...children]
  return [{ chunkId: parentId, parentId: null, score: maxScoreOf(children), text: info.text }]
}
const autoMerge = ({
  minChildRatio,
  parents,
  retrieved
}: {
  minChildRatio: number
  parents: ReadonlyMap<string, ParentInfo>
  retrieved: readonly Retrieved[]
}): Retrieved[] => {
  const ratio = clampRatio(minChildRatio)
  const { byParent, passthrough } = groupByParent(dedupe(retrieved), parents)
  const out: Retrieved[] = [...passthrough]
  for (const [parentId, children] of byParent)
    out.push(...collapsed({ children, info: parents.get(parentId), parentId, ratio }))
  out.sort((a, b) => b.score - a.score)
  return out
}
export { autoMerge, lostInTheMiddle, maximalMarginalRelevance }
export type { MmrArgs, MmrItem, ParentInfo, Retrieved }
