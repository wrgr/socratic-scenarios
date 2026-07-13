# Document 04: Assembly and Maintenance — What Experienced Hands Feel
## Tacit Knowledge Corpus · HD2 AJP Training System

**Purpose:** The physical manipulation of HD2 components during assembly, cleaning, and maintenance involves tactile, visual, and procedural knowledge that SOPs describe only partially. This document captures the embodied knowledge layer — what proper assembly feels like, what novices consistently get wrong, and where errors that cause problems during printing actually originate.

**Node type:** TacitKnowledge (subtype: EmbodiedProcedural)  
**Retrieval role:** Scenario Narrator descriptions of assembly feedback; Socratic probe enrichment for procedural steps; Pre-print checklist verification

---

## SECTION 1: PRINTHEAD ASSEMBLY — THE CRITICAL SEATING CHECKS

### 1.1 O-Ring Inspection and Greasing

**The written step:** Inspect O-rings; apply thin layer of Apiezon L grease; reassemble.

**What novices do wrong:**

*Under-greasing:* The O-ring looks slightly shiny but is not uniformly coated. Dry patches exist that are not visible under typical shop lighting. Under-greased O-rings seat properly initially but may allow micro-leaks under operating pressure, causing pressure anomalies that look like gas system faults.

*Over-greasing:* A visible bead of grease on the O-ring surface. Excess grease migrates into the ink or gas path during assembly. Grease in the ink path contaminates the ink. Grease in the gas path can leave deposits that attract ink particles, becoming nucleation sites for clogs.

**The correct amount — what it looks, feels, and behaves like:**
- Visual: O-ring is uniformly shiny with no dry patches; no visible excess ridge or bead of grease
- Touch: Running a clean fingertip around the O-ring leaves a thin film but no smear that wipes off thickly
- Behavior: When the component is assembled and the fitting is tightened, you do not feel grease squelching or see grease extruding from the joint

**The inspection protocol:** After greasing, visually inspect from two angles (90° apart). Look for any areas where the sheen is inconsistent. If you see dry patches, add a minimal amount with a toothpick and redistribute.

**O-ring condition inspection (before greasing):**
- Squeeze gently between two fingers — it should return to round immediately. If it retains the pinch shape, it is hardened and must be replaced.
- Check for cuts, nicks, or flat sections along the circumference. A clean O-ring is a perfectly smooth torus.
- Check diameter consistency — a swollen or shrunken O-ring has been chemically attacked by incompatible fluids. Replace.

**O-ring replacement trigger:** Any O-ring that has been exposed to acetone (common cleaning agent) must be inspected immediately after. Acetone attacks some elastomer formulations. If in doubt, replace.

---

### 1.2 Nozzle Installation

**The written step:** Thread nozzle into printhead body; tighten.

**What novices do wrong:**

*Cross-threading:* The nozzle has fine threads. If started at a slight angle, the threads can cross-engage. A cross-threaded nozzle feels like it is tightening at first, then suddenly becomes difficult. If forced past this point, the threads are damaged — the printhead or the nozzle may need replacement.

*The test for cross-threading:* Before applying any torque, rotate the nozzle counterclockwise (backward) until you feel and hear a slight click — this is the threads engaging at their starting position. Then rotate clockwise. If the nozzle begins threading smoothly from the start position without resistance, it is correctly threaded.

*Over-tightening:* The nozzle is ceramic. It does not need to be torqued like a metal fitting. "Finger tight plus 1/8 turn" is the correct standard — the seal is made by the O-ring, not by clamping the nozzle body. Over-tightening can crack the ceramic or damage the seat.

*Under-tightening:* A nozzle that is too loose will allow gas to bypass the nozzle O-ring rather than passing through the orifice — you will get low or zero pressure despite the gas system being on, and the nozzle will not be secured.

**The correct feel:** A properly installed nozzle has no wobble when gently rocked side-to-side. It is flush with or slightly recessed into the printhead face. It cannot be rotated by hand after installation.

---

### 1.3 Ink Jar / Vial Loading — PA vs. UA Differences

**PA (pneumatic atomizer) — jar loading:**
- Fill level: 0.5–2.5 mL of ink (SRC-018). The jet tube must be above the ink surface by approximately 15mm (SRC-019 Section 4.3).
- The novice error: overfilling. With the jet tube submerged in ink, the atomizer generates no aerosol — it just bubbles through the liquid. The symptom is zero KEWB carrier pressure despite atomizer gas flowing.
- Verification: after filling, visually confirm the jet tube tip is clearly above the ink surface. Hold the jar up to the light if necessary.
- Seal check: when the jar lid is tightened, there should be a slight resistance at the final turn as the O-ring compresses. A jar that tightens with no resistance has a missing or improperly seated O-ring.

