# Document 03: Gas System — The Counterintuitive Rules and Why Novices Get It Wrong
## Tacit Knowledge Corpus · HD2 AJP Training System

**Purpose:** The gas system is the most procedurally critical and most counterintuitively behaving subsystem in the HD2. This document isolates the tacit knowledge layer of gas system operation: the rules that are not in the SOP, the mistakes that seem logical but aren't, and the judgment calls that define expert operation.

**Node type:** TacitKnowledge (subtype: ProceduralJudgment + SafetyRationale)  
**Retrieval role:** Mandatory co-retrieval with all gas system Step nodes; Socratic probe enrichment; Safety gate verification

---

## SECTION 1: THE GAS SEQUENCE — WHY THE ORDER IS NOT ARBITRARY

### 1.1 The Startup Sequence and the Reasoning Behind It

**The prescribed order (SRC-018, SRC-019):** Exhaust ON → Sheath ON → Atomizer ON

**What novices think:** "These gases all flow through the same system, so the order shouldn't matter much."

**What actually happens if you get it wrong:**

**Error: Atomizer before sheath**
The atomizer generates aerosol immediately. Without sheath gas flowing, the aerosol is not focused — it disperses broadly through the printhead rather than being collimated toward the nozzle. Two consequences: (1) unfocused aerosol can deposit on internal printhead surfaces, contributing to buildup and eventual clogs; (2) when sheath gas is then activated, you have a slug of undispersed aerosol that flushes unpredictably toward the nozzle. This produces an initial blob or burst on the first print attempt.

**Error: Sheath before exhaust**
The sheath gas pressurizes the printhead before the exhaust system is carrying away displaced air. This creates a brief positive pressure inside the printhead that can push aerosol back through the atomizer path in the opposite direction — forcing ink droplets into the carrier gas tubing. This is rare in practice but possible, and it contributes to ink contamination of gas lines over time.

**Error: All gases simultaneously**
Unpredictable transient effects from multiple flow systems starting at once. The relative pressures during startup transients are not controlled. Empirically, experienced operators report more variable initial line quality with simultaneous startup.

**The correct mental model:** Think of the gas system as a wind tunnel. The exhaust system creates the low-pressure downstream end. The sheath creates the focusing flow. The atomizer then injects material into an already-stable aerodynamic environment. Starting in sequence ensures each stage is stable before the next introduces its variable.

---

### 1.2 The Shutdown Sequence — The Purge Logic

**The prescribed order:** Atomizer OFF → wait 10 seconds → Exhaust OFF → wait 60 seconds → Sheath OFF

**Why not just turn everything off at once?**

The 10-second wait after atomizer OFF allows the carrier gas to sweep remaining aerosol from the mist tube through the printhead and out the nozzle (or into the exhaust). If exhaust is turned off while aerosol is still in the system, that aerosol settles and dries inside the printhead — contributing to next-session clogs.

The 60-second wait between exhaust OFF and sheath OFF allows the sheath gas to continue flowing (flushing and drying the nozzle path) while the exhaust system winds down. Turning sheath off immediately after exhaust removes this flush period.

**The consequence of skipping:** Operators who routinely skip the shutdown waits report higher rates of startup clogs in subsequent sessions. The connection is not always obvious — the clog appears tomorrow, not today.

**The expert practice:** Set a timer. Don't try to estimate 10 or 60 seconds by feel. In the middle of post-print cleanup, time estimation is unreliable.

---

## SECTION 2: PRESSURE RELATIONSHIPS — WHAT THE NUMBERS ACTUALLY MEAN

### 2.1 The Sheath-to-Carrier Ratio (Focus Ratio)

**What it is:** The relationship between sheath gas flow rate and carrier/atomizer gas flow rate determines the degree of aerosol focusing. This is called the "focus ratio" in peer literature (Smith 2017, Islam 2025).

**The principle:** More sheath relative to carrier → more focused beam → narrower line. Less sheath → less focused → wider line with more overspray.

**What novices get wrong:** They treat sheath and carrier as independent adjustments. They are not — they operate as a ratio. If you increase carrier gas (more ink throughput) without proportionally increasing sheath, the focus ratio drops and the line gets wider.

**The expert practice:** When adjusting carrier/atomizer flow for deposition rate, always check whether the sheath needs proportional adjustment. The focus ratio is the parameter you are actually managing, not the individual flow values.

