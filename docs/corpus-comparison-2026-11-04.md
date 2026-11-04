# ExpertTrace corpus comparison — 2026-11-04

This audit compares the current ExpertTrace retrieval data with the older local TeachMe exports to distinguish extraction regressions from superseded data.

## Recommendation

Keep the current corpus as the baseline. Do not bulk-restore the old JSON,
SQLite database, or embedding cache. Two sources have clear extraction failures;
two others need a targeted completeness review. The initial startup change repaired graph registration only. The subsequent
source repair is recorded below; it selectively re-extracts current originals
rather than restoring the older exports.

## Inputs and method

- Current: `public/ajp-corpus.json` in `wrgr/socratic-scenarios`, generated
  2026-07-14, model `gemini-embedding-001`, 377 chunks. The previous investigation
  downloaded the production file and verified it exactly matches this local JSON.
- Older JSON: `public/ajp-corpus.json` in the separate local `teachme` checkout,
  generated 2026-04-15, same model, 507 chunks.
- Older database: `knowledge/knowledge.db` in that checkout, opened read-only;
  its chunks were created/updated on 2026-04-12–13.
- Older node cache: `public/ajp-node-embeddings.json` in that checkout,
  generated 2026-04-15, 128 nodes.
- Matched JSON sources by `sourcesSummary.id`, then selected their chunks by
  the source-ID prefix in chunk IDs. Counted words with lowercase ASCII
  `[a-z0-9]+` tokens. Word counts include chunk overlap and are not unique
  document word counts. Inspected section headings and beginnings/endings
  for the largest reductions. This is a text/extraction audit, not a semantic
  equivalence proof or a retrieval-quality benchmark.

Current JSON SHA-256:
`ff97e331027213789b4d83252711c4097b7bb6756016ff0c72a08b2008020953`.

Older JSON SHA-256:
`e549fde8cd078d341656d6cb2eeae0bd6d3de1bdc32c8399faff064145387f69`.

## What changed

All 16 sources that had chunks in the old JSON still have chunks in the current
JSON. The current manifest adds two populated sources (Training Manual, 3;
Questions and Answers, 4), and one failed source (Definitions, 0). Therefore,
retained source names do not imply retained source content.

Four sources account for 147 fewer chunks; growth elsewhere adds 17, giving
507 - 147 + 17 = 377. The file history labels the current update
`dba0cdd` as a full ingest with a paid key; it does not explain these reductions.

### Confirmed extraction regressions

- **Nature line-quality study** (`nature-line-quality`): 30 → 1 chunks;
  10,309 → 49 counted words. The old content includes the article
  "Optimization of process parameters in micro-scale pneumatic aerosol jet
  printing"; the current sole chunk is a "Client Challenge" asking for
  JavaScript. It is not article content, despite manifest status `ok`.
- **HD2 Process Manual** (`hd2-process-manual`): 89 → 6 chunks;
  32,249 → 2,076 counted words. The current text covers revisions,
  introductory equipment material, and initial safety warnings, then ends
  mid-sentence. Old chunks extend into operational procedures, maintenance,
  and end matter. Some old text is legitimately obsolete or scrub-worthy,
  but redaction alone does not explain this extent of truncation.

Re-extract these two from reviewed source documents with the existing scrub
policy and matching embeddings, and validate their content before replacement.
The old copies are recovery references, not approved public replacements.

### Shorter extractions requiring review

- **Salary 2019 review**: 43 → 19 chunks; 16,171 → 6,799 counted words.
  Current text is substantially rewritten/condensed and omits the old
  reference-list tail. Some reduction is end matter, but full preservation
  of the technical body is not established.
- **Fisher 2023 sensor review**: 69 → 58 chunks; 25,203 → 21,286 counted words.
  Current text still reaches conclusions and author contributions. This is
  not the clear cutoff seen in the process manual; chunk-count reduction
  alone does not establish harmful loss. Review selected technical sections
  before treating the older wording as missing knowledge.

### Other source chunk counts (older → current)

- Stanford SOP: 18 → 20.
- Boise State SOP: 13 → 14.
- PMC 9412835: 19 → 19; concatenated selected chunk text is identical.
- Frontiers paper: 70 → 70.
- Chen 2018: 27 → 28.
- Gu 2017: 17 → 17.
- Secor 2018: 20 → 23.
- Wilkinson 2019: 30 → 31.
- Motion/Vision manual: 47 → 49.
- Health/Safety guidelines: 5 → 5.
- Process Development Session 11: 8 → 8.
- Hardware block diagram: 2 → 2.

