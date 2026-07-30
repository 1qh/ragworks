import { expect, test } from 'bun:test'
import { connectedCommunities, dedupeEntities, isDegenerate, normalizeName, parseExtraction } from './graph-core'

test('entity names normalize across case, punctuation and spacing so one entity is not three', () => {
  expect(normalizeName('  Green SM,  ')).toBe('green sm')
  expect(normalizeName('GREEN SM')).toBe(normalizeName('green sm'))
})
test('dedupe groups the same entity mentioned in different chunks under one key', () => {
  const grouped = dedupeEntities([
    { chunkId: 'c1', name: 'Green SM', type: 'org' },
    { chunkId: 'c2', name: 'green sm.', type: 'org' },
    { chunkId: 'c3', name: 'VinFast', type: 'org' }
  ])
  expect(grouped.size).toBe(2)
  expect(grouped.get('green sm')).toHaveLength(2)
})
test('an empty entity name is dropped rather than forming a blank cluster', () => {
  expect(dedupeEntities([{ chunkId: 'c1', name: '   ', type: 'org' }]).size).toBe(0)
})
test('communities are the connected groups, largest first', () => {
  const communities = connectedCommunities([
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
    { source: 'x', target: 'y' }
  ])
  expect(communities).toHaveLength(2)
  expect(communities[0]?.members).toEqual(['a', 'b', 'c'])
  expect(communities[1]?.members).toEqual(['x', 'y'])
})
test('a self-edge and a blank endpoint never create a community', () => {
  expect(connectedCommunities([{ source: 'a', target: 'a' }])).toHaveLength(0)
  expect(connectedCommunities([{ source: '', target: 'b' }])).toHaveLength(0)
})
test('a graph that collapses into one giant community is reported degenerate, so a global answer is not trusted', () => {
  const giant = connectedCommunities([
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
    { source: 'c', target: 'd' }
  ])
  expect(isDegenerate(giant)).toBe(true)
  expect(
    isDegenerate(
      connectedCommunities([
        { source: 'a', target: 'b' },
        { source: 'c', target: 'd' },
        { source: 'e', target: 'f' },
        { source: 'g', target: 'h' },
        { source: 'i', target: 'j' }
      ])
    )
  ).toBe(false)
})
test('no edges means degenerate, never a confident empty answer', () => {
  expect(isDegenerate([])).toBe(true)
})
test('extraction parses entities and relationships and stamps the source chunk on every entity', () => {
  const out = parseExtraction(
    '```json\n{"entities":[{"name":"Green SM","type":"org"},{"name":"Hanoi","type":"place"}],"relationships":[{"source":"Green SM","target":"Hanoi"}]}\n```',
    'chunk-7'
  )
  expect(out.entities).toHaveLength(2)
  expect(out.entities[0]?.chunkId).toBe('chunk-7')
  expect(out.relationships).toEqual([{ source: 'Green SM', target: 'Hanoi' }])
})
test('a relationship endpoint spelled shorter than its entity keeps its edge, resolved to the canonical name', () => {
  const passage = 'Vinpearl Phu Quoc cung cap dich vu dua don. Cong ty VinWonders quan ly cong vien.'
  const raw = JSON.stringify({
    entities: [
      { name: 'Vinpearl Phu Quoc', type: 'org' },
      { name: 'VinWonders', type: 'org' }
    ],
    relationships: [
      { source: 'Vinpearl', target: 'VinWonders' },
      { source: 'VinWonders', target: 'Vinpearl' },
      { source: 'Khong Co Trong Doan', target: 'VinWonders' }
    ]
  })
  const out = parseExtraction(raw, 'c1', passage)
  /** One edge, not zero: demanding the endpoint be spelled exactly as the entity deletes it, which is
   * how a graph ends up with fewer edges than nodes and nothing for local search to traverse. */
  expect(out.relationships).toEqual([{ source: 'Vinpearl Phu Quoc', target: 'VinWonders' }])
  /** And still grounded — an endpoint naming nothing in the passage stays out. */
  expect(out.relationships.some(r => r.source.includes('Khong Co'))).toBe(false)
})
test('a malformed or empty extraction yields nothing rather than throwing', () => {
  expect(parseExtraction('not json at all', 'c1').entities).toHaveLength(0)
  expect(parseExtraction('', 'c1').relationships).toHaveLength(0)
  expect(parseExtraction('{}', 'c1').entities).toHaveLength(0)
})
test('entries missing a name or an endpoint are dropped, never stored half-formed', () => {
  const out = parseExtraction(
    '{"entities":[{"type":"org"},{"name":"  "}],"relationships":[{"source":"a"},{"source":"a","target":"b"}]}',
    'c1'
  )
  expect(out.entities).toHaveLength(0)
  expect(out.relationships).toEqual([{ source: 'a', target: 'b' }])
})
test('an entity the passage does not contain is dropped, and its relationships with it', () => {
  const raw = JSON.stringify({
    entities: [
      { name: 'Green SM', type: 'org' },
      { name: 'Acme Holdings', type: 'org' }
    ],
    relationships: [
      { source: 'Green SM', target: 'Acme Holdings' },
      { source: 'Green SM', target: 'Green SM' }
    ]
  })
  const passage = 'Green SM applies the discount to every ride.'
  const grounded = parseExtraction(raw, 'chunk-1', passage)
  expect(grounded.entities.map(e => e.name)).toEqual(['Green SM'])
  /** The edge to the dropped entity goes with it, and the SELF-edge goes too: an edge from a node to
   * itself connects nothing a neighbourhood search can traverse while still counting toward that
   * node's degree, which is how a graph reads as hub-dominated when it is merely self-referential. */
  expect(grounded.relationships).toEqual([])
  const ungrounded = parseExtraction(raw, 'chunk-1')
  expect(ungrounded.entities).toHaveLength(2)
})
test('a single letter or a bare number is a parse fragment, never an entity', () => {
  const raw = JSON.stringify({
    entities: [{ name: 'C' }, { name: '2025' }, { name: '15.000' }, { name: 'Green SM' }, { name: 'GSM_KD11' }],
    relationships: [
      { source: 'C', target: 'Green SM' },
      { source: 'Green SM', target: 'GSM_KD11' }
    ]
  })
  const kept = parseExtraction(raw, 'chunk-1')
  expect(kept.entities.map(e => e.name)).toEqual(['Green SM', 'GSM_KD11'])
})
