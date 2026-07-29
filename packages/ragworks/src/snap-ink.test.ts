import { describe, expect, test } from 'bun:test'
import { Document } from 'mupdf'
import { snapBlocksToInk } from './snap-ink'

const pdfWithLineAt = (yFromTop: number): Uint8Array => {
  const content = `BT /F1 12 Tf 60 ${String(792 - yFromTop)} Td (Hello ink) Tj ET`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${String(content.length)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  for (const [i, o] of objs.entries()) {
    offsets.push(pdf.length)
    pdf += `${String(i + 1)} 0 obj\n${o}\nendobj\n`
  }
  const xref = pdf.length
  pdf += `xref\n0 ${String(objs.length + 1)}\n0000000000 65535 f \n`
  for (const off of offsets) pdf += `${off.toString().padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${String(objs.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF`
  return new TextEncoder().encode(pdf)
}
describe('snapBlocksToInk', () => {
  const bytes = pdfWithLineAt(100)
  test('a page renders, so the fixture itself carries ink where the text was drawn', () => {
    const doc = Document.openDocument(bytes, 'application/pdf')
    expect(doc.countPages()).toBe(1)
  })
  test('a box already over its glyphs is left exactly as it is', () => {
    const onInk = [55, 700, 160, 686] as const
    const { blocks, snapped } = snapBlocksToInk(bytes, [{ bbox: onInk, page: 1, text: 'Hello ink' }])
    expect(snapped).toBe(0)
    expect(blocks[0]?.bbox).toEqual(onInk)
  })
  test('a box a line below its glyphs snaps up onto them', () => {
    const tooLow = [55, 686, 160, 672] as const
    const { blocks, snapped } = snapBlocksToInk(bytes, [{ bbox: tooLow, page: 1, text: 'Hello ink' }])
    expect(snapped).toBe(1)
    const moved = blocks[0]?.bbox
    expect(moved).toBeDefined()
    expect(moved?.[1]).toBeGreaterThan(tooLow[1])
  })
  test('a box over blank page area is never dragged to distant ink', () => {
    const empty = [400, 200, 500, 186] as const
    const onInk = [55, 700, 160, 686] as const
    const { blocks, snapped } = snapBlocksToInk(bytes, [
      { bbox: onInk, page: 1, text: 'Hello ink' },
      { bbox: empty, page: 1, text: 'nothing here' }
    ])
    expect(snapped).toBe(0)
    expect(blocks.some(b => b.bbox?.[0] === empty[0] && b.bbox[1] === empty[1] + 6)).toBe(false)
  })
  test('text that renders invisibly keeps its content and loses only its box, so nothing leaves the corpus', () => {
    const onInk = [55, 700, 160, 686] as const
    const invisible = [400, 200, 500, 186] as const
    const { blocks, unanchored } = snapBlocksToInk(bytes, [
      { bbox: onInk, page: 1, text: 'Hello ink' },
      { bbox: invisible, page: 1, text: 'CBM' }
    ])
    expect(unanchored).toBe(1)
    expect(blocks).toHaveLength(2)
    expect(blocks[1]?.text).toBe('CBM')
    expect(blocks[1]?.bbox).toBeNull()
  })
  test('a page that renders entirely blank keeps every box, so a failed render never strips a parse', () => {
    const { blocks, unanchored } = snapBlocksToInk(bytes, [
      { bbox: [400, 200, 500, 186] as const, page: 1, text: 'one' },
      { bbox: [400, 180, 500, 166] as const, page: 1, text: 'two' }
    ])
    expect(unanchored).toBe(0)
    expect(blocks).toHaveLength(2)
    expect(blocks[0]?.bbox).not.toBeNull()
  })
  test('a box carrying faint sub-threshold contrast is unanchored, never left as a box the ink gate then fails', () => {
    const onInk = [55, 700, 160, 686] as const
    const faint = [300, 300, 312, 286] as const
    const { blocks, unanchored } = snapBlocksToInk(bytes, [
      { bbox: onInk, page: 1, text: 'Hello ink' },
      { bbox: faint, page: 1, text: '• Sustainability, Energy & Urban Innovation' }
    ])
    expect(unanchored).toBe(1)
    expect(blocks[1]?.bbox).toBeNull()
    expect(blocks[1]?.text).toBe('• Sustainability, Energy & Urban Innovation')
  })
})