**UA (ultrasonic atomizer) — vial loading:**
- Fill level: approximately 30 mL (SRC-019 Section 4.3). Underfilling is the risk here — the transducer must be in contact with the ink through the vial wall.
- Vial seating: the vial must sit squarely in the transducer cradle. A vial that is canted to one side has poor acoustic coupling, which reduces atomization efficiency and can make the UA sound irregular (auditory diagnostic signal).
- Verify seating by pressing gently down on the vial top — it should not shift or rock. If it rocks, reseat it.

---

## SECTION 2: CLEANING — WHERE MOST RECURRING CLOGS ORIGINATE

### 2.1 The Cleaning Protocol Hierarchy

The most common source of persistent clog problems is incomplete cleaning. Operators who cut cleaning short end up with residue that dries in place and becomes the nucleus for the next session's clog.

**Full cleaning sequence (SRC-018, SRC-019):**
1. DI water flush
2. Branson IS solution (11:1 water dilution) — minimum 4 hours soak
3. IPA rinse
4. Air dry or nitrogen blow-out

**The elements novices skip or shorten:**

*The 4-hour soak:* This is not approximate. Branson IS is a laboratory detergent / ultrasonic cleaning fluid. Its surfactant action requires time to penetrate and loosen dried Ag NP residue. A 30-minute soak leaves residue. A 4-hour soak is the minimum effective duration for significant clog material.

*The IPA rinse:* Some operators skip this, thinking "water rinsed it clean enough." IPA removes water-soluble Branson IS residue AND has faster evaporation, reducing moisture in the assembly for the next use. Skipping leaves surfactant residue that can affect ink behavior.

*Nitrogen blow-out:* If available, a brief nitrogen blow through the nozzle and tubing after IPA rinsing removes the final rinse fluid and ensures the path is clear. If not available, extended air drying (overnight) achieves similar results.

**The expert practice:** Clean at the end of every session. Do not leave dried ink in the system to "clean next time." Dried Ag NP ink is substantially harder to clean than wet or recently dried ink.

---

### 2.2 Sonication — The Most Misunderstood Cleaning Step

**What sonication is:** The Branson IS cleaning solution is typically used in conjunction with an ultrasonic bath. The sonic energy breaks up dried ink deposits at the micro level, allowing the surfactant to penetrate and carry them away.

**What novices get wrong:**

*Putting assembled components in the ultrasonic bath:* O-rings should be removed before sonication. Sonic energy can degrade elastomers. Nozzles should be disassembled from the printhead.

*Not confirming the ultrasonic bath is working:* Place a small piece of aluminum foil in the bath and run it — a working ultrasonic bath will rapidly pit and perforate the foil. If the foil emerges intact, the bath transducers are not functioning and sonication is not occurring.

*Temperature of the bath:* Room temperature ultrasonic cleaning works but is slower. A bath at 40-50°C significantly accelerates the cleaning action for Ag NP inks. Many labs allow the bath to heat during the soak period.

*Post-sonication inspection:* After the full cleaning sequence, inspect the nozzle orifice under magnification. If you can still see residue after the full protocol, repeat the soak — do not try to mechanically clear the orifice. Mechanical probing can damage the ceramic.

---

### 2.3 The PFA Tubing Replacement Judgment

**When to replace PFA tubing:**
- Visible yellowing or discoloration (PFA should be nearly transparent; discoloration indicates chemical attack or aging)
- Any kinks or permanent bends from routing — kinked PFA creates flow restriction
- Any tube that was cut at an angle and installed (even temporarily)
- Any tube where the cut end shows deformation or crushing from a fitting

**The novice tendency:** Use the same tubing for as long as possible because replacement feels like unnecessary work. The cost of a bad tube (partial flow restriction, variable pressure readings, potential leak) is much higher than replacement cost.

**The expert practice:** Inspect tubing at every cleaning session. Replace at the first sign of discoloration or mechanical damage. PFA tubing is inexpensive relative to the cost of a failed print on an actual PCB.

---

## SECTION 3: PRE-PRINT CHECKLIST — THE EXPERT'S MENTAL MODEL

Experienced operators do not rely on memory for pre-print checks. They have internalized a sequence, but experts also recommend a written checklist for any high-stakes operation. The following represents the expert's pre-print mental sweep.

