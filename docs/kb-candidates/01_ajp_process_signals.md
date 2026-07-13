# Document 01: AJP Process Signals — What Experts Read in Real Time
## Tacit Knowledge Corpus for HD2 Aerosol Jet Printer Training System

**Purpose:** This document captures the perceptual, behavioral, and interpretive knowledge that experienced AJP operators use during operation — the knowledge that SOPs do not contain and that separates a competent technician from an expert one. It is designed for ingestion into the training system's TacitKnowledge node corpus.

**Primary sources:** Stanford SNF Manual (SRC-018), Boise State SOP (SRC-019), peer-reviewed process monitoring literature (Rurup 2024, Islam 2025, Zhang 2024), operator observation synthesis.

**Node type:** TacitKnowledge  
**Retrieval role:** Enrichment for Socratic probes; Narrator environment description; In-Operation diagnostic support

---

## SECTION 1: VISUAL SIGNALS — THE PNEUMATIC ATOMIZER (PA)

### 1.1 Ink Droplets on Jar Walls — The Primary Atomization Health Read

**What to look for:** When the PA atomizer gas is active and atomization is occurring, fine ink droplets will coat the interior walls of the ink jar in a characteristic pattern.

**Healthy atomization pattern:**
- A uniform "rain" of very small, evenly distributed droplets covers the lower portion of the jar walls
- Droplets appear in rapid, continuous succession — not in bursts or clusters
- The droplet density is consistent — no bare patches on the wall followed by heavy accumulation
- Droplet size is small and fairly uniform; large isolated droplets are a warning sign

**Warning patterns and what they mean:**

| What you see | What it likely means | Action |
|---|---|---|
| No droplets on walls at all | No atomization — jet hole submerged in ink, or atomizer clogged, or gas not on | Check jet position (must be ≥15mm above ink), check gas flow in KEWB, check for clog |
| Droplets appear then stop, then appear again | Intermittent atomization — oscillating partial clog, or ink supply inconsistency | Watch KEWB pressure for spikes; check stirrer; consider aborting to clean |
| Droplets clustered in one area only | Asymmetric atomization — jet position may be off-center, or jar geometry interference | Check atomizer jet positioning |
| Large isolated blobs on wall instead of fine droplets | Ink too viscous, or flow rates creating unstable larger droplets | Check ink temperature; check viscosity; reduce atomizer gas slightly |
| Droplets on walls but line quality is degrading | Deposition rate drifting — aerosol volume adequate but transport changing | Check KEWB pressure trend (not just current value); check carrier gas |
| Walls wet but KEWB pressure is elevated | Possible partial clog downstream (impactor or nozzle) despite good atomization | Run sheath-only check; inspect downstream components |

**The expert read:** An experienced operator glances at the jar walls every few minutes during a print run, not just at startup. They are watching for *changes* in droplet pattern relative to baseline, not just presence/absence. A pattern that was fine at the start of a 30-minute run can drift subtly — peer literature confirms that deposition rate can drift on timescales of minutes to hours even with no parameter changes (Rurup 2024, Salary et al. referenced therein).

**Teaching note for Socratic probing:** Ask "What are you looking for on the jar walls? Describe what healthy looks like versus struggling." This probe distinguishes a learner who knows *that* they should check versus one who knows *what* they are checking for.

---

### 1.2 The Aerosol Plume at the Nozzle — Process Camera Read

**What to look for:** The KEWB process camera, when correctly focused, shows the aerosol stream exiting the nozzle tip as a visible plume.

**Healthy plume characteristics:**
- A tight, well-defined column of aerosol exits the nozzle coaxially
- The plume converges slightly below the nozzle tip (this is the aerosol focusing effect of the sheath gas)
- The plume appears steady — minimal flickering or pulsing
- The boundary between the plume and surrounding air is relatively sharp, not diffuse

**Warning plume patterns:**

| Plume appearance | Likely cause | Parameter adjustment |
|---|---|---|
| Wide, diffuse — no clear focus | Sheath gas too low; or standoff too large | Increase sheath gas in small increments; check standoff |
| Flickering, pulsing, intermittent | Intermittent atomization or partial clog oscillating | Watch KEWB for pressure spikes; may need to clean |
| Very narrow but thin line deposition | Sheath too high (over-focusing) | Reduce sheath slightly |
| Plume drifting to one side | Nozzle orifice asymmetry (possible damage) or gas flow imbalance | Inspect nozzle under magnification |
| No visible plume but KEWB shows gas flowing | Nozzle fully clogged — no material passing | Abort; disassemble and clean |

