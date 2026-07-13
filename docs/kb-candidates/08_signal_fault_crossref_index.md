# Document 08: Process Signal Cross-Reference Index
## Observable → Fault Node → Corrective Action → Socratic Probe Mapping
## Tacit Knowledge Corpus · HD2 AJP Training System

**Purpose:** A complete cross-reference table mapping every observable process signal to its candidate fault nodes, likely parameter adjustments, associated Socratic probes, and graph traversal path. This is a navigation aid for the knowledge graph and a retrieval optimization document — enabling the In-Operation mode to surface the correct causal chain given a symptom description, and the Socratic mode to probe the correct knowledge component.

**Node type:** CrossReferenceIndex (meta-document for retrieval routing)  
**Retrieval role:** In-Operation mode symptom-to-fault routing; Socratic probe selection; Scenario fault injection reference

---

## INDEX 1: VISUAL SIGNALS → FAULT NODES

### 1.1 Plume / Nozzle Output Signals

| What the operator observes | Candidate fault node(s) | Priority order | Parameter to check first |
|---|---|---|---|
| No visible plume; KEWB gas flows present | FAULT-CLOG-FULL-001 | 1 | KEWB carrier pressure (very elevated or freeze) |
| Very narrow plume, trace is thin and faint | FAULT-GAS-SHEATH-HIGH-001 | 1 | KEWB sheath pressure |
| Wide, diffuse plume; overspray halo | FAULT-GAS-SHEATH-LOW-001 | 1 | KEWB sheath pressure (below nominal) |
| Wide plume with discrete satellite droplets | FAULT-GAS-CARRIER-EXCESS-001 | 1 | KEWB ATM pressure (PA); reduce carrier gas |
| Plume flickering / intermittent | FAULT-ATOMIZATION-INTERMITTENT-001 | 1 | KEWB pressure spikes; ink level (UA vial) |
| Plume offset to one side | FAULT-NOZZLE-DAMAGE-001 | 1 | Nozzle tip inspection under magnification |
| Blob accumulating on nozzle tip | FAULT-BLOB-FORMATION-001 | 1 | Sheath/carrier ratio; print speed vs. deposition rate |

### 1.2 Deposited Line Quality Signals

| What the operator observes | Candidate fault node(s) | Discrimination question | Primary fix |
|---|---|---|---|
| Line wider than expected, consistent width, soft edges | FAULT-GAS-SHEATH-LOW-001 | Is KEWB sheath below nominal? | Increase sheath gas |
| Line wider than expected, consistent width, discrete overspray | FAULT-GAS-CARRIER-EXCESS-001 | Is ATM elevated? Is carrier above nominal? | Reduce carrier gas |
| Line wider than expected, pileup at corners | Speed too slow (no named fault node — parameter issue) | Is print speed below nominal? | Increase print speed |
| Line narrow and thin, regular shape, no gaps | Speed too fast / atomizer flow too low | Is carrier/UA below nominal? | Increase flow or decrease speed |
| Line narrow and thin, irregular shape, gaps | FAULT-CLOG-PARTIAL-001 | Is KEWB pressure elevated? | Abort; clean |
| Line intermittent with clean breaks | FAULT-CLOG-PARTIAL-001 or FAULT-ATOMIZATION-INTERMITTENT-001 | Pressure spike timing? | If spikes: abort. If no spikes: check atomizer flow and ink level |
| Line with holes / dewetting (ink pulls back) | FAULT-SUBSTRATE-ADHESION-001 | Is pattern independent of print direction? | Substrate cleaning and prep |
| Blob on trace, isolated | FAULT-BLOB-FORMATION-001 | Is blob at a direction change or mid-trace? | At direction change: tip accumulation. Mid-trace: developing clog |
| Lines good on sacrificial, poor on PCB | FAULT-SUBSTRATE-ADHESION-001 | Does pattern persist on cleaned area of PCB? | Substrate surface treatment |
| Line quality good at start, degrades over time | FAULT-CLOG-PARTIAL-001 or ink depletion | Is KEWB pressure rising over time? | Rising pressure → abort/clean. No pressure change → check ink level |
| Over-deposited trace (thick, elevated, may crack after sinter) | Speed too slow + flow too high | Is line width also excessive? | Reduce flow and increase speed together |

### 1.3 PA Jar Wall Signals

