# Document 02: Fault Diagnosis — How Experts Reason from Symptom to Root Cause
## Tacit Knowledge Corpus · HD2 AJP Training System

**Purpose:** Captures the diagnostic reasoning patterns, discrimination heuristics, and judgment rules that experienced AJP operators use when something goes wrong. This is not the fault taxonomy (that lives in the knowledge registry) — this is the *reasoning process* an expert follows to get from "something is off" to "here is exactly what is wrong and what to do."

**Node type:** TacitKnowledge (subtype: DiagnosticReasoning)  
**Retrieval role:** Socratic probe enrichment; Scenario Mentor agent reasoning scaffold; In-Operation diagnostic chain

---

## SECTION 1: THE EXPERT DIAGNOSTIC MINDSET

### 1.1 How Experts Actually Diagnose — The Mental Model

Novices, when something goes wrong, tend to: (1) panic, (2) start changing parameters randomly, or (3) freeze and call for help. Experienced operators follow a structured mental process that they may not consciously articulate but that is recoverable through reflection.

**The expert diagnostic loop:**

```
OBSERVE → LOCALIZE → DISCRIMINATE → ACT → VERIFY → (loop if unresolved)
```

**Observe:** What exactly is wrong? Describe it precisely — not "the line looks bad" but "the line is 40% wider than expected with diffuse edges and visible overspray, but consistent width along the full trace."

**Localize:** Which subsystem is the likely source? The fault space has six domains (fluidic/atomization, gas system, deposition quality, substrate/adhesion, post-process, system/software). Most symptoms narrow immediately to one or two.

**Discriminate:** Within the candidate domain, which specific fault is it? This is where the expert's perceptual knowledge comes in — distinguishing faults that look similar on the surface.

**Act:** Make one change. Not two. Not three. One targeted adjustment, then observe.

**Verify:** Did the change resolve the symptom? If yes, continue. If no, you have learned something — that fault is not the cause — and you loop back to Discriminate with updated information.

**The single-change rule** is the most important tacit practice rule and the one most consistently violated by novices. Changing two parameters simultaneously makes it impossible to know which change produced the result.

---

### 1.2 The Temporal Dimension: Onset Pattern Matters

When a fault started is often as diagnostic as what the fault looks like. Experts instinctively track when the problem appeared.

| Onset pattern | What it suggests | Example faults |
|---|---|---|
| Problem present from first line | Setup error; wrong parameter; bad ink; substrate issue | Wrong gas sequence; contaminated substrate; clogged nozzle carried over from prior session |
| Problem appears mid-print, develops gradually | Progressive drift; partial clog forming; ink running low | FAULT-CLOG-PARTIAL-001; UA vial level dropping; ink agglomeration beginning |
| Problem appears suddenly, full severity | Complete clog; gas loss; system fault | FAULT-CLOG-FULL-001; tubing disconnection; KEWB freeze |
| Problem appears, then partially resolves, then returns | Intermittent fault; oscillating partial clog; unstable atomization | FAULT-ATOMIZATION-INTERMITTENT-001; blob formation cycling |
| Problem only at certain path geometries | Geometry-dependent issue; direction-change artifact | Print speed/deposition balance issue at corners; standoff variation across substrate |

**Teaching note:** Ask Socratic probe: "When in the print did the problem first appear? Was it there from the first line, or did it develop?" This question alone eliminates 50% of candidate faults.

---

## SECTION 2: DISCRIMINATION HEURISTICS — FAULTS THAT LOOK SIMILAR

The most important diagnostic tacit knowledge is the ability to distinguish faults that produce superficially similar symptoms. These are the cases where novices misdiagnose and make the wrong correction.

### 2.1 Wide Line — Four Possible Causes, Very Different Fixes

**Symptom:** Deposited trace is wider than expected.

**The four causes and how to discriminate:**

**Cause A — Sheath gas too low:**
- Width is consistent along the entire trace length
- Overspray is present but diffuse (soft halo rather than discrete droplets)
- Line is otherwise continuous and uniform
- KEWB sheath pressure is below nominal for nozzle+elevation
- *Fix:* Increase sheath gas in 1 sccm increments

**Cause B — Stage speed too slow:**
- Width is consistent along entire trace
- Ink appears to pile up at corners and turns (more residence time)
- Line may be thicker (more material per unit length)
- *Fix:* Increase print speed; re-tune on sacrificial substrate

**Cause C — Atomizer flow too high:**
- Width is wider, with more discrete overspray droplets (not just soft halo)
- KEWB shows carrier gas pressure elevated or ATM approaching limit
- PA jar shows heavy droplet accumulation
- *Fix:* Reduce atomizer flow; check ATM pressure

**Cause D — Standoff too large:**
- Width increases (aerosol spreads more before hitting substrate)
- Overspray increases proportionally
- Effect is consistent across the substrate
- *Fix:* Reduce Z height (lower standoff) and re-tune

