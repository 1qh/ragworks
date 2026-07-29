import { file, spawn, write } from 'bun'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { engineEnv as env } from './engine-config'
import { contentTypeOf, isOfficeName, isSofficeName } from './upload'

const OFFICE_EXT = /\.(?:docx|pptx|html?|odt|odp|ods|rtf|doc|ppt|xls)$/iu
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
    await write(src, bytes)
    const proc = spawn([soffice, '--headless', '--convert-to', format, '--outdir', dir, src], {
      signal: AbortSignal.timeout(180_000),
      stderr: 'pipe',
      stdout: 'pipe'
    })
    const code = await proc.exited
    if (code !== 0) {
      const err = await new Response(proc.stderr).text()
      throw new Error(`soffice convert-to ${format} failed (exit ${String(code)}): ${err.slice(0, 200)}`)
    }
    const outPath = src.replace(OFFICE_EXT, ext)
    const out = file(outPath)
    if (!(await out.exists())) throw new Error(`soffice produced no ${ext}`)
    return new Uint8Array(await out.arrayBuffer())
  } finally {
    await rm(dir, { force: true, recursive: true })
  }
}
const officeToPdf = async (bytes: Uint8Array, name: string): Promise<Uint8Array<ArrayBuffer>> =>
  sofficeConvert({ bytes, ext: '.pdf', format: 'pdf', name })
const xlsToXlsx = async (bytes: Uint8Array, name: string): Promise<Uint8Array<ArrayBuffer>> =>
  sofficeConvert({ bytes, ext: '.xlsx', format: 'xlsx', name })
const mupdfInput = async (
  raw: Uint8Array<ArrayBuffer>,
  name: string
): Promise<{ bytes: Uint8Array<ArrayBuffer>; contentType: string }> =>
  isOfficeName(name) || isSofficeName(name)
    ? { bytes: await officeToPdf(raw, name), contentType: 'application/pdf' }
    : { bytes: raw, contentType: contentTypeOf(name) }
export { mupdfInput, officeToPdf, xlsToXlsx }
