import { describe, expect, test } from 'bun:test'
import { toChandraHtml } from './datalab'

describe('datalab toChandraHtml', () => {
  test('unions word spans into one block and normalizes the pixel bbox to chandra 0-1000 grid', () => {
    const html =
      '<html><body><p><span data-bbox="0 0 500 100">Hello</span><span data-bbox="510 0 1000 100">world</span></p></body></html>'
    const out = toChandraHtml(html, 1000, 200)
    expect(out).toContain('data-bbox="0 0 1000 500"')
    expect(out).toContain('Hello world')
    expect(out).toContain('data-label="text"')
  })
  test('keeps two sibling paragraphs as two separate blocks', () => {
    const html = '<body><p><span data-bbox="0 0 100 50">a</span></p><p><span data-bbox="0 60 100 110">b</span></p></body>'
    const out = toChandraHtml(html, 100, 200)
    expect(out.match(/data-bbox=/gu)?.length).toBe(2)
  })
  test('escapes html-special characters in the joined text', () => {
    const out = toChandraHtml('<p><span data-bbox="0 0 10 10">a&lt;b</span></p>', 10, 10)
    expect(out).toContain('a&lt;b')
    expect(out).not.toContain('a<b')
  })
  test('returns the input unchanged when image dimensions are invalid', () => {
    const html = '<p><span data-bbox="1 2 3 4">x</span></p>'
    expect(toChandraHtml(html, 0, 0)).toBe(html)
  })
})
