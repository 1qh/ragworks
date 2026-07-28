# rag-ingest

Turn a document into retrievable chunks that still know where they came from.

Most RAG stacks treat ingest as a preamble: extract some text, split it every N characters, embed. That is where the answers are lost. A scanned page returns nothing, a table’s value slides one column, and a citation points at a passage no reader can find on the page. This package is the ingest half done properly — per-page engine routing, parsing, chunking, and an offset-to-region bridge that keeps every chunk anchored to the pixels it came from.

## What this is not

It is not a whole RAG engine, and the name says so. Retrieval — query understanding, hybrid search, fusion, reranking, the graph index — needs a store interface and a record store, and neither belongs in a library like this. Bring your own index; this package decides what goes into it.

## Why the ingest half is worth its own package

- **Per-page routing, not per-document.** A mixed document has clean pages and scanned ones. One engine for the whole file caps quality on the rest. Each page is scored on four orthogonal signals — character count, control-character ratio, script validity, and already-decoded mojibake — and escalated to a vision model only when its text layer is genuinely unusable.
- **The corruption signal measures corruption.** The control-character ratio excludes the C0 layout whitespace every text layer carries by the line. Counting `\n` measures line density instead, which makes the densest table on the page look like the most corrupt one — across a sampled corpus that mistake escalated all 39 pages when 9 needed it, and the vision model then rewrote text the source never contained.
- **Provenance survives chunking.** `buildChunks` returns each chunk’s character span into the markdown _and_ its regions on the page, joined by an interval tree over the parser’s element geometry. That join is the one capability here no library owns.
- **A page assigned to an absent engine still gets read.** If a structure engine is not configured, its pages re-route to the vision model rather than silently keeping the parse the router already rejected.

## Install

```sh
bun add rag-ingest      # or npm / pnpm
```

Needs a [docling](https://github.com/docling-project/docling) service for parsing, and a provider registry file naming your OpenAI-compatible endpoints for embedding. Both are configuration, not vendors: any OpenAI-compatible host works, local or managed.

## Use

```ts
import { buildChunks, configureEngine, parseDocument } from 'rag-ingest'

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
