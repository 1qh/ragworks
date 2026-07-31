import { expect, test } from 'bun:test'
import { parseQueryList } from './query-parse'

test('a JSON array of strings parses to a trimmed list', () => {
  expect(parseQueryList('["what is the fee?", "when is it due?"]', 'x')).toEqual(['what is the fee?', 'when is it due?'])
})
test('a fenced JSON block is unwrapped before parsing', () => {
  expect(parseQueryList('```json\n["a","b"]\n```', 'x')).toEqual(['a', 'b'])
})
test('a bulleted or numbered list falls back to line splitting with the markers stripped', () => {
  expect(parseQueryList('1. first sub-question\n2. second sub-question', 'x')).toEqual([
    'first sub-question',
    'second sub-question'
  ])
  expect(parseQueryList('- alpha\n- beta', 'x')).toEqual(['alpha', 'beta'])
})
test('empty or unparseable output falls back to the original question, never an empty list', () => {
  expect(parseQueryList('', 'the original question')).toEqual(['the original question'])
  expect(parseQueryList('   \n  ', 'the original question')).toEqual(['the original question'])
})
test('an empty JSON array falls back rather than returning nothing', () => {
  expect(parseQueryList('[]', 'the original question')).toEqual(['the original question'])
})
