/** A dense grid of look-alike percentages under a TWO-ROW header — the corpus's retrieval shape, and the
 * only entry that measures a retriever with extraction held right.
 *
 * Its difficulty is a CONJUNCTION, established by varying both factors independently rather than by
 * authoring another page and arguing about it:
 *
 *                     one header row      two header rows
 *   distinct cells    answers, rank 1     answers, rank 1
 *   look-alike cells  answers, rank 4     REPRODUCES, gold never retrieved
 *
 * Neither factor does anything alone. A deep header gives the read an alignment to get wrong; look-alike
 * cells remove any downstream chance of noticing that it did, because a figure an order of magnitude out is
 * not a plausible answer while a percentage one point out is. Size is the threshold that separates this
 * from the scanned grid: sixteen look-alike cells still leave a retriever a discriminator and thirty-six
 * do not.
 *
 * It reproduces BORN-DIGITAL, with a perfect text layer, so the difficulty is not optical — anyone running
 * it measures their retriever rather than their OCR. It survives whole-table chunking and every granularity
 * a block-bound chunker offers, and `dense-2hdr-ruled.ts` proves it survives a perfectly correct parse.
 *
 * The entry is a QUESTION, not a page: a sibling cell on this same grid answers at rank 1, so substituting
 * another cell silently turns a hard entry into an easy one. Both questions ship for exactly that reason. */
import type { Line } from './pdf.ts'
import { page } from './pdf.ts'

const GROUPS = [
  { name: 'NAM 2025', subs: ['Q1', 'Q2', 'Q3'] },
  { name: 'NAM 2026', subs: ['Q1', 'Q2', 'Q3'] }
] as const
const ROWS = [
  { label: 'Nhom A1', vals: ['4,2%', '4,5%', '4,8%', '5,1%', '5,4%', '5,7%'] },
  { label: 'Nhom A2', vals: ['4,4%', '4,7%', '5,0%', '5,3%', '5,6%', '5,9%'] },
  { label: 'Nhom B1', vals: ['4,6%', '4,9%', '5,2%', '5,5%', '5,8%', '6,1%'] },
  { label: 'Nhom B2', vals: ['4,8%', '5,1%', '5,4%', '5,7%', '6,0%', '6,3%'] },
  { label: 'Nhom C1', vals: ['5,0%', '5,3%', '5,6%', '5,9%', '6,2%', '6,5%'] },
  { label: 'Nhom C2', vals: ['5,2%', '5,5%', '5,8%', '6,1%', '6,4%', '6,7%'] }
] as const
/** Two questions on ONE page with opposite outcomes, which is why the entry states its question. The first
 * is never retrieved; the second is answered at gold rank 1. Same page, same parse, same chunks. */
const QUESTIONS = [
  { expect: '5,8%', question: 'Nhom B1, nam 2026 quy Q2, ty le trich lap du phong la bao nhieu?', reject: '5,5%' },
  { expect: '5,9%', question: 'Nhom C1, nam 2026 quy Q1, ty le trich lap du phong la bao nhieu?', reject: '5,6%' }
] as const
const X0 = 55
const CW = 72
const build = (ruled = false): Uint8Array => {
  const lines: Line[] = [
    { bold: true, size: 15, text: 'TY LE TRICH LAP DU PHONG THEO NHOM', x: X0, y: 70 },
    { text: 'Don vi tinh: phan tram tren du no', x: X0, y: 90 }
  ]
  const rules: { x1: number; x2: number; y: number }[] = []
  const y0 = 128
  let col = 0
  for (const g of GROUPS) {
    lines.push({ bold: true, size: 10, text: g.name, x: X0 + 90 + col * CW + 18, y: y0 })
    col += g.subs.length
  }
  const y1 = y0 + 20
  lines.push({ bold: true, size: 10, text: 'Nhom', x: X0, y: y1 })
  let i = 0
  for (const g of GROUPS)
    for (const sub of g.subs) {
      lines.push({ bold: true, size: 10, text: sub, x: X0 + 90 + i * CW, y: y1 })
      i += 1
    }
  /** The RULED variant exists to settle ownership of an off-by-one: a borderless grid makes the extractor
   * infer column boundaries from x positions, and a label drawn at a column's origin can fall on the wrong
   * side of an inferred one. Ruling the columns removes the inference — and the gold is STILL never
   * retrieved, which is what proves the difficulty is retrieval rather than extraction. */
  if (ruled) rules.push({ x1: X0, x2: 539, y: y1 + 6 })
  let y = y1 + 26
  for (const row of ROWS) {
    lines.push({ size: 10, text: row.label, x: X0, y })
    for (const [j, v] of row.vals.entries()) lines.push({ size: 10, text: v, x: X0 + 90 + j * CW, y })
    if (ruled) rules.push({ x1: X0, x2: 539, y: y + 8 })
    y += 30
  }
  lines.push({ text: 'Ty le duoc ra soat dinh ky theo quy dinh noi bo.', x: X0, y: y + 24 })
  return page(lines, rules)
}
export { build, QUESTIONS }
