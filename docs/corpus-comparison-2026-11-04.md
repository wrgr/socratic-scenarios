# ExpertTrace corpus comparison — 2026-11-04

This audit compares the current ExpertTrace retrieval data with the older local TeachMe exports to distinguish extraction regressions from superseded data.

## Recommendation

Keep the current corpus as the baseline. Do not bulk-restore the old JSON,
SQLite database, or embedding cache. Two sources have clear extraction failures;
two others need a targeted completeness review. This change repairs startup
registration only and does not change any corpus text or embeddings.

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
