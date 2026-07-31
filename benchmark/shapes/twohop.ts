/** A fee table plus a clause far below it that OVERRIDES three of its rows.
 *
 * The clause names the category, names the condition the question asks about, states the answer outright,
 * and is retrieved at RANK 1. The model returns the table row's unadjusted figure anyway. So this is a
 * generation shape: nothing upstream failed, and no fusion lean, reranker or context budget moves it.
 *
 * It is worth publishing beside the windowed band table because it needs neither a second dimension nor any
 * ambiguity — the page is ordinary and retrieval on it is healthy. A plain row lookup on the same page (the
 * C1 conversion fee) is answered at gold rank 1, so only a question whose answer an overriding clause
 * changes fails.
 *
 * THREE ARMS isolated the mechanism, and the middle one is what made the reading honest. A first version
 * stated the surcharge as a PERCENTAGE, so the answer had to be computed — it failed, but the model's own
 * words quoted both facts and then computed wrongly, so the treatment differed from its control in two ways
 * and named nothing. The arm below keeps the second passage and removes the arithmetic, and it fails
 * identically: the mechanism is an override never applied, not a sum got wrong. The arithmetic arm stays
 * out for a second reason — its gold is DERIVED, appears in no passage, and any retrieval rank reported for
 * it would have measured nothing while looking like evidence.
 *
 * The entry carries three override questions and they do NOT all fail. That is the point: a one-question
 * entry would have reported the mechanism as total or absent purely by which row it picked. */
import type { Line } from './pdf.ts'
import { page } from './pdf.ts'

const CATEGORIES = [
  { code: 'A1', fee: '1.200.000', label: 'Ho so dang ky lan dau' },
  { code: 'A2', fee: '850.000', label: 'Ho so dang ky bo sung' },
  { code: 'B1', fee: '640.000', label: 'Ho so gia han thuong nien' },
  { code: 'B2', fee: '430.000', label: 'Ho so gia han rut gon' },
  { code: 'C1', fee: '2.100.000', label: 'Ho so chuyen doi loai hinh' },
  { code: 'C2', fee: '1.750.000', label: 'Ho so chuyen doi dia ban' }
] as const
const FILLER = [
  'Don vi tiep nhan co trach nhiem kiem tra tinh day du cua ho so truoc khi cap so tiep nhan.',
  'Thoi han giai quyet duoc tinh tu ngay lam viec ke tiep ngay tiep nhan ho so hop le.',
  'Truong hop ho so thieu thanh phan, don vi tiep nhan thong bao bang van ban trong ba ngay lam viec.',
  'Le phi da nop khong duoc hoan tra khi nguoi nop don rut ho so sau khi da co so tiep nhan.',
  'Bien lai thu le phi duoc lap thanh hai ban, mot ban giao cho nguoi nop.'
] as const
/** Each clause STATES its figure rather than a rule to apply, so assembly is required and arithmetic is not. */
const OVERRIDES = [
  'Ho so loai B1 nop truc tiep tai quay ap dung muc thu la 960.000 VND.',
  'Ho so loai A2 nop truc tiep tai quay ap dung muc thu la 1.275.000 VND.',
  'Ho so loai C2 nop truc tiep tai quay ap dung muc thu la 2.625.000 VND.'
] as const
/** Two of the three reproduce and one is answered, so a stack's score here is a FRACTION. What separates
 * them is not established: the two that fail answer in the question's own phrasing carrying the table's
 * figure, while the one that answers echoes the clause's own wording — which describes the outcome rather
 * than explaining it. The fourth entry is the healthy-page check: an ordinary row lookup, answered. */
const QUESTIONS = [
  {
    expect: '960.000',
    question: 'Ho so gia han thuong nien nop truc tiep tai quay thi phai nop tong cong bao nhieu tien?',
    reject: '640.000'
  },
  {
    expect: '2.625.000',
    question: 'Ho so chuyen doi dia ban nop truc tiep tai quay thi phai nop tong cong bao nhieu tien?',
    reject: '1.750.000'
  },
  {
    expect: '1.275.000',
    question: 'Ho so dang ky bo sung nop truc tiep tai quay thi phai nop tong cong bao nhieu tien?',
    reject: '850.000'
  },
  { expect: '2.100.000', question: 'Le phi ho so chuyen doi loai hinh la bao nhieu?', reject: '1.750.000' }
] as const
/** `joined` is the CONTROL: the B1 row carries the already-adjusted figure, so a reader that finds the
 * table is done and the second passage is unnecessary. Exactly one factor varies; every other byte of the
 * page comes from this same code path. Read the pair together and nothing else — if the control answers and
 * the treatment does not, the second hop is the mechanism; if both fail, neither belongs. */
const build = (joined = false): Uint8Array => {
  const lines: Line[] = [
    { bold: true, size: 13, text: 'BIEU MUC LE PHI XU LY HO SO', x: 56, y: 68 },
    { text: 'Ap dung tu ky ngan sach hien hanh.', x: 56, y: 88 },
    { bold: true, text: 'Ma loai', x: 56, y: 122 },
    { bold: true, text: 'Ten loai ho so', x: 130, y: 122 },
    { bold: true, text: 'Muc le phi (VND)', x: 430, y: 122 }
  ]
  const rules = [{ x1: 56, x2: 539, y: 128 }]
  let y = 146
  for (const c of CATEGORIES) {
    lines.push(
      { text: c.code, x: 56, y },
      { text: c.label, x: 130, y },
      { text: joined && c.code === 'B1' ? '960.000' : c.fee, x: 430, y }
    )
    y += 22
  }
  rules.push({ x1: 56, x2: 539, y: y - 6 })
  y += 24
  lines.push({ bold: true, size: 10, text: 'Dieu khoan chung', x: 56, y })
  y += 20
  for (const line of FILLER) {
    lines.push({ text: line, x: 56, y })
    y += 18
  }
  y += 14
  lines.push({ bold: true, size: 10, text: 'Dieu khoan dieu chinh', x: 56, y })
  y += 20
  if (joined) {
    lines.push({ text: 'Ho so nop truc tiep tai quay ap dung muc thu da dieu chinh ghi tai bang tren.', x: 56, y })
    y += 18
  } else
    for (const line of OVERRIDES) {
      lines.push({ text: line, x: 56, y })
      y += 18
    }
  lines.push({ text: 'Muc thu nay duoc ghi chung tren mot bien lai voi le phi.', x: 56, y })
  return page(lines, rules)
}
export { build, QUESTIONS }
