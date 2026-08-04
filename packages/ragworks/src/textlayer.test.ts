import { expect, test } from 'bun:test'
import { textLayerBlocks } from './textlayer'

const pdfWithText = (label: string, yFromTop: number): Uint8Array<ArrayBuffer> => {
  const content = `BT /F1 12 Tf 60 ${String(792 - yFromTop)} Td (${label}) Tj ET`
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${String(content.length)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  for (const [i, obj] of objs.entries()) {
    offsets.push(pdf.length)
    pdf += `${String(i + 1)} 0 obj\n${obj}\nendobj\n`
  }
  const xref = pdf.length
  pdf += `xref\n0 ${String(objs.length + 1)}\n0000000000 65535 f \n`
  for (const off of offsets) pdf += `${off.toString().padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${String(objs.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF`
  return new Uint8Array(new TextEncoder().encode(pdf))
}
test('extracts a boxed text-layer block from a born-digital pdf', () => {
  const blocks = textLayerBlocks(pdfWithText('Hello ink', 100))
  const hit = blocks.find(block => block.text.includes('Hello ink'))
  expect(hit).toBeDefined()
  expect(hit?.page).toBe(1)
  expect(hit?.bbox?.length).toBe(4)
})
test('places the block near the drawn baseline in flipped coordinates', () => {
  const high = textLayerBlocks(pdfWithText('Marker', 80)).find(block => block.text.includes('Marker'))
  const low = textLayerBlocks(pdfWithText('Marker', 500)).find(block => block.text.includes('Marker'))
  expect((high?.bbox?.[1] ?? 0) > (low?.bbox?.[1] ?? 0)).toBe(true)
})
