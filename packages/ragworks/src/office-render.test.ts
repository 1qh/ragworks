import { expect, test } from 'bun:test'
import { ColorSpace, Document, Matrix, PDFDocument } from 'mupdf'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { outputName, pngsToPdf } from './office-render'
import { isPresentationName } from './upload'

const onePagePng = (): Uint8Array => {
  const doc = new PDFDocument()
  doc.insertPage(-1, doc.addPage([0, 0, 120, 90], 0, doc.addObject({}), 'q Q'))
  const page = doc.loadPage(0)
  const pix = page.toPixmap(Matrix.scale(2, 2), ColorSpace.DeviceRGB, false)
  return pix.asPNG()
}
test('replaces an office extension with the target extension', () => {
  expect(outputName('/work/office-render-x/report.docx', '.pdf')).toBe('/work/office-render-x/report.pdf')
  expect(outputName('/work/office-render-x/book.xlsx', '.pdf')).toBe('/work/office-render-x/book.pdf')
})
test('replaces a NON-office (image) extension too, so soffice output is read from the right path', () => {
  expect(outputName('/work/office-render-x/scan.png', '.pdf')).toBe('/work/office-render-x/scan.pdf')
  expect(outputName('/work/office-render-x/photo.jpeg', '.pdf')).toBe('/work/office-render-x/photo.pdf')
})
test('replaces only the final extension, leaving dotted directory segments intact', () => {
  expect(outputName('/work/office.render/scan.png', '.pdf')).toBe('/work/office.render/scan.pdf')
})
test('isPresentationName routes only slide formats to the slide-render fallback', () => {
  for (const name of ['deck.pptx', 'deck.ppt', 'deck.odp', 'DECK.PPTX']) expect(isPresentationName(name)).toBe(true)
  for (const name of ['report.docx', 'book.xlsx', 'page.html', 'notes.txt', 'scan.pdf'])
    expect(isPresentationName(name)).toBe(false)
})
test('pngsToPdf assembles numbered slide images into a reopenable one-page-per-image PDF', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pngs-test-'))
  try {
    const png = onePagePng()
    for (const n of [1, 2, 3]) await Bun.write(join(dir, `slide_${String(n).padStart(4, '0')}.png`), png)
    await Bun.write(join(dir, 'notes.txt'), 'ignored — not a png')
    const pdf = await pngsToPdf(dir)
    const doc = Document.openDocument(pdf, 'application/pdf')
    expect(doc.countPages()).toBe(3)
  } finally {
    await rm(dir, { force: true, recursive: true })
  }
})
test('pngsToPdf refuses a directory with no slide images rather than emitting an empty pdf', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pngs-empty-'))
  try {
    expect(pngsToPdf(dir)).rejects.toThrow('no images')
  } finally {
    await rm(dir, { force: true, recursive: true })
  }
})
