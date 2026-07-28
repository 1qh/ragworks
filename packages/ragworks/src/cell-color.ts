interface PixelPlane {
  comps: number
  height: number
  pixels: Uint8Array | Uint8ClampedArray
  width: number
}
interface Rgb {
  b: number
  g: number
  r: number
}
const SWATCHES: { name: string; rgb: Rgb }[] = [
  { name: 'blue', rgb: { b: 235, g: 180, r: 170 } },
  { name: 'green', rgb: { b: 170, g: 220, r: 150 } },
  { name: 'yellow', rgb: { b: 140, g: 230, r: 235 } },
  { name: 'orange', rgb: { b: 110, g: 175, r: 235 } },
  { name: 'red', rgb: { b: 140, g: 140, r: 225 } },
  { name: 'purple', rgb: { b: 220, g: 160, r: 200 } },
  { name: 'pink', rgb: { b: 210, g: 180, r: 240 } }
]
const SAT_MIN = 28
const MIN_SAMPLES = 8
const dist2 = (a: Rgb, b: Rgb): number => (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2
const isSaturated = (c: Rgb): boolean => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) >= SAT_MIN
const bucket = (n: number): number => Math.floor(n / 32)
const colorName = (c: Rgb): null | string => {
  if (!isSaturated(c)) return null
  let best = SWATCHES[0]
  if (!best) return null
  for (const s of SWATCHES) if (dist2(c, s.rgb) < dist2(c, best.rgb)) best = s
  return best.name
}
const dominantColor = (plane: PixelPlane, box: { x0: number; x1: number; y0: number; y1: number }): null | Rgb => {
  const { comps, height, pixels, width } = plane
  const x0 = Math.max(0, Math.floor(Math.min(box.x0, box.x1)))
  const x1 = Math.min(width, Math.ceil(Math.max(box.x0, box.x1)))
  const y0 = Math.max(0, Math.floor(Math.min(box.y0, box.y1)))
  const y1 = Math.min(height, Math.ceil(Math.max(box.y0, box.y1)))
  const buckets = new Map<string, { b: number; g: number; n: number; r: number }>()
  for (let y = y0; y < y1; y += 2)
    for (let x = x0; x < x1; x += 2) {
      const i = (y * width + x) * comps
      const c = { b: pixels[i + 2] ?? 0, g: pixels[i + 1] ?? 0, r: pixels[i] ?? 0 }
      if (isSaturated(c)) {
        const key = `${bucket(c.r)}:${bucket(c.g)}:${bucket(c.b)}`
        const cur = buckets.get(key) ?? { b: 0, g: 0, n: 0, r: 0 }
        buckets.set(key, { b: cur.b + c.b, g: cur.g + c.g, n: cur.n + 1, r: cur.r + c.r })
      }
    }
  let best: undefined | { b: number; g: number; n: number; r: number }
  for (const v of buckets.values()) if (!best || v.n > best.n) best = v
  if (!best || best.n < MIN_SAMPLES) return null
  return { b: Math.round(best.b / best.n), g: Math.round(best.g / best.n), r: Math.round(best.r / best.n) }
}
const NEUTRAL_MIN = 12
const neutralFill = (plane: PixelPlane, box: { x0: number; x1: number; y0: number; y1: number }): null | Rgb => {
  const { comps, height, pixels, width } = plane
  const x0 = Math.max(0, Math.floor(Math.min(box.x0, box.x1)))
  const x1 = Math.min(width, Math.ceil(Math.max(box.x0, box.x1)))
  const y0 = Math.max(0, Math.floor(Math.min(box.y0, box.y1)))
  const y1 = Math.min(height, Math.ceil(Math.max(box.y0, box.y1)))
  let n = 0
  let sum = { b: 0, g: 0, r: 0 }
  for (let y = y0; y < y1; y += 2)
    for (let x = x0; x < x1; x += 2) {
      const i = (y * width + x) * comps
      const c = { b: pixels[i + 2] ?? 0, g: pixels[i + 1] ?? 0, r: pixels[i] ?? 0 }
      const lum = (c.r * 299 + c.g * 587 + c.b * 114) / 1000
      if (lum < 250 && lum > 60) {
        sum = { b: sum.b + c.b, g: sum.g + c.g, r: sum.r + c.r }
        n += 1
      }
    }
  if (n < MIN_SAMPLES) return null
  const avg = { b: Math.round(sum.b / n), g: Math.round(sum.g / n), r: Math.round(sum.r / n) }
  return 255 - Math.max(avg.r, avg.g, avg.b) >= NEUTRAL_MIN ? avg : null
}
const fillColor = (plane: PixelPlane, box: { x0: number; x1: number; y0: number; y1: number }): null | Rgb =>
  dominantColor(plane, box) ?? neutralFill(plane, box)
const nearestLabel = (c: Rgb, vocabulary: readonly { label: string; rgb: Rgb }[]): null | string => {
  let best: null | { d: number; label: string } = null
  for (const v of vocabulary) {
    const d = dist2(c, v.rgb)
    if (!best || d < best.d) best = { d, label: v.label }
  }
  return best && best.d <= 3000 ? best.label : null
}
const cellColorName = (plane: PixelPlane, box: { x0: number; x1: number; y0: number; y1: number }): null | string => {
  const c = dominantColor(plane, box)
  return c ? colorName(c) : null
}
export { cellColorName, colorName, dominantColor, fillColor, isSaturated, nearestLabel }
export type { PixelPlane, Rgb }
