# Sources Log — canonical ledger

The authoritative per-source record. **Disposition** is the operative field; it
governs the clean rebuild. See [`../docs/SOURCE_PROVENANCE_AUDIT.md`](../docs/SOURCE_PROVENANCE_AUDIT.md)
for the reasoning and open decisions.

## Standing policy (user, 2026-07-13)

Reflects the review of the audit. The posture is **use the content freely for
extraction now, defer legal questions**, with hard hygiene rules:

1. **Extract/use everything we have** — copyright & redistribution are addressed
   *later*, not a gate on the rebuild.
2. **Never ship raw source docs** (papers *or* OEM manuals). Extract text; keep
   originals in gitignored `local-sources/`.
3. **Reference the internet version** of every source that has one (capture the
   canonical URL/DOI). Verify which OEM manuals are actually public.
4. **Scrub** all extracted/authored content for employee **names**, site-identifying
   details, and **site-specific parameters/recipe filenames**.
5. **Structure (J): RESOLVED (2026-07-13).** (1) "Deployed Environment" framing →
   **genericized** to "an Optomec HD2" (done in committed sources). (2) "Decathlon"
   codename → **removed** (done). (3) Site-specific recipe filenames
   (`ABQ_PA_Clariant_Start_Up.ini`, `0K HD2_UA_Shutdown.ini`) → **scrubbed** from
   committed docs + graph node content.

### Programmatic scrub (implemented)

Scrubbing is now a **re-runnable filter**, not manual edits — `scripts/scrub.ts` is
the single source of truth. Rules: `Decathlon` → `HD2`; "Deployed Environment" framing
→ generic; site-specific recipe `.ini` filenames (underscored) → redacted; OEM employee
names (Brocato, Pulscher, Sandoval, …) → redacted. Deterministic + idempotent.

- **`npm run scrub:kb`** — applies it to every `docs/kb-candidates/*.md` (`--check` for a
  CI gate). All 31 candidates currently clean.
- **Ingest** (`scripts/ingest-corpus.ts`) applies `scrubText()` to every source's text
  before chunking, so a rebuilt `public/ajp-corpus.json` never reintroduces the ~149
  `Decathlon` / employee-name occurrences currently baked into the shipped corpus.

Note: IPs / camera serials / COM ports are **not** regex-scrubbed (a generic IPv4
pattern also matches document clause numbers like IPC `3.9.1.2`). Those values live
only in the raw machine-config exports, which are handled by **exclusion**
(`EXCLUDED_SOURCES` — never ingested), not scrubbing.

**Disposition values:** `USE` (extract + cite; legal review deferred) · `USE-SCRUB`
(extract, but scrub names/params first) · `EXCLUDED` (out; reason recorded) ·
`STUB` (not acquired) · `SAFE-INTERNAL` (authored by us; scrub) · `PENDING` (open).
Rule 2 (**no raw docs committed**) and rule 3 (**cite internet version**) apply to
every `USE`/`USE-SCRUB` row.

Legend — Origin: `net` internet URL · `local` file on disk · `internal` authored by us · `?` unknown.

## 1. Dense corpus inputs

### 1a. Internet-sourced (also serve as graph citations)
| Key | Origin | Rights | Uses | Disposition |
|---|---|---|---|---|
| `stanford-snf-sop` (=SRC-018) | net | facility manual, public | dense + cite | **USE** |
| `boise-state-iml-sop` (=SRC-019) | net | lab SOP, public | dense + cite | **USE** |
| `pmc9412835` (=SRC-005) | net | PMC (license later) | dense + cite | **USE** |
| `nature-line-quality` (=SRC-004) | net | Sci Reports | dense + cite | **USE** |
| `frontiers-fault-analysis` (=SRC-003) | net | Frontiers CC-BY | dense + cite | **USE** |

### 1b. Local papers (`curatedBy: Eddie`) — extract from local, cite internet
Rule: extract from the locally-held PDF, **cite the internet version**, don't ship the PDF. Capture the DOI/URL in the ref cell.
| Key | Origin | Internet ref (to capture) | Disposition |
|---|---|---|---|
| `chen-2018-overspray` | local | Adv. Eng. Mater. — DOI TBD | **USE** (cite internet) |
| `gu-2017-fillets` | local | Adv. Mater. Technol. — DOI TBD | **USE** (cite internet) |
| `fisher-2023-sensors` | local | Adv. Mater. Technol. — DOI TBD | **USE** (cite internet) |
| `secor-2018-principles` | local | Flex. Print. Electron. (IOP) — DOI TBD | **USE** (cite internet) |
| `wilkinson-2019-review` | local (**OA mirror: White Rose**) | eprints.whiterose.ac.uk/146144 | **USE** (cite White Rose OA) |
| `salary-2019-state-of-art` | local | MSEC 2019 (ASME) — DOI TBD | **USE** (cite internet) |

