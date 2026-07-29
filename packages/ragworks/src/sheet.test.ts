import { describe, expect, test } from 'bun:test'
import { Workbook } from 'exceljs'
import { isSheet, parseSheet } from './sheet'

const bytesOf = (s: string): Uint8Array<ArrayBuffer> => {
  const src = new TextEncoder().encode(s)
  const buf = new ArrayBuffer(src.byteLength)
  new Uint8Array(buf).set(src)
  return new Uint8Array(buf)
}
describe('sheet extraction', () => {
  test('isSheet matches spreadsheet extensions only', () => {
    expect(isSheet('data.csv')).toBe(true)
    expect(isSheet('book.xlsx')).toBe(true)
    expect(isSheet('old.xls')).toBe(false)
    expect(isSheet('doc.pdf')).toBe(false)
    expect(isSheet('note.txt')).toBe(false)
  })
  test('csv parses to grid geometry with per-row cell blocks', async () => {
    const result = await parseSheet({ bytes: bytesOf('name,score\nAda,91\nGrace,88'), name: 'data.csv' })
    expect(result.geometry).toBe('grid')
    expect(result.engine).toBe('sheet(exceljs)')
    expect(result.blocks).toHaveLength(3)
    expect(result.blocks.every(b => b.cell !== undefined && b.kind === 'table' && b.bbox === null)).toBe(true)
    expect(result.blocks[0]?.text).toBe('name | score')
    expect(result.blocks[1]?.cell?.row).toBe(2)
    expect(result.markdown).toContain('Ada | 91')
  })
  test('a grid parse chunks without a span-overflow: markdown aligns with block spans', async () => {
    const { buildChunks } = await import('./chunker')
    const result = await parseSheet({ bytes: bytesOf('name,score\nAda,91\nGrace,88'), name: 'data.csv' })
    const chunks = await buildChunks({
      blocks: result.blocks,
      markdown: result.markdown,
      maxSize: 800,
      overlap: 100,
      strategy: 'recursive'
    })
    expect(chunks.length).toBeGreaterThan(0)
  })
  test('xlsx round-trips to grid blocks', async () => {
    const wb = new Workbook()
    const ws = wb.addWorksheet('S1')
    ws.addRow(['h1', 'h2'])
    ws.addRow(['v1', 'v2'])
    const ab = await wb.xlsx.writeBuffer()
    const src = new Uint8Array(ab)
    const bytes = new Uint8Array(new ArrayBuffer(src.byteLength))
    bytes.set(src)
    const result = await parseSheet({ bytes, name: 'book.xlsx' })
    expect(result.geometry).toBe('grid')
    expect(result.blocks).toHaveLength(2)
    expect(result.blocks[0]?.text).toBe('h1 | h2')
  })
})