**The expert read:** Experienced operators develop a sense for what "their machine" looks like under their standard conditions. A new operator may not be able to distinguish a good plume from a borderline one. This is genuinely experience-dependent — but verbal description of the categories above provides the cognitive scaffold that makes physical experience interpretable faster.

---

### 1.3 Deposited Line Quality — The Mid-Print Visual Inspection

**What to look for:** During line tuning (on sacrificial substrate) and during print (via alignment camera), the deposited trace should be inspected frequently.

**The five canonical line quality states** (from Optomec training materials / SRC-019 Section 5.10, cross-referenced with peer literature classification systems):

**State 1 — Good line:**
- Uniform width throughout the trace length
- Sharp, well-defined edges (not diffuse or feathered)
- Consistent color (bright metallic silver for Ag NP inks, not matte or dark)
- No gaps, no blobs, no scalloping
- Width matches expected width for the nozzle and sheath gas setting

**State 2 — Substrate adhesion problem:**
- Ink appears to bead up or retract in places rather than wetting uniformly
- Trace may have "holes" or "windows" — areas where ink did not adhere
- Color may be duller or more irregular
- *Cause:* Surface contamination, wrong substrate treatment, or ink-substrate incompatibility
- *Fix:* Do not adjust printing parameters — address substrate first

**State 3 — Ink flow too low for print speed (under-deposition):**
- Trace is thinner than expected
- Gaps or dropouts appear — trace is intermittent, not continuous
- Width narrows noticeably relative to neighboring segments
- *Cause:* Stage moving faster than ink delivery supports; or atomization rate insufficient
- *Fix:* Reduce print speed, or increase atomizer flow; one change at a time

**State 4 — Ink flow too high for print speed (over-deposition):**
- Trace is wider than expected
- Edges are diffuse, with satellite deposits or overspray visible
- In extreme cases, trace has a "piled up" appearance or pools at direction changes
- *Cause:* Too much ink relative to stage speed; or sheath too low
- *Fix:* Increase print speed, or reduce atomizer flow; one change at a time

**State 5 — Sheath gas too high (over-focusing):**
- Trace is extremely narrow — potentially narrower than nozzle inner diameter
- Very little material depositing; trace is thin and faint
- May appear as a very fine line with poor coverage
- *Cause:* Sheath gas over-focusing the aerosol; or sheath gas too high for the atomizer flow rate
- *Fix:* Reduce sheath gas

**The expert judgment call:** Experienced operators can make all five discriminations quickly, and importantly, they can distinguish *which* parameter to adjust. Novices often see "something is wrong" but cannot identify whether it is speed, sheath, atomizer, or substrate. This discrimination is the core of line-tuning tacit knowledge — and it is articulable, which means it can be taught.

**Research note:** The peer literature (Islam 2025, Smith 2017) has quantified how these parameters interact — e.g., raising carrier gas from optimal to excessive levels can cause up to 215% increase in line width. This gives numerical grounding to the qualitative descriptions above.

---

### 1.4 Nozzle Tip Inspection — Pre-Print and During Troubleshooting

**What to look for (under magnification — 10x hand loupe minimum, microscope preferred):**

**Healthy nozzle tip:**
- Clean, circular orifice — no residue, no partial blockage visible
- Orifice shape is symmetric — no chips, cracks, or deformation
- Ceramic body is intact with no visible damage

**Reject nozzle conditions:**
- Any asymmetry in the orifice shape (oval, D-shaped, or irregular)
- Any visible residue inside the orifice that sonication did not remove
- Any chipping of the ceramic at or near the orifice
- Nozzle dropped or mishandled — inspect regardless of visible damage

**During troubleshooting inspection:**
- Residue inside orifice → clog; clean per protocol
- Asymmetric orifice → nozzle damaged; replace
- Clean orifice but clog symptoms → clog is upstream (impactor or atomizer)

**Tacit element:** The ability to distinguish "this can be cleaned" from "this needs replacement" under magnification comes with experience. The verbal rule is: if the orifice geometry is intact and the residue is removable by sonication, clean it. If the geometry is compromised, no amount of cleaning will restore print quality.

---

## SECTION 2: AUDITORY SIGNALS — THE ULTRASONIC ATOMIZER (UA)

### 2.1 The UA Sound Signature

**Why this matters:** The ultrasonic atomizer produces a characteristic high-pitched tone when operating. The frequency and character of this tone changes with operating conditions in ways that carry diagnostic information. This is one of the most purely tacit knowledge elements in AJP operation — it is essentially impossible to transmit via text alone, but the conceptual framework can be taught.

