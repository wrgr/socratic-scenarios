# Security & data provenance

This is a research prototype. It ships **no secrets** and takes a deliberate stance on
source provenance, because the training corpus is derived from third-party technical
documents.

## Secrets

- **No API keys are committed.** The app runs key-free in a deterministic *simulated*
  mode; a Gemini key is supplied at runtime via the gear icon (BYOK), stored only in the
  browser's `localStorage`.
- `.env` is gitignored. `VITE_`-prefixed variables are inlined into the client bundle at
  build time, so a real key must **never** be placed in a committed `.env` or a published
  `dist/`. Prefer the runtime BYOK flow.
- The ingestion pipeline redacts any API key echoed back in provider error messages before
  it can reach logs or the corpus JSON (`scripts/ingest-corpus.ts`).

## Source provenance & sensitivity

Every source that feeds the knowledge store is accounted for in
[`sources/SOURCES_LOG.md`](sources/SOURCES_LOG.md), with an evaluation in
[`docs/SOURCE_PROVENANCE_AUDIT.md`](docs/SOURCE_PROVENANCE_AUDIT.md) and a store map in
[`docs/DATA_CATALOG.md`](docs/DATA_CATALOG.md). Rules enforced:

- **Raw source documents are never shipped.** Third-party PDFs/`.docx` (vendor manuals,
  journal papers) live only in a gitignored `local-sources/` directory. The repo ships
  *extracted, scrubbed* text in the dense corpus and hand-authored abstractions in the
  graph — never the original files.
- **Machine-configuration exports are excluded, not scrubbed.** Raw config from a real
  deployment (network addresses, serial numbers, recipe/toolpath filenames) is quarantined
  and never ingested (`EXCLUDED_SOURCES`); the useful knowledge is re-authored as generic
  graph nodes with no real identifiers.
- **Deterministic scrub filter.** `scripts/scrub.ts` is a single, re-runnable source of
  truth that removes internal codenames, deployment-identifying framing, site-specific
  recipe filenames, and personal names. It runs over the `.md` reference docs
  (`npm run scrub:kb`) and over every corpus chunk at ingest time, so re-extraction can't
  reintroduce sensitive terms. `npm run scrub:kb -- --check` is a CI-style gate.
- **Copyright/redistribution** of the underlying third-party documents is the user's
  responsibility; extracted text is used for a research prototype and the raw documents are
  not redistributed. See the sources ledger for per-source rights notes.

## Reporting

Found a leaked secret, a sensitive value in the corpus, or a provenance concern? Please
open an issue (omit the sensitive value itself) or contact the maintainer directly.
