const COMMUNITY_TEXT_MEMBERS = 24
const SIMILARITY_FLOOR = 0.35
const cosine = (a: readonly number[], b: readonly number[]): number => {
  if (a.length === 0 || a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (const [i, ai] of a.entries()) {
    const bi = b[i] ?? 0
    dot += ai * bi
    na += ai * ai
    nb += bi * bi
  }
  const mag = Math.sqrt(na) * Math.sqrt(nb)
  return mag === 0 ? 0 : dot / mag
}
const entityText = (name: string, type: string): string => `${name} (${type})`
const relationshipText = (source: string, target: string): string => `${source} — ${target}`
const communityText = (members: readonly string[], summary: null | string): string =>
  summary ?? members.slice(0, COMMUNITY_TEXT_MEMBERS).join(', ')
const rankBySimilarity = <T extends { vec: null | number[] }>(
  rows: readonly T[],
  question: readonly number[],
  limit: number
): { row: T; score: number }[] =>
  rows
    .filter((r): r is T & { vec: number[] } => Array.isArray(r.vec) && r.vec.length > 0)
    .map(row => ({ row, score: cosine(row.vec, question) }))
    .filter(s => s.score >= SIMILARITY_FLOOR)
    .toSorted((x, y) => y.score - x.score)
    .slice(0, limit)
export { communityText, cosine, entityText, rankBySimilarity, relationshipText, SIMILARITY_FLOOR }
