---
domain: ajp
source: local — see scripts/ingest-corpus.ts ACTIVE_SOURCES (hd2-training-manual)
confidence: High
curatedBy: OEM
sourceCategory: oem-corecorpus
ingest_status: dense-rag (hd2-training-manual) — extracted + scrubbed into public/ajp-corpus.json; raw .docx not shipped
---
> **ℹ SOURCE USED (promoted 2026-07-13).** The extracted, **scrubbed** text of this
> unnumbered `.docx` is ingested into `public/ajp-corpus.json` (`hd2-training-manual`).
> The **raw `.docx` is never shipped** (gitignored `local-sources/`). Redistribution
> rights for these unnumbered docs are unconfirmed — flagged for later legal review,
> not a rebuild gate. This note is the authored abstraction of the source.


# Candidate 34: HD2 Training Manual

**Document:** "Training Manual for the operation of an Optomec HD2 Aerosol Jet Printer"

**Dense RAG:** Not yet ingested. Add as `hd2-training-manual` in `ingest-corpus.ts`.

**Authoritative for:** Complete HD2 operating procedure via KEWB software. This document
supersedes the Stanford SNF and Boise State SOPs for procedure ordering — those cover generic AJP systems,
this covers the specific deployed HD2 + KEWB configuration.

---

## Coverage Summary

Six major sections, each maps directly to a canonical phase:
1. System Assembly → CANON-STARTUP-003
2. Leak Checking → CANON-STARTUP-004
3. Starting the Print Process → CANON-STARTUP-005
4. Calibrating the Printer Alignment (Z-height) → CANON-STARTUP-006
5. Printing a Toolpath → CANON-OP-001 / CANON-OP-002
6. Disassembling and Cleaning → CANON-SHUTDOWN-003

---

## Node Extraction Candidates

### 1. STEP-ASSEMBLY-DETAIL-001
**Type:** Step  
**Target file:** `src/corpus/ajp/graph.ts`

**What to capture:** The full assembly sequence is more granular than CANON-STARTUP-003. Key tacit details:
- Membrane and O-ring go into holder BEFORE screwing to vial bottom (order matters for seal)
- Ferules: ink ferrule pushed into TOP of vial body; ¼" tube ferrule pushed into BOTTOM and twisted right
- Vial body cap screws: hand tight then flathead, never power-tool
- DI water fill level: "until water level reaches the bottom of the splash guard" — not to the top
- Cartridge install: "align positioning bayonet and then slide firmly until seated against the BACK of the motion assembly" — incomplete seating is a common source of leak-check failure

**Why it matters:** O-ring seating order and DI water fill level are tacit details absent from all other corpus sources. They are the primary failure modes for leak-check failures.

---

### 2. TACIT-CASSETTE-INSTALL-001
**Type:** TacitKnowledge  
**Target file:** `src/corpus/ajp/tacit-knowledge.ts`

**What to capture:** "Secure the cartridge clip on the upper left end of the cartridge and plug in the communication/control cable with the red dot facing forward." The red dot orientation is a tactile/visual cue absent from all other sources. Incorrect cable orientation prevents KEWB from communicating with the cartridge — the symptom is KEWB shows no atomizer response, which mimics a harder fault.

---

### 3. STEP-PRINT-SEQUENCE-001 (update to CANON-OP-002 narratorText)
**Type:** Step  
**Target file:** `src/corpus/ajp/graph.ts`

**What to capture:** The two-stage parameter prompt from the Training Manual:
- First prompt: print speed, rapid speed, print loops (for ink deposition)
- Second prompt (after printing completes): print speed, rapid speed, passes for LASER SINTERING

This two-stage nature is critical: operators sometimes confuse the laser sinter parameters with the print parameters — they are separate inputs at separate KEWB dialog boxes.

---

### 4. STEP-BOARD-PLACEMENT-TIMING-001
**Type:** TacitKnowledge  
**Target file:** `src/corpus/ajp/tacit-knowledge.ts`  

**What to capture:** "Allow the printer to jog over to the starting position BEFORE placing the damaged board in the printer to avoid crashing the printer into the board." This is the explicit basis for why CANON-OP-001 (board load) comes AFTER CANON-STARTUP-006 (Z-height), not before. The prior canonical ordering (board load as step 2) was wrong precisely because this constraint was not represented.

---

## Review Notes

- The Training Manual describes a PA (pneumatic) Clariant startup recipe path (site-specific recipe filename — redacted). The active system uses UA (ultrasonic) not PA atomization. The startup recipe filename in the UA Start Process is "[site-specific recipe filename — redacted]" — confirm with operator which atomizer type is actually in use.
- "Torque wrench until an audible click" for the vial captive screw — this is a torque-limited mechanism, not indefinite tightening. Flag as tacit knowledge for the assembly step.
