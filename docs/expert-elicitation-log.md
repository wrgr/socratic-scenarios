# Expert Elicitation Log — AJP HD2 Training Corpus
<!-- Live log of expert sessions and the question backlog for corpus expansion. -->
<!-- Companion to docs/expert-elicitation-guidelines.md -->

**Corpus files:**  
- Tacit knowledge → `src/corpus/ajp/tacit-knowledge.ts`  
- Fault/symptom nodes → `src/corpus/ajp/design-faults.ts`  
- Corrective actions → `src/corpus/ajp/design-actions.ts`  
- Gap registry → `src/corpus/ajp/corpus-gaps.ts`  

**After each session:** add a Session Entry below, then add the resulting nodes to the relevant corpus file and update `corpus-gaps.ts` status.

---

## Open Question Backlog

Questions grouped by gap. These are the specific things we need from an expert or a document before the corpus can be considered complete for training use.

### GAP-003/015 — Sheath pressure setpoint table

| # | Question | Target expert | Priority |
|---|---|---|---|
| Q-001 | What sheath gas flow rate (SLPM) do you start at for a 150 μm, 300 μm, and 500 μm nozzle? | HD2 operator | High |
| Q-002 | Does your lab's elevation meaningfully affect the sheath setpoint? By how much, roughly? | HD2 operator | Medium |
| Q-003 | When you increase sheath gas, what do you see first in KEWB and in the deposited trace? | HD2 operator | High |

### GAP-010 — Stage fault codes

| # | Question | Target expert | Priority |
|---|---|---|---|
| Q-004 | When stage homing fails, what number(s) does KEWB display? What does each mean? | HD2 operator / Optomec support | High |
| Q-005 | Is there a difference in the fault display between a mechanical obstruction and an electrical fault? What does each look like? | HD2 operator | High |
| Q-006 | Have you ever recovered from a stage fault without calling Optomec? What did you do? | HD2 operator | Medium |

### GAP-011 — KEWB error code catalog

| # | Question | Target expert | Priority |
|---|---|---|---|
| Q-007 | What are the most common KEWB pop-up errors you see in normal operation? What triggers each? | HD2 operator | High |
| Q-008 | Is there a difference between a warning (can continue) and an error (must stop) in KEWB? How do you tell? | HD2 operator | High |
| Q-009 | What's the correct recovery procedure when KEWB shows a pressure alarm vs. a flow alarm? | HD2 operator | High |

### GAP-012 — Vision system camera

| # | Question | Target expert | Priority |
|---|---|---|---|
| Q-010 | What can you reliably see on the nozzle tip with the built-in camera? What requires an external microscope? | HD2 operator | Medium |
| Q-011 | What magnification or field of view does the vision system give you? (Camera model or spec label OK) | HD2 operator | Low |

### GAP-013 — Ink dilution — **RESOLVED as a flagged baseline (2026-04-14)**

Q-012 and Q-013 are resolved by a deliberate baseline choice from the training program owner:
**Novacentrix Metalon JS-A426** (conductive, no dilution) and **Norland NEA 121**
(dielectric, 2:1 acetone dilution) — see `PARAM-INK-IDENTITY-001` in `parameters.ts` and
`corpus-gaps.ts`. This is a flagged default, not a confirmed current-lot check; the remaining
questions below stay open until someone verifies the baseline against the actual site inventory.

| # | Question | Target expert | Priority |
|---|---|---|---|
| ~~Q-012~~ | ~~Which specific Ag NP ink product do you use?~~ | — | Resolved as baseline — confirm against site inventory |
| ~~Q-013~~ | ~~Do you dilute the ink before loading? If so, with what solvent and at what ratio?~~ | — | Resolved as baseline — confirm against site inventory |
| Q-014 | How do you tell when the ink viscosity is correct for printing vs. too thick or too thin? | HD2 operator | High |
| Q-015 | At what shelf age or visual sign do you discard ink and open a fresh vial? | HD2 operator | High |

### GAP-014 — Safety Data Sheet

| # | Question | Target expert | Priority |
|---|---|---|---|
| Q-016 | Can you provide or locate the SDS for the specific Ag NP ink in use at your lab? | Lab manager / EHS | **Blocking** |
| Q-017 | What exposure controls (fume hood, respirator, PPE level) does your site use for AJP printing? | EHS officer | High |

---

### Tacit knowledge questions (not gap-blocked, but not yet elicited)

These are open research questions about expert perceptual/judgment knowledge that would improve existing corpus nodes.

| # | Question | Target node | Priority |
|---|---|---|---|
| Q-018 | When you look at a deposited trace under the microscope after a print, what do you look for first to judge quality before running continuity? | TACIT-LINE-QUALITY-REFERENCE-001 | High |
| Q-019 | When the PA atomizer is running well, what does the sound tell you vs. what KEWB tells you? Are there sounds that precede KEWB alarms? | TACIT-ATOMIZATION-VISUAL-PA-001 | Medium |
| Q-020 | Describe what 'too much sheath gas' looks like in the deposition — not just wider, but what specifically changes? | FAULT-OVERSPRAY-001 | Medium |
| Q-021 | When you're deciding to wipe the nozzle vs. abort, what is the one signal that makes you commit to abort rather than try again? | TACIT-ABORT-DECISION-001 | High |
| Q-022 | What does good sinter look like visually before and after? Can you tell from appearance alone that sintering is complete? | FAULT-SINTER-INCOMPLETE-001 | Medium |
| Q-023 | Have you ever had a PCB survive a sinter temperature that should have been too high? What did you observe? | FAULT-SINTER-THERMAL-DAMAGE-001 | Low |
| Q-024 | What's the minimum standoff distance you've successfully printed at without nozzle contact? What made it possible? | FAULT-STANDOFF-TOO-SMALL-001 | Medium |
| Q-025 | What does an ESD-damaged component look like vs. one that's clearly mechanically damaged? Have you ever confirmed ESD post-hoc? | FAULT-ESD-DAMAGE-001 | Medium |

