---
domain: ajp
source: local — see scripts/ingest-corpus.ts ACTIVE_SOURCES['chen-2018-overspray']
confidence: High
curatedBy: Eddie
ingest_status: dense-rag (chen-2018-overspray)
---

# Candidate 31: Chen 2018 — Droplet Sizes and Overspray in AJP

**Citation:** Chen, G., Gu, Y., Tsang, H., Hines, D. R., & Das, S. (2018). The Effect of Droplet Sizes on Overspray in Aerosol‐Jet Printing. *Advanced Engineering Materials.*

**Dense RAG:** Already added as `chen-2018-overspray` in `ingest-corpus.ts`. Content is semantically queryable.

---

## Node Extraction Candidates

### 1. PARAM-SHEATH-OVERSPRAY-CURVE-001
**Type:** Parameter  
**Target file:** `src/corpus/ajp/parameters.ts`  
**curatedBy:** Eddie

**What to capture:** The non-monotonic ShGF→overspray relationship. Overspray first *decreases* then *increases* as ShGF rises. The minimum occurs at an intermediate ShGF value; beyond it, instabilities at the nozzle exit reintroduce overspray. This is the computational 3-D fluid dynamics validation of the empirical observation.

**Why it matters:** Operators often assume "more sheath = less overspray always." This node corrects that misconception and gives the Socratic layer a concrete wrong-answer pattern to probe.

**Source section:** Introduction + Results §3.1 (ShGF sweep, Figure 1b).

---

### 2. TACIT-OVERSPRAY-DROPLET-INERTIA-001
**Type:** TacitKnowledge  
**Target file:** `src/corpus/ajp/tacit-knowledge.ts`  
**curatedBy:** Eddie

**What to capture:** The *mechanism* — overspray originates from droplets with insufficient inertia to follow the focused aerosol stream and instead spread with the carrier/sheath gas. Droplet size (controlled by atomizer power and ink viscosity) directly sets the inertia distribution. Larger droplets → higher inertia → tighter focus; but too large → satellite splatter on impact.

**Why it matters:** Bridges the gap between the observable symptom (overspray) and the upstream lever (atomizer settings, ink dilution). Currently TACIT-PLUME-VISUAL-001 describes what overspray looks like; this node explains *why it happens* at the physics level.

**Source section:** §2 (Modeling), §3 (Results) — droplet size distribution vs. deposition fidelity.

---

## Review Notes

- Confirm the ShGF sweep values (sccm ranges) are comparable to HD2 operating ranges before adding to PARAM node content — the paper uses an AJ300 configuration.
- The computational model may overstate precision; flag `confidence: Medium` on PARAM node until an operator validates against live HD2 behavior.
