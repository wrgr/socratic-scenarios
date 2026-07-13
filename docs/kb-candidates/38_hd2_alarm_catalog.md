---
domain: ajp
source: local — see scripts/ingest-corpus.ts EXCLUDED_SOURCES
confidence: High
curatedBy: OEM
sourceCategory: config
ingest_status: EXCLUDED (sensitivity review, 2026-07) — not ingested, not in ACTIVE_SOURCES
---
> **⚠ RAW SOURCE EXCLUDED from the public corpus (sensitivity review, 2026-07) — this note is retained.**
> Raw exported machine configuration from a real deployed HD2. The alarm-severity knowledge itself is preserved, abstracted, in src/corpus/ajp/design-faults.ts.
> Kept here as a documented, quarantined record — not read by ingestion, not part of
> `public/ajp-corpus.json`. See `scripts/ingest-corpus.ts` `EXCLUDED_SOURCES` and the
> app's Domain Sources panel for the same exclusion surfaced in-app.


# Candidate 38: KEWB Alarm Catalog (from Alarms.xml)

**Document:** `Config/Alarms.xml` — complete list of KEWB alarms, their severities, and trigger conditions
for the deployed HD2.

**Gap closures:**
- GAP-011 (KEWB error code catalog): **Substantially closed** — full alarm catalog obtained.
- GAP-010 (stage fault codes): **Partially closed** — limit switch alarm not yet in this file (see Review Notes).

**Dense RAG:** Not yet ingested. Requires XML-to-prose conversion in ingest-corpus.ts.

---

## Complete Alarm Catalog

All 8 alarms defined in the deployed HD2 configuration:

| Alarm Name | Severity | Severity Name | Trigger Condition |
|---|---|---|---|
| Bubbler Temperature Too Low | **3 — Critical** | Triggers message box | BUB_HEAT_Temp > BUB_HEAT_SetPoint − 2 |
| Bubbler Temperature Too High | 2 — Error | Triggers message box | BUB_HEAT_Temp < BUB_HEAT_SetPoint + 2 |
| Pneumatic Atomizer Temperature Too Low | 2 — Error | Triggers message box | PA_HEAT_Temp > PA_HEAT_SetPoint − 2 |
| Pneumatic Atomizer Temperature Too High | 2 — Error | Triggers message box | PA_HEAT_Temp < PA_HEAT_SetPoint + 2 |
| Ultrasonic Atomizer Temperature Too Low | 2 — Error | Triggers message box | UA_HEAT_Temp > UA_HEAT_SetPoint − 2 |
| Ultrasonic Atomizer Temperature Too High | 2 — Error | Triggers message box | UA_HEAT_Temp < UA_HEAT_SetPoint + 2 |
| Panels Removed | 2 — Error | Generic "alarm was triggered" | Physical safety panel sensor |
| Atomizer Pressure High | 2 — Error | Triggers message box | (condition variable not shown in excerpt) |

**Severity scale:** 0 = Information, 1 = Warning (Yellow), 2 = Error (Orange), 3 = Critical (Red)

---

## Node Extraction Candidates

### 1. FAULT-BUBBLER-TEMP-LOW-001
**Type:** FailureMode  
**Target file:** `src/corpus/ajp/design-faults.ts`  
**Alarm severity:** Critical (3) — highest severity in the system

**What to capture:** BUB_HEAT temperature dropped more than 2 °C below setpoint. This is Critical because the bubbler temperature directly affects ink viscosity and aerosolization quality — if too cold, ink may not atomize correctly, leading to process instability. Recovery: check bubbler heater connection, wait for temperature to restabilize before continuing.

**Link:** INDICATES → FAULT-WEAK-ATOMIZATION-001 (cold bubbler → poor atomization)

---

### 2. FAULT-BUBBLER-TEMP-HIGH-001
**Type:** FailureMode  
**Target file:** `src/corpus/ajp/design-faults.ts`  
**Alarm severity:** Error (2)

**What to capture:** BUB_HEAT temperature exceeded setpoint by more than 2 °C. Less critical than too-low (ink still atomizes) but excess heat accelerates solvent evaporation and can alter ink viscosity during the run. Recovery: allow to stabilize, reduce bubbler setpoint if persistent.

---

### 3. FAULT-UA-TEMP-LOW-001 / FAULT-UA-TEMP-HIGH-001
**Type:** FailureMode  
**Target file:** `src/corpus/ajp/design-faults.ts`  
**Alarm severity:** Error (2) for both

**What to capture:** UA_HEAT (Ultrasonic Atomizer heater) out of tolerance (±2 °C of setpoint). UA temperature affects transducer efficiency and ink droplet formation. Typical recovery: acknowledge alarm in KEWB Alarms panel, wait for temperature recovery; if persistent, check HEATER_EN digital output state.

---

### 4. FAULT-PANELS-REMOVED-001
**Type:** SafetyHazard  
**Target file:** `src/corpus/ajp/design-faults.ts`  
**Alarm severity:** Error (2)

**What to capture:** Physical safety panel or door sensor triggered. KEWB fires this alarm when panels are removed during operation — this is a safety interlock. The system should pause. Recovery: close/replace panels, acknowledge alarm. CRITICAL: If panels are removed while aerosol is active, nanoparticle exposure risk is present. Do not attempt to re-enter until ventilation has cleared the chamber.

**safetyAlert:** "Do not re-enter the print area until panels are replaced and KEWB alarm is acknowledged — nanoparticle aerosol exposure risk."

---

### 5. FAULT-ATOMIZER-PRESSURE-HIGH-001
**Type:** FailureMode  
**Target file:** `src/corpus/ajp/design-faults.ts`  
**Alarm severity:** Error (2)

**What to capture:** ATM_MFC pressure exceeds a configured threshold. This is distinct from KEWB's pressure display rising due to a developing clog — this alarm fires when system-level pressure exceeds a safety threshold. Recovery: reduce ATM_MFC setpoint, check for nozzle or mist tube blockage before continuing. Do not increase pressure to compensate — pressure buildup is a nozzle-damage risk.

---

## Review Notes

- The 8 alarms listed here are all that are defined in the deployed Alarms.xml. This does NOT mean these are the only error conditions — stage homing failures, vision system errors, and recipe errors produce KEWB dialog boxes without being registered as Alarm entries. GAP-010 (stage fault codes) is not fully addressed by this file.
- PA temperature alarms (Pneumatic Atomizer Too Low/High) are present in this config even though the deployed system uses UA (Ultrasonic) atomization. This suggests the config was not cleaned up for the deployed configuration, OR the system supports both atomizer types. Confirm with operator.
- All alarms are marked `<Enabled>false</Enabled>` in the XML. This may mean they require an engineer-level login to activate. Confirm whether these alarms are actually active during normal operation.
