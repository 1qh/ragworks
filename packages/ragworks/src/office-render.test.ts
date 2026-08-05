import { expect, test } from 'bun:test'
import { outputName } from './office-render'

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
