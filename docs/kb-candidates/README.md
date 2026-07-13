## kb-candidates

Source-of-truth markdown chunks for the knowledge database. Ingested by `npm run db:ingest-kb` ([scripts/db/ingest-kb.ts](../../scripts/db/ingest-kb.ts)) — each `.md` file is split on `##` headings, with optional YAML frontmatter (`linked_node_ids`, `confidence`, `domain`, `chunk_type`).

Despite the "candidates" name, these are not a staging area — the ingest pipeline depends on them. If you change the directory layout, update [scripts/db/ingest-kb.ts](../../scripts/db/ingest-kb.ts) and [scripts/db/retrieve-report-sources.ts](../../scripts/db/retrieve-report-sources.ts).

Filename conventions (informal):
- `01–10` — authored synthesis docs (signals, fault diagnosis, tacit knowledge, methods)
- `21–30` — `*_retrieved_*.md` web sources fetched by `db:retrieve-report-sources`
- `31–40` — Optomec/HD2-specific manuals, Q&A, alarm catalogs
