---
domain: ajp
source: local — see scripts/ingest-corpus.ts EXCLUDED_SOURCES
confidence: High
curatedBy: OEM
sourceCategory: schema
ingest_status: EXCLUDED (sensitivity review, 2026-07) — not ingested, not in ACTIVE_SOURCES
---
> **⚠ RAW SOURCE EXCLUDED from the public corpus (sensitivity review, 2026-07) — this note is retained.**
> Raw exported machine configuration (Sequences/*.xml) from a real deployed HD2, not vendor-published documentation — contained real recipe/toolpath filenames identifying the specific deployment. Real filenames below have been redacted; the general procedure-sequence knowledge is preserved, abstracted, in src/corpus/ajp/canonical-steps.ts.
> Kept here as a documented, quarantined record — not read by ingestion, not part of
> `public/ajp-corpus.json`. See `scripts/ingest-corpus.ts` `EXCLUDED_SOURCES` and the
> app's Domain Sources panel for the same exclusion surfaced in-app.


# Candidate 37: KEWB Sequence Schema (Authoritative Procedure Ordering)

**Document set:** All XML files in `CoreKB/Sequences/` — the canonical KEWB procedure sequences
as they execute on the deployed HD2.

**Dense RAG:** Not yet ingested. Requires a custom XML extractor (see ingest-corpus.ts update notes).

**Why this matters:** These sequences are ground truth for procedure ordering, operator prompts,
and system state at each step. They supersede all text-based SOPs for step ordering on this specific machine.

---

## Canonical Sequence Catalog

### Top-level sequences (operator-initiated)

| Sequence file | KEWB name | Canonical step |
|---|---|---|
| Machine Start-Up.xml | Machine Start-Up | CANON-STARTUP-002 |
| 1 - Cassette Change.xml | Cassette Change | CANON-STARTUP-003 |
| 2 - UA Leak Check.xml | UA Leak Check | CANON-STARTUP-004 (gate) |
| 3 - UA Start Process .xml | UA Start Process | CANON-STARTUP-005 |
| 4 - Set Z-height with Alignment Camera to Nozzle offset.xml | Set Z-height | CANON-STARTUP-006 |
| 5 - Load New Part.xml | Load New Part | CANON-OP-001 |
| 6 - Print Board with Laser Sintering.xml | Print Board with Laser Sintering | CANON-OP-002 |
| 7 - Shutdown UA Process.xml | Shutdown UA Process | CANON-SHUTDOWN-001 |
| Machine Shut Down.xml | Machine Shut Down | CANON-SHUTDOWN-002 |

### Notable supplementary sequences

| Sequence file | Purpose |
|---|---|
| Start UA Temperatures.xml | Temperature warmup only (subset of Sequence 3) |
| Maint - Home System.xml | Maintenance homing without full startup |
| 000 - Repair Demonstration.xml | Demo/training scenario sequence |
| UA Shutdown Process.xml | Standalone UA shutdown (alias for Sequence 7) |

---

## Node Extraction Candidates

### 1. STEP-MACHINE-STARTUP-DETAIL-001
**Type:** Step  
**Target file:** `src/corpus/ajp/graph.ts`

**What to capture (from Machine Start-Up.xml):** Three KEWB-automated steps in order:
1. Shut all vision lights off (ProcessLeft, ProcessRight, AlignmentRing, AlignmentSpot → 0)
2. Turn all gas flows to zero (ATM_MFC, S_MFC, DIVERT_MFC, BOOST_MFC → 0 SCCM)
3. Enable PlatenVacuum and ProcessVacuum (true), turn on MachineLight (true)

The light-off first, then gas, then vacuum/light sequence is the authoritative Machine Start-Up order.

---

### 2. STEP-LEAK-CHECK-DETAIL-001
**Type:** Step  
**Target file:** `src/corpus/ajp/graph.ts`

**What to capture (from 2 - UA Leak Check.xml):** Full step sequence:
1. Operator plugs mist tube exit on ink vial
2. KEWB clears chart data
3. Sheath (S_MFC) and Atomizer (ATM_MFC) flows turned on
4. System waits for pressure > 2 PSI
5. Sheath and ATM flows turned off
6. Wait for pressure stabilization
7. Capture starting pressure
8. Wait for pressure decay window
9. Decision: leak detected? → compute leak rate
   - Small leak: jump to plug removal (operator removes plug, KEWB continues)
   - Large leak: turn off sheath, hard stop ("Large Leak detected" — diagnose before continuing)
   - Pass: "No Leak detected" — continue to plug removal

**Why it matters:** The branching logic (small vs large leak) is not documented anywhere else. Training must cover all three outcomes, not just the pass path.

---

### 3. STEP-UA-START-DETAIL-001
**Type:** Step  
**Target file:** `src/corpus/ajp/graph.ts`

**What to capture (from 3 - UA Start Process.xml):** Full step sequence:
1. Reset Fixture (world coordinates)
2. Check Water in the Bath (operator prompted)
3. Move to Dump Zone
4. Enable Heater Circuit (HEATER_EN digital output → true)
5. Set Temps (BUB_HEAT, UA_HEAT setpoints)
6. Wait for temperatures (monitored hold — KEWB waits, operator watches)
7. Turn off Javelin valve
8. Clear data from graph
9. Run Recipe File: "[site-specific recipe filename — redacted]"
10. KEWB displays "Recipe Has Started"

The "Check Water in the Bath" step (step 2) is a manual operator prompt — if DI water level is low, the UA transducer will run dry and can be damaged. This is a critical tacit gate.

---

### 4. STEP-SHUTDOWN-DETAIL-001
**Type:** Step  
**Target file:** `src/corpus/ajp/graph.ts`

**What to capture (from 7 - Shutdown UA Process.xml):**
1. Reset Fixture to world coordinates
2. Move to Dump Zone
3. Turn off Javelin Divert valve
4. Run Shutdown Recipe: "[site-specific shutdown recipe filename — redacted]"

And from Machine Shut Down.xml:
1. Shut lights off
2. Reset Fixture (world coordinates)
3. Turn all gas flows to zero
4. Disable PlatenVacuum and ProcessVacuum
5. Move stage to home (X 200, Y 150, Z –5 in Main coordinate system)

---

## Review Notes

- The `4.5 - Set Z-height with Alignment Camera to Rotary Tool offset.xml` sequence exists for when a rotary tool is being used. The deployed repair workflow uses the standard nozzle, so Sequence 4 (not 4.5) is canonical.
- `9 - Unmask Via with Rotary Tool.xml` covers a rotary milling tool operation — not part of standard AJP training scope.
- The `000 - Repair Demonstration.xml` sequence could be a useful source for a scripted training scenario — review its content for scenario-scripts.ts.
- Sequence `6.5 - Print Board Backup.xml` exists — likely a fallback without laser sintering. Do not use as canonical; the laser-sinter version (Sequence 6) is authoritative for this corpus.