| What operator sees on jar walls | Interpretation | Action |
|---|---|---|
| Fine uniform droplets, rapid and continuous | Healthy atomization | No action |
| No droplets on walls | No atomization | Check: jet tube above ink? Gas flowing? Clog? |
| Droplets appear then stop, cycling | Intermittent atomization | Watch KEWB; check stirrer function; consider aborting |
| Heavy droplet accumulation, walls very wet | Atomizer flow too high, or ink too low (all available ink being aerosolized fast) | Check ATM; check ink level; reduce atomizer flow |
| Droplets only in one area | Asymmetric atomization | Check jet tube centering |
| Large blobs on walls rather than fine droplets | Ink too viscous for current conditions | Check ink temperature; check ink age/condition |

### 1.4 Post-Sinter Visual Signals

| What operator sees after sintering | Interpretation | Action |
|---|---|---|
| Bright metallic silver, smooth, adherent | Good sinter | Measure resistance; if passes, complete |
| Matte or powdery surface | Insufficient sintering | Re-sinter if substrate allows; or reprint |
| Dark patches within metallic trace | Incomplete binder removal at those points | Extended re-sinter attempt; if persistent, reprint |
| Fine transverse cracks | Thermal stress during heating; ramp too fast | Measure resistance; may still pass. Reprint with slower ramp |
| Trace delaminated from substrate | Adhesion failure during sinter | Reprint; investigate substrate condition and ink-substrate compatibility |
| PCB discoloration adjacent to trace | Substrate thermal damage | Do not re-sinter; assess component damage; escalate |
| Trace looks good but resistance >> expected | Incomplete interior sintering; or thickness/geometry issue | Extended re-sinter; if no improvement, reprint |

---

## INDEX 2: KEWB DISPLAY SIGNALS → FAULT NODES

### 2.1 Pressure Signals

| KEWB display reading | Interpretation | Fault node | Action |
|---|---|---|---|
| Sheath pressure below nominal for nozzle/elevation | Insufficient sheath gas; possible supply issue | FAULT-GAS-SHEATH-LOW-001 | Increase sheath in 1 sccm increments |
| Sheath pressure above nominal for nozzle/elevation | Possible nozzle clog creating backpressure, or supply issue | FAULT-GAS-SHEATH-HIGH-001 (precursor to FAULT-CLOG) | Check carrier pressure too; inspect nozzle |
| Carrier pressure stable, at nominal | Healthy system | No fault | No action |
| Carrier pressure rising gradually | Partial clog developing | FAULT-CLOG-PARTIAL-001 | Monitor rate; abort if continues |
| Carrier pressure stable then sudden large rise | Full or near-full clog | FAULT-CLOG-FULL-001 | Abort immediately |
| Carrier pressure spiking then recovering | Blob/slug passing; intermittent partial clog | FAULT-BLOB-FORMATION-001 or FAULT-CLOG-PARTIAL-001 | Watch frequency of spikes; abort if increasing |
| Carrier pressure below nominal | Possible gas leak; supply issue | FAULT-GAS-FLOW-LOW-001 | Check all fittings; check supply pressure |
| KEWB display frozen / not updating | KEWB software fault | FAULT-SOFTWARE-KEWB-001 | Save current state if possible; restart KEWB per protocol |
| ATM pressure approaching 5 PSI (PA) | Excess atomizer pressure | FAULT-ATM-PRESSURE-HIGH-001 | Reduce atomizer gas immediately |
| ATM pressure at or exceeding 5 PSI | Dangerous overpressure | FAULT-ATM-PRESSURE-HIGH-001 (critical) | Abort immediately; reduce atomizer gas |

### 2.2 Stage / Motion Signals

| KEWB display reading | Interpretation | Action |
|---|---|---|
| Stage not responding to jog commands | Stage fault; connection issue | FAULT-STAGE-001 — check connection; restart KEWB |
| Stage moving but position readout not updating | Encoder fault or display issue | Stop print; diagnose before continuing |
| Stage at wrong Z height vs. expected | Z drift; or initial Z not set correctly | Re-verify Z height with slide stack; re-home if necessary |

---

## INDEX 3: AUDITORY SIGNALS → FAULT NODES

