const PDF = 'application/pdf'
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const XLS_MIME = 'application/vnd.ms-excel'
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const CSV_MIME = 'text/csv'
const SHEET_RE = /\.(?:csv|xls|xlsx)$/iu
const XLSX_RE = /\.xlsx$/iu
const XLS_RE = /\.xls$/iu
const CSV_RE = /\.csv$/iu
const TEXT_RE = /\.(?:txt|md|markdown)$/iu
const IMAGE_RE = /\.(?:png|jpe?g|webp|tiff?|gif|bmp)$/iu
const MD_RE = /\.(?:md|markdown)$/iu
const PNG_RE = /\.png$/iu
const WEBP_RE = /\.webp$/iu
const TIFF_RE = /\.tiff?$/iu
const GIF_RE = /\.gif$/iu
const BMP_RE = /\.bmp$/iu
const DOCX_RE = /\.docx$/iu
const PPTX_RE = /\.pptx$/iu
const HTML_RE = /\.html?$/iu
const OFFICE_RE = /\.(?:docx|pptx|html?)$/iu
const SOFFICE_RE = /\.(?:odt|odp|rtf|doc|ppt)$/iu
const LEGACY_SHEET_RE = /\.(?:xls|ods)$/iu
const ACCEPT =
  '.pdf,.docx,.pptx,.html,.odt,.odp,.ods,.rtf,.doc,.ppt,.csv,.xls,.xlsx,.txt,.md,.png,.jpg,.jpeg,.webp,.tiff,.tif,.gif,.bmp,application/pdf'
const isSheetName = (name: string): boolean => SHEET_RE.test(name)
const isTextName = (name: string): boolean => TEXT_RE.test(name)
const isImageName = (name: string): boolean => IMAGE_RE.test(name)
const isOfficeName = (name: string): boolean => OFFICE_RE.test(name)
const isSofficeName = (name: string): boolean => SOFFICE_RE.test(name)
const isLegacySheet = (name: string): boolean => LEGACY_SHEET_RE.test(name)
const acceptedFile = (f: File): boolean =>
  f.type === PDF ||
  OFFICE_RE.test(f.name) ||
  SOFFICE_RE.test(f.name) ||
  LEGACY_SHEET_RE.test(f.name) ||
  SHEET_RE.test(f.name) ||
  TEXT_RE.test(f.name) ||
  IMAGE_RE.test(f.name)
const contentTypeOf = (name: string): string => {
  if (DOCX_RE.test(name)) return DOCX_MIME
  if (PPTX_RE.test(name)) return PPTX_MIME
  if (HTML_RE.test(name)) return 'text/html'
  if (XLSX_RE.test(name)) return XLSX_MIME
  if (XLS_RE.test(name)) return XLS_MIME
  if (CSV_RE.test(name)) return CSV_MIME
  if (MD_RE.test(name)) return 'text/markdown'
  if (TEXT_RE.test(name)) return 'text/plain'
  if (PNG_RE.test(name)) return 'image/png'
  if (WEBP_RE.test(name)) return 'image/webp'
  if (TIFF_RE.test(name)) return 'image/tiff'
  if (GIF_RE.test(name)) return 'image/gif'
  if (BMP_RE.test(name)) return 'image/bmp'
  if (IMAGE_RE.test(name)) return 'image/jpeg'
  return PDF
}
export {
  ACCEPT,
  acceptedFile,
  contentTypeOf,
  isImageName,
  isLegacySheet,
  isOfficeName,
  isSheetName,
  isSofficeName,
  isTextName,
  PDF
}