---

## Session Log

> Add entries here after each expert interview or document review.
> Format: ## Session N · YYYY-MM-DD · [Expert role] · [Duration]

## Session 1 · 2026-04-10 · Document Review — KB Candidates v1.0 · N/A

**Questions addressed:** Q-018 (partial), Q-019 (partial), Q-020 (partial), Q-021 (partial), Q-022 (partial)  
**Format:** Document synthesis from docs/kb-candidates/ (01–08)  
**Recorded:** N/A — document review session

### KB-DOC-01 — AJP Process Signals
> Content captured as: TACIT-ATOMIZATION-VISUAL-PA-001 (enriched),
  TACIT-PLUME-VISUAL-001 (new), TACIT-LINE-QUALITY-REFERENCE-001 (enriched),
  TACIT-NOZZLE-INSPECT-001 (enriched), TACIT-ATOMIZATION-SOUND-UA-001 (enriched),
  TACIT-KEWB-PRESSURE-READ-001 (enriched), TACIT-ABORT-DECISION-001 (enriched),
  TACIT-INK-QUALITY-001 (new), TACIT-POST-SINTER-INSPECT-001 (new),
  TACIT-ASSEMBLY-ORING-001 (new), TACIT-ASSEMBLY-TUBING-001 (new)

### KB-DOC-02 — Fault Diagnosis Reasoning
> TACIT-DIAGNOSIS-LOOP-001 (new), TACIT-DIAGNOSIS-SINGLE-CHANGE-001 (new),
  TACIT-SUBSTRATE-VS-PARAM-001 (new)

### KB-DOC-03 — Gas System Tacit
> TACIT-GAS-SEQUENCE-RATIONALE-001 (new), TACIT-FOCUS-RATIO-001 (new),
  TACIT-GAS-CONDITIONING-001 (new)

### KB-DOC-04 — Assembly & Maintenance Tacit
> TACIT-NOZZLE-INSTALL-001 (new), TACIT-ASSEMBLY-JAR-LOAD-PA-001 (new),
  TACIT-ASSEMBLY-VIAL-LOAD-UA-001 (new), TACIT-CLEANING-PROTOCOL-001 (new),
  TACIT-PREPRINT-CHECKLIST-001 (new)

### KB-DOC-05 — Sintering Decision Tacit
> TACIT-SINTER-SUBSTRATE-LIMIT-001 (new), TACIT-SINTER-RAMP-RATE-001 (new),
  TACIT-SINTER-RESISTANCE-001 (new)

### KB-DOC-06 — Tacit Knowledge Theory
> THEORY-TACIT-KNOWLEDGE-001 (new TheoryReference node)

### KB-DOC-07 — Expert Elicitation Template
> Process document. Available as docs/kb-candidates/07_expert_elicitation_template.md.
  Use in place of / alongside docs/expert-elicitation-guidelines.md for future sessions.

### KB-DOC-08 — Signal-Fault Cross-Reference Index
> GAP-015 added to corpus-gaps.ts. Three new probe nodes added to probes.ts
  (PROBE-ATOMIZATION-PA-001, PROBE-PLUME-VISUAL-001, PROBE-UA-SOUND-001).
  GAP-012 affectedNodeIds updated to include TACIT-PLUME-VISUAL-001.
  GAP-013 affectedNodeIds updated to include TACIT-INK-QUALITY-001.

---

<!-- TEMPLATE — copy and fill for each session:

## Session N · YYYY-MM-DD · [Expert role, e.g. "process engineer, 4 years HD2 experience"] · [Duration, e.g. "75 min"]

**Questions addressed:** Q-001, Q-004, Q-007  
**Format:** In-person / Video call / Async written  
**Recorded:** Yes / No  

### Q-001 — Sheath gas setpoints
> **Expert answer (verbatim or close paraphrase):**
> "For a 150 μm nozzle we start at 40 SLPM and adjust up. 300 μm we're usually around 60. Never needed to go above 80."

**Node action:**
- Updated `PARAM-SHEATH-FLOW-001` content with specific values.
- Status: GAP-003 → partial (elevation effect still unknown).

---

### Q-004 — Stage fault codes
> **Expert answer:**
> "We see code 12 when the limit switch isn't hit. Code 15 means the motor didn't respond in time — that's usually a cable."

**Node action:**
- Added fault codes to `FAULT-STAGE-HOME-FAIL-001` content.
- Status: GAP-010 → resolved.

-->

---

*No sessions recorded yet. Schedule the first session using `docs/expert-elicitation-guidelines.md` as the interview guide.*
