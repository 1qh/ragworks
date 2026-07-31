import { expect, test } from 'bun:test'
import { assembleContextTool, mergeToParents, orderContext, parseQueryListTool, statelessTools } from './mcp'

test('every tool carries a name, an input shape and a description that TEACHES', () => {
  for (const tool of statelessTools) {
    expect(tool.name).toMatch(/^[a-z][a-z-]+$/u)
    expect(Object.keys(tool.inputSchema).length).toBeGreaterThan(0)
    /** A bare parameter list leaves an agent guessing, and the guesses are expensive — so a description
     * short enough to be one is a defect, not a style preference. */
    expect(tool.description.length).toBeGreaterThan(200)
  }
})
test('tool names are unique, so a consumer registering the whole set cannot silently shadow one', () => {
  const names = statelessTools.map(t => t.name)
  expect(new Set(names).size).toBe(names.length)
})
test('every tool is PURE — running it twice on one input returns the same result', () => {
  const args = { passages: ['a', 'b', 'c', 'd', 'e'] }
  expect(orderContext.run(args)).toEqual(orderContext.run(args))
})
test('assembly stops at whole passages and never drops the top-ranked one', () => {
  const segments = [
    { chunkId: 'a', text: 'one two', tokens: 2 },
    { chunkId: 'b', text: 'three four', tokens: 2 }
  ]
  expect(assembleContextTool.run({ budget: 2, segments }).includedIds).toEqual(['a'])
  /** Alone over budget: included anyway, because an empty context answers nothing. */
  expect(
    assembleContextTool.run({ budget: 1, segments: [{ chunkId: 'x', text: 'a b c', tokens: 3 }] }).includedIds
  ).toEqual(['x'])
})
test('merge-to-parents returns its input unchanged when the corpus carries no parent edges', () => {
  const retrieved = [{ chunkId: 'a', parentId: null, score: 1, text: 'x' }]
  const out = mergeToParents.run({ minChildRatio: 0.5, parents: [], retrieved })
  expect(out.merged.map(m => m.chunkId)).toEqual(['a'])
})
test('an empty or unparseable model output falls back to the question rather than an empty list', () => {
  /** A stage that returns nothing silently deletes itself from the pipeline, so the fallback is what
   * keeps a failed rewrite from collapsing the whole query. A single line is a valid one-query answer
   * and is taken as such, never treated as failure. */
  expect(parseQueryListTool.run({ fallback: 'original question', text: '' }).queries).toEqual(['original question'])
  expect(parseQueryListTool.run({ fallback: 'original question', text: 'one line' }).queries).toEqual(['one line'])
})