| Sound characteristic | Machine component | Interpretation | Action |
|---|---|---|---|
| Steady high-pitched tone | UA (ultrasonic atomizer) | Normal operation | No action |
| Tone becomes intermittent or pulsing | UA | Ink level critically low | Check vial; refill or replace |
| Tone pitch rises | UA | Ink level dropping | Monitor; prepare to refill |
| Irregular rattling sound | UA | Vial seated incorrectly; possible gasket issue | Stop UA; reseat vial; check gasket |
| Tone disappears (power on) | UA | Power below activation threshold | Increase UA power incrementally |
| Any sharp crack or pop from machine | Any | Possible fitting failure or tubing disconnection | Stop operation immediately; inspect all connections |
| Hissing sound from printhead area | Printhead | Gas leak at fitting or O-ring | Stop; locate and address leak before continuing |

---

## INDEX 4: TACTILE / FEEL SIGNALS → DIAGNOSTIC NODES

| What operator feels | During which step | Interpretation | Action |
|---|---|---|---|
| Nozzle rotates freely but doesn't tighten | Nozzle installation | Cross-threading | Back out completely; restart threading from click position |
| Nozzle seats with no resistance | Nozzle installation | Missing O-ring or seat damaged | Check O-ring; inspect seat |
| Jar lid tightens with no final resistance | PA jar assembly | O-ring missing or unseated | Disassemble; check O-ring |
| PFA tube can be pulled out of fitting | Tubing insertion | Not fully inserted; omnilock not engaged | Reinsert fully; engage omnilock; re-test pull |
| O-ring does not return to round when pinched | O-ring inspection | Hardened/aged O-ring | Replace O-ring |
| O-ring shows resistance in assembly then pops out | O-ring installation | O-ring too large for this application, or seat damaged | Check O-ring size; inspect seat |

---

## INDEX 5: SOCRATIC PROBE ROUTING TABLE

For each knowledge domain, the probes that must be passed and the node they target:

### Gas System Probes

| Probe question (abbreviated) | Bloom level | Target KC | Safety-critical? | Gate threshold |
|---|---|---|---|---|
| Correct startup gas sequence | L1 Recall | PROC-STARTUP-GAS-001 | YES | 0.90 |
| Correct shutdown sequence + wait times | L1 Recall | PROC-SHUTDOWN-GAS-001 | YES | 0.90 |
| High pressure means obstruction, not flow | L2 Comprehension | TACIT-KEWB-PRESSURE-READ-001 | YES | 0.90 |
| ATM pressure limit (PA) | L1 Recall | PARAM-ATM-LIMIT-001 | YES | 0.90 |
| Why startup order matters | L2 Comprehension | PROC-STARTUP-GAS-001 rationale | NO | 0.85 |
| Focus ratio concept | L3 Application | PARAM-FOCUS-RATIO-001 | NO | 0.85 |

### Fault Diagnosis Probes

| Probe question (abbreviated) | Bloom level | Target KC | Safety-critical? | Gate threshold |
|---|---|---|---|---|
| Wide line — name 3 possible causes | L3 Application | FAULT-GAS-SHEATH-LOW-001, FAULT-GAS-CARRIER-EXCESS-001 | NO | 0.85 |
| Narrow intermittent line — clog vs. flow | L4 Analysis | FAULT-CLOG-PARTIAL-001 discrimination | NO | 0.85 |
| Single-change rule explanation | L2 Comprehension | TACIT-DIAGNOSIS-SINGLE-CHANGE-001 | NO | 0.85 |
| Substrate problem vs. print parameter problem | L4 Analysis | FAULT-SUBSTRATE-ADHESION-001 discrimination | NO | 0.85 |

### Tacit Knowledge Probes

| Probe question (abbreviated) | Bloom level | Target KC | Safety-critical? | Gate threshold |
|---|---|---|---|---|
| Describe healthy PA jar wall pattern | L1 Recall (perceptual) | TACIT-ATOMIZATION-VISUAL-PA-001 | NO | 0.85 |
| Describe 5-state line quality reference | L2 Comprehension | TACIT-LINE-QUALITY-REFERENCE-001 | NO | 0.85 |
| KEWB trend vs. point value — which matters more? | L2 Comprehension | TACIT-KEWB-PRESSURE-READ-001 | YES | 0.90 |
| Abort decision criteria — name the 3 abort-immediately conditions | L3 Application | TACIT-ABORT-DECISION-001 | YES | 0.90 |

### Sintering Probes

