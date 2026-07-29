import { describe, expect, test } from 'bun:test'
import type { GridCell } from './table-grid.js'
import { describeGrid } from './table-grid.js'

const head = (text: string): GridCell => ({ header: true, text })
const cell = (text: string): GridCell => ({ header: false, text })
const gap: GridCell = { header: true, text: '' }
describe('describeGrid', () => {
  test('carries a spanning group header across every column it covers', () => {
    const grid: (GridCell | undefined)[][] = [
      [gap, head('NAM 2025'), gap, head('NAM 2026'), gap],
      [head('Nhom'), head('Q1'), head('Q2'), head('Q1'), head('Q2')],
      [cell('B1'), cell('4,6%'), cell('4,9%'), cell('5,5%'), cell('5,8%')]
    ]
    const line = describeGrid(grid)[0]?.line ?? ''
    expect(line).toContain('NAM 2025 · Q1: 4,6%')
    expect(line).toContain('NAM 2025 · Q2: 4,9%')
    expect(line).toContain('NAM 2026 · Q1: 5,5%')
    expect(line).toContain('NAM 2026 · Q2: 5,8%')
  })
  test('invents no header where a row carries none, so a single-header table is unchanged', () => {
    const grid: (GridCell | undefined)[][] = [
      [head('Nhom'), head('Q1'), head('Q2')],
      [cell('B1'), cell('4,6%'), cell('4,9%')]
    ]
    expect(describeGrid(grid)[0]?.line).toBe('B1 │ Q1: 4,6% │ Q2: 4,9%')
  })
})
