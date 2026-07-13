---
domain: ajp
source: local — see scripts/ingest-corpus.ts ACTIVE_SOURCES['secor-2018-principles']
confidence: High
curatedBy: Eddie
ingest_status: dense-rag (secor-2018-principles)
---

# Candidate 33: Secor 2018 — Principles of Aerosol Jet Printing

**Citation:** Secor, E. B. (2018). Principles of aerosol jet printing. *Flexible and Printed Electronics, 3*(3), 035002. Sandia National Laboratories.

**Dense RAG:** Already added as `secor-2018-principles` in `ingest-corpus.ts`. Content is semantically queryable.

---

## Node Extraction Candidates

This is the highest-priority node extraction of the three Eddie papers. Secor is the clearest first-principles account of AJP physics available in open literature. Several existing TacitKnowledge and Parameter nodes reference phenomena without explaining the underlying mechanism — these TheoryReference nodes fill that gap.

---

### 1. THEORY-AEROSOL-FOCUSING-MECHANICS-001
**Type:** TheoryReference  
**Target file:** `src/corpus/ajp/graph.ts` (with other TheoryReference nodes)  
**curatedBy:** Eddie

**What to capture:** The fluid mechanics of aerosol focusing. The sheath gas creates an annular flow that compresses the aerosol stream via viscous coupling — not turbulent mixing. The focusing ratio (sheath:carrier flow) determines the stream diameter. Below a minimum ratio, the stream diverges; above a maximum, instabilities appear. This is the physics behind every ShGF adjustment an operator makes.

**Link to existing nodes:** Add `SUPPORTED_BY` edge from `PARAM-SHEATH-FLOW-001` and `TACIT-OVERSPRAY-DROPLET-INERTIA-001` (candidate 31) to this node.

**Source section:** §2 (Aerosol Focusing), Fig. 2–4.

---

### 2. THEORY-ATOMIZATION-UA-VS-PNEUMATIC-001
**Type:** TheoryReference  
**Target file:** `src/corpus/ajp/graph.ts`  
**curatedBy:** Eddie

**What to capture:** Comparative physics of ultrasonic (UA) vs. pneumatic atomization. UA produces a narrower droplet size distribution (2–5 µm, low dispersity) limited to low-viscosity inks (~1–10 cP). Pneumatic produces polydisperse droplets, tolerates 1–1000 cP, but requires a virtual impactor to remove large droplets that would cause splatter. The choice of atomizer is the first process decision and determines which fault modes are likely.

**Link to existing nodes:** Add `SUPPORTED_BY` edges from `EQUIP-ATOMIZER-UA-001` and `EQUIP-ATOMIZER-PNEUMATIC-001` (if they exist) or from relevant FailureMode nodes that are atomizer-specific.

**Source section:** §3 (Atomization Methods).

---

### 3. THEORY-INK-FORMULATION-WINDOW-001
**Type:** TheoryReference  
**Target file:** `src/corpus/ajp/graph.ts`  
**curatedBy:** Eddie

**What to capture:** The process window for ink formulation. Viscosity sets atomizer choice; surface tension and volatility set whether the droplet stays intact during transport and wets the substrate on impact. Secor's framework: high-volatility co-solvent stabilizes droplet volume in transit; low-volatility co-solvent prevents total drying before deposition. Operating outside this window → satellite deposition, line discontinuity, or dried-out nozzle.

**Link to existing nodes:** Add `SUPPORTED_BY` edge from `FAULT-INK-DEGRADED-001` and `TACIT-INK-QUALITY-001`.

**Source section:** §4 (Ink Formulation Principles).

---

## Review Notes

- Secor is Sandia / peer-reviewed; `confidence: High` is appropriate for all three nodes.
- These are *explanatory* nodes, not procedural — they should appear in Socratic probe responses ("why does more sheath gas help up to a point?") not in step-by-step scenario flows.
- After authoring, run `npm test` to verify no dangling edge references (the `SUPPORTED_BY` edges need both endpoint IDs to exist).
