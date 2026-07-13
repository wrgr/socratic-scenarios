---
domain: ajp
source: local — see scripts/ingest-corpus.ts ACTIVE_SOURCES (hd2-motion-vision-kewb, hd2-health-safety, hd2-process-manual, hd2-process-dev-session11, hd2-block-diagram)
confidence: High
curatedBy: OEM
sourceCategory: oem-corecorpus
ingest_status: pending — see ingest-corpus.ts for per-file source entries (format: pdf)
---

# Candidate 40: OEM Documentation PDFs

**Document set:** All PDFs in `CoreKB/OEM Documentation/`. Each is a separate ingest source.
This file catalogs them, assigns priority, and notes which gaps each addresses.

---

## Priority Tier 1 — Ingest Immediately

### 9001094 AJ HD2 Motion and Vision Manual with KEWB.pdf
- **Ingest ID:** `hd2-motion-vision-kewb`
- **What it covers:** HD2-specific motion system, vision alignment system, and KEWB software interface
- **Gap relevance:** GAP-010 (stage fault codes), GAP-011 (KEWB error catalog), GAP-012 (vision system camera capabilities)
- **Note:** This is the primary KEWB software documentation. Likely contains fault codes, alarm descriptions, and KEWB interface navigation not in Alarms.xml.

### 9000876 AJ Health and Safety Guidelines.pdf
- **Ingest ID:** `hd2-health-safety`
- **What it covers:** Optomec-authored health and safety guidelines for AJP systems
- **Gap relevance:** GAP-014 (SDS and safety controls) — partial closure; full SDS still needs manufacturer source
- **Note:** This is the OEM safety authority. Use to validate HAZARD nodes and PPE requirements.

### 9000983 Aerosol Jet Process Manual.pdf
- **Ingest ID:** `hd2-process-manual`
- **What it covers:** HD2 process manual — parameters, recipes, and procedures
- **Gap relevance:** GAP-003/015 (sheath pressure setpoints), sintering parameters

### 24450-Session-11-AJ-Process-Development-Techniques.pdf
- **Ingest ID:** `hd2-process-dev-session11`
- **What it covers:** Optomec training session on process development — parameter optimization, fault identification
- **Gap relevance:** GAP-003/015 (sheath setpoints), process window guidance
- **Note:** High value for Socratic probe content — process development reasoning.

### HD2 block diagram 12_8_22.pdf
- **Ingest ID:** `hd2-block-diagram`
- **What it covers:** Hardware block diagram of the HD2 system
- **Gap relevance:** Equipment node accuracy, gas system topology
- **Note:** Useful for verifying gas flow path (ATM → mist tube → nozzle) and confirming device interconnects.

---

## Priority Tier 2 — Ingest in Second Pass

### HD2 System - Process Dev 05-31-24.pdf
- **Ingest ID:** `hd2-process-dev-2024`
- **What it covers:** More recent (2024) process development documentation
- **Note:** May supersede Session-11 content on some parameters.

### AlicatManual.pdf
- **Ingest ID:** `hd2-alicat-manual`
- **What it covers:** Alicat MFC operation and calibration
- **Gap relevance:** GAP-003/015 — actual SLPM calibration and range interpretation
- **Note:** The Alicat MFCs (ATM_MFC, S_MFC, etc.) all use this interface. Understanding Alicat display units is prerequisite for interpreting KEWB gas flow readings.

### 9000230 - VMTools 2.0 User Manual.pdf
- **Ingest ID:** `hd2-vmtools`
- **What it covers:** VMTools 2.0 — toolpath generation software
- **Gap relevance:** Print path verification step (CANON-OP-001)
- **Note:** Toolpath generation is upstream of KEWB; relevant for operators who create their own repair paths.

### Soldering Ag to Aerosol Jet Printed Features.pdf
- **Ingest ID:** `hd2-soldering-ag`  
- **What it covers:** Soldering to AJP traces — post-repair integration
- **Note:** Relevant for operators who need to solder leads or components to AJP-repaired traces.

### Soldering of Printed Silver.pdf
- **Ingest ID:** `hd2-soldering-silver`
- **What it covers:** Additional guidance on soldering printed silver
- **Note:** Companion to above.

---

## Priority Tier 3 — Reference Only (low training value)

### 9001016 AJ 5X, FLEX, 200, and HD2 Safety Sticker Placement.pdf
- **Ingest ID:** `hd2-safety-stickers`
- **Note:** Physical label placement guide. Low training value but confirms safety label locations for visual recognition.

### Projecting Feature on 3D Surface in ACAD 08242018 v1.pdf
- **Ingest ID:** `hd2-acad-3d-projection`
- **Note:** AutoCAD toolpath projection for 3D surfaces — niche capability not in standard repair workflow.

### 9009025C .pdf
- **Ingest ID:** `hd2-9009025c`
- **Note:** Unknown document — read first to categorize before ingesting.

---

## Review Notes

- The `User Manual.pdf` in OEM Documentation is likely the base AJP system manual (not HD2-specific). Read before ingesting to determine overlap with Stanford SNF SOP already in corpus.
- Start with Tier 1 documents before adding Tier 2; Tier 1 is most likely to close remaining open gaps.
