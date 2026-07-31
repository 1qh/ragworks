/** Author a PDF page by placing text at exact coordinates, which is what every shape in this corpus needs:
 * a shape's difficulty is its LAYOUT, so a generator that cannot control where a glyph lands cannot author
 * one. This uses the mupdf the engine already depends on rather than adding a PDF library — the same
 * engine the reference Python generators reached through PyMuPDF, so the pages it produces are built by
 * the same renderer that read them. */
import { Document, Font, PDFDocument } from 'mupdf'
/** A bordered, optionally filled cell. The multi-level discount table needs these because its difficulty
 * lives in a header that SPANS several columns — a span is only expressible as a box wider than the cells
 * beneath it, and a page drawn with rules alone cannot state it. */
interface Box {
  /** 0 = black, 1 = white; a grey header band is what marks a group row apart from its data rows. */
  readonly fill?: number
  readonly h: number
  readonly w: number
  readonly x: number
  readonly y: number
}
interface Line {
  readonly bold?: boolean
  readonly size?: number
  readonly text: string
  readonly x: number
  /** Distance from the TOP of the page, so a caller lays a table out downwards the way it reads. */
  readonly y: number
}
interface Rule {
  readonly x1: number
  readonly x2: number
  readonly y: number
}
const WIDTH = 595
const HEIGHT = 842
/** A PDF text object addresses the page from its BOTTOM-left, and every table here is described from the
 * top down, so the flip lives in one place rather than in each generator's arithmetic. */
const up = (y: number): number => HEIGHT - y
/** Parentheses and backslashes terminate or escape a PDF string literal, so an unescaped one silently
 * truncates the line it sits in — the page then renders with text missing and nothing errors. */
const escapePdfString = (text: string): string =>
  text.replaceAll('\\', String.raw`\\`).replaceAll('(', String.raw`\(`).replaceAll(')', String.raw`\)`)
const draw = (lines: readonly Line[], rules: readonly Rule[] = [], boxes: readonly Box[] = []): string => {
  const out: string[] = []
  /** Boxes are emitted FIRST so a filled header band sits behind its own label rather than covering it. */
  for (const b of boxes)
    out.push(
      b.fill === undefined
        ? `0.8 w ${String(b.x)} ${String(up(b.y + b.h))} ${String(b.w)} ${String(b.h)} re S`
        : `${String(b.fill)} g 0.8 w ${String(b.x)} ${String(up(b.y + b.h))} ${String(b.w)} ${String(b.h)} re B 0 g`
    )
  for (const r of rules) out.push(`0.5 w ${String(r.x1)} ${String(up(r.y))} m ${String(r.x2)} ${String(up(r.y))} l S`)
  for (const l of lines)
    out.push(
      `BT /${l.bold === true ? 'FB' : 'FR'} ${String(l.size ?? 9)} Tf ${String(l.x)} ${String(up(l.y))} Td (${escapePdfString(l.text)}) Tj ET`
    )
  return out.join('\n')
}
/** Write a single-page PDF and return its bytes. Callers persist it; returning bytes keeps the generator
 * pure enough to assert on in a test without touching a filesystem. */
const page = (lines: readonly Line[], rules: readonly Rule[] = [], boxes: readonly Box[] = []): Uint8Array => {
  const doc = new PDFDocument()
  const resources = doc.addObject({
    Font: { FB: doc.addSimpleFont(new Font('Helvetica-Bold')), FR: doc.addSimpleFont(new Font('Helvetica')) }
  })
  doc.insertPage(-1, doc.addPage([0, 0, WIDTH, HEIGHT], 0, resources, draw(lines, rules, boxes)))
  /** COPY the bytes out. `asUint8Array` returns a view into the wasm heap, so allocating another document
   * — which the scan generator does, since it re-embeds this page — can move or reuse that memory and the
   * earlier view then reads as a corrupt PDF. It survives a round-trip through a file, which is exactly why
   * it hides: the failure appears only when one generator's output feeds another in the same process. */
  return new Uint8Array(doc.saveToBuffer('').asUint8Array())
}
/** Read a page's own text layer back. Every shape's classification depends on what a parser can recover,
 * so a generator that cannot state its page's text layer cannot prove the shape is what it claims —
 * the extraction-wipeout shape is DEFINED by this number being one character. */
const textLayerOf = (bytes: Uint8Array): string =>
  Document.openDocument(bytes, 'application/pdf').loadPage(0).toStructuredText().asText()
export { HEIGHT, page, textLayerOf, WIDTH }
export type { Box, Line, Rule }
