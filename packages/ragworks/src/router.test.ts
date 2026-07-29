import { describe, expect, test } from 'bun:test'
import { routePage, withoutMinerU } from './router'

const NULL_BYTES = '\u0000'.repeat(6)
describe('router', () => {
  test('clean Vietnamese text-layer page routes fast', () => {
    const vn =
      'Thông báo Chính sách bảo hành xe điện VinFast đã dừng sản xuất tại Việt Nam kể từ ngày ban hành quyết định này. '.repeat(
        5
      )
    const s = routePage(vn)
    expect(s.route).toBe('fast')
    expect(s.validFrac).toBeGreaterThan(0.9)
  })
  test('vietnamese diacritics are valid (not flagged as garbage)', () => {
    const s = routePage(
      'Đại học VinUni áp dụng học phí theo hai đợt mỗi năm học và miễn giảm cho sinh viên xuất sắc trong toàn khóa. '.repeat(
        4
      )
    )
    expect(s.validFrac).toBeGreaterThan(0.9)
    expect(s.route).toBe('fast')
  })
  test('short page routes vlm', () => {
    expect(routePage('Hình 1').route).toBe('vlm')
  })
  test('empty / whitespace page routes vlm', () => {
    expect(routePage('   \n  ').route).toBe('vlm')
    expect(routePage('').charCount).toBe(0)
  })
  test('control-byte / CID corrupt text-layer routes vlm', () => {
    const corrupt = `${'x'.repeat(400)}\u0000\u0000\u0000��${'y'.repeat(400)}`
    const s = routePage(corrupt)
    expect(s.ctrlRatio).toBeGreaterThan(0.002)
    expect(s.route).toBe('vlm')
  })
  test('mojibake / wrong-script letters route vlm', () => {
    const s = routePage('░▒▓█ ╬╩╪ ▄▀■ Ω≈ç√∫˜µ≤ ‰¶•ª �‰ˇ¿ '.repeat(20))
    expect(s.validFrac).toBeLessThan(0.6)
    expect(s.route).toBe('vlm')
  })
  test('a graphic-only page (low text + graphics present) routes to MinerU, not vlm', () => {
    expect(routePage('', true).route).toBe('mineru')
    expect(routePage('a few labels', true).route).toBe('mineru')
  })
  test('a scanned-text page (low text, no graphics) still routes to vlm for OCR', () => {
    expect(routePage('', false).route).toBe('vlm')
  })
  test('a clean text-layer page routes to docling regardless of graphics', () => {
    const clean = 'The transformer relies on self-attention. '.repeat(20)
    expect(routePage(clean, true).route).toBe('fast')
  })
  test('a line-dense clean page is not corrupt — newlines are layout, not control bytes', () => {
    const table = 'Chinh sach khuyen mai ap dung cho khach hang doanh nghiep nam 2026.\n'.repeat(12)
    const s = routePage(table)
    expect(s.ctrlRatio).toBe(0)
    expect(s.route).toBe('fast')
  })
  test('layout whitespace and a real control byte are told apart on the same page', () => {
    const lines = 'Bang gia dich vu nam 2026 ap dung tren toan he thong.\n'.repeat(8)
    expect(routePage(lines).ctrlRatio).toBe(0)
    expect(routePage(`${lines}${NULL_BYTES}`).ctrlRatio).toBeGreaterThan(0)
    expect(routePage(`${lines}${NULL_BYTES}`).route).toBe('vlm')
  })
  test('a MinerU page falls back to the vlm when MinerU is not configured', () => {
    expect(withoutMinerU(['mineru', 'fast', 'vlm', 'mineru'])).toEqual(['vlm', 'fast', 'vlm', 'vlm'])
  })
  test('a scanned page with graphics never keeps its garbled text layer without MinerU', () => {
    const scanned = routePage('.', true).route
    expect(scanned).toBe('mineru')
    expect(withoutMinerU([scanned])).toEqual(['vlm'])
  })
})
