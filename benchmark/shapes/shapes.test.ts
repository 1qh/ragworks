import { expect, test } from 'bun:test'
import { QUESTIONS as bandFirstQuestions, build as buildBandFirst } from './band-first.ts'
import { QUESTIONS as bandTwodimQuestions, build as buildBandTwodim } from './band-twodim.ts'
import { build as buildDense, QUESTIONS as denseQuestions } from './dense-2hdr.ts'
import { textLayerOf } from './pdf.ts'
import { build as buildScanDegenerate, QUESTIONS as scanQuestions, sourceTextLength } from './scan-degenerate.ts'
import { scanify } from './scan.ts'
import { build as buildTable, QUESTIONS as tableQuestions } from './table-multilevel.ts'
import { build as buildTwohop, QUESTIONS as twohopQuestions } from './twohop.ts'
/** These generators ARE the published corpus, so a silent break here ships a benchmark that measures
 * something other than what it claims — and the failure would be invisible, because a page that renders is
 * a page that looks fine. Each assertion below is a property the shape is DEFINED by rather than a check
 * that the code ran: a gold that is absent measures nothing, a scan whose text layer survives is not an
 * extraction shape, and a generator that varies between runs means two people comparing scores are
 * comparing two different documents. */
const SHAPES = [
  { build: buildBandTwodim, name: 'band-twodim', questions: bandTwodimQuestions },
  { build: buildBandFirst, name: 'band-first', questions: bandFirstQuestions },
  { build: buildDense, name: 'dense-2hdr', questions: denseQuestions },
  { build: buildTwohop, name: 'twohop', questions: twohopQuestions },
  { build: buildTable, name: 'table-multilevel', questions: tableQuestions }
]
test('every born-digital generator states its own gold on the page', () => {
  const missing: string[] = []
  for (const { build, name, questions } of SHAPES) {
    const text = textLayerOf(build())
    for (const q of questions) if (!text.includes(q.expect)) missing.push(`${name}: ${q.expect}`)
  }
  expect(missing).toEqual([])
})
test('every distractor is on the page too, or the question cannot turn on it', () => {
  const missing: string[] = []
  for (const { build, name, questions } of SHAPES) {
    const text = textLayerOf(build())
    for (const q of questions) if (q.reject !== '' && !text.includes(q.reject)) missing.push(`${name}: ${q.reject}`)
  }
  expect(missing).toEqual([])
})
test('the windowed band golds are UNIQUE in the grid, so an answer is attributable to the cell asked about', () => {
  const numbers = textLayerOf(buildBandTwodim()).match(/\d\.\d/gu) ?? []
  const ambiguous = bandTwodimQuestions.filter(q => numbers.filter(n => n === q.expect).length !== 1).map(q => q.expect)
  expect(ambiguous).toEqual([])
})
test('the dense grid ships BOTH questions, because a sibling cell on it answers while the entry does not', () => {
  expect(denseQuestions.length).toBeGreaterThan(1)
  const text = textLayerOf(buildDense())
  for (const q of denseQuestions) expect(text).toContain(q.expect)
})
test('the ruled variant differs from the borderless one, or it proves nothing about column inference', () => {
  const ruled = Buffer.from(buildDense(true))
  const borderless = Buffer.from(buildDense())
  expect(ruled.equals(borderless)).toBe(false)
})
test('the twohop control states the adjusted figure in its ROW, and the treatment does not', () => {
  /** The control varies exactly one factor: the answer sits where the reader already is. If the treatment
   * also carried it in the row, the pair would vary nothing and the mechanism would be unisolated. */
  const treatment = textLayerOf(buildTwohop())
  const control = textLayerOf(buildTwohop(true))
  expect(control).toContain('960.000')
  expect(treatment).toContain('960.000')
  expect(control).not.toContain('Ho so loai B1 nop truc tiep tai quay')
  expect(treatment).toContain('Ho so loai B1 nop truc tiep tai quay')
})
test('a scan collapses the text layer to one character while the born-digital page carries hundreds', async () => {
  const born = buildTable()
  const bornLength = textLayerOf(born).trim().length
  expect(bornLength).toBeGreaterThan(300)
  expect(textLayerOf(await scanify(born)).trim()).toHaveLength(1)
})
test('the scanned decision hides its gold from the text layer entirely', async () => {
  const scanned = await buildScanDegenerate()
  const text = textLayerOf(scanned)
  expect(text.trim()).toHaveLength(1)
  for (const q of scanQuestions) expect(text).not.toContain(q.expect)
  /** The control is the source text this page renders, which must be substantial or the ratio is not a
   * wipe-out at all. */
  expect(sourceTextLength()).toBeGreaterThan(400)
})
test('the scan degradation is DETERMINISTIC, so two people measure the same document', async () => {
  const born = buildTable()
  const first = await scanify(born)
  const second = await scanify(born)
  expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true)
})
/** A test asserting the wasm-view hazard was written here and REMOVED: planting the defect (returning the
 * view instead of a copy) left it green, because reproducing that corruption needs a large allocation to
 * reuse the freed heap region and the assertion never forced one. A control that applies and still passes
 * indicts the assertion, not the fix — and a vacuous test is worse than none, since it reads as cover. The
 * copy stays in `pdf.ts` with its reasoning; what is missing is a reliable way to prove it, not the fix. */
