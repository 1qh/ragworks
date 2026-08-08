/** biome-ignore-all lint/performance/noAwaitInLoops: the socket-readiness poll must wait between probes, and slide-image assembly appends one page at a time into a single PDF document */
/* eslint-disable no-await-in-loop -- the socket-readiness poll must wait between probes, and slide-image assembly appends one page at a time into a single PDF document */
import { Image, PDFDocument } from 'mupdf'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
/** Bun APIs are reached through the GLOBAL here, not `import { … } from 'bun'`, and a fleet rule that
 * prefers the named form does not apply to a PUBLISHED LIBRARY. A consumer bundling for Next cannot
 * resolve the `bun` module — its build dies with "Cannot find module 'bun'" — while the global
 * resolves everywhere. A lint gate cannot see this, because it never assembles the dependency graph:
 * the engine gate passed, the consumer's typecheck passed, and only the consumer's BUILD failed. */
import { createConnection, createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { engineEnv as env } from './engine-config'
import { log } from './log'
import { contentTypeOf, isOfficeName, isPresentationName, isSofficeName } from './upload'

const FINAL_EXT_RE = /\.[^.]+$/u
const outputName = (src: string, ext: string): string => src.replace(FINAL_EXT_RE, ext)
const sofficeConvert = async ({
  bytes,
  ext,
  format,
  name
}: {
  bytes: Uint8Array
  ext: string
  format: string
  name: string
}): Promise<Uint8Array<ArrayBuffer>> => {
  const soffice = env.SOFFICE_PATH ?? 'soffice'
  const dir = await mkdtemp(join(tmpdir(), 'office-render-'))
  try {
    const src = join(dir, name.replaceAll(/[^\w.-]/gu, '_'))
    await Bun.write(src, bytes)
    const proc = Bun.spawn([soffice, '--headless', '--convert-to', format, '--outdir', dir, src], {
      signal: AbortSignal.timeout(180_000),
      stderr: 'pipe',
      stdout: 'pipe'
    })
    const code = await proc.exited
    const outPath = outputName(src, ext)
    const out = Bun.file(outPath)
    if (code !== 0 || !(await out.exists())) {
      const err = await new Response(proc.stderr).text()
      throw new Error(`soffice convert-to ${format} failed (exit ${String(code)}): ${err.slice(0, 200)}`)
    }
    return new Uint8Array(await out.arrayBuffer())
  } finally {
    await rm(dir, { force: true, recursive: true })
  }
}
const freePort = async (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => {
        resolve(port)
      })
    })
  })
const canConnect = async (port: number): Promise<boolean> =>
  new Promise(resolve => {
    const socket = createConnection(port, '127.0.0.1')
    socket.setTimeout(1000)
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => resolve(false))
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
  })
const sleep = async (ms: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, ms)
  })
