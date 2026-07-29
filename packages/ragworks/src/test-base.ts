const buildPdf = (): Uint8Array<ArrayBuffer> => {
  const content =
    'BT /F1 12 Tf 50 700 Td (Attention is the core mechanism of the transformer model.) Tj 0 -20 Td (Recurrent networks process tokens sequentially in order.) Tj 0 -20 Td (The transformer relies entirely on self attention layers.) Tj ET'
  const stream = new TextEncoder().encode(content)
  const objs = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>',
    `<</Length ${stream.length}>>\nstream\n${content}\nendstream`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>'
  ]
  let body = `%PDF-1.4\n%uniq-${crypto.randomUUID()}\n`
  const offsets: number[] = []
  for (const [i, o] of objs.entries()) {
    offsets.push(body.length)
    body += `${i + 1} 0 obj\n${o}\nendobj\n`
  }
  const xref = body.length
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) body += `${String(off).padStart(10, '0')} 00000 n \n`
  body += `trailer<</Root 1 0 R/Size ${objs.length + 1}>>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(body)
}
export { buildPdf }
