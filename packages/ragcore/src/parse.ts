import { ColorSpace, Document, Matrix } from 'mupdf'
import type { ParseConfig } from './config'
import type { ParseResult } from './docling'
import type { Block } from './lib'
import type { Route } from './router'
import { pageBadness } from './chonkie'
import { mapPool } from './concurrency'
import { geometryOf, markdownOf, parsePdf } from './docling'
import { log } from './log'
import { defaultRefForRole } from './providers'
import { routePage, withoutMinerU } from './router'
import { isSheet, parseSheet } from './sheet'
import { stubbed } from './stub'
import { contentTypeOf, isImageName, isLegacySheet, isOfficeName, isSofficeName, isTextName } from './upload'

const PARA_SPLIT = /\n{2,}/u
const OFFICE_EXT_RE = /\.(?:docx|pptx|html?|odt|odp|ods|rtf|doc|ppt)$/iu
const LEGACY_SHEET_RE = /\.(?:xls|ods)$/iu
const SCALE = 2
const VLM_POOL = 1
const VLM_MAX_DIM = 1600
const pageHasImages = (doc: Document, i: number): boolean => {
  try {
    const st = doc.loadPage(i).toStructuredText('preserve-images')
    const json = st.asJSON()
    st.destroy()
    return json.includes('"type":"image"')
  } catch {
    return false
  }
}
const pageText = (doc: Document, i: number): string => {
  const st = doc.loadPage(i).toStructuredText('preserve-whitespace')
  const text = st.asText()
  st.destroy()
  return text
}
const renderPage = (doc: Document, i: number): string => {
  const pix = doc.loadPage(i).toPixmap(Matrix.scale(SCALE, SCALE), ColorSpace.DeviceRGB, false)
  return Buffer.from(pix.asPNG()).toString('base64')
}
const renderForVlm = (doc: Document, i: number): string => {
  const page = doc.loadPage(i)
  const b = page.getBounds()
  const longer = Math.max(b[2] - b[0], b[3] - b[1], 1)
  const scale = Math.min(SCALE, VLM_MAX_DIM / longer)
  const pix = page.toPixmap(Matrix.scale(scale, scale), ColorSpace.DeviceRGB, false)
  return Buffer.from(pix.asPNG()).toString('base64')
}
const byPage = (blocks: readonly Block[]): Map<number, Block[]> => {
  const m = new Map<number, Block[]>()
  for (const b of blocks) {
    const list = m.get(b.page) ?? []
    list.push(b)
    m.set(b.page, list)
  }
  return m
}
const parseTextDocument = (bytes: Uint8Array<ArrayBuffer>): ParseResult => {
  const text = new TextDecoder().decode(bytes)
  const blocks: Block[] = text
    .split(PARA_SPLIT)
    .map(s => s.trim())
    .filter(Boolean)
    .map(t => ({ bbox: null, page: 1, text: t }))
  return {
    blocks,
    engine: 'text',
    geometry: 'none',
    markdown: markdownOf(blocks),
    pages: [{ height: 0, pageNo: 1, width: 0 }]
  }
}
const parseImageDocument = async ({
  bytes,
  config,
  name,
  onProgress
}: {
  bytes: Uint8Array<ArrayBuffer>
  config?: ParseConfig
  name: string
  onProgress?: (label: string) => void
}): Promise<ParseResult> => {
  const ref = config?.vlmModel ?? defaultRefForRole('vlm')
  if (ref === undefined) throw new Error('image ingest needs a configured vlm model')
  onProgress?.('reading the image with the vision model')
  const { ocrPage, pageBlocks, requireVlm } = await import('./chandra')
  const doc = Document.openDocument(bytes, contentTypeOf(name))
  const bounds = doc.loadPage(0).getBounds()
  const widthPt = bounds[2] - bounds[0]
  const heightPt = bounds[3] - bounds[1]
  const html = await ocrPage(renderForVlm(doc, 0), requireVlm(ref))
  const blocks = pageBlocks({ heightPt, html, pageNo: 1, widthPt })
  return {
    blocks,
    engine: 'image(vlm)',
    geometry: geometryOf(blocks),
    markdown: markdownOf(blocks),
    pages: [{ height: heightPt, pageNo: 1, width: widthPt }]
  }
}
const routePdf = async ({
  base,
  bytes,
  config,
  onProgress
}: {
  base: ParseResult
  bytes: Uint8Array<ArrayBuffer>
  config?: ParseConfig
  onProgress?: (label: string) => void
}): Promise<ParseResult> => {
  const doc = Document.openDocument(bytes, 'application/pdf')
  const count = doc.countPages()
  const { minerUAvailable, minerUPage } = await import('./mineru')
  const forceVlm = config?.pipeline === 'vlm'
  const pageTexts = Array.from({ length: count }, (_, i) => pageText(doc, i))
  const badness = forceVlm ? [] : await pageBadness(pageTexts)
  const routes: Route[] = forceVlm
    ? pageTexts.map((): Route => 'vlm')
    : pageTexts.map((t, i) => routePage(t, pageHasImages(doc, i), badness[i] ?? 0).route)
  const pageBlockMap = byPage(base.blocks)
  const rendered = base.pages
  const minerUPages = minerUAvailable()
    ? Array.from({ length: count }, (_, i) => i).filter(i => routes[i] === 'mineru')
    : []
  await mapPool(minerUPages, VLM_POOL, async i => {
    onProgress?.(`routing graphic page ${String(i + 1)}/${String(count)} to MinerU`)
    try {
      const dims = rendered.find(p => p.pageNo === i + 1)
      pageBlockMap.set(
        i + 1,
        await minerUPage({ heightPt: dims?.height ?? 0, pageNo: i + 1, pngBase64: renderPage(doc, i) })
      )
    } catch {
      routes[i] = 'vlm'
    }
  })
  const resolved = minerUAvailable() ? routes : withoutMinerU(routes)
  const vlmPages = Array.from({ length: count }, (_, i) => i).filter(i => resolved[i] === 'vlm')
  const ref = config?.vlmModel ?? defaultRefForRole('vlm')
  if (vlmPages.length > 0 && ref === undefined)
    log.warn(
      { pages: vlmPages.length },
      'pages escalated off the text layer but no vlm is configured — keeping the rejected parse'
    )
  if (vlmPages.length === 0 || ref === undefined) {
    if (minerUPages.length === 0) return base
    const blocks = base.pages.flatMap(p => pageBlockMap.get(p.pageNo) ?? [])
    return {
      blocks,
      engine: `routed(${base.engine})`,
      geometry: geometryOf(blocks),
      markdown: markdownOf(blocks),
      pages: base.pages
    }
  }
  onProgress?.(`routing ${String(vlmPages.length)} scanned pages to the vision model`)
  const { ocrPage, pageBlocks, requireVlm } = await import('./chandra')
  const vlm = requireVlm(ref)
  await mapPool(vlmPages, VLM_POOL, async i => {
    onProgress?.(`reading scanned page ${String(i + 1)}/${String(count)}`)
    const html = await ocrPage(renderForVlm(doc, i), vlm)
    const dims = rendered.find(p => p.pageNo === i + 1)
    pageBlockMap.set(i + 1, pageBlocks({ heightPt: dims?.height ?? 0, html, pageNo: i + 1, widthPt: dims?.width ?? 0 }))
  })
  const blocks = base.pages.flatMap(p => pageBlockMap.get(p.pageNo) ?? [])
  return {
    blocks,
    engine: `routed(${base.engine})`,
    geometry: geometryOf(blocks),
    markdown: markdownOf(blocks),
    pages: base.pages
  }
}
const snapSpatial = async (result: ParseResult, bytes: Uint8Array<ArrayBuffer>): Promise<ParseResult> => {
  if (result.geometry !== 'spatial' || stubbed()) return result
  try {
    const { reconcileBlocks } = await import('./reconcile')
    const { blocks, repaired, snapped, unanchored } = reconcileBlocks(bytes, result.blocks)
    if (snapped === 0 && unanchored === 0 && repaired === 0) return result
    return { ...result, blocks, geometry: geometryOf(blocks), markdown: markdownOf(blocks) }
  } catch {
    return result
  }
}
const parseDocument = async ({
  bytes,
  config,
  name,
  onProgress
}: {
  bytes: Uint8Array<ArrayBuffer>
  config?: ParseConfig
  name: string
  onProgress?: (label: string) => void
}): Promise<ParseResult> => {
  if (isLegacySheet(name) && !stubbed()) {
    onProgress?.('converting spreadsheet to .xlsx for grid parsing')
    const { xlsToXlsx } = await import('./office-render')
    const xlsx = await xlsToXlsx(bytes, name)
    return parseDocument({ bytes: xlsx, config, name: name.replace(LEGACY_SHEET_RE, '.xlsx'), onProgress })
  }
  if (isSheet(name)) return parseSheet({ bytes, name, onProgress })
  if (isTextName(name)) return parseTextDocument(bytes)
  if (isImageName(name)) return parseImageDocument({ bytes, config, name, onProgress })
  if (isSofficeName(name) && !stubbed()) {
    const { officeToPdf } = await import('./office-render')
    const pdf = await officeToPdf(bytes, name)
    return parseDocument({
      bytes: pdf,
      config: config === undefined ? undefined : { ...config, pipeline: 'standard' },
      name: name.replace(OFFICE_EXT_RE, '.pdf'),
      onProgress
    })
  }
  if (isOfficeName(name)) {
    if (config?.pipeline === 'vlm' && !stubbed()) {
      const { officeToPdf } = await import('./office-render')
      const pdf = await officeToPdf(bytes, name)
      return parseDocument({
        bytes: pdf,
        config: { ...config, pipeline: 'standard' },
        name: name.replace(OFFICE_EXT_RE, '.pdf'),
        onProgress
      })
    }
    return snapSpatial(await parsePdf({ bytes, name, onProgress, options: config }), bytes)
  }
  const base = await parsePdf({ bytes, name, onProgress, options: config })
  if (stubbed()) return base
  return snapSpatial(await routePdf({ base, bytes, config, onProgress }), bytes)
}
export { parseDocument }