These counts are an inventory, not evidence of semantic equivalence. Parsing,
rewriting, redaction, and overlap changed between exports.

## Why the database is not a replacement

The older database has 978 chunks and 98 source records, including 884 chunks
classified as external-source/external-source-extract and 94 other chunks.
Its 94 distinct external-source role contexts cover a broader set of vendor,
government, safety, and research material than the canonical JSON manifest.
No database chunk exactly matches a current or older JSON chunk after lowercase
ASCII token normalization; different segmentation and paraphrasing limit the
meaning of that exact-match result.

This is the separate, deprecated pipeline already described in
[DATA_CATALOG.md](DATA_CATALOG.md), not evidence that 601 canonical chunks were
lost. Its extra references may be future enrichment candidates; they need
source-by-source review rather than bulk import.

Its graph has 108 node IDs: 105 occur in the current graph, and three old
`KEWA` IDs correspond to renamed `KEWB` nodes. The current graph has 130 nodes.
Every ID in the older 128-node embedding cache is present in the current graph;
the current graph additionally includes `PARAM-INK-IDENTITY-001` and
`TACIT-ESD-HANDLING-001`. No old embedded node ID was lost.

The node-embedding JSON is absent from the current checkout; it is an optional
precomputed cache, separate from the 377 embedded document chunks. The old
128-node cache is incomplete for today's graph and should not be copied back
without checking text/model consistency or regenerating it.

## Follow-up boundaries

Keep machine-configuration exclusions and existing redaction rules. Existing
catalog/audit prose still describes older counts and excludes two documents
that the July JSON actually includes; reconcile that documentation during the
next deliberate corpus update. This audit does not establish new redistribution
rights, change inclusion decisions, or restore historical content.

## Source repair completed — 2026-11-04

Rebuilt four sources with `--sources` and `--extract=local`. The publisher's
Nature PDF and the three held local PDFs were parsed in full with `pdf-parse`.
The Nature PDF's license page and the manual's Chapter 1 page were also rendered
and visually checked against extracted content. The manual revision-log block
was omitted under the standing employee-name policy, and reader-specific PDF
download watermarks were removed. The existing deterministic scrub ran before
chunking and before any embedding request.

- Nature: 12 PDF pages, 1 → 29 chunks.
- Process Manual: 176 PDF pages, 6 → 105 chunks.
- Salary: 16 PDF pages, 19 → 44 chunks.
- Fisher: 37 PDF pages, 58 → 104 chunks.

All new chunks have finite 3072-dimensional vectors in the existing
`gemini-embedding-001` model space. All 293 unrelated chunks (including their
embeddings) were retained exactly. The total is 575 chunks, up from 377.
References/end matter and overlap contribute to counts; counts are not a
semantic-equivalence or retrieval-quality metric.

The Definitions Word file was inspected independently: its text contains 14 term
names and no definitions. It remains incomplete. A deliberate failed repair of
that source returned nonzero and left the entire corpus byte-for-byte unchanged.
No definitions were invented, and no old database data was bulk-imported.

The added quality checks reject browser challenges, non-finite/wrong-size
vectors, unfinished model output, and model text retaining less than 80% of the
local PDF text layer. Model extraction falls back to complete local text.
Selected-source repairs reject unknown/excluded IDs, enforce the embedding model,
and only replace the corpus after every selected source succeeds.

Repaired corpus SHA-256:
`6e21900d25a8e095ac3aa9bbc99a5f3cebc2593575a54d2fd3b09d2b70d939c0`.

Input PDF SHA-256 values (raw originals are not committed):

- Nature publisher PDF: `e18a4bbdc017f11771d2a3cc07c267e38fffffec75e7ef25acd638f296eaabcd`.

- HD2 Process Manual: `c3ea9748f01cb1332ba49efbf14ecff34fa3dbf0e1393602f7fac6f0f3b803c7`.

- Salary 2019: `b5ff48e75c28f7b001c8ab7857a8718c626c84a3d72f2ce6b723f0609b929f54`.

- Fisher 2023: `6fae8565c4aff66c028187bb8924ce638c064a165864b11f84ec7d9980a3b028`.