**The quantitative range:** From peer literature (Islam 2025), optimal focus ratios for conductive line printing are typically in the range of 2–4 (sheath:carrier). Below 2, overspray becomes significant. Above 4, the beam is over-focused and deposition thins.

---

### 2.2 Elevation and Atmospheric Pressure Effects

**Why this matters for the HD2:** Sheath gas pressure must be calibrated for the ambient atmospheric pressure at the site of operation. The same nominal flow setting produces different effective focusing at different elevations.

**The principle:** At higher elevation, ambient pressure is lower. The pressure differential that drives gas flow is partially determined by ambient. At higher elevation, a given flow rate setting produces a somewhat different gas velocity and pressure profile at the nozzle.

**The practical consequence:** A sheath pressure setting that produces good line quality at sea level (standard lab conditions) may produce wider lines at 5,000 ft elevation. This is GAP-003/015 in the knowledge registry — the exact pressure table for elevation correction has not been publicly confirmed for the HD2, but the principle is established.

**The tacit rule:** If a machine is moved to a new facility, or if the operator is using the machine at a facility at significantly different elevation than where it was characterized, re-characterize sheath settings on sacrificial substrate before printing on the actual PCB. Do not assume parameters transfer.

---

### 2.3 Reading ATM Pressure — The PA-Specific Monitor

**What ATM pressure is:** The pressure inside the pneumatic atomizer jar. Distinct from sheath or carrier gas pressure.

**Nominal range:** Below 5 PSI for HD2 PA configuration.

**What causes ATM to rise:**
- Atomizer gas flow too high for the ink viscosity
- Partial occlusion downstream (impactor or nozzle) creating backpressure
- Ink temperature too low (higher viscosity → more resistance)

**What ATM elevation means in practice:** If ATM is approaching 5 PSI during printing, you are close to the condition where ink can be forced through the system in an uncontrolled manner, potentially flooding a trace or bursting a fitting.

**The expert response to elevated ATM:** Reduce atomizer gas flow first. If that doesn't bring ATM down, check for downstream partial clog (KEWB carrier pressure should be checked). Do not try to push through by increasing flow — this is exactly the wrong response.