**Normal UA operation sounds:**
- A steady, high-pitched tone (in the ultrasonic range — often at or near the edge of audibility for adults, typically 1.6-2.4 MHz transducer frequency)
- The tone is consistent — not pulsing, not rising and falling
- A faint liquid agitation sound may be audible if the vial is near empty (the transducer vibrating the small remaining volume)

**Abnormal UA sounds and meanings:**

| Sound change | Likely meaning | Action |
|---|---|---|
| Tone becomes intermittent / pulsing | Ink level critically low; vial nearly empty | Check vial level immediately; refill or replace |
| Tone pitch rises noticeably | Less damping from ink — vial level getting low | Prepare to refill; monitor closely |
| Loud rattling or irregular sound | Vial seated incorrectly; possible gasket issue | Stop UA, reseat vial, check gasket seal |
| Tone disappears while power is on | UA power below activation threshold | Increase power knob slowly in 0.05 increments |
| Higher power required than normal to achieve same ink agitation | Ink viscosity has increased (temperature drop, solvent evaporation) | Check ink temperature; consider ink refresh |

**The expert read:** Experienced operators describe this as "the machine sounds different today." They cannot always articulate the specific change, but they notice it. The training intervention here is to make the diagnostic categories explicit — so that when a novice notices "something sounds off," they have a mental framework for what might be changing and what to check.

**Teaching note:** Verbally articulate the expected sound to trainees before their first session ("you should hear a steady high-pitched tone; if it becomes choppy or irregular, that's your cue to check the vial level"). This pre-experience framing makes the sound more interpretable when encountered.

---

## SECTION 3: KEWB PRESSURE GRAPH — THE CRITICAL QUANTITATIVE SIGNAL

### 3.1 Reading the KEWB Pressure Display in Real Time

**The common mistake:** Novice operators check the KEWB pressure value at a single moment and compare it to the table. Expert operators watch the *trend* of the pressure graph over time — whether it is stable, drifting up, drifting down, or spiking.

**Four pressure behaviors and their meanings:**

**Behavior 1 — Stable, in nominal range:**
- What it looks like: Flat line at the expected value ± small noise
- What it means: System is operating normally
- Action: Continue

**Behavior 2 — Steady upward drift:**
- What it looks like: Pressure slowly rising over many minutes — from 4 PSI to 4.5 to 5 to 5.5...
- What it means: Partial clog forming — nozzle or impactor beginning to occlude
- Action: Note the rate of drift; if it exceeds nominal + 20%, abort and inspect before it becomes a full clog on the PCB
- *Expert judgment call:* How much drift is acceptable before aborting? Depends on remaining print length. A repair trace that will complete in 30 seconds can be finished; a 10-minute trace should be aborted earlier.

**Behavior 3 — Sudden spike then recovery:**
- What it looks like: Pressure jumps sharply then returns to baseline
- What it means: Ink blob in the transfer tube passing through; or momentary turbulence at the impactor
- Action: Watch for repeat spikes; if they become frequent, abort (FAULT-BLOB-FORMATION-001 is developing)

**Behavior 4 — Sudden jump and stays high:**
- What it looks like: Pressure jumps from nominal (e.g., 4 PSI) to significantly elevated (e.g., 8+ PSI) and stays there
- What it means: Full or near-full clog at nozzle or impactor
- Action: Abort immediately; do not continue printing

**The counterintuitive rule that novices always get wrong:**
- **High pressure = clog** (flow is obstructed → pressure builds)
- **Low pressure = leak** (flow is escaping → pressure drops)

This is consistently misremembered by novices who intuit that "high pressure means more gas is flowing" rather than "high pressure means gas cannot get through." This is a mandatory Socratic probe point.

---

### 3.2 The ATM Pressure Constraint (Pneumatic Atomizer)

**Critical parameter:** When using the PA, the ATM pressure readout in KEWB must stay below 5 PSI. This is a hard constraint, not a guideline.

**What ATM pressure is:** The pressure inside the atomizer jar itself — distinct from the sheath pressure. High ATM pressure means the atomizer is working hard against resistance.

**Why it matters:** Excessive ATM pressure can force ink through the system in an uncontrolled manner, creating large deposits or blobs. It also risks fitting connections if sustained.

**Management:** If ATM pressure approaches 5, reduce atomizer gas flow. This is a real-time adjustment that must be made during printing, not pre-set and forgotten.

**Expert behavior:** Experienced operators have a mental interrupt: any time the ATM readout catches their eye, they instinctively check whether it's approaching 5.

---

## SECTION 4: JUDGMENT CALLS — WHEN TO ABORT VS. CONTINUE