**The discrimination question sequence:** (1) Is the width consistent or variable along the trace? Consistent → parameter is the issue. Variable → suspect partial clog or intermittent atomization. (2) Is there discrete overspray or just a soft edge? Discrete → too much material. Soft → focusing problem (sheath or standoff). (3) What does KEWB show?

---

### 2.2 Narrow/Missing Line — Three Possible Causes

**Symptom:** Deposited trace is narrower than expected, or is intermittent/gapped.

**Cause A — Nozzle clog (partial or full):**
- Narrowing or gaps appear mid-print, not from the start (unless it was clogged from prior session)
- KEWB pressure elevated (partial clog → elevated; full clog → very elevated or freeze)
- Narrowing may be accompanied by shape irregularity — not perfectly narrow, but malformed
- *Fix:* Abort; disassemble; clean

**Cause B — Atomization rate too low:**
- Trace is narrow or thin but the shape is still regular (smooth edges)
- KEWB pressure is nominal (no clog)
- UA vial may be low; or PA atomizer gas too low
- *Fix:* Check ink level; increase atomizer flow carefully

**Cause C — Stage speed too high:**
- Trace is narrow and consistent but thinner (less material per unit length)
- No pressure anomaly; atomization appears healthy
- Problem is reproducible and consistent
- *Fix:* Reduce print speed

**The key discrimination:** A clog-narrowed line has an irregular, malformed quality — the shape is not right. A speed-related or flow-related narrow line has the correct shape, just undersized. KEWB pressure confirms clog.

---

### 2.3 Intermittent Trace — Three Possible Causes

**Symptom:** Trace deposits for a distance, then gaps, then deposits again.

**Cause A — Oscillating partial clog:**
- Gaps correspond to KEWB pressure spike events
- Spacing of gaps may be irregular
- Gaps appear as clean breaks, not as gradual thinning
- *Fix:* Abort; clean

**Cause B — Substrate surface inconsistency:**
- Gaps occur in predictable locations (same areas on substrate)
- KEWB pressure is normal throughout
- No correlation with print direction
- *Fix:* Inspect substrate under magnification; clean/re-treat; may need to print onto a different area

**Cause C — Ink agglomeration / clumps passing through:**
- Gaps associated with momentary KEWB pressure spikes
- May see occasional blobs rather than clean gaps
- Ink may be near end of vial or past optimal condition
- *Fix:* Check ink condition; if agglomerated, do not continue; replace ink

---

### 2.4 Blob on Trace — Two Possible Causes

**Symptom:** A discrete blob of excess material appears on an otherwise acceptable trace.

**Cause A — Blob accumulated on nozzle tip discharged onto substrate:**
- Single large blob, typically at a start or stop point, or at a corner
- After blob, trace quality may return to normal
- Blob is a distinct deposit, not part of a trend
- *Fix:* Stop print; inspect nozzle tip; wipe carefully; resume. If blobs are recurring, address root cause (excessive accumulation on tip → may need sheath adjustment or nozzle inspection)

**Cause B — KEWB pressure spike releasing a slug of accumulated ink:**
- Blob appears mid-trace, corresponding to a KEWB pressure spike
- Blob may be followed by a period of lower deposition (slug depleted the ink volume)
- *Fix:* Abort if blobs are appearing mid-trace; indicates developing clog. A single isolated event: monitor closely.

---

## SECTION 3: THE GAS SYSTEM DIAGNOSTIC — THE COUNTERINTUITIVE DOMAIN

### 3.1 Why Gas System Faults Are Most Often Misdiagnosed

The gas system is the most counterintuitively behaving subsystem. Two principles confuse novices:

**Principle 1: High pressure = obstruction, not high flow**
When a clog forms, pressure *rises* because gas cannot move through. Novices often interpret high pressure as "the system is working harder" and try to increase flow — which makes it worse.

**Principle 2: Gas sequence errors do not produce immediate visible faults**
If the startup gas sequence is done wrong (e.g., atomizer before sheath, or sheath before exhaust), the failure mode may not appear immediately. The consequence can be a substrate flooded with ink before the plume is focused, or gas buildup in the atomizer. Novices may not connect a startup sequence error to a problem that appears 30 seconds into printing.

### 3.2 Pressure Direction Reference (MANDATORY Socratic probe point)

This must be checked for every learner:

| Situation | Pressure reading | Correct interpretation |
|---|---|---|
| Nozzle clog forming | Rising above nominal | Obstruction — gas cannot flow freely |
| Full nozzle clog | Very elevated; may freeze KEWB | Complete obstruction |
| Tubing disconnection or leak | Below nominal | Flow escaping to atmosphere |
| Normal operation | Stable, at nominal for nozzle/elevation | No action |
| Startup before gas is on | Zero | Expected |

