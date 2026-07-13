# `sources/` — canonical source ledger

This folder is the **authoritative record of every source** that feeds the knowledge
store (Graph, Flow, Dense). The rule: **nothing is published until it is accounted
for here** with a signed-off disposition.

- **`SOURCES_LOG.md`** — the ledger: one row per distinct source, its origin
  (internet / local / authored-internal / unknown), rights, how it's used, and its
  disposition (CLEARED / PENDING / EXCLUDED / STUB / SAFE-INTERNAL).
- The detailed evaluation and open decisions live in
  [`../docs/SOURCE_PROVENANCE_AUDIT.md`](../docs/SOURCE_PROVENANCE_AUDIT.md); this
  ledger records the *outcomes*.

**Originals are not stored here.** Locally-held source files stay in the gitignored
`local-sources/` directory (see `local-sources/README.md`); this ledger references
them by relative path so nothing copyrighted or sensitive is committed.

Every graph/flow node citation (`SRC-###`, `KB-DOC-##`) and every dense-corpus
`source` should resolve to a row in the ledger.
