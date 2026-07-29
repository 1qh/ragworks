import { expect, test } from 'bun:test'
import { respaceText } from './respace'

const words = ['DỊCH', 'VỤ', 'VẬN', 'CHUYỂN', 'CÔNG', 'CỘNG', 'A.1']
test('a fused run is restored to the spacing the page text layer carries', () => {
  expect(respaceText('A.1 DỊCHVỤVẬNCHUYỂNCÔNGCỘNG', words)).toBe('A.1 DỊCH VỤ VẬN CHUYỂN CÔNG CỘNG')
})
test('text that is already spaced is returned untouched', () => {
  const spaced = 'A.1 DỊCH VỤ VẬN CHUYỂN CÔNG CỘNG'
  expect(respaceText(spaced, words)).toBe(spaced)
})
test('a long word the page text does not corroborate is left alone, never guessed apart', () => {
  expect(respaceText('MELIÁREWARDSPROGRAM', ['UNRELATED', 'TOKENS'])).toBe('MELIÁREWARDSPROGRAM')
})
test('a genuinely single long word is preserved, not split', () => {
  expect(respaceText('PASSIONFRUITCORDIAL', ['PASSIONFRUITCORDIAL'])).toBe('PASSIONFRUITCORDIAL')
})
test('no page words means no repair rather than a mangled guess', () => {
  expect(respaceText('DỊCHVỤVẬNCHUYỂNCÔNGCỘNG', [])).toBe('DỊCHVỤVẬNCHUYỂNCÔNGCỘNG')
})
test('a short fused pair is repaired once the page corroborates it', () => {
  expect(respaceText('SẢNPHẨM', ['SẢN', 'PHẨM'])).toBe('SẢN PHẨM')
})
test('a single-letter fragment never drives a split', () => {
  expect(respaceText('AHOMES', ['A', 'HOMES'])).toBe('AHOMES')
})
test('an ordinary word of six letters is untouched when uncorroborated', () => {
  expect(respaceText('CHUYỂN', ['CHUYỂN'])).toBe('CHUYỂN')
})