**The probe:** "If your KEWB sheath pressure is reading higher than expected, does that mean more gas is flowing to the nozzle, or less? Explain your reasoning." Common wrong answer: "more gas is flowing." Correct answer: "less — or none — is getting through; the high pressure indicates obstruction."

---

## SECTION 4: SUBSTRATE AND ADHESION FAULT DIAGNOSIS

### 4.1 The Critical Distinction: Printing Problem vs. Substrate Problem

Many novices adjust printing parameters when the problem is the substrate. The rule:

**If the line shape is correct but coverage is wrong (holes, dewetting, retraction) — it's a substrate problem, not a print parameter problem.**

Printing parameters control width, thickness, and position. Substrate adhesion controls whether the ink stays where it was deposited. These are independent failure modes.

**Substrate diagnostic questions:**
1. Is the substrate clean? (IPA wipe immediately before printing? No handling of print area with bare hands after cleaning?)
2. Is the substrate material compatible with this ink? (Ag NP inks adhere well to most PCB substrates, but surface coatings, conformal coatings, or heavy oxidation can interfere)
3. Was the substrate pre-heated if required? (Some substrates benefit from mild preheating for adhesion)
4. Is the ink-substrate combination tested at these conditions? (Different ink lots can have slightly different surface tension characteristics)

**The novice error:** Seeing a trace with gaps and thinking "I need more ink" → increases atomizer flow → gets more ink deposited → ink still dewets → now has wide, gappy trace instead of narrow, gappy trace. The gap pattern didn't change because the substrate was the problem.

---

## SECTION 5: EXPERT DIAGNOSTIC CASE PATTERNS

These are structured case descriptions in the format an expert might narrate. They are written for ingest as Scenario Narrator reference cases and as Socratic exemplars.

### Case 01: The Progressive Pressure Rise

**Setup:** Print is going well. 15 minutes into a 20-minute repair trace, KEWB pressure begins rising from 4.2 PSI to 4.8 PSI to 5.3 PSI over 3 minutes.

**Expert reasoning:**
"Pressure is rising steadily — that's a partial clog developing. I need to decide: do I finish the print or abort? The trace is 75% complete. If I abort now, I lose the work but protect the PCB. If I continue, I risk a full clog — the pressure spike will discharge a blob onto the trace, or worse, onto the PCB beyond the trace. The pressure is rising at about 0.5 PSI per minute. If that continues, I'll hit dangerous levels before I finish. I'm aborting. Better to have a 75% trace I can re-print over than a blob on the PCB."

**Outcome:** Aborts. Disassembles. Finds partial occlusion at virtual impactor. Cleans. Reprints successfully.

**Teaching point:** The decision to abort is not a failure — it is a correct diagnosis acted upon. The expert's willingness to abort and restart is a mark of expertise, not hesitation.

---

### Case 02: The Misdiagnosed Wide Line

**Setup:** First print run of the day. Lines are coming out 30% wider than expected. Operator tries reducing print speed. Lines get even wider. Tries reducing atomizer flow. Still wide. Frustration building.

**Expert analysis of what went wrong:**
"The operator is making two mistakes. First, they're not asking 'when did this start?' — it started from the first line, which rules out progressive drift. Second, they're not checking KEWB sheath pressure — which would show it's below nominal. The width is a sheath gas problem. The nozzle is 150 μm and was used yesterday at sea level; today's run is in a different facility at higher elevation. The pressure table was not adjusted. The fix is to increase sheath pressure to compensate for elevation."

**Teaching point:** Systematic elimination beats random parameter adjustment. Always check KEWB first.

---

### Case 03: The Substrate Trap

**Setup:** Print looks fine on sacrificial substrate. Operator moves to PCB. First trace shows gaps and dewetting despite identical parameters.

**Expert reasoning:**
"Same parameters, different result → the substrate changed. The sacrificial substrate was clean glass. The PCB has a conformal coating from a previous repair attempt. The Ag NP ink has different surface energy on coated surfaces. I need to: (1) identify the coating, (2) determine if it can be removed from the repair area, (3) determine if the ink will adhere after surface prep. This is not a printing problem."

**Teaching point:** Transfer from sacrificial substrate to actual part is a critical transition point. Do not assume parametric equivalence.

---

## Source Provenance

| Content area | Sources | Confidence |
|---|---|---|
| Expert diagnostic loop structure | InferredFromDomain, peer lit on AJP anomaly detection (Zhang 2024) | Medium-High |
| Temporal onset as diagnostic signal | InferredFromDomain, SRC-018 troubleshooting section | Medium |
| Wide line discrimination heuristics | Islam 2025, Smith 2017, SRC-019 Section 5 | High |
| Pressure direction principle | SRC-018 Section 8, SRC-019 Section 4.9 | High |
| Single-change rule | InferredFromDomain, universal manufacturing practice | High |
| Substrate vs. print parameter distinction | SRC-018, peer lit on adhesion | Medium-High |
| Case patterns | InferredFromDomain (structured synthesis) | Medium |
