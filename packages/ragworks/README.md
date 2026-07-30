# ragworks

Turn a document into retrievable chunks that still know where they came from.

Most RAG stacks treat ingest as a preamble: extract some text, split it every N characters, embed. That is where the answers are lost. A scanned page returns nothing, a table’s value slides one column, and a citation points at a passage no reader can find on the page. This package does that half properly — per-page engine routing, parsing, chunking, and an offset-to-region bridge that keeps every chunk anchored to the pixels it came from — and then retrieves over the store you already have.

## What it does not bring

No store, no record model, no servers, no models. `retrieve` takes your index as a **port**: implement a `search` that returns hits for a vector, add `keywordSearch` if your store has a text index, and hybrid fusion, near-duplicate filtering and optional reranking happen in the core rather than in your database. A store with no keyword side degrades to vector-only instead of failing, because most stores have no text index and demanding one would exclude them.

What stays yours is what genuinely needs a record store — parse versions, lineage, metering, and the documents themselves. The core computes; it reaches for nothing. Every collaborator that touches a network — the parser, the embedder, the reranker, the store — arrives as an argument, so the whole retrieval path is drivable in a test with three functions and no services standing.

## Why the ingest half is worth its own package

- **Per-page routing, not per-document.** A mixed document has clean pages and scanned ones. One engine for the whole file caps quality on the rest. Each page is scored on four orthogonal signals — character count, control-character ratio, script validity, and already-decoded mojibake — and escalated to a vision model only when its text layer is genuinely unusable.
- **The corruption signal measures corruption.** The control-character ratio excludes the C0 layout whitespace every text layer carries by the line. Counting `\n` measures line density instead, which makes the densest table on the page look like the most corrupt one — across a sampled corpus that mistake escalated all 39 pages when 9 needed it, and the vision model then rewrote text the source never contained.
- **Provenance survives chunking.** `buildChunks` returns each chunk’s character span into the markdown _and_ its regions on the page, joined by an interval tree over the parser’s element geometry. That join is the one capability here no library owns.
- **A page assigned to an absent engine still gets read.** If a structure engine is not configured, its pages re-route to the vision model rather than silently keeping the parse the router already rejected.

## Install

```sh
bun add ragworks      # or npm / pnpm
```

Bring only what you use. The parse path reaches a [docling](https://github.com/docling-project/docling) service through its reference adapter unless you pass a `Parser` of your own; embedding reads a provider registry file naming your OpenAI-compatible endpoints. Neither is a vendor lock — every adapter ships at its own subpath (`ragworks/opensearch`, `ragworks/models`, …) and the main entry re-exports none of them, so a consumer bringing their own store or parser never pulls ours into their bundle.

## Use

```ts
import { buildChunks, configureEngine, parseDocument } from 'ragworks'

configureEngine({
  DOCLING_URL: 'http://localhost:5001',
  PROVIDERS_FILE: './providers.toml'
})

const parsed = await parseDocument({ bytes, name: 'policy.pdf' })
const chunks = await buildChunks({
  blocks: parsed.blocks ?? [],
  markdown: parsed.markdown,
  maxSize: 800,
  overlap: 120,
  strategy: 'recursive'
})

for (const c of chunks) console.log(c.text, c.charspan, c.regions)
```

Every step stands alone. If you already parse your own documents, take only `buildChunks`. If you already chunk, take only `locateChunks` and `buildRegionIndex` — the provenance bridge works on any markdown plus any block geometry.

`configureEngine` fails fast, by name, on the two values the pipeline cannot run without. It never substitutes a default, because a pipeline pointed at the wrong service reports success.

## Verify it yourself

```sh
bun smoke.ts <path-to-document>
```

Drives the public API against real services and fails if a spatial parse produces chunks with no page regions.

## Maintenance

This is a living project: the code runs in production and keeps moving, and issues get answered. It is published under Apache-2.0.

Two honest caveats. The Vietnamese-language behaviour is the best-measured part, because that is the corpus it was built against; other languages are expected to work and are not equally measured. And the routing thresholds are defaults drawn from one corpus — they are exported so you can measure your own rather than inherit ours.