### 1c. OEM manuals (`curatedBy: OEM`) — verbatim OK, don't ship raw, scrub names
Rule: extract verbatim text is fine; **never ship the raw manual**; **scrub employee
names + site params** (rule 4); link the internet version *where one exists* (most
numbered Optomec manuals are **not** public — verify, cite by P/N otherwise).
| Key | Origin | Public link? | Disposition |
|---|---|---|---|
| `hd2-motion-vision-kewb` (9001094) | local | likely none (verify) | **USE-SCRUB** |
| `hd2-health-safety` (9000876) | local | likely none (verify) | **USE-SCRUB** |
| `hd2-process-manual` (9000983) | local | likely none (verify) | **USE-SCRUB** — strip employee revision log |
| `hd2-process-dev-session11` (24450) | local | likely none (verify) | **USE-SCRUB** |
| `hd2-block-diagram` | local | likely none (verify) | **USE-SCRUB** |

## 2. Currently excluded — reclassify?
The raw originals are **not in the repo** (they live only in your local `CoreKB/…`
folder). The 3 raw-config files carry **real IPs/serials/COM ports** → keep excluded
or `USE-SCRUB` only after heavy scrubbing. The 3 `.docx` are just absent; reclassify
if you want them (drop into `local-sources/`, then `USE-SCRUB`).
| Key | Origin | Note | Disposition |
|---|---|---|---|
| `hd2-training-manual` | ? (.docx) | not in repo | EXCLUDED (reclassify if wanted) |
| `hd2-qanda` | ? (.docx) | site-specific ops content | EXCLUDED (reclassify if wanted) |
| `hd2-definitions` | ? (.docx) | not in repo | EXCLUDED (reclassify if wanted) |
| `hd2-sequences` | local (deployment) | raw config — recipe filenames | EXCLUDED (abstracted in `canonical-steps.ts`) |
| `hd2-alarms` | local (deployment) | raw config | EXCLUDED (abstracted in `design-faults.ts`) |
| `hd2-process-config` | local (deployment) | **real IPs, serials, COM port** | EXCLUDED (abstracted in `design-faults.ts`) |

## 3. Stubs (no data shipped)
| Key | Disposition |
|---|---|
| `hd2-motion-vision-kewb-full` | STUB |
| `expert-session-transcripts` | STUB |

## 4. Graph/Flow external citations (`SRC-###`) — expand to extraction
Per disposition F: these are no longer citation-only — **extract full text where
available** (they're public URLs) to enrich the dense corpus. Preprints/paywalled
that block extraction stay cite-only. Verify each URL resolves.

Disposition: **USE** (extract + cite) for all `net` sources with retrievable text —
SRC-001…005, 007…020. **SRC-006** (arXiv preprint): USE if the PDF extracts cleanly,
else cite-only. SRC-003/004/005/016/018/019/020 overlap §1a/§6 (dedupe on rebuild).

## 5. Graph/Flow internal-authored (`KB-DOC-##`) — USE-SCRUB
`docs/kb-candidates/01–10_*.md`, authored by the TeachMe project. Per disposition G:
**scrub for names / site params / sensitivity** before publish. Disposition:
**USE-SCRUB** (all 10). Derived-authored, expected clean, but scrub to confirm.

## 6. Candidate docs — web-retrieved (`21–30`) — `net`
Extracted from public URLs (manifest: `knowledge/report-source-retrieval.json`).
Per disposition H: **use fully**, flag copyright only. 21 CEUR, **22 White Rose
Wilkinson OA**, 23/24/25 Optomec, 26 NIOSH, 27 IPC-7711 TOC (**flag: IPC standard is
copyrighted**), 28 Nature Comms, 29 OSHA, 30 OSTI. Disposition: **USE** (all; 27 flagged).

## 7. Candidate docs — authored notes (`31–40`) — all fine to use (disposition I)
Project-authored extraction notes, **not raw sources**. User: "these are all fine to
use." J genericization applied.
| Files | Origin | Disposition |
|---|---|---|
| 31–33 `eddie_*` (paper reading notes) | internal | USE (confirm no long verbatim quotes) |
| 34–39 `hd2_*` (doc notes) | internal notes | USE — "Deployed Environment" genericized, recipe filenames scrubbed; the raw docs they describe remain EXCLUDED |
| 40 `hd2_oem_pdfs` (OEM index) | internal index | USE — "Decathlon" codename removed |
