# Source Provenance Audit

**Status: DRAFT for explicit review.** Nothing is published or rebuilt until every
source below has a signed-off disposition recorded in `sources/SOURCES_LOG.md`.

This audit enumerates **every input used to build the knowledge store** — across all
three parts (**Graph**, **Flow**, **Dense**) — and classifies each by **origin**
(does it have a real internet source, or did it come from a local / unknown place?)
and **rights**, then proposes a **handling decision** for you to confirm or override.

## How to use this document

1. Read each group. The **Rec.** (recommended handling) column is my assessment, not
   a decision.
2. Rows marked **⟵ NEEDS INPUT** are where I can't decide for you (rights unclear,
   or a policy call about what's OK to publish). Your call drives the clean rebuild.
3. Record final dispositions in `sources/SOURCES_LOG.md` (the canonical ledger).

### Origin legend
- **internet** — has a public URL; re-derivable and linkable. We can cite + link,
  and extract text, without shipping the original file.
- **local** — came from a file on disk (`local-sources/`, gitignored). May *also*
  have an internet origin we haven't linked yet (see reconciliation notes).
- **authored-internal** — written by the TeachMe project itself.
- **unknown** — origin/authorship/rights not established. Default to exclude.

### Handling legend
- **extract+cite** — extract text into the dense corpus, cite the URL. OK when rights permit.
- **cite-only** — link/cite it, but do not ship extracted body text.
- **abstract→graph** — do not ship source text; encode the *knowledge* as authored graph nodes.
- **exclude** — keep out entirely; record the reason.

---

## A. Dense inputs — internet-sourced (`ACTIVE_SOURCES` with a `url`)

These already have public URLs. Extraction is re-derivable; we never need to ship the doc.

| id | Origin | Rights (assessed) | Rec. | Notes |
|---|---|---|---|---|
| `stanford-snf-sop` | internet | shared-facility manual, public PDF | extract+cite | = `SRC-018`. Stanford SNF AJ300 manual. |
| `boise-state-iml-sop` | internet | university lab SOP, public PDF | extract+cite | = `SRC-019`. |
| `pmc9412835` | internet | PMC — **verify OA/CC license** | extract+cite | = `SRC-005`. Also a dense source **and** a graph citation. |
| `nature-line-quality` | internet | *Sci Reports* s41598 — typically CC-BY | extract+cite | = `SRC-004`. |
| `frontiers-fault-analysis` | internet | Frontiers — CC-BY | extract+cite | = `SRC-003`. |

**Reconciliation:** these five are counted **twice** — once as dense inputs and once
as `SRC-###` graph citations. That's expected (same doc, two uses), but the log
should list one canonical entry per doc with both uses noted.

---

## B. Dense inputs — local papers, `curatedBy: "Eddie"` (COPYRIGHT REVIEW)

Six PDFs held locally. Their extracted **verbatim body text is in the shipped
corpus today** (~206 chunks). Most are closed-access journals — shipping that text is
the primary copyright blocker. For each: establish the canonical internet source and
license, then decide.

| id | Journal / rights | Internet source? | Rec. | ⟵ decision |
|---|---|---|---|---|
| `chen-2018-overspray` | Adv. Eng. Mater. (Wiley) — likely all-rights-reserved | none linked yet | abstract→graph, cite-only | **NEEDS INPUT** |
| `gu-2017-fillets` | Adv. Mater. Technol. (Wiley) — likely ARR | none linked yet | abstract→graph, cite-only | **NEEDS INPUT** |
| `fisher-2023-sensors` | Adv. Mater. Technol. (Wiley) — likely ARR | none linked yet | abstract→graph, cite-only | **NEEDS INPUT** |
| `secor-2018-principles` | Flex. Print. Electron. (IOP) — **may be OA** | verify IOP OA | extract+cite **iff** OA, else cite-only | **NEEDS INPUT** |
| `wilkinson-2019-review` | Int. J. Adv. Manuf. Technol. (Springer) | **YES — White Rose OA eprint** already retrieved (`kb-candidates/22`) | extract+cite **from the OA eprint**, drop the local PDF | recommend: use OA mirror |
| `salary-2019-state-of-art` | MSEC 2019 (ASME conf.) — likely ARR | none linked yet | abstract→graph, cite-only | **NEEDS INPUT** |