**The expert monitor habit:** ATM is checked approximately every 2-3 minutes during a print run. It does not need constant monitoring (it's not the primary real-time signal), but it is a periodic sanity check.

---

## SECTION 3: GAS SYSTEM FAULTS — WHAT THEY FEEL LIKE IN REAL TIME

### 3.1 FAULT-GAS-SHEATH-LOW-001 (Insufficient Sheath)

**How it develops:** Sheath gas below nominal for nozzle/elevation. Can be caused by: incorrect setup, drift in flow controller, or elevation change.

**What the operator experiences:**
- Lines are wider than expected from the first print
- Overspray is visible around the trace — a soft halo rather than clean edges
- The plume on the process camera appears wider/less focused than expected
- KEWB sheath pressure reads below the nominal value for this nozzle

**The mistake operators make:** Interpret wide lines as "too much ink" → reduce atomizer flow → ink drops off but lines are still wide → now have under-deposited wide lines → confused.

**Correct diagnosis pathway:** Check sheath pressure in KEWB first. If it's low → increase sheath → re-tune on sacrificial substrate.

---

### 3.2 FAULT-GAS-CARRIER-EXCESS-001 (Excess Carrier Gas)

**How it develops:** Carrier gas (for PA) or atomizer gas set too high for the current ink and conditions.

**What the operator experiences:**
- ATM pressure elevated (PA configuration)
- Lines are wide with discrete overspray droplets (not just soft halo — individual satellite dots are visible)
- KEWB carrier pressure elevated
- Blob formation on nozzle tip occurs faster than normal

**The mechanism:** Excess carrier gas creates a high-velocity aerosol flow that is harder to focus with the sheath, and that exceeds the nozzle's ability to converge the stream. The droplets have too much momentum and spread.

**Correct diagnosis:** ATM elevated + discrete overspray → carrier too high. Reduce in 1 sccm increments, checking ATM and line quality after each adjustment.

---

### 3.3 FAULT-GAS-FLOW-RATE-MISMATCH-001 (Focus Ratio Out of Balance)

**How it develops:** Sheath and carrier set independently without maintaining focus ratio. Most commonly occurs after adjusting one gas for a different reason without adjusting the other.

**What the operator experiences:**
- Line quality was good, then changed after a parameter adjustment
- The change does not match the expected effect of the adjustment made

**Example:** Operator increased carrier flow to get more deposition. Lines got wider. Operator confused because "I increased carrier, not sheath, so why is focus affected?" Answer: because the focus ratio changed.

**Correct response:** After any carrier gas adjustment, check sheath and adjust proportionally to maintain focus ratio.

---

## SECTION 4: THE THINGS NOBODY TELLS YOU ABOUT THE GAS SYSTEM

### 4.1 Gas Line Conditioning — The First-of-Day Behavior

**The phenomenon:** When the system is started after a period of inactivity (overnight, or longer), the gas lines may contain residual dried ink particles or moisture. The first few minutes of operation can flush these through, causing transient print quality anomalies.

**What this looks like:** First 1-2 test lines show pressure spikes or irregular deposition; system then stabilizes and prints normally.

**The practice:** Always run at least 3-5 sacrificial test lines before printing on the actual substrate, particularly at the start of a session after any idle period. This is not just for parameter verification — it is for conditioning the gas lines.

### 4.2 The Tubing Flex Effect

**The phenomenon:** PFA tubing runs from the atomizer to the printhead. If this tubing has significant slack, movement of the stage can cause the tubing to flex — and the flexing can momentarily alter the gas/aerosol flow dynamics.

**What this looks like:** KEWB pressure shows small fluctuations that correlate with stage direction changes.

**The practice:** Ensure tubing routing is secure and has minimal slack. This is a setup issue that is worth checking if you see pressure fluctuations that correlate with stage motion.

### 4.3 The Gas Warm-Up Drift

**The phenomenon:** Flow controllers and gas line fittings have thermal mass. In a cold environment, gas flow rates may drift slightly as components warm up in the first 10-15 minutes of operation.

**What this looks like:** Print quality slowly improves over the first 10-15 minutes of a session even with no parameter changes.

**The practice:** In cold environments (below 65°F / 18°C), allow a warm-up period of at least 15 minutes before printing on actual substrates. This is separate from parameter tuning — it's physical thermal stabilization.

---

## SECTION 5: GAS SYSTEM SOCRATIC PROBE REFERENCE

**Mandatory Bloom Level 1 (Recall) probes — all learners must pass before operating:**

1. "What is the correct startup sequence for the HD2 gas system? Name the gases in order."  
   *Expected:* Exhaust → Sheath → Atomizer

2. "What is the correct shutdown sequence? Include the wait times."  
   *Expected:* Atomizer OFF → 10s → Exhaust OFF → 60s → Sheath OFF

3. "If the KEWB sheath pressure is reading higher than the nominal value for your nozzle, does that mean more gas is reaching the nozzle, or less? Why?"  
   *Expected:* Less (or none) — high pressure indicates obstruction upstream; the gas cannot flow freely.

4. "What is the maximum ATM pressure allowed during PA operation?"  
   *Expected:* 5 PSI

**Level 2 (Comprehension) probes:**

5. "Why does the gas startup order matter? What happens if atomizer gas is turned on before sheath gas?"  
   *Expected:* Aerosol is generated before a focusing flow is established; unfocused aerosol disperses inside printhead; potential buildup and blob at initial print.

6. "You increase carrier gas flow to get more deposition. Your lines get wider. Explain what happened and how to fix it."  
   *Expected:* Increasing carrier without proportionally increasing sheath reduces focus ratio; line width increases. Fix: increase sheath proportionally, re-tune.

**Level 3 (Application) probes:**

7. "You are printing and notice ATM pressure rising from 3.2 to 4.5 PSI over 5 minutes. What do you do and in what order?"  
   *Expected:* First, reduce atomizer flow. Then check KEWB carrier pressure for downstream clog. Monitor. If ATM continues to rise despite reduced flow → abort and inspect.

---

## Source Provenance

| Content | Sources | Confidence |
|---|---|---|
| Startup/shutdown gas sequence | SRC-018 Section 6-7, SRC-019 Section 4 | High |
| Sequence rationale (why order matters) | InferredFromDomain, SRC-018 explanatory sections | Medium-High |
| Focus ratio concept | Islam 2025, Smith 2017 | High |
| ATM pressure limit (5 PSI) | SRC-019 Section 4.9 | High |
| Elevation effects on gas settings | InferredFromDomain, peer lit (general AJP parametric) | Medium |
| First-of-day conditioning | InferredFromDomain | Medium |
| Tubing flex effect | InferredFromDomain | Low-Medium |
| Gas warm-up drift | InferredFromDomain | Low-Medium |