| Probe question (abbreviated) | Bloom level | Target KC | Safety-critical? | Gate threshold |
|---|---|---|---|---|
| Why is sintering necessary (mechanism) | L2 Comprehension | PROC-SINTER-001 | NO | 0.85 |
| How does substrate type affect sintering temperature decision | L4 Analysis | TACIT-SINTER-SUBSTRATE-LIMIT-001 | NO | 0.85 |
| What does post-sinter cracking indicate | L4 Analysis | TACIT-POST-SINTER-INSPECT-001 | NO | 0.85 |
| Resistance measurement — pass/fail thresholds | L3 Application | TACIT-SINTER-RESISTANCE-001 | NO | 0.85 |

---

## INDEX 6: SCENARIO FAULT INJECTION REFERENCE TABLE

For Scenario mode fault injection — mapping fault IDs to observable signals, correct detection point, and consequence if undetected.

| Fault injected | Scenario step of injection | First observable signal | Correct detection action | Consequence if missed |
|---|---|---|---|---|
| FAULT-CLOG-PARTIAL-001 | Print start + 5 min | KEWB carrier rising from nominal | Abort when pressure exceeds nominal + 15%; disassemble and clean | Clog worsens → full clog → blob on PCB trace → rework or loss of PCB |
| FAULT-CLOG-FULL-001 | Print start + 2 min | KEWB carrier very elevated; no line depositing | Abort immediately | Continued printing → pressure damages fittings; nozzle fully blocked |
| FAULT-GAS-SHEATH-LOW-001 | At setup (sheath set below nominal) | First test line → wide with halo | Check KEWB sheath; increase sheath; re-tune | Overspray contaminates adjacent PCB traces; electrical shorts |
| FAULT-BLOB-FORMATION-001 | Print + 10 min | KEWB pressure spike + blob visible on trace | Stop print; inspect nozzle; wipe; resume if pressure normalizes | Blob deposited on trace → excess material; possible short to adjacent trace |
| FAULT-SUBSTRATE-ADHESION-001 | First trace on PCB | Gaps and dewetting visible on trace | Recognize as substrate problem (not print parameter); clean substrate | Repeated parameter adjustment without effect; wasted time; may damage PCB from unnecessary rework |
| FAULT-ATOMIZATION-INTERMITTENT-001 | Print + 3 min | UA tone irregular; KEWB intermittent; intermittent trace | Check UA vial level; refill; if pattern persists, abort and check atomizer | Intermittent trace; incomplete repair; may pass visual but fail electrical |
| FAULT-WRONG-GAS-SEQUENCE-001 | Startup | Blob/burst on first print attempt | Recognize startup sequence was wrong; abort; re-start sequence correctly | Damaged trace on first line; potential nozzle contamination |

---

## INDEX 7: KNOWLEDGE GAP FLAGS FOR RETRIEVAL SYSTEM

When the system encounters queries in these areas, it should flag a GAP condition and recommend reachback to a human expert rather than generating a confident answer:

| Query domain | Gap ID | Gap description | Recommended action |
|---|---|---|---|
| Sheath pressure for specific nozzle size at elevation | GAP-003/015 | Pressure table for HD2 not publicly confirmed | Recommend photographing table from machine PC |
| KEWB-specific error codes | GAP-011 | Error code catalog not in public SOPs | Refer to HD2 Operator Manual if available |
| Stage-specific fault codes | GAP-010 | Stage fault codes not confirmed | Refer to HD2 Operator Manual |
| Ink-specific dilution ratios | GAP-013 | Manufacturer-specific; varies by lot | Consult ink manufacturer datasheet |
| Specific ink SDS / health data | GAP-014 | Must obtain before use | Mandatory before first use of any new ink |
| Vision system specifications | GAP-012 | Not in public SOPs | HD2 Operator Manual |

**Retrieval rule:** Any In-Operation query that requires information from a GAP-flagged domain must be answered with:
1. The best available approximate answer (if a reasonable estimate exists)
2. An explicit GAP flag: "NOTE: This information is not confirmed in the training corpus for your specific machine configuration. Verify before acting."
3. The recommended source for the authoritative answer

---

## Source Provenance

This cross-reference index is derived from:
- Knowledge Registry v1.1 (fault node IDs, symptom-fault-action chains)
- Documents 01-05 of this tacit knowledge corpus (signal descriptions)
- SRC-018 (Stanford SNF Manual), SRC-019 (Boise State SOP) — symptom tables and troubleshooting sections
- Peer literature: Islam 2025, Smith 2017, Zhang 2024, Rurup 2024 — parameter relationships and defect classification
- InferredFromDomain synthesis (for entries not directly sourced)

Entries marked as InferredFromDomain should be verified against actual HD2 operator experience via the elicitation protocol in Document 07.
