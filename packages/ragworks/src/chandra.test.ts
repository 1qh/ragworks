import { expect, test } from 'bun:test'
import { isDegenerate, pageBlocks, renderCrop } from './chandra'
import { buildPdf } from './test-base'

const div = (bbox: string, text: string): string => `<div data-bbox="${bbox}" data-label="text"><p>${text}</p></div>`
test('pageBlocks collapses a repetition loop emitted as many divs sharing one bbox', () => {
  const html =
    div('0 0 500 20', 'Đơn vị: nghìn VNĐ') +
    Array.from({ length: 106 }, () => div('0 30 500 50', 'Unit: thousand VND')).join('')
  const blocks = pageBlocks({ heightPt: 100, html, pageNo: 1, widthPt: 100 })
  expect(blocks.map(b => b.text)).toEqual(['Đơn vị: nghìn VNĐ', 'Unit: thousand VND'])
})
test('pageBlocks collapses a repetition loop repeated inside one div', () => {
  const looped = ['Đơn vị: nghìn VNĐ', ...Array.from({ length: 106 }, () => 'Unit: thousand VND')].join('\n')
  const blocks = pageBlocks({ heightPt: 100, html: div('0 0 1000 1000', looped), pageNo: 1, widthPt: 100 })
  expect(blocks.map(b => b.text)).toEqual(['Đơn vị: nghìn VNĐ', 'Unit: thousand VND'])
})
test('pageBlocks keeps a legitimate duplicate pair and identical text at different boxes', () => {
  const pair = div('0 0 500 20', '42. Phở gà 220') + div('0 30 500 50', '240') + div('0 30 500 50', '240')
  const apart = div('0 60 500 80', '240') + div('0 90 500 110', '240')
  const blocks = pageBlocks({ heightPt: 100, html: pair + apart, pageNo: 1, widthPt: 100 })
  expect(blocks.map(b => b.text)).toEqual(['42. Phở gà 220', '240', '240', '240', '240'])
})
test('isDegenerate flags a repetition loop of duplicate block texts', () => {
  const loop = Array.from({ length: 20 }, (_v, i) => div(`10 ${String(20 + i)} 400 ${String(35 + i)}`, 'CỤC TRƯỞNG')).join(
    ''
  )
  expect(isDegenerate(loop)).toBe(true)
})
test('isDegenerate passes a normal page of varied block texts', () => {
  const page = Array.from({ length: 20 }, (_v, i) =>
    div(`10 ${String(20 + i)} 400 ${String(35 + i)}`, `Điều ${String(i)} nội dung khác nhau`)
  ).join('')
  expect(isDegenerate(page)).toBe(false)
})
test('isDegenerate ignores a short page below the repetition threshold', () => {
  expect(isDegenerate(div('10 20 400 35', 'x') + div('10 40 400 55', 'x'))).toBe(false)
})
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
test('renderCrop returns a PNG crop of the given page bbox', () => {
  const png = renderCrop({ bbox: [50, 720, 560, 680], bytes: buildPdf(), contentType: 'application/pdf', pageIndex: 0 })
  const bytes = Buffer.from(png, 'base64')
  expect(bytes.length).toBeGreaterThan(8)
  expect(bytes.subarray(0, 8)).toEqual(PNG_MAGIC)
})
test('renderCrop clamps a degenerate zero-area bbox to a minimum crop', () => {
  const png = renderCrop({ bbox: [100, 500, 100, 500], bytes: buildPdf(), contentType: 'application/pdf', pageIndex: 0 })
  expect(Buffer.from(png, 'base64').subarray(0, 8)).toEqual(PNG_MAGIC)
})