**Related derived docs:** `docs/kb-candidates/31_eddie_chen_2018_overspray.md`,
`32_eddie_gu_2017_fillets.md`, `33_eddie_secor_2018_principles.md` are project-written
*summaries* of these papers — authored-internal derivatives, safe to keep as our own
prose (they are not the papers' text). Confirm they contain no long verbatim quotes.

---

## C. Dense inputs — OEM manuals, `curatedBy: "OEM"` (RESTRICTED)

Five officially-numbered Optomec PDFs held locally. Their extracted text is in the
shipped corpus today (~151 chunks), including a **revision log naming ~9 Optomec
employees**. OEM manuals typically carry no redistribution rights.

| id | Doc | Rec. | ⟵ decision |
|---|---|---|---|
| `hd2-motion-vision-kewb` | 9001094 Motion/Vision + KEWB | abstract→graph, exclude verbatim | **NEEDS INPUT** (pursue Optomec permission?) |
| `hd2-health-safety` | 9000876 Health & Safety | abstract→graph, exclude verbatim | **NEEDS INPUT** |
| `hd2-process-manual` | 9000983 Decathlon Process Manual | abstract→graph, exclude verbatim | **NEEDS INPUT** — holds the employee revision log |
| `24450-Session-11-AJ-Process-Development-Techniques.pdf` | 24450 Session 11 | abstract→graph, exclude verbatim | **NEEDS INPUT** |
| `hd2-block-diagram` | HD2 hardware block diagram | abstract→graph, exclude verbatim | **NEEDS INPUT** |

Default recommendation: **exclude all OEM verbatim text** from the public corpus;
retain the operational knowledge as abstracted graph nodes (the existing
`FAULT-BUBBLER-TEMP-*` / generic `EQUIP-*` pattern already does this with no real
addresses/serials). Revisit only if Optomec grants written redistribution rights.

---

## D. Already-excluded sources (confirm they stay out)

Kept in `EXCLUDED_SOURCES` with documented reasons; surfaced in the app's Domain
Sources panel. Confirm disposition — none should return without a rights/sensitivity clear.

| id | Origin | Why excluded | Rec. |
|---|---|---|---|
| `hd2-training-manual` | unknown (.docx) | unnumbered, rights unconfirmed | keep excluded |
| `hd2-qanda` | unknown (.docx) | rights + site-specific ops content | keep excluded |
| `hd2-definitions` | unknown (.docx) | same folder/rights concern | keep excluded |
| `hd2-sequences` | local (real deployment) | raw machine config — recipe/toolpath filenames | keep excluded (knowledge abstracted in `canonical-steps.ts`) |
| `hd2-alarms` | local (real deployment) | raw machine config | keep excluded (abstracted in `design-faults.ts`) |
| `hd2-process-config` | local (real deployment) | raw config — real IPs, camera serials, COM port | keep excluded (abstracted in `design-faults.ts`) |

Derived docs `docs/kb-candidates/34–39_hd2_*.md` carry ⚠ EXCLUDED banners and
redaction placeholders. **Structure-sensitivity call (see §J).**

---

## E. Stub sources (not acquired; no data shipped)

| id | Status | Rec. |
|---|---|---|
| `hd2-motion-vision-kewb-full` | full operator manual not obtained | leave as stub; if obtained, treat as OEM (§C) |
| `expert-session-transcripts` | SME sessions not yet run | leave as stub; when authored, they become authored-internal |

---

## F. Graph/Flow citations — external (`SRC-001 … SRC-020`)

Every `SRC-###` in `source-ref-registry.ts` has a public URL (**all internet**).
These are *citations* attached to graph nodes, not bulk-extracted text — low risk.
Government/standards/OA journals dominate. Action: keep; verify each URL still
resolves; ensure attribution shows in the Domain Sources panel.

- **Government / standards (public domain, safe):** SRC-011 (NIOSH CIB 70), SRC-013 (NIH ORS), SRC-020 (OSHA FS-3634), SRC-012 (AIHA).
- **Vendor (Optomec / trade press):** SRC-001, SRC-002, SRC-016 — cite+link; public marketing.
- **Peer-reviewed (mixed OA/closed):** SRC-003…010, SRC-014, SRC-015, SRC-017 — cited only (no bulk text), so publishable as citations regardless of OA status. Flag SRC-006 (arXiv preprint) and any closed-access ones so we never *extract* their text without a license.
- **Facility manuals:** SRC-018 (Stanford), SRC-019 (Boise State) — overlap with §A.

Full per-ID table lives in `sources/SOURCES_LOG.md`.

---

## G. Graph/Flow docs — internal-authored (`KB-DOC-01 … KB-DOC-10`)

`docs/kb-candidates/01–10_*.md`, authored by the TeachMe project (per
`kb-doc-registry.ts`). **Origin: authored-internal → safe to publish** as our own
content. Action: keep; confirm none embed verbatim third-party text or a real
person's name/site detail.

---

## H. Candidate docs — web-retrieved (`21 … 30`)

Ten docs auto-retrieved from public URLs (manifest: `knowledge/report-source-retrieval.json`).
**All internet-sourced.** These are extracted text held as markdown.

| file | source | Rec. |
|---|---|---|
| 21 | ceur-ws.org Vol-3223 paper1 (CEUR, OA) | keep |
| 22 | **White Rose eprint — Wilkinson 2019 (OA)** | keep; use as Wilkinson's publishable source (§B) |
| 23, 24, 25 | optomec.com pages / production sheet | keep as vendor cite; verify redistribution of extracted text |
| 26 | cdc.gov NIOSH 2021-112 | keep (government) |
| 27 | electronics.org IPC-7711 TOC | **verify** — IPC standards are copyrighted; TOC only, low risk, but confirm |
| 28 | nature.com s41467 (Nature Comms, CC-BY) | keep |
| 29 | osha.gov FS-3634 | keep (government) |
| 30 | osti.gov 1601270 | keep (government) |

---

## I. Candidate docs — deployment / local-derived (`31 … 40`)

| file | origin | Rec. |
|---|---|---|
| 31–33 `eddie_*` | authored-internal summaries of §B papers | keep (our prose); confirm no long verbatim quotes |
| 34–39 `hd2_*` | local (real deployment) | already excluded from corpus; **structure-sensitivity call, §J** |
| 40 `hd2_oem_pdfs` | index of §C OEM PDFs | keep as internal index or genericize; contains no manual text |

---

## J. Structure sensitivity (not values — the taxonomy itself)

Even with values redacted, some **structure** discloses a specific real deployment.
Decide (policy call, **NEEDS INPUT**):
- The `docs/kb-candidates/3x_hd2_*` naming and the "**Decathlon**" Optomec codename.
- The KEWB internal variable/sequence/alarm namespace (e.g. `BUB_HEAT`, `S_MFC`).
- Repeated "**Deployed Environment**" framing implying a specific field capability.

Note on `ABQ_*` recipe names: **`ABQ` = Albuquerque, Optomec's HQ** — so these read
as *vendor-internal* recipe names, not a customer deployment identifier. This lowers
the "specific customer site" concern; the open question is really just the
"Deployed Environment" framing (below).

---

## Dispositions recorded (user review, 2026-07-13)

The posture is **use content freely for extraction now, defer legal review**, with
hard hygiene rules. See `sources/SOURCES_LOG.md` "Standing policy" for the canonical
statement. Summary of what changed from the recommendations above:

- **§A internet** → USE (extract reproducibly).
- **§B papers** → USE: extract from the locally-held PDF, **cite the internet version**
  (capture DOI/URL), don't ship the PDF. Copyright deferred.
- **§C OEM manuals** → USE verbatim, but **never ship the raw manual**, **scrub employee
  names/site params** (esp. `hd2-process-manual` revision log), link internet version
  where one exists. Redistribution flagged for later.
- **§D excluded** → 3 raw-config stay excluded (real IPs/serials); 3 `.docx` not in repo,
  reclassify only if you add them to `local-sources/`.
- **§E stubs** → agreed, remain stubs.
- **§F `SRC-###`** → EXPAND to extraction (not citation-only) where full text is retrievable.
- **§G `KB-DOC`** → USE but **scrub** for names/params/sensitivity.
- **§H retrieved 21–30** → USE fully; flag copyright (IPC-7711).

## Still open / follow-ups

1. **§J structure — RESOLVED (2026-07-13):** "Deployed Environment" → genericized to
   "an Optomec HD2"; "Decathlon" codename → removed; site-specific recipe filenames →
   scrubbed. Applied to committed sources; corpus scrub-terms recorded in
   `sources/SOURCES_LOG.md` for the rebuild.
2. **local-sources archive:** the full raw archive lives in gitignored
   `local-sources/` (see `local-sources/README.md`). Open decisions remain on
   "not covered" buckets (IDS Nanojet → exclude; APL strategy decks → exclude
   pending clearance; extra HD2/AJ300 OEM docs + ink recipes → optional adds).
   Record dispositions in `sources/SOURCES_LOG.md` as they are decided.
3. **Verification tasks (I'll run, no decision needed):** capture canonical DOI/URL per
   §B paper; web-search which numbered OEM manuals are public; wire the name/param/codename
   **scrub pass** into the rebuild; reconcile the ingest path mismatch (§coverage).

**All §J/§I decisions are resolved.** The rebuild (Step 8) is unblocked once the
local-sources §4 buckets are decided and the ingest paths are reconciled.
