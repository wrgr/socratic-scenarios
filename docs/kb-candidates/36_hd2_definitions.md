---
domain: ajp
source: local — see scripts/ingest-corpus.ts ACTIVE_SOURCES (hd2-definitions)
confidence: High
curatedBy: OEM
sourceCategory: oem-corecorpus
ingest_status: dense-rag (hd2-definitions) — extracted + scrubbed into public/ajp-corpus.json; raw .docx not shipped
---
> **ℹ SOURCE USED (promoted 2026-07-13).** The extracted, **scrubbed** text of this
> unnumbered `.docx` (component glossary) is ingested into `public/ajp-corpus.json`
> (`hd2-definitions`). The **raw `.docx` is never shipped** (gitignored `local-sources/`).
> Redistribution rights unconfirmed — flagged for later legal review, not a rebuild gate.
> This note is the authored abstraction of the source.


# Candidate 36: HD2 Definitions

**Document:** HD2 Definitions — authoritative glossary of hardware component names for the Optomec HD2.

**Dense RAG:** Not yet ingested. Add as `hd2-definitions` in `ingest-corpus.ts`.

---

## Authoritative Component Name List

These are the OEM-defined names for HD2 hardware components. Use these names consistently
in all Equipment nodes and narrator text — inconsistent naming confuses operators who
compare corpus text to what they see physically labeled on the machine.

| OEM Term | Notes |
|---|---|
| Atomizer Energy | UA transducer power setpoint (maps to UIMC_Power in Process_Configuration.xml) |
| Atomizer MFC | ATM_MFC in KEWB — Alicat mass flow controller for atomizer gas |
| Boost MFC | BOOST_MFC in KEWB — Alicat MFC |
| Bubbler Heat | BUB_HEAT in KEWB — Omron heater controller, 0–50 °C range |
| Cassette | The removable cartridge assembly containing ink vial + atomizer |
| Divert MFC | DIVERT_MFC in KEWB — Alicat MFC |
| Ink Vial | The glass vial containing ink, assembled into the cassette |
| Mist Tube | The tube carrying aerosolized ink from atomizer toward the nozzle (plugged during leak check) |
| Nozzle | Tapered print nozzle (300 µm in deployed configuration) |
| Platen | The substrate holder / stage surface |
| Platen Heat | PLATEN_HEAT in KEWB — Omron heater controller, 0–150 °C range |
| Sheath MFC | S_MFC in KEWB — Alicat MFC for sheath gas |
| Solvent Add-Back | The module attached to the left side of the cassette that replenishes solvent during printing |
| Substrate | The PCB or other material being printed on |

---

## Node Extraction Candidates

### 1. EQUIP-HD2-CASSETTE-001
**Type:** Equipment  
**Target file:** `src/corpus/ajp/graph.ts`

**What to capture:** The cassette is a removable module containing the ink vial, atomizer well, and solvent add-back. It installs via a bayonet mount and connects to KEWB via a keyed communication cable (red dot forward). The cassette change sequence (KEWB Sequence 1) covers its assembly and installation.

---

### 2. EQUIP-HD2-MIST-TUBE-001
**Type:** Equipment  
**Target file:** `src/corpus/ajp/graph.ts`

**What to capture:** The mist tube carries aerosolized ink from the atomizer to the nozzle body. Its exit port is plugged during the UA Leak Check (KEWB Sequence 2) to pressurize the system. A clogged mist tube (vs. a clogged nozzle) produces a different pressure signature — pressure at the atomizer rises but nozzle-side pressure is normal. Distinguishing these requires understanding which segment of the gas path is blocked.

---

### 3. EQUIP-HD2-SOLVENT-ADDBACK-001
**Type:** Equipment  
**Target file:** `src/corpus/ajp/graph.ts`

**What to capture:** The solvent add-back module replenishes evaporating solvent during extended print sessions, maintaining ink viscosity. The solvent in the add-back system must match the ink solvent base: DI water for Novacentrix Metalon JS-A426; acetone for Norland NEA 121. Mismatch causes ink phase separation.

---

## Review Notes

- The "Boost MFC" (BOOST_MFC) is listed in definitions and Process_Configuration.xml but its operational role (boosting pressure for specific nozzle conditions?) is not yet documented in the corpus. Add to open questions for operator elicitation.
- "Atomizer Energy" corresponds to `UA_MAX` or `UIMC_Power` in the KEWB variable space — confirm mapping with operator before authoring a Parameter node with specific wattage or voltage values.