const waitForPort = async (port: number, deadlineMs: number): Promise<void> => {
  const until = Date.now() + deadlineMs
  while (Date.now() < until) {
    if (await canConnect(port)) return
    await sleep(300)
  }
  throw new Error(`soffice uno socket did not open on port ${String(port)} within ${String(deadlineMs)}ms`)
}
const SLIDE_EXPORT_PY = `import sys, os
import uno
from com.sun.star.beans import PropertyValue
def pv(name, value):
    p = PropertyValue(); p.Name = name; p.Value = value; return p
src = os.path.abspath(sys.argv[1]); outdir = os.path.abspath(sys.argv[2]); port = sys.argv[3]
os.makedirs(outdir, exist_ok=True)
local = uno.getComponentContext()
resolver = local.ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", local)
ctx = resolver.resolve("uno:socket,host=localhost,port=%s;urp;StarOffice.ComponentContext" % port)
smgr = ctx.ServiceManager
desktop = smgr.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
doc = desktop.loadComponentFromURL("file://" + src, "_blank", 0, (pv("Hidden", True),))
exporter = smgr.createInstanceWithContext("com.sun.star.drawing.GraphicExportFilter", ctx)
n = doc.DrawPages.Count
for i in range(n):
    page = doc.DrawPages.getByIndex(i)
    exporter.setSourceDocument(page)
    out = "%s/slide_%04d.png" % (outdir, i + 1)
    exporter.filter((pv("URL", "file://" + out), pv("MediaType", "image/png"),
        pv("FilterData", uno.Any("[]com.sun.star.beans.PropertyValue", (pv("PixelWidth", 1600), pv("PixelHeight", 900),))),))
doc.close(False)
print(n, flush=True)
`
const pngsToPdf = async (dir: string): Promise<Uint8Array<ArrayBuffer>> => {
  const files = (await readdir(dir)).filter(f => f.endsWith('.png')).toSorted((a, b) => a.localeCompare(b))
  if (files.length === 0) throw new Error('slide export produced no images')
  const doc = new PDFDocument()
  for (const file of files) {
    const bytes = new Uint8Array(await Bun.file(join(dir, file)).arrayBuffer())
    const image = new Image(bytes)
    const width = image.getWidth()
    const height = image.getHeight()
    const resources = doc.addObject({ XObject: { Img: doc.addImage(image) } })
    const contents = `q ${String(width)} 0 0 ${String(height)} 0 0 cm /Img Do Q`
    doc.insertPage(-1, doc.addPage([0, 0, width, height], 0, resources, contents))
  }
  return new Uint8Array(doc.saveToBuffer('compress').asUint8Array())
}
const presentationSlidesToPdf = async (bytes: Uint8Array, name: string): Promise<Uint8Array<ArrayBuffer>> => {
  const soffice = env.SOFFICE_PATH ?? 'soffice'
  const python = env.PYTHON_UNO_PATH ?? 'python3'
  const dir = await mkdtemp(join(tmpdir(), 'slide-render-'))
  const port = await freePort()
  const profile = join(dir, 'prof')
  const soff = Bun.spawn(
    [
      soffice,
      `-env:UserInstallation=file://${profile}`,
      '--headless',
      '--invisible',
      '--norestore',
      '--nodefault',
      `--accept=socket,host=localhost,port=${String(port)};urp;StarOffice.ComponentContext`
    ],
    { stderr: 'pipe', stdout: 'pipe' }
  )
  try {
    const src = join(dir, name.replaceAll(/[^\w.-]/gu, '_'))
    const slides = join(dir, 'slides')
    const script = join(dir, 'export.py')
    await Bun.write(src, bytes)
    await Bun.write(script, SLIDE_EXPORT_PY)
    await waitForPort(port, 60_000)
    const proc = Bun.spawn([python, script, src, slides, String(port)], {
      signal: AbortSignal.timeout(600_000),
      stderr: 'pipe',
      stdout: 'pipe'
    })
    const code = await proc.exited
    if (code !== 0) {
      const err = await new Response(proc.stderr).text()
      throw new Error(`uno slide export failed (exit ${String(code)}): ${err.slice(0, 300)}`)
    }
    return await pngsToPdf(slides)
  } finally {
    soff.kill()
    await rm(dir, { force: true, recursive: true })
  }
}
const officeToPdf = async (bytes: Uint8Array, name: string): Promise<Uint8Array<ArrayBuffer>> => {
  try {
    return await sofficeConvert({ bytes, ext: '.pdf', format: 'pdf', name })
  } catch (error) {
    if (!isPresentationName(name)) throw error
    log.warn({ name }, 'soffice pdf export failed on a presentation — falling back to per-slide render')
    return presentationSlidesToPdf(bytes, name)
  }
}
const xlsToXlsx = async (bytes: Uint8Array, name: string): Promise<Uint8Array<ArrayBuffer>> =>
  sofficeConvert({ bytes, ext: '.xlsx', format: 'xlsx', name })
const mupdfInput = async (
  raw: Uint8Array<ArrayBuffer>,
  name: string
): Promise<{ bytes: Uint8Array<ArrayBuffer>; contentType: string }> =>
  isOfficeName(name) || isSofficeName(name)
    ? { bytes: await officeToPdf(raw, name), contentType: 'application/pdf' }
    : { bytes: raw, contentType: contentTypeOf(name) }
export { mupdfInput, officeToPdf, outputName, pngsToPdf, xlsToXlsx }
