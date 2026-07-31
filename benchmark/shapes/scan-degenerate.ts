/** A Vietnamese administrative decision, rendered and then degraded into a scan whose text layer is ONE
 * character — the extraction wipe-out.
 *
 * It measures whether a stack escalates to OCR at all. A text-layer parser "succeeds" against it and
 * recovers nothing, so a stack that answers is reading pixels and one that does not is trusting a text
 * layer that is not there. Nothing about retrieval or generation is exercised; the figure is simply absent
 * from the text unless something looked at the image.
 *
 * The page is rendered through SVG rather than placed as PDF text, and that is a deliberate fix rather than
 * a convenience. The reference generator hardcoded a proprietary macOS font path, which made this shape
 * regenerable on exactly one operating system — so "anyone may redistribute it" was false for this entry.
 * SVG text resolves through fontconfig, so any system carrying a Unicode font produces the page.
 *
 * Its control is the SOURCE TEXT this page is rendered from, whose length is asserted below: a born-digital
 * page of this content carries thousands of characters and the scan carries one. The reference version
 * shipped that control as a second PDF, which is not reproducible here without embedding a font binary —
 * no libre TTF ships in the dependency tree, and a system font path is the defect being removed. The
 * character count is the evidence either way, and the generator states it rather than a doc asserting it. */
import { scanifyImage } from './scan.ts'

const W = 1240
const H = 1754
interface DecisionLine {
  readonly align: 'center' | 'left'
  readonly size: number
  readonly text: string
}
const LINES: readonly DecisionLine[] = [
  { align: 'center', size: 34, text: 'UỶ BAN NHÂN DÂN TỈNH LÂM PHONG' },
  { align: 'center', size: 26, text: 'SỞ TÀI CHÍNH' },
  { align: 'center', size: 10, text: '' },
  { align: 'center', size: 32, text: 'QUYẾT ĐỊNH' },
  { align: 'center', size: 22, text: 'Về việc ban hành mức thu phí thẩm định hồ sơ năm 2026' },
  { align: 'left', size: 14, text: '' },
  { align: 'left', size: 22, text: 'Điều 1. Phạm vi điều chỉnh' },
  { align: 'left', size: 20, text: 'Quyết định này quy định mức thu, chế độ thu, nộp và quản lý' },
  { align: 'left', size: 20, text: 'phí thẩm định hồ sơ cấp phép hoạt động trên địa bàn tỉnh.' },
  { align: 'left', size: 12, text: '' },
  { align: 'left', size: 22, text: 'Điều 2. Mức thu' },
  { align: 'left', size: 20, text: 'Mức thu phí thẩm định hồ sơ đối với tổ chức kinh tế là' },
  { align: 'left', size: 20, text: '2.450.000 đồng cho mỗi bộ hồ sơ nộp lần đầu.' },
  { align: 'left', size: 20, text: 'Mức thu đối với cá nhân là 780.000 đồng cho mỗi bộ hồ sơ.' },
  { align: 'left', size: 20, text: 'Trường hợp nộp lại hồ sơ đã bị từ chối, mức thu bằng 50%' },
  { align: 'left', size: 20, text: 'mức thu quy định tại khoản 1 Điều này.' },
  { align: 'left', size: 12, text: '' },
  { align: 'left', size: 22, text: 'Điều 3. Hiệu lực thi hành' },
  { align: 'left', size: 20, text: 'Quyết định này có hiệu lực kể từ ngày 01 tháng 3 năm 2026.' }
]
/** The gold is stated only in the image, so a text-layer parser cannot reach it however well it works. */
const QUESTIONS = [
  { expect: '2.450.000', question: 'Mức thu phí thẩm định hồ sơ đối với tổ chức kinh tế là bao nhiêu?', reject: '780.000' }
] as const
/** `&` `<` `>` are markup in SVG, so an unescaped one makes the document unparseable and sharp fails on a
 * page that reads correctly in source. */
const xml = (text: string): string => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const svg = (): string => {
  const parts: string[] = [`<rect width="${String(W)}" height="${String(H)}" fill="#fcfcfc"/>`]
  let y = 150
  for (const line of LINES)
    if (line.text === '') y += line.size
    else {
      const anchor = line.align === 'center' ? `x="${String(W / 2)}" text-anchor="middle"` : 'x="150"'
      parts.push(
        `<text ${anchor} y="${String(y)}" font-family="sans-serif" font-size="${String(line.size)}" fill="#1c1c1c">${xml(line.text)}</text>`
      )
      y += Math.round(line.size * 1.85)
    }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(W)}" height="${String(H)}">${parts.join('')}</svg>`
}
/** The born-digital control: how many characters this page's content actually carries, against the one
 * character the scan leaves behind. */
const sourceTextLength = (): number =>
  LINES.map(l => l.text)
    .join('\n')
    .trim().length
const build = async (): Promise<Uint8Array> => scanifyImage(Buffer.from(svg()), 7)
export { build, LINES, QUESTIONS, sourceTextLength, svg }
