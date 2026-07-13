---
domain: ajp
source: local — see scripts/ingest-corpus.ts EXCLUDED_SOURCES
confidence: High
curatedBy: OEM
sourceCategory: schema
ingest_status: EXCLUDED (sensitivity review, 2026-07) — not ingested, not in ACTIVE_SOURCES
---
> **⚠ RAW SOURCE EXCLUDED from the public corpus (sensitivity review, 2026-07) — this note is retained.**
> Raw exported machine configuration from a real deployed HD2 — contained real network addresses, camera serial numbers, and a chiller COM port for the specific deployment. Real values below have been redacted; the device-role knowledge is preserved, abstracted, in src/corpus/ajp/design-faults.ts.
> Kept here as a documented, quarantined record — not read by ingestion, not part of
> `public/ajp-corpus.json`. See `scripts/ingest-corpus.ts` `EXCLUDED_SOURCES` and the
> app's Domain Sources panel for the same exclusion surfaced in-app.


# Candidate 39: KEWB Process Configuration Schema

**Document:** `Config/Process_Configuration.xml` — defines all hardware devices, controllers, and their
operational ranges as recognized by KEWB. This is the machine's device topology.

**Dense RAG:** Not yet ingested. Requires XML-to-prose conversion.

---

## Device Catalog (from Process_Configuration.xml)

### Gas Flow Controllers (Alicat MFCs — all at [redacted local network address])

| KEWB Name | Role | Address | Range |
|---|---|---|---|
| ATM_MFC | Atomizer gas flow | A | 0–4000 SCCM |
| S_MFC | Sheath gas flow | B | 0–4000 SCCM |
| DIVERT_MFC | Divert valve flow | E | 0–4000 SCCM |
| BOOST_MFC | Boost gas flow | D | 0–4000 SCCM |
| LASER_MFC | Laser assist gas flow | G | 0–4000 SCCM |

### Heaters (Omron controllers)

| KEWB Name | Role | Channel | Range |
|---|---|---|---|
| BUB_HEAT | Bubbler heater | Unit 50, Ch 3 | 0–50 °C |
| UA_HEAT | Ultrasonic atomizer heater | Unit 50, Ch 1 | 0–60 °C |
| PLATEN_HEAT | Substrate platen heater | Unit 51, Ch 4 | 0–150 °C |

### Other Devices

| KEWB Name | Type | Role |
|---|---|---|
| UIMC_Power | Wago analog output (0–10 V) | Ultrasonic transducer power |
| UA_Feedback | Wago thermocouple | UA temperature feedback |
| HEATER_EN | Wago digital output | Heater circuit enable relay |
| PlatenVacuum | Wago digital output | Platen vacuum pump |
| ProcessVacuum | Wago digital output | Process vacuum pump |
| MachineLight | Wago digital output | Machine interior light |

### Vision/Lighting Controllers (Mightex)

| ID | Serial | Role |
|---|---|---|
| process_light | [redacted serial] | Process camera illumination |
| alignment_light | [redacted serial] | Alignment camera illumination |
| uv_light | [redacted serial] | UV curing light (optional) |

---

## Node Extraction Candidates

### 1. EQUIP-ATM-MFC-001
**Type:** Equipment  
**Target file:** `src/corpus/ajp/graph.ts`

**What to capture:** ATM_MFC — Alicat mass flow controller at address A, range 0–4000 SCCM, controlling atomizer carrier gas flow. This is the gas that carries the aerosol from the atomizer through the mist tube to the nozzle. In KEWB, this is the variable shown as "Atomizer MFC" (per HD2 Definitions).

---

### 2. EQUIP-S-MFC-001
**Type:** Equipment  
**Target file:** `src/corpus/ajp/graph.ts`

**What to capture:** S_MFC — Alicat MFC at address B, range 0–4000 SCCM, controlling sheath gas flow. The sheath gas creates the annular focusing envelope at the nozzle exit. This is the variable the operator adjusts to control line width: increase S_MFC → decrease feature size; decrease S_MFC → increase feature size (per HD2 Q&A).

---

### 3. EQUIP-PLATEN-HEAT-001
**Type:** Equipment  
**Target file:** `src/corpus/ajp/graph.ts`

**What to capture:** PLATEN_HEAT — Omron heater, range 0–150 °C, controlling the substrate platen temperature. Elevated platen temperature dries printed ink more rapidly and locks features in place to prevent ink blow-out (per HD2 Q&A). Also relevant for substrate thermal compatibility (platen heat is limited to 150 °C, so it cannot damage most PCB substrates at normal operating temps).

---

### 4. EQUIP-LASER-MFC-001
**Type:** Equipment  
**Target file:** `src/corpus/ajp/graph.ts`

**What to capture:** LASER_MFC — Alicat MFC at address G, 0–4000 SCCM, providing assist gas flow to the laser sintering module. This device confirms that the laser sintering system has its own independent gas flow control — it is not shared with the print gas system. The laser MFC assist gas is likely nitrogen or argon for the sinter atmosphere; confirm specific gas type with operator.

---

## Review Notes

- The BOOST_MFC (address D) role is not documented in Q&A or Training Manual. It may provide supplemental pressure during deposition start or at high-speed printing. Add to open elicitation questions.
- ThermoTek chiller (COM2) is referenced in the config — this is likely for the laser cooling system, not the ink system. Confirm.
- The UV light controller (uv_light, Mightex) suggests a UV curing capability exists on the machine. This would be relevant for curing Norland NEA 121 dielectric ink (UV-curable), and should be documented as an optional post-print step for dielectric printing (out of scope for current silver-only training module).
- The UserVariables.xml shows `Toolpath = C:\AerosolJetPrinter\User Toolpaths\[site-specific filename — redacted]` — confirms the active demo scenario is an Arduino board repair.