### 4.1 The Abort Decision Framework

This is the highest-level tacit knowledge in AJP repair operation. It synthesizes all the process signals above into an operational decision.

**The general principle:** The cost of aborting and restarting is almost always lower than the cost of printing a failed trace onto the PCB and then having to diagnose, clean, and attempt again.

**Abort immediately (no deliberation):**
- Any safety gate violation (nanoparticle exposure, KEWB freeze, gas sequence error)
- Nozzle tip makes or nearly makes contact with substrate
- KEWB pressure spikes above 2× nominal and stays there
- You see a large blob forming on the nozzle tip that cannot be wiped without touching the substrate

**Abort after assessing (can take 30-60 seconds to decide):**
- Steady upward pressure drift that has not yet reached 1.5× nominal
- Line quality degrading but print is >80% complete
- KEWB shows intermittent spikes but trace quality looks acceptable

**Wipe and continue (specific case):**
- Small blob forming on nozzle tip during travel moves (between traces)
- Procedure: engage shutter, lower atomizer gas momentarily, wipe tip with cotton swab, restore gas, re-engage shutter and continue
- Only appropriate if pressure is nominal and line quality is good apart from tip accumulation

**Continue without action:**
- Single momentary KEWB spike, pressure returned to nominal, no visible trace defect
- Very slight line width variation within ±10% of target
- UA tone variation that resolves within 30 seconds

**The novice error pattern:** Novices tend to either (a) be too conservative, aborting at any deviation and never completing a print, or (b) be too optimistic, continuing past clear warning signs because they don't want to restart. Expert judgment develops through experience with both — but the training system can provide the decision framework in advance to compress this learning curve.

---

## SECTION 5: SETUP AND ASSEMBLY TACIT KNOWLEDGE

### 5.1 O-Ring Grease — The Feel Check

**The written rule:** Apply a thin layer of Apiezon L grease to all O-rings; the O-ring should appear shiny.

**The tacit element:** The amount of grease matters more than most novices realize. Too little → O-ring doesn't seal → leak. Too much → grease migrates into the ink path → contamination → clog.

**The expert check:** After greasing, run a finger around the O-ring — it should feel uniformly smooth and slightly tacky, with no dry patches and no excess that smears visibly.

**The installation feel:** When assembling the printhead and atomizer, properly seated O-rings have a distinctive tactile quality — there's a slight resistance and then a definite "seat" when correctly positioned. An O-ring that's not quite in place feels loose or shows a slight gap visually. This distinction is learned by feel, not by description — but knowing to pay attention to it accelerates learning.

### 5.2 PFA Tubing — The Quality Cut Check

**The written rule:** Cut PFA tubing flat, not at an angle.

**The tacit element:** The difference between a flat cut and an angle cut is often subtle and harder to see than expected. Experienced operators hold the cut end up to the light and look for the circular cross-section — any oval shape means an angled cut.

**The insertion feel:** When PFA tubing is correctly inserted into a fitting and the omnilock is tightened, attempting to pull the tube out should fail — it should feel firmly seated. If there's any give, it's not fully seated. This pull-test is described in both SOPs and is genuinely reliable.

### 5.3 The Three-Slide Standoff — The Parallax Problem

**The written rule:** Stack three 1mm microscope slides and adjust Z until nozzle tip aligns with the top of the stack.

**The tacit element:** Parallax. When looking at the nozzle tip and the slides from the side, the apparent alignment depends on your eye position. Experienced operators learn to look directly from the side, eyes at the level of the nozzle tip, not from above.

**The expert refinement:** After using the slides to get approximate Z height, experienced operators use the process camera in KEWB to verify — the camera provides a more reliable view of the nozzle-substrate gap than direct visual inspection.

---

## SECTION 6: INK CONDITION ASSESSMENT

### 6.1 Visual Ink Inspection Before Loading

**Before filling the atomizer vial or jar, inspect the ink under good lighting:**

**Good ink (Ag NP conductive ink):**
- Bright, shiny silver-gray color — metallic appearance
- After gentle swirling: uniform dispersion, no visible settling
- Consistency is like light cream — pourable but not watery

**Warning signs:**
- Settled dark layer at bottom that doesn't re-disperse: particles have agglomerated — do not use
- Color changed to dark gray or brownish: oxidation — do not use
- Stringy or gel-like consistency when poured: agglomeration — do not use
- Color looks right but past open date: use with caution, test on sacrificial substrate first
- Ink was left in atomizer from prior session without proper shutdown: risk of dried residue at jet — inspect before use

