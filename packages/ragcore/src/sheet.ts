import { Workbook } from 'exceljs'
import { Readable } from 'node:stream'
import type { ParseResult } from './docling'
import type { Block, PageDim } from './lib'
import { markdownOf } from './lib'

const SHEET_RE = /\.(?:csv|xlsx)$/iu
const CSV_RE = /\.csv$/iu
const scalar = (v: unknown): string => {
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return ''
}
const isSheet = (name: string): boolean => SHEET_RE.test(name)
const cellText = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    if ('text' in value) return scalar(value.text)
    if ('result' in value) return scalar(value.result)
    return ''
  }
  return scalar(value)
}
const loadWorkbook = async (bytes: Uint8Array<ArrayBuffer>, name: string): Promise<Workbook> => {
  const wb = new Workbook()
  await (CSV_RE.test(name) ? wb.csv.read(Readable.from(Buffer.from(bytes))) : wb.xlsx.load(bytes.buffer))
  return wb
}
const rowLine = (cells: readonly string[]): string => cells.map(c => c.replaceAll('|', String.raw`\|`)).join(' | ')
const parseSheet = async ({
  bytes,
  name,
  onProgress
}: {
  bytes: Uint8Array<ArrayBuffer>
  name: string
  onProgress?: (label: string) => void
}): Promise<ParseResult> => {
  onProgress?.('reading workbook rows')
  const wb = await loadWorkbook(bytes, name)
  const blocks: Block[] = []
  const pages: PageDim[] = []
  wb.eachSheet((ws, sheetId) => {
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const cells: (string | undefined)[] = []
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cells[colNumber - 1] = cellText(cell.value)
      })
      const text = rowLine(Array.from(cells, c => c ?? ''))
      blocks.push({
        bbox: null,
        cell: { col: 0, page: sheetId, row: rowNumber, table: sheetId },
        kind: 'table',
        page: sheetId,
        text
      })
    })
    pages.push({ height: 0, pageNo: sheetId, width: 0 })
  })
  return { blocks, engine: 'sheet(exceljs)', geometry: 'grid', markdown: markdownOf(blocks), pages }
}
export { isSheet, parseSheet }
