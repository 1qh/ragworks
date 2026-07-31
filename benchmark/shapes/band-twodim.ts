/** The windowed band table: a surge multiplier per distance band, repeated once per TIME WINDOW.
 *
 * The shape isolates a generation failure that no extraction or retrieval shape can measure, because all
 * of those fail before the model ever sees the answer. Here the gold passage is retrieved — often at rank
 * 1 — and the model still returns the right distance band read from the WRONG time window.
 *
 * Its control is `band-first.ts`: the same bands, same figures, no second dimension. That page answers, so
 * the dimension the question must fix is isolated rather than argued for. Two earlier candidates for this
 * mechanism were authored, answered correctly, and stayed out.
 *
 * Every gold below is UNIQUE in the grid. That is a constraint on authoring rather than a detail: several
 * values repeat across cells (1.8, 1.9 and 2.2 each appear twice), and a repeated gold makes a
 * correct-looking answer unattributable to the cell that was asked about, so the question measures nothing. */
import type { Line } from './pdf.ts'
import { page } from './pdf.ts'

const BANDS = ['0 - 2 km', '2 - 20 km', '20 - 50 km', '50 - 100 km', 'over 100 km'] as const
const WINDOWS = [
  { surge: ['1.5', '1.8', '2.1', '2.4', '2.7'], window: '06:00 - 09:59' },
  { surge: ['1.1', '1.3', '1.5', '1.7', '1.9'], window: '10:00 - 15:59' },
  { surge: ['1.9', '2.2', '2.5', '2.8', '3.1'], window: '16:00 - 18:59' },
  { surge: ['1.4', '1.6', '1.8', '2.0', '2.2'], window: '19:00 - 23:59' }
] as const
/** The measured question set. A one-question entry reports a mechanism as total or absent purely by which
 * row it picked — the sibling override shape proved that by reproducing on only two of its three — so the
 * entry is a SET and a stack's score is a fraction. `reject` is the distractor the answer must not also
 * state: a reply reciting every candidate contains the gold and resolves nothing. */
const QUESTIONS = [
  { band: '2 - 20 km', expect: '1.3', reject: '1.8', window: '10:00 - 15:59' },
  { band: '20 - 50 km', expect: '2.5', reject: '1.5', window: '16:00 - 18:59' },
  { band: '50 - 100 km', expect: '2.8', reject: '2.4', window: '16:00 - 18:59' },
  { band: '50 - 100 km', expect: '2.0', reject: '2.8', window: '19:00 - 23:59' },
  { band: 'over 100 km', expect: '2.7', reject: '1.9', window: '06:00 - 09:59' }
] as const
/** The wording is part of the ENTRY, not a presentation choice: these are the exact questions the shape was
 * measured with, and a rephrasing is a different question whose verdict is unknown. The page's own dashes
 * are spelled out here because that is how the measured set reads. */
const ask = (q: { band: string; window: string }): string => {
  const window = q.window.replace(' - ', ' to ')
  const trip = q.band.startsWith('over') ? q.band : `from ${q.band.replace(' - ', ' to ').replace(' km', '')} km`
  return `In the time window ${window}, for a trip ${trip}, what is the peak max_surge?`
}
const build = (): Uint8Array => {
  const lines: Line[] = [
    { bold: true, size: 13, text: 'DYNAMIC PRICING CONFIGURATION', x: 56, y: 68 },
    { text: 'Surge multiplier by distance band, per time window.', x: 56, y: 88 }
  ]
  const rules: { x1: number; x2: number; y: number }[] = []
  let y = 118
  for (const { surge, window } of WINDOWS) {
    lines.push(
      { bold: true, size: 10, text: `Time window ${window}`, x: 56, y },
      { bold: true, text: 'Distance band', x: 56, y: y + 18 },
      { bold: true, text: 'Peak max_surge', x: 300, y: y + 18 }
    )
    rules.push({ x1: 56, x2: 539, y: y + 23 })
    for (const [r, band] of BANDS.entries())
      lines.push({ text: band, x: 56, y: y + 40 + r * 17 }, { text: surge[r] ?? '', x: 300, y: y + 40 + r * 17 })
    y += 40 + BANDS.length * 17 + 22
  }
  lines.push({
    size: 8,
    text: 'Bands are inclusive of the lower bound and exclusive of the upper bound.',
    x: 56,
    y: y + 6
  })
  return page(lines, rules)
}
export { ask, build, QUESTIONS }
