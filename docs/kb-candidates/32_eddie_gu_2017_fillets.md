---
domain: ajp
source: local — see scripts/ingest-corpus.ts ACTIVE_SOURCES['gu-2017-fillets']
confidence: Medium
curatedBy: Eddie
ingest_status: dense-rag (gu-2017-fillets)
---

# Candidate 32: Gu 2017 — AJP Fillets for Electrical Connections Between Different-Level Surfaces

**Citation:** Gu, Y., Hines, D. R., Yun, V., Antoniak, M., & Das, S. (2017). Aerosol‐Jet Printed Fillets for Well‐Formed Electrical Connections between Different Leveled Surfaces. *Advanced Materials Technologies.*

**Dense RAG:** Already added as `gu-2017-fillets` in `ingest-corpus.ts`. Content is semantically queryable.

---

## Node Extraction Candidates

### 1. TACIT-DLS-FILLET-TRANSITION-001
**Type:** TacitKnowledge  
**Target file:** `src/corpus/ajp/tacit-knowledge.ts`  
**curatedBy:** Eddie

**What to capture:** Routing conductive traces over step transitions (e.g., embedded IC chip → substrate) requires a printed fillet ramp first. Printing directly over an abrupt step causes trace cracking at the edge. The fillet is UV-curable polymer ink printed layer-by-layer with in-situ curing, then surface-smoothed before the conductive trace is deposited over it.

**Why it matters:** PHE/FHE assembly scenarios will involve step transitions. This is non-obvious tacit knowledge — novices attempt direct routing and get cracked interconnects. Fills a gap in the current assembly tacit layer.

**Source section:** Abstract + §3 (Fillet Fabrication Procedure).

---

### 2. TACIT-DLS-SURFACE-SMOOTHING-001
**Type:** TacitKnowledge  
**Target file:** `src/corpus/ajp/tacit-knowledge.ts`  
**curatedBy:** Eddie

**What to capture:** The layer-by-layer fillet produces a stepped surface even after printing. A secondary smoothing pass (described in paper as a reflow or overcoat technique) is required before the conductive trace run. Skipping smoothing produces high-resistance or open-circuit interconnects due to poor conformal contact at the step edges.

**Why it matters:** Two-step nature of the process (fillet then smooth then trace) is exactly the kind of procedural tacit knowledge novices miss.

**Source section:** §3.2 (Surface Smoothing Technique).

---

### 3. PARAM-FILLET-DEPOSITION-RATE-001
**Type:** Parameter  
**Target file:** `src/corpus/ajp/parameters.ts`  
**curatedBy:** Eddie

**What to capture:** A specific deposition rate must be established for the UV-curable fillet ink to ensure precise layer architecture — too fast and layers merge before curing; too slow and inter-layer adhesion fails. The paper establishes this empirically.

**Why it matters:** Quantitative parameter guidance for fillet printing, currently absent from the parameter corpus.

**Source section:** §3.1 (Deposition Rate Establishment).

---

## Review Notes

- This paper uses an AJ300 with UV lamp attachment — confirm HD2 has equivalent in-situ curing capability before adding Step nodes that assume UV curing is available.
- If the HD2 at the target lab lacks in-situ UV, demote these to TacitKnowledge (awareness only) rather than Step (actionable procedure). Flag as `confidence: Medium`.
- Resistance measurement and temperature cycling results in §4 are good dense-RAG content; no node extraction needed there.
