/** A multi-level discount table: two group headers, each SPANNING two payment-method sub-columns, over four
 * near-duplicate turnover bands.
 *
 * Born-digital this page ANSWERS at gold rank 1. Scanned it fails, and the model returns the neighbouring
 * column's figure. That inversion is the whole entry: structure held constant and only the extraction path
 * varied, so the shape's difficulty is the arrangement PLUS the parse that loses it, never the arrangement
 * alone. The born-digital page is therefore the CONTROL rather than a second entry.
 *
 * What a flattened read destroys here is specific and was arrived at by refutation, not assumption: a header
 * that spans several columns and sits adjacent to none of its cells. Every coordinate written against the
 * thing it labels survives a scan — that is why a section header spanning ROWS answered at rank 5 while
 * quoting the row it read, and why an English price grid answered on both paths. The span is the lever. */
import type { Box, Line } from './pdf.ts'
import { page } from './pdf.ts'

const GROUPS = [
  { name: 'KHACH LE', subs: ['Tra truoc', 'Tra sau'] },
  { name: 'DOI TAC DOANH NGHIEP', subs: ['Tra truoc', 'Tra sau'] }
] as const
/** Deliberately near-duplicate: each band shifts by one percentage point, so an adjacent grab returns a
 * confident wrong figure rather than something obviously absurd. */
const BANDS = [
  { label: 'Tu 0 den 50 trieu', vals: ['3%', '4%', '5%', '6%'] },
  { label: 'Tu 50 den 200 trieu', vals: ['4%', '5%', '6%', '7%'] },
  { label: 'Tu 200 den 800 trieu', vals: ['5%', '6%', '7%', '8%'] },
  { label: 'Tu 800 trieu tro len', vals: ['6%', '7%', '9%', '10%'] }
] as const
/** The gold sits in the last band under the second group's second sub-column, so reading it requires BOTH
 * the spanning group header and the sub-column beneath it. The distractor is the same band one column left
 * — the corporate prepaid rate — which is what a flattened read returns. */
const QUESTIONS = [
  {
    expect: '10%',
    question: 'Doi tac doanh nghiep tra sau, doanh so tu 800 trieu tro len thi muc chiet khau la bao nhieu?',
    reject: '9%'
  }
] as const
const X0 = 60
const Y0 = 120
const BAND_W = 150
const COL_W = 85
const ROW_H = 26
const build = (): Uint8Array => {
  const lines: Line[] = [
    { bold: true, size: 15, text: 'CHINH SACH CHIET KHAU 2026', x: X0, y: 70 },
    { text: 'Bang muc khuyen mai theo nhom khach hang va hinh thuc thanh toan', x: X0, y: 92 }
  ]
  const boxes: Box[] = []
  let x = X0 + BAND_W
  for (const g of GROUPS) {
    const w = COL_W * g.subs.length
    boxes.push({ fill: 0.88, h: ROW_H, w, x, y: Y0 })
    lines.push({ bold: true, size: 8, text: g.name, x: x + 8, y: Y0 + 17 })
    x += w
  }
  boxes.push({ fill: 0.88, h: 2 * ROW_H, w: BAND_W, x: X0, y: Y0 })
  lines.push({ bold: true, size: 8, text: 'Doanh so', x: X0 + 8, y: Y0 + 30 })
  x = X0 + BAND_W
  for (const g of GROUPS)
    for (const s of g.subs) {
      boxes.push({ h: ROW_H, w: COL_W, x, y: Y0 + ROW_H })
      lines.push({ size: 8, text: s, x: x + 8, y: Y0 + ROW_H + 17 })
      x += COL_W
    }
  let y = Y0 + 2 * ROW_H
  for (const band of BANDS) {
    boxes.push({ h: ROW_H, w: BAND_W, x: X0, y })
    lines.push({ size: 8, text: band.label, x: X0 + 8, y: y + 17 })
    x = X0 + BAND_W
    for (const v of band.vals) {
      boxes.push({ h: ROW_H, w: COL_W, x, y })
      lines.push({ size: 8, text: v, x: x + 30, y: y + 17 })
      x += COL_W
    }
    y += ROW_H
  }
  lines.push({ size: 8, text: 'Ghi chu: muc khuyen mai ap dung cho ky thanh toan trong nam 2026.', x: X0, y: y + 30 })
  boxes.push({ h: y - Y0, w: BAND_W + GROUPS.length * 2 * COL_W, x: X0, y: Y0 })
  return page(lines, [], boxes)
}
export { build, QUESTIONS }
