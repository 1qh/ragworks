/** The CONTROL for the windowed band table: the same distance bands and the same figures, with NO second
 * dimension for a question to fix.
 *
 * A control is what makes the treatment readable. This page answers — the gold is retrieved and the model
 * returns it — so the windowed page's failure is attributable to the time-window dimension rather than to
 * banded tables, to surge multipliers, or to the wording of the question. Without it, "the windowed table
 * fails" is a claim about one page and nothing more.
 *
 * It is also the shape's own falsifier, and it has already killed one authoring rule: this page was first
 * built to test whether a band OPENING AT ZERO was the lever, on the theory that a model reaches for the
 * neighbouring row. It answered, at gold rank 5, without taking the distractor — so that rule died, and
 * what replaced it is the second dimension the windowed page carries. */
import type { Line } from './pdf.ts'
import { page } from './pdf.ts'

const COLS = ['Distance band', 'Peak max_surge', 'Off-peak max_surge'] as const
const X = [56, 240, 380] as const
const ROWS = [
  { band: '0 - 2 km', off: '1.2', peak: '1.5' },
  { band: '2 - 20 km', off: '1.4', peak: '1.8' },
  { band: '20 - 50 km', off: '1.6', peak: '2.1' },
  { band: '50 - 100 km', off: '1.9', peak: '2.4' },
  { band: 'over 100 km', off: '2.2', peak: '2.7' }
] as const
/** The control's own question, which must ANSWER. A control that fails alongside its treatment proves
 * nothing about the factor and usually means the generator, not the shape, is what changed. */
const QUESTIONS = [
  { expect: '1.8', question: 'For a trip from 2 to 20 km, what is the peak max_surge?', reject: '' }
] as const
const build = (): Uint8Array => {
  const lines: Line[] = [
    { bold: true, size: 13, text: 'DYNAMIC PRICING CONFIGURATION', x: 56, y: 70 },
    { text: 'Surge multiplier by distance band. Values apply per completed trip.', x: 56, y: 92 }
  ]
  const y = 130
  for (const [i, head] of COLS.entries()) lines.push({ bold: true, size: 10, text: head, x: X[i] ?? 56, y })
  for (const [r, row] of ROWS.entries()) {
    const ry = y + 26 + r * 22
    lines.push(
      { size: 10, text: row.band, x: X[0], y: ry },
      { size: 10, text: row.peak, x: X[1], y: ry },
      { size: 10, text: row.off, x: X[2], y: ry }
    )
  }
  const tail = y + 26 + ROWS.length * 22 + 28
  lines.push(
    { text: 'Bands are inclusive of the lower bound and exclusive of the upper bound.', x: 56, y: tail },
    { text: 'A trip spanning two bands is charged at the band its total distance falls in.', x: 56, y: tail + 16 }
  )
  return page(lines, [{ x1: 56, x2: 539, y: y + 6 }])
}
export { build, QUESTIONS }
