interface GridCell {
  color?: string
  header: boolean
  text: string
}
const columnHeader = (grid: (GridCell | undefined)[][], headEnd: number, col: number): string => {
  const parts: string[] = []
  for (let r = 0; r < headEnd; r += 1) {
    const t = grid[r]?.[col]?.text ?? ''
    if (t !== '' && parts.at(-1) !== t) parts.push(t)
  }
  return parts.join(' · ')
}
const rowLine = (row: readonly (GridCell | undefined)[], headers: readonly string[], cols: number): string => {
  const cells: string[] = []
  for (let c = 0; c < cols; c += 1) {
    const cell = row[c]
    const v = cell?.text ?? ''
    const color = cell?.color
    if (v !== '' || color !== undefined) {
      const h = headers[c] ?? ''
      let label = v
      if (c !== 0 && h !== '') label = v === '' ? h : `${h}: ${v}`
      cells.push(color === undefined ? label : `${label} [${color}]`.trim())
    }
  }
  return cells.join(' │ ')
}
const describeGrid = (grid: (GridCell | undefined)[][]): { line: string; rowIndex: number }[] => {
  if (grid.length === 0) return []
  const cols = Math.max(...grid.map(row => row.length))
  const firstData = grid.findIndex(row => !row.some(cell => cell?.header === true))
  const headEnd = firstData === -1 ? Math.min(1, grid.length - 1) : firstData
  const headers = Array.from({ length: cols }, (_, col) => columnHeader(grid, headEnd, col))
  const out: { line: string; rowIndex: number }[] = []
  for (let r = headEnd; r < grid.length; r += 1) {
    const line = rowLine(grid[r] ?? [], headers, cols)
    if (line !== '') out.push({ line, rowIndex: r })
  }
  return out
}
export { describeGrid }
export type { GridCell }
