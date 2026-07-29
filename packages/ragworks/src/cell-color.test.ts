import { describe, expect, test } from 'bun:test'
import type { PixelPlane } from './cell-color'
import { cellColorName, colorName, dominantColor, isSaturated, nearestLabel } from './cell-color'

test('colorName returns null for grayscale (white, black, grey) — no status color', () => {
  expect(colorName({ b: 255, g: 255, r: 255 })).toBeNull()
  expect(colorName({ b: 0, g: 0, r: 0 })).toBeNull()
  expect(colorName({ b: 190, g: 190, r: 190 })).toBeNull()
})
test('colorName maps observed pastel fills to their palette names', () => {
  expect(colorName({ b: 240, g: 192, r: 192 })).toBe('blue')
  expect(colorName({ b: 144, g: 240, r: 240 })).toBe('yellow')
  expect(colorName({ b: 192, g: 240, r: 144 })).toBe('green')
  expect(colorName({ b: 96, g: 144, r: 192 })).toBe('orange')
})
test('isSaturated distinguishes a colored fill from a near-grey', () => {
  expect(isSaturated({ b: 240, g: 192, r: 192 })).toBe(true)
  expect(isSaturated({ b: 200, g: 205, r: 210 })).toBe(false)
})
const plane = (w: number, h: number, fill: [number, number, number]): PixelPlane => {
  const pixels = new Uint8Array(w * h * 3)
  for (let i = 0; i < pixels.length; i += 3) [pixels[i], pixels[i + 1], pixels[i + 2]] = fill
  return { comps: 3, height: h, pixels, width: w }
}
test('dominantColor returns the majority saturated fill of a region', () => {
  const p = plane(20, 20, [150, 230, 150])
  const c = dominantColor(p, { x0: 2, x1: 18, y0: 2, y1: 18 })
  expect(c && colorName(c)).toBe('green')
})
test('cellColorName returns null on a white cell', () => {
  expect(cellColorName(plane(20, 20, [255, 255, 255]), { x0: 0, x1: 20, y0: 0, y1: 20 })).toBeNull()
})
test('cellColorName names a green cell region', () => {
  expect(cellColorName(plane(20, 20, [150, 230, 150]), { x0: 0, x1: 20, y0: 0, y1: 20 })).toBe('green')
})
describe('document-local colour vocabulary', () => {
  const vocab = [
    { label: 'Đang áp dụng', rgb: { b: 180, g: 223, r: 197 } },
    { label: 'Đang xây dựng', rgb: { b: 172, g: 202, r: 248 } },
    { label: 'Cần kiểm tra thêm về quy định', rgb: { b: 0, g: 255, r: 255 } },
    { label: 'Chưa triển khai', rgb: { b: 206, g: 206, r: 208 } }
  ]
  test('pure yellow resolves to its own legend entry, never to a global palette name', () => {
    expect(nearestLabel({ b: 2, g: 253, r: 254 }, vocab)).toBe('Cần kiểm tra thêm về quy định')
  })
  test('pastel orange resolves to the entry it actually matches', () => {
    expect(nearestLabel({ b: 170, g: 200, r: 246 }, vocab)).toBe('Đang xây dựng')
  })
  test('an unsaturated grey still resolves, because the legend defines it', () => {
    expect(nearestLabel({ b: 205, g: 205, r: 207 }, vocab)).toBe('Chưa triển khai')
  })
  test('a colour unlike every legend entry resolves to nothing', () => {
    expect(nearestLabel({ b: 20, g: 20, r: 20 }, vocab)).toBeNull()
  })
})
