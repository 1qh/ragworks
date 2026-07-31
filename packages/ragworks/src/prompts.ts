/** The prompts that ELICIT the output this package's parsers consume.
 *
 * Shipping `parseExtraction` without the prompt that produces its JSON leaves a consumer holding a
 * reader for a format nobody told them how to request — they would have to reverse-engineer the shape
 * out of the parser, and any drift between their guess and it fails as an empty extraction rather than
 * an error. A parser and the prompt it expects are one contract, so they live together.
 *
 * Each returns a string and reaches nothing: bring your own model, run it however you like, and hand
 * the raw completion back to the matching parser. */
interface PriorTurn {
  answer: string
  question: string
}
/** Pairs with `parseExtraction`. Names are requested in the PASSAGE's own language rather than
 * translated, because an entity translated at extraction time no longer matches the text it came from
 * and the grounding check then drops it. */
const graphExtractionPrompt = (passage: string): string =>
  `Extract the named entities and the relationships between them from this passage. Use the passage's own language for names. Return ONLY JSON of the form {"entities":[{"name":"...","type":"..."}],"relationships":[{"source":"...","target":"..."}]} with no prose.\n\nPassage:\n${passage}\n\nJSON:`
/** Contextual Retrieval: a standalone sentence situating a chunk in its document, prepended before
 * embedding so a passage that reads as a bare fragment becomes retrievable. One caveat measured on a
 * real corpus: where rows already look alike, a prefix drawn from a sibling makes passages LESS
 * distinguishable, so this earns its place on fragments rather than on uniform tables. */
const chunkContextPrompt = (document: string, chunk: string): string =>
  `Here is a document:\n${document}\n\nHere is a chunk from it:\n${chunk}\n\nWrite one short standalone sentence, in the document's language, that situates this chunk within the whole document to improve search retrieval. Give only the sentence, no preamble.`
/** Resolve a follow-up question's referents against prior turns into a standalone query. Retrieval sees
 * only the query, so an unresolved pronoun searches for nothing useful. */
const contextualizePrompt = (history: readonly PriorTurn[], question: string, historyTurns = 6): string =>
  `Given the conversation so far, rewrite the final user question into a standalone search query that resolves every referent (pronouns, "it", "that", ellipsis) using the prior turns. Output only the rewritten query.\n\n${history
    .slice(-historyTurns)
    .map(h => `User: ${h.question}\nAssistant: ${h.answer}`)
    .join('\n')}\n\nUser: ${question}\n\nStandalone query:`
const QUERY_LABEL = /^(?:standalone query|query|rewritten query)\s*:\s*/iu
const WHITESPACE = /\s+/u
const THINK_BLOCK = /<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/giu
/** Clean a rewrite back into a usable query. A reasoning model answers with a think block and a label,
 * and a keyword engine has a clause limit — an uncapped rewrite overflows it and that leg silently
 * drops, so the cap is what keeps a rewrite from disabling half of hybrid retrieval. */
const cleanQuery = (raw: string, termCap = 60): string => {
  const lines = raw
    .replace(THINK_BLOCK, '')
    .split('\n')
    .map(l => l.replace(QUERY_LABEL, '').trim())
  const picked = lines.find(l => l.length > 0 && !l.endsWith(':')) ?? lines.find(Boolean) ?? raw.trim()
  return picked.split(WHITESPACE).slice(0, termCap).join(' ')
}
export { chunkContextPrompt, cleanQuery, contextualizePrompt, graphExtractionPrompt }
export type { PriorTurn }
