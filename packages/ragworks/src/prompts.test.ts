import { expect, test } from 'bun:test'
import { parseExtraction } from './graph-core'
import { chunkContextPrompt, cleanQuery, contextualizePrompt, graphExtractionPrompt } from './prompts'

test('the shape the extraction prompt REQUESTS is the shape its parser accepts', () => {
  /** The contract that would otherwise drift silently: change the prompt's stated JSON and the parser
   * keeps returning an empty extraction rather than erroring, which reads as a model that found
   * nothing. Answering the prompt exactly must parse. */
  const passage = 'Vinpearl operates VinWonders.'
  const answered = JSON.stringify({
    entities: [
      { name: 'Vinpearl', type: 'org' },
      { name: 'VinWonders', type: 'org' }
    ],
    relationships: [{ source: 'Vinpearl', target: 'VinWonders' }]
  })
  expect(graphExtractionPrompt(passage)).toContain('"entities"')
  const out = parseExtraction(answered, 'c1', passage)
  expect(out.entities.map(e => e.name)).toEqual(['Vinpearl', 'VinWonders'])
  expect(out.relationships).toEqual([{ source: 'Vinpearl', target: 'VinWonders' }])
})
test('the extraction prompt asks for the passage language, never a translation', () => {
  /** A translated entity no longer matches the text it came from, so the grounding check drops it and
   * the extraction silently returns less than the model found. */
  expect(graphExtractionPrompt('x')).toContain("passage's own language")
})
test('a rewrite is cleaned of reasoning blocks, labels, and unbounded length', () => {
  expect(cleanQuery('<think>weighing it up</think>\nStandalone query: what is the fee')).toBe('what is the fee')
  /** The cap is not cosmetic: an uncapped rewrite overflows the keyword engine's clause limit and that
   * leg silently drops, so half of hybrid retrieval disappears with no error. */
  expect(cleanQuery(Array.from({ length: 200 }, (_, i) => `w${String(i)}`).join(' '), 5).split(' ')).toHaveLength(5)
})
test('the contextualize prompt carries the recent turns and the question it must resolve', () => {
  const p = contextualizePrompt([{ answer: 'The fee is 200.', question: 'what is the fee' }], 'and for the second one?', 6)
  expect(p).toContain('The fee is 200.')
  expect(p).toContain('and for the second one?')
})
test('the chunk-context prompt situates a chunk inside its document', () => {
  const p = chunkContextPrompt('a long policy document', 'row 3: 200')
  expect(p).toContain('a long policy document')
  expect(p).toContain('row 3: 200')
})
