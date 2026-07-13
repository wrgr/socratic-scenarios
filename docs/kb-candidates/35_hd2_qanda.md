---
domain: ajp
source: local — see scripts/ingest-corpus.ts ACTIVE_SOURCES (hd2-qanda)
confidence: High
curatedBy: OEM
sourceCategory: oem-corecorpus
ingest_status: dense-rag (hd2-qanda) — extracted + scrubbed into public/ajp-corpus.json; raw .docx not shipped
---
> **ℹ SOURCE USED (promoted 2026-07-13).** The extracted, **scrubbed** text of this
> unnumbered `.docx` is ingested into `public/ajp-corpus.json` (`hd2-qanda`). It reads
> as site-specific first-person operational Q&A; the **raw `.docx` is never shipped**
> (gitignored `local-sources/`). Redistribution rights unconfirmed — flagged for later
> legal review, not a rebuild gate. This note is the authored abstraction of the source.


# Candidate 35: HD2 Questions and Answers

**Document:** HD2 Q&A — covers ink specification, parameters, fault recovery, and storage.

**Dense RAG:** Not yet ingested. Add as `hd2-qanda` in `ingest-corpus.ts`.

**Gap closures from this document:**
- GAP-012 (ink identity): **CLOSED** — Novacentrix Metalon JS-A426 (Ag NP, used straight from bottle)
- GAP-013 (ink dilution): **CLOSED** — JS-A426 straight from bottle; Norland NEA 121 dielectric at 2:1 acetone:NEA 121
- GAP-014 (safety/storage): **Partially closed** — JS-A426 refrigerate <5 °C; NEA 121 in amber/opaque vials

---

## Node Extraction Candidates

### 1. PARAM-INK-SPECIFICATION-001
**Type:** Parameter  
**Target file:** `src/corpus/ajp/parameters.ts`

**What to capture:**
- Standard conductive ink: Novacentrix Metalon JS-A426 — printed straight from bottle, no dilution
- Standard dielectric/insulating ink: Norland NEA 121 — 2:1 ratio of acetone to NEA 121
- Viscosity ranges: UA atomization targets 1–10 cP (water-to-blood range); PA atomization targets 1–100 cP
- Storage: JS-A426 refrigerated <5 °C; NEA 121 in amber/opaque vials (UV-curable, light-sensitive)

**Why it matters:** GAP-012 was blocking — ink identity was unknown, so nodes about ink degradation, dilution, and storage lacked specific product references. This closes that gap with OEM authority.

---

### 2. PARAM-STANDOFF-DISTANCE-001
**Type:** Parameter  
**Target file:** `src/corpus/ajp/parameters.ts`

**What to capture:** Ideal standoff distance 3–7 mm, set by "Set Z-height with Alignment Camera to Nozzle offset" calibration sequence. Nozzle must clear all taller components on the substrate at the chosen offset.

---

### 3. PARAM-PRINT-SPEED-001
**Type:** Parameter  
**Target file:** `src/corpus/ajp/parameters.ts`

**What to capture:**
- Recommended print speed: 2–3 mm/s
- Recommended rapid (jog) speed: 10 mm/s
- Note: UserVariables.xml shows PrintSpeed = 30 and ProcessSpeed = 4 — these may represent different operational contexts (the repair demo vs. general guidance) or different parameter roles. Flag for operator confirmation. Use Q&A values (2–3 mm/s) as the conservative training baseline.
- Print speed also affects deposition rate: slower = more material per unit length.

---

### 4. PARAM-SINTER-PROFILES-001
**Type:** Parameter  
**Target file:** `src/corpus/ajp/parameters.ts`

**What to capture:** Three valid sintering profiles for Ag NP ink (JS-A426):
- 100 °C / 12 hours (lowest thermal stress, longest time)
- 185 °C / 4 hours (standard for most substrates)
- 250 °C / 10 minutes (highest temp, shortest time — confirm substrate can tolerate)

**Correction:** Prior CANON-POST-004 stated "175 °C, 3–4 hours" — this is not one of the OEM-specified profiles. The closest is 185 °C / 4 hours. Update any nodes referencing 175 °C.

**Note:** These are bench-top oven profiles. The deployed HD2 uses inline laser sintering (CANON-OP-002). These profiles remain relevant for re-sinter rescue operations if laser sinter is incomplete.

---

### 5. TACIT-LIMIT-SWITCH-RECOVERY-001
**Type:** TacitKnowledge  
**Target file:** `src/corpus/ajp/tacit-knowledge.ts`

**What to capture:** Limit switch recovery procedure (partial closure of GAP-010):
"Navigate to the Alarms button on the bottom right of the KEWB window, click 'Ack All Alarms' as many times as necessary to clear the flashing red alarm codes, then manually jog the printer back into the safe zone — move up in Z direction FIRST, then toward center of platen using X and Y jog buttons."

The Z-first rule is critical — moving X or Y before Z risks nozzle collision with raised board components.

---

### 6. TACIT-INK-STABILITY-001
**Type:** TacitKnowledge  
**Target file:** `src/corpus/ajp/tacit-knowledge.ts`

**What to capture:** "Aerosol jet printer inks are solvent-based and will begin evaporating as soon as they are formulated. They are usually stable as long as solvent is being added back in the printing process but will dry out and become unprintable if the ink is left unattended. The printer should be cleaned at the end of each print session and new ink should be loaded the next time the printer is used."

This directly answers the question of whether ink can be left in the vial overnight — it cannot.

---

### 7. FAULT-FAILED-LEAK-CHECK-001 (update)
**Type:** FailureMode  
**Target file:** `src/corpus/ajp/design-faults.ts`

**What to capture from Q&A:** "Failing a leak check could be indicative of a few issues. First, check all O-rings in the ink vial assembly — properly seated and not damaged. Replace any that appear dry, cracked, discolored, or caked in ink. Next, ensure cartridge is well-seated against alignment pins and latch is secured. Finally, check tube connections between ink tube, vial assembly, and nozzle."

Diagnosis order: O-rings first → cartridge seating → tube connections.

---

## Review Notes

- The Q&A mentions "multiple inks can be printed on top of each other, but you must fully cure each layer." This creates a multi-layer printing scenario not yet represented in the corpus.
- "Aerosol jet printer inks... are meant to be stored in a refrigerator at less than 5°C" applies to JS-A426. Storage guidance for NEA 121 differs (amber vials, not refrigeration). Both should be on the CANON-SHUTDOWN-003 narrator text.