**The rule of thumb:** If you're not sure about ink quality, print 3 test lines on a sacrificial substrate, measure resistance after sintering. If resistance is ≥10× expected — bad ink. The cost of a test print is much less than a failed repair.

---

## SECTION 7: POST-SINTER INSPECTION

### 7.1 Visual Trace Inspection After Sintering

**What a well-sintered Ag NP trace looks like:**
- Shiny, metallic silver appearance — similar to or brighter than pre-sinter
- No visible cracking or delamination
- Uniform color along the trace length — no dark spots (incomplete sintering) or whitened areas (thermal damage)
- Adhered firmly to substrate — cannot be scraped off easily with a fingernail

**Warning signs post-sinter:**
- Dark areas within the trace: incomplete sintering at those points — may have elevated resistance
- Cracking (especially at bends or corners): thermal stress from too-rapid heating or cooling — mechanical failure risk
- Delamination from substrate: adhesion failure — did the substrate reach temperature without the trace? Or was substrate surface contaminated?
- Discoloration of PCB substrate adjacent to trace: thermal damage to substrate — may have damaged nearby components or traces

**The resistance expectation:** After sintering, a properly deposited and sintered Ag NP repair trace for continuity purposes should measure:
- Short repair traces (bridging broken trace, <5mm): typically 1-10 Ω
- Medium traces: 10-100 Ω
- Very high resistance (>500 Ω) despite visual continuity: likely incomplete sintering or significant internal voids

**The expert call:** If resistance is between 100-500 Ω, the functional question is whether this is within spec for the circuit being repaired. This requires understanding the circuit — a pure continuity repair (replacing an open with anything conductive) has different tolerance than a trace that is part of a precision resistive network. This contextual judgment is the final expert layer.

---

## Cross-References to Knowledge Graph Nodes

| Tacit Knowledge Element | Primary Node | Socratic Probe Node |
|---|---|---|
| PA jar wall droplet pattern | TACIT-ATOMIZATION-VISUAL-PA-001 | PROBE-ATOMIZATION-PA-001 |
| Nozzle tip plume appearance | TACIT-PLUME-VISUAL-001 | PROBE-PLUME-VISUAL-001 |
| UA sound signature | TACIT-ATOMIZATION-SOUND-UA-001 | PROBE-UA-SOUND-001 |
| KEWB pressure trend vs. point value | TACIT-KEWB-PRESSURE-READ-001 | PROBE-PRESSURE-INTERPRETATION-001 |
| Line quality visual reference (5 states) | TACIT-LINE-QUALITY-REFERENCE-001 | PROBE-TACIT-LINE-QUALITY-001 |
| Abort decision framework | TACIT-ABORT-DECISION-001 | PROBE-ABORT-DECISION-001 |
| O-ring grease feel check | TACIT-ASSEMBLY-ORING-001 | (Procedural check, not standalone probe) |
| PFA tube cut quality | TACIT-ASSEMBLY-TUBING-001 | (Procedural check) |
| Nozzle tip inspection | TACIT-NOZZLE-INSPECT-001 | PROBE-NOZZLE-INSPECT-001 |
| Ink condition assessment | TACIT-INK-QUALITY-001 | (Exists in registry v1.1) |
| Post-sinter visual inspection | TACIT-POST-SINTER-INSPECT-001 | PROBE-SINTER-PARAMETERS-001 |

---

## Source Provenance

| Claim Category | Primary Source | Confidence |
|---|---|---|
| PA jar wall droplet patterns | SRC-018 (Stanford SNF), SRC-019 (Boise State) | High |
| Plume visual characteristics | Peer lit: Islam 2025, Smith 2017, peer CFD studies | Medium-High |
| UA sound signature | SRC-018 (description), InferredFromDomain | Medium |
| KEWB pressure trend reading | SRC-018 Section 7-8, SRC-019 Section 4.9 | High |
| Clog vs. leak pressure direction | SRC-018 Section 8.2-8.3, SRC-019 Section 4.9 | High (confirmed by both) |
| Line quality 5-state reference | SRC-019 Section 5.10, Optomec training materials per SRC-019 | High |
| Abort decision framework | SRC-018 (implied), InferredFromDomain | Medium |
| O-ring grease feel | SRC-018 Section 4.1, SRC-019 Section 1.3 | High |
| PFA tube cut quality | SRC-018 Section 4.1 | High |
| Post-sinter visual inspection | Peer lit: SRC-007, SRC-008, SRC-009, InferredFromDomain | Medium-High |
| Resistance expectations | Peer lit: SRC-009, electronics repair practice | Medium |
