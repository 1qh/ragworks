const FENCE_OPEN = /^```(?:json)?/u
const FENCE_CLOSE = /```$/u
const LIST_MARKER = /^\s*(?:[-*]|\d+[.)])\s*/u
const parseQueryList = (text: string, fallback: string): string[] => {
  const cleaned = text.trim().replace(FENCE_OPEN, '').replace(FENCE_CLOSE, '').trim()
  try {
    const parsed: unknown = JSON.parse(cleaned)
    if (Array.isArray(parsed)) {
      const items = parsed.filter((v): v is string => typeof v === 'string' && v.trim() !== '').map(v => v.trim())
      return items.length > 0 ? items : [fallback]
    }
  } catch {
    /* not JSON — fall through to line splitting */
  }
  const lines = cleaned
    .split('\n')
    .map(l => l.replace(LIST_MARKER, '').trim())
    .filter(l => l !== '')
  return lines.length > 0 ? lines : [fallback]
}
export { parseQueryList }