### 3.1 The Seven-Zone Pre-Print Check

**Zone 1 — Ink:**
- Correct ink for this application? (Ag NP for conductivity restoration)
- Ink condition checked (visual inspection, no agglomeration, color correct)?
- Appropriate fill level for PA or UA?

**Zone 2 — Assembly:**
- All O-rings present and greased?
- Nozzle correctly installed (no cross-threading, no wobble)?
- All fittings finger-tight or tightened per protocol?
- PFA tubing correctly cut, correctly inserted, omnilock secured?

**Zone 3 — Gas System:**
- Gas lines connected to correct ports?
- KEWB showing expected pre-flow readings (should be at background before any gas is on)?

**Zone 4 — Stage and Substrate:**
- PCB correctly fixtured (will not move during print)?
- Substrate cleaned immediately before mounting (IPA wipe, no handling of print area)?
- Z height (standoff) set using slide stack?

**Zone 5 — Toolpath:**
- KEWB toolpath verified on correct layer?
- Print path checked for correct start/stop positions relative to PCB trace?
- Alignment verified against reference marks?

**Zone 6 — Safety:**
- Ventilation/exhaust confirmed active?
- Lab access restricted if required by local protocol?
- PPE available (gloves, eye protection)?

**Zone 7 — Abort Plan:**
- Know where the emergency stop is?
- Have a sacrificial substrate ready for test lines?
- Know who to call if the system needs emergency shutdown?

**The expert habit:** This sweep takes approximately 2 minutes when internalized. It is done silently, systematically, before touching KEWB. The novice who skips this sweep is the novice who realizes mid-print that the tubing is disconnected or the ink is from the wrong lot.

---

## SECTION 4: MAINTENANCE KNOWLEDGE THAT IS RARELY DOCUMENTED

### 4.1 The "Cold Nozzle" Problem

**The phenomenon:** In environments below 65°F, ink viscosity increases. The nozzle tip can accumulate ink residue faster than in warmer conditions because the ink does not flow as freely off the tip between depositions.

**Observation:** Blob formation at the nozzle tip occurs earlier in a print run than expected; KEWB pressure begins rising sooner than the expected clog timeline.

**Mitigation:** Allow the system to warm up in the operating environment before printing. Some operators warm the ink vial gently (between palms, or in a warm water bath at < 30°C) before loading.

**Never:** Apply direct heat to the nozzle or printhead. Thermal shock to the ceramic is a cracking risk.

### 4.2 The Printhead Gasket Wear Indicator

**What to watch for:** If the printhead body shows any visible gap or unevenness at the junction between the upper and lower sections when assembled and tightened, the gasket is worn or improperly seated.

**Symptom in operation:** Intermittent pressure anomalies that don't match any tubing or nozzle fault; occasional gas bypass.

**Action:** Disassemble, inspect gasket, replace if compressed or deformed.

### 4.3 Atomizer Jet Tube Positioning — The Recurring Reset

**The known issue:** The PA atomizer jet tube is positioned during assembly and is intended to stay in position. In practice, it can shift slightly between sessions, particularly if the jar is handled roughly.

**Effect:** Jet tube submerged in ink → no atomization (diagnosis is immediate). Jet tube too high above ink → reduced atomization efficiency (slower deposition rate, may be mistaken for other faults).

**Verification:** At every session startup, confirm jet tube height visually before loading ink. The standard is approximately 15mm above the bottom of the jar interior (or the level at which the tube tip clears the nominal ink surface at normal fill volume).

---

## Source Provenance

| Content | Sources | Confidence |
|---|---|---|
| O-ring greasing technique | SRC-018 Section 4.1, SRC-019 Section 1.3 | High |
| O-ring condition inspection | SRC-018 | Medium-High |
| Nozzle cross-threading check | InferredFromDomain (standard threaded fitting practice) | High |
| PA jar fill level and jet tube | SRC-019 Section 4.3, SRC-018 | High |
| UA vial fill level | SRC-019 Section 4.3 | High |
| Cleaning protocol (water → Branson → IPA) | SRC-018 Section 11, SRC-019 Section 7 | High |
| 4-hour minimum soak | SRC-018 | High |
| Sonication O-ring removal | InferredFromDomain (standard ultrasonic cleaning practice) | High |
| PFA tubing replacement indicators | InferredFromDomain | Medium |
| Cold nozzle phenomenon | InferredFromDomain | Medium |
| Jet tube positioning | SRC-019 Section 4.3 | Medium-High |
