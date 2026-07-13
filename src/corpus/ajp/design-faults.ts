/**
 * Extended AJP fault corpus from the AJP Training System Design Document (Section 3.2).
 * Covers the full six-domain failure taxonomy: Fluidic, Gas System, Deposition Quality,
 * Substrate/Adhesion, Post-Process, and System/Software failures.
 * These supplement graph.ts and graph-faults.ts with 17 additional fault nodes,
 * enriching both In-Operation retrieval and Socratic mode fault-diagnosis probing.
 * Sources: Stanford SNF SOP (SRC-018), Boise State IML SOP (SRC-019), peer literature.
 */
import type { AJPNode, AJPEdge } from '../../types/ajp';

// ─── Fluidic / Atomization Faults ─────────────────────────────────

export const designFaultNodes: AJPNode[] = [
  {
    id: 'FAULT-CLOG-VIRTUAL-IMPACTOR-001',
    type: 'FailureMode',
    content:
      'Occlusion at the virtual impactor rather than the nozzle tip. Symptoms are similar to nozzle clog but pressure pattern may differ — recirculation of large droplets causes erratic flow. Distinguishing test: remove and inspect impactor separately before assuming nozzle is at fault.',
    confidence: 'High',
    source: 'SRC-018 Section 8.3, SRC-019 Section 3.1',
  },
  {
    id: 'FAULT-LEAK-FITTING-001',
    type: 'FailureMode',
    content:
      'Gas or aerosol leak at a fitting, ferrule, or PFA tubing connection. KEWB shows pressure BELOW expected range. Tubing leak visible as white haze near connections. Causes: angled tube cut, loose ferrule, cracked O-ring. CRITICAL: Do not start atomizer gas with a known leak — nanoparticle exposure hazard.',
    safetyAlert: 'Do NOT start atomizer gas with a known leak — nanoparticle aerosol release risk.',
    confidence: 'High',
    source: 'SRC-018 Section 8.2',
  },
  {
    id: 'FAULT-LEAK-ORING-001',
    type: 'FailureMode',
    content:
      'O-ring leak at printhead, virtual impactor, or atomizer assembly. Caused by cracked/worn O-ring, missing Apiezon grease, or misalignment. Inspect printhead O-rings first, then impactor, then atomizer (frequency order). Disassemble, inspect under magnification, replace any with cracks, re-grease all O-rings before reassembly.',
    confidence: 'High',
    source: 'SRC-018 Section 8.2 steps 3-4',
  },
  {
    id: 'FAULT-NO-ATOMIZATION-001',
    type: 'FailureMode',
    content:
      'Atomizer gas is flowing but no aerosol is being generated. PA: check jet position (must be ≥15mm above ink level), ink volume, and stirrer engagement. UA: check power knob setting, vial fill (0.5–2.5mL range), water bath level, and vial cap gasket seal.',
    confidence: 'High',
    source: 'SRC-018 Section 5, SRC-019 Section 5.5',
  },
  {
    id: 'FAULT-DROPOUT-001',
    type: 'FailureMode',
    content:
      'Gaps or missing segments within a deposited trace. Distinct from full clog: intermittent gaps vs. complete absence. Causes: weak atomization (intermittent aerosol), oscillating partial clog, insufficient ink flow relative to print speed, excessive exhaust pull on PA. Check KEWB for pressure spikes indicating oscillating clog.',
    confidence: 'High',
    source: 'SRC-018 Section 8.4, SRC-019',
  },
  {
    id: 'FAULT-BLOB-FORMATION-001',
    type: 'FailureMode',
    content:
      'Large ink accumulations at discrete points along the trace or at the nozzle tip during travel moves. Can cause shorts if blob falls on adjacent circuit features. Correlated with gas flow spikes in KEWB. Actions: (1) wipe nozzle tip with cotton swab between passes; (2) dilute ink to reduce viscosity; (3) clean impactor and printhead. CRITICAL: If blob falls on PCB, abort print and inspect before sintering.',
    safetyAlert: 'If blob falls on PCB: abort print immediately and assess for shorts before sintering.',
    confidence: 'High',
    source: 'SRC-018 Section 8.4',
  },

  // ─── Substrate / Adhesion Faults ─────────────────────────────────

  {
    id: 'FAULT-POOR-ADHESION-001',
    type: 'FailureMode',
    content:
      'Deposited trace does not bond to substrate surface — visible immediately (trace smears) or post-sinter (delamination). Causes: substrate not cleaned before print (oils, flux, ESD foam residue); inherently low-adhesion substrate (PTFE, some polyimides); chuck temperature too low; ink/substrate incompatibility.',
    confidence: 'High',
    source: 'SRC-018, peer literature SRC-003',
  },
  {
    id: 'FAULT-CONTAMINATION-PRE-PRINT-001',
    type: 'FailureMode',
    content:
      'Foreign material on substrate surface — fingerprint oils, flux residue, solder mask residue. Detection: visual inspection under magnification before print. Corrective: IPA wipe with cleanroom swab (unidirectional); for flux: IPA then 30-second dry time. Prevention: photograph board before cleaning to document pre-existing damage.',
    confidence: 'High',
    source: 'Standard electronics assembly practice',
  },
  {
    id: 'FAULT-ESD-DAMAGE-001',
    type: 'FailureMode',
    content:
      'Electrostatic discharge event damages PCB during handling or setup. Often invisible — may manifest as latent degraded performance, gate oxide failure, or immediate circuit failure. Causes: technician not grounded, board on non-ESD surface, low-humidity environment, ESD-sensitive components near repair area.',
    safetyAlert: 'ESD damage is often invisible and irreversible. Always verify wrist strap before touching PCB.',
    confidence: 'High',
    source: 'HAZARD-ESD-001, standard practice',
  },

  // ─── Post-Process Faults ──────────────────────────────────────────

  {
    id: 'FAULT-SINTER-INCOMPLETE-001',
    type: 'FailureMode',
    content:
      'Post-sinter continuity test fails due to insufficient sintering. Ag NP requires thermal energy to coalesce into a conductive network. Causes: temperature below 175°C; time < 3-4 hours; oven calibration drift; trace too thick; substrate thermal mass. Corrective: verify oven temperature with calibrated thermocouple at substrate level; extend sinter time in 1-hour increments.',
    confidence: 'High',
    source: 'SRC-007, SRC-008, SRC-009, SRC-010',
  },
  {
    id: 'FAULT-SINTER-THERMAL-DAMAGE-001',
    type: 'FailureMode',
    content:
      'Excessive sintering temperature or time damages PCB substrate, adjacent components, or trace adhesion. May present as delamination, discoloration, or trace cracking. FR4 glass transition ~135°C — MUST verify substrate tolerance before sintering. This failure mode may be IRREVERSIBLE — total loss of PCB. Highest Part Risk of any failure mode.',
    safetyAlert: 'Never exceed PCB manufacturer maximum temperature rating. Thermal damage is irreversible.',
    confidence: 'High',
    source: 'Standard electronics thermal management, SRC-007',
  },

  // ─── System / Software Faults ─────────────────────────────────────

  {
    id: 'FAULT-STAGE-HOME-FAIL-001',
    type: 'FailureMode',
    content:
      'KEWB Motion Manager homing sequence fails — stage does not move, moves partially, or times out. Diagnostic sequence: (1) visually inspect stage for obstructions; (2) attempt manual stage movement with steppers disabled (should move smoothly); (3) check all cable connections; (4) smooth by hand = electrical fault; mechanical resistance = mechanical fault.',
    confidence: 'High',
    source: 'SRC-018 Sections 4.6, 4.11',
  },
  {
    id: 'FAULT-KEWB-FREEZE-001',
    type: 'FailureMode',
    content:
      'KEWB software stops responding mid-operation. CRITICAL SAFE STATE FIRST: if gas flows are active, manually set to zero using physical controls before any software intervention. Recovery sequence (SRC-018 Section 8.1): (1) Atomizer OFF → wait 10s → Exhaust OFF → wait 60s → Sheath OFF (hardware controls if software unresponsive); (2) Close all KEWB windows; (3) Reinitialize KEWB Gadget; (4) If fails: power off PC, disable tool, re-enable, restart; (5) Home and run test piece before returning to repair PCB.',
    safetyAlert: 'KEWB freeze with active gas flows: use PHYSICAL controls to zero all gas before software intervention.',
    confidence: 'High',
    source: 'SRC-018 Section 8.1',
  },

  // ─── Procedural / Parameter Faults ───────────────────────────────

  {
    id: 'FAULT-GAS-SEQUENCE-WRONG-001',
    type: 'FailureMode',
    content:
      'Gas flows started or stopped in incorrect sequence. Correct startup: Sheath → Atomizer → Exhaust. Correct shutdown: Atomizer OFF → 10s → Exhaust OFF → 60s → Sheath OFF. Wrong startup order (atomizer before sheath): ink aerosol releases without focusing, immediate clogging, lab exposure. Wrong shutdown (sheath before atomizer): residual ink aerosol pushed back into nozzle tip, immediate clog. The sequence is counterintuitive — a prime Socratic probe target.',
    safetyAlert: 'Wrong gas sequence can release unsheathed nanoparticle aerosol. Follow: Sheath first, Sheath last.',
    confidence: 'High',
    source: 'SRC-018 Sections 9-10, SRC-019 Section 7.1',
  },
  {
    id: 'FAULT-NOZZLE-DAMAGE-001',
    type: 'FailureMode',
    content:
      'Physical damage to ceramic nozzle tip — chipping, cracking, or deformed orifice geometry. Results in unpredictable deposition and cannot be cleaned back to function. Causes: contact with substrate (standoff too small), dropping nozzle, overtightening retaining nut, wrong cleaning tools. Corrective: replace nozzle, label damaged one for review.',
    confidence: 'High',
    source: 'SRC-019 Section 1.6, SRC-018 Section 8.3',
  },
  {
    id: 'FAULT-INK-DEGRADED-001',
    type: 'FailureMode',
    content:
      'Silver nanoparticle ink has degraded and cannot produce conductive traces even with successful deposition. Indicators: (1) settled layer that does not re-disperse after sonication; (2) color change to dark gray or brown; (3) gel-like or stringy consistency; (4) past shelf life; (5) ink was frozen. Print may appear visually successful but will fail continuity post-sinter. Baseline ink (Novacentrix Metalon JS-A426, see PARAM-INK-IDENTITY-001) requires refrigerated storage below 5 °C — degradation risk rises sharply if left at room temperature for extended periods.',
    confidence: 'High',
    source: 'TACIT-INK-QUALITY-001, SRC-010, PARAM-INK-IDENTITY-001',
  },
  {
    id: 'FAULT-STANDOFF-TOO-LARGE-001',
    type: 'FailureMode',
    content:
      'Nozzle-to-substrate distance exceeds optimal range (>5mm). Aerosol plume expands excessively, causing wide, diffuse, low-density traces. Causes: calibration at wrong substrate height, elevated component near repair area, Z-height drift. Corrective: re-calibrate Z-height using 3-slide method at the actual repair location, accounting for component heights.',
    confidence: 'High',
    source: 'SRC-018 Section 4 Figure 4, SRC-019 Section 4.12',
  },
  {
    id: 'FAULT-STANDOFF-TOO-SMALL-001',
    type: 'FailureMode',
    content:
      'Nozzle-to-substrate distance below optimal range (<2mm). Nozzle may physically contact substrate or components, causing nozzle damage, substrate damage, or sudden ink deposit. Nozzle is ceramic — contact can chip or break the tip immediately. Corrective: emergency stop, inspect nozzle and PCB under magnification, recalibrate at the actual print location.',
    safetyAlert: 'Ceramic nozzle tip contact with substrate causes immediate irreversible nozzle damage.',
    confidence: 'High',
    source: 'SRC-018 Figure 4',
  },

  // ─── Deposition Quality Faults ────────────────────────────────────

  {
    id: 'FAULT-OVERSPRAY-001',
    type: 'FailureMode',
    content:
      'Diffuse silver deposition beyond the intended trace boundary — visible as a haze or scattered droplets under microscopy. Causes: sheath gas flow too low (aerosol not focused), standoff too large, print speed too slow. Corrective: increase sheath gas in 0.5 SLPM increments while monitoring KEWB; reduce standoff to optimal 2–5mm range; increase print speed. Overspray creates short-circuit risk on dense PCBs — measure trace width and spacing before sintering.',
    confidence: 'High',
    source: 'SRC-018 Section 6, SRC-019 Section 4.12, peer literature SRC-003',
  },
  {
    id: 'FAULT-WEAK-ATOMIZATION-001',
    type: 'FailureMode',
    content:
      'Atomizer running but generating insufficient aerosol for deposition. PA: check jet position (≥15mm above ink level), ink volume (minimum 3mL), and stirrer engagement. UA: verify ultrasonic power knob is above threshold, check water bath level, verify ink volume is in 0.5–2.5mL range. KEWB shows lower-than-nominal flow and current draw. Print may appear to start but trace density is insufficient for conductivity after sintering.',
    confidence: 'High',
    source: 'SRC-018 Section 5, SRC-019 Section 5.5',
  },
];

// ─── Symptom + TacitKnowledge nodes linked to design faults ────────

export const designSymptomNodes: AJPNode[] = [
  {
    id: 'SYMPT-ERRATIC-FLOW-001',
    type: 'Symptom',
    content:
      'KEWB pressure oscillates or spikes erratically rather than holding steady. Indicates recirculation or oscillating partial blockage — could be virtual impactor clog or intermittent nozzle blockage.',
    confidence: 'High',
    source: 'SRC-018',
  },
  {
    id: 'SYMPT-LINE-GAPS-001',
    type: 'Symptom',
    content:
      'Intermittent gaps or breaks in the deposited trace. Unlike full clog (no deposition), dropout shows sections of the line are present but interrupted. Indicates oscillating clog, insufficient atomization, or excessive print speed.',
    confidence: 'High',
    source: 'SRC-018 Section 8.4',
  },
  {
    id: 'SYMPT-LINE-TOO-WIDE-001',
    type: 'Symptom',
    content:
      'Deposited trace wider than designed toolpath, with soft/graduated edges instead of sharp boundaries. Under microscope: scattered fine silver droplets beyond trace boundaries. Indicates overspray from low sheath gas, large standoff, or slow print speed.',
    confidence: 'High',
    source: 'Peer literature SRC-003, SRC-004',
  },
  {
    id: 'SYMPT-BLOB-ON-TRACE-001',
    type: 'Symptom',
    content:
      'Large ink accumulation at a discrete point on the trace or at the nozzle tip. Visible as a significantly wider blob compared to the surrounding trace. Correlated with KEWB flow spikes. Risk: if blob falls, can short adjacent features.',
    confidence: 'High',
    source: 'SRC-018 Section 8.4',
  },
  {
    id: 'SYMPT-PCB-DISCOLOR-001',
    type: 'Symptom',
    content:
      'Substrate discoloration post-sinter — yellowing, browning, or delamination of PCB surface. Indicates thermal damage from excessive sintering temperature or duration exceeding the substrate Tg (glass transition temperature).',
    confidence: 'High',
    source: 'Standard electronics practice',
  },

  // ─── Additional symptom nodes (§3.3 diagnostic index) ─────────────

  {
    id: 'SYMPT-DIFFUSE-EDGES-001',
    type: 'Symptom',
    content:
      'Trace edges appear soft or graduated under microscopy rather than sharp and well-defined. Droplets visible beyond trace boundaries. Indicates overspray — sheath gas too low, standoff too large, or print speed too slow.',
    confidence: 'High',
    source: 'SRC-003, SRC-018 Section 6',
  },
  {
    id: 'SYMPT-BLOB-NOZZLE-TIP-001',
    type: 'Symptom',
    content:
      'Visible ink accumulation on the nozzle tip exterior. Observable between print passes or during travel moves. Precursor to blob-falls-on-PCB event. Indicates ink accumulation from partial blockage, excess flow, or ink re-wetting of tip.',
    confidence: 'High',
    source: 'SRC-018 Section 8.4',
  },
  {
    id: 'SYMPT-KEWB-SPIKE-001',
    type: 'Symptom',
    content:
      'KEWB pressure graph shows sharp upward spike — a sudden transient rather than steady elevation. Indicates sudden partial blockage event (blob formation, intermittent impactor occlusion, or ink dropout event causing back-pressure).',
    confidence: 'High',
    source: 'SRC-018',
  },
  {
    id: 'SYMPT-WHITE-HAZE-FITTING-001',
    type: 'Symptom',
    content:
      'Visible white haze or cloudiness near a tubing fitting, ferrule, or connection point while gas flows are active. Indicates nanoparticle aerosol escaping at a gas leak site. Requires immediate gas shutdown — nanoparticle exposure hazard.',
    safetyAlert: 'White haze at fittings = active nanoparticle release. Zero all gas flows immediately.',
    confidence: 'High',
    source: 'SRC-018 Section 8.2',
  },
  {
    id: 'SYMPT-NO-AEROSOL-PA-001',
    type: 'Symptom',
    content:
      'PA atomizer jar shows no mist or droplet activity on jar walls — gas is flowing but no aerosol is being generated. Distinct from KEWB alarm: flow present but zero deposition occurs. Check jet position, ink volume, and stirrer engagement.',
    confidence: 'High',
    source: 'SRC-018 Section 5',
  },
  {
    id: 'SYMPT-THIN-PLUME-001',
    type: 'Symptom',
    content:
      'Aerosol plume visible but narrow and faint compared to normal printing conditions. Deposition is present but trace density appears insufficient. KEWB current draw below normal range. Indicates weak atomization — insufficient aerosol generation for target trace conductivity.',
    confidence: 'High',
    source: 'SRC-019 Section 5.5',
  },
  {
    id: 'SYMPT-TONE-CHANGE-UA-001',
    type: 'Symptom',
    content:
      'Audible change in pitch or character of the ultrasonic atomizer tone during operation. UA atomizer produces a characteristic frequency — pitch rising or shifting indicates ink level dropping below optimal, vial coupling change, or early UA weakness.',
    confidence: 'Medium',
    source: 'Practitioner knowledge',
  },
  {
    id: 'SYMPT-TRACE-CRACKING-001',
    type: 'Symptom',
    content:
      'Post-sinter trace shows surface cracking, crazing, or delamination under microscopy. Indicates substrate thermal damage — either temperature exceeded PCB glass transition or thermal cycling caused differential expansion. Board is likely irreparably damaged.',
    confidence: 'High',
    source: 'Standard electronics practice, SRC-007',
  },
  {
    id: 'SYMPT-LOW-DENSITY-TRACE-001',
    type: 'Symptom',
    content:
      'Deposited trace has correct width but appears thin or low-density under microscopy, or post-sinter resistance is higher than expected for trace geometry. Indicates large standoff distance causing aerosol expansion and diluted deposition density.',
    confidence: 'High',
    source: 'SRC-018 Figure 4, SRC-019 Section 4.12',
  },
  {
    id: 'SYMPT-HIGH-RESISTANCE-POST-SINTER-001',
    type: 'Symptom',
    content:
      'Four-probe resistance measurement post-sinter shows resistance higher than the theoretical value for the deposited silver cross-section and length. Trace is visually present but incompletely sintered. Corrective: verify sinter temperature at substrate level, extend time in 1-hour increments.',
    confidence: 'High',
    source: 'SRC-007, SRC-008',
  },
  {
    id: 'SYMPT-NO-STAGE-MOTION-001',
    type: 'Symptom',
    content:
      'Stage does not respond to KEWB motion commands — no movement, partial movement, or timeout error during homing or print start. Requires systematic diagnosis: check for physical obstructions, disable steppers and attempt manual movement, then isolate mechanical vs. electrical fault.',
    confidence: 'High',
    source: 'SRC-018 Sections 4.6, 4.11',
  },
];

export const designTacitNodes: AJPNode[] = [
  {
    id: 'TACIT-NOZZLE-INSPECT-001',
    type: 'TacitKnowledge',
    content:
      'Inspect the nozzle tip under 10× magnification (hand loupe minimum; microscope preferred) before every session and during troubleshooting. ' +
      'Healthy: clean circular orifice, symmetric edges, intact ceramic body. ' +
      'Reject immediately if: orifice is oval/D-shaped/irregular; ceramic is chipped at or near the orifice; nozzle was dropped (inspect regardless of visible damage). ' +
      'During troubleshooting: residue inside orifice → clog; asymmetric orifice → replace, not clean. ' +
      'The expert rule: if orifice geometry is intact and residue is removable by sonication, clean it. If geometry is compromised, no parameter adjustment will restore print quality — replace.',
    confidence: 'High',
    source: 'KB-DOC-01 §1.4 · SRC-019 §1.6, SRC-018 §8.3 · v1.0-2026-04-10',
  },
  {
    id: 'TACIT-ABORT-DECISION-001',
    type: 'TacitKnowledge',
    content:
      'Four-tier abort decision framework. ' +
      'ABORT IMMEDIATELY (no deliberation): any safety gate violation or nanoparticle exposure event; nozzle tip contacts or nearly contacts substrate; KEWB pressure ≥ 2× nominal and stays elevated; large blob on nozzle tip during a trace that cannot be wiped without contacting the PCB. ' +
      'ABORT AFTER ASSESSING (30–60 s): steady upward pressure drift not yet at 1.5× nominal; line quality degrading but print is >80% complete; intermittent KEWB spikes with acceptable trace quality so far. ' +
      'WIPE AND CONTINUE (specific case): small blob accumulating on nozzle tip during travel moves only — engage shutter, lower atomizer gas momentarily, wipe tip with cotton swab, restore gas, disengage shutter. Only valid if pressure is nominal and line quality is otherwise good. ' +
      'CONTINUE WITHOUT ACTION: single momentary KEWB spike that returned to nominal with no visible trace defect; line width variation within ±10% of target; UA tone variation that resolves within 30 s. ' +
      'The general principle: the cost of aborting and restarting is almost always lower than the cost of a failed trace on the PCB.',
    safetyAlert: 'Abort immediately on any safety gate violation. When in doubt, abort — the PCB can be reprinted.',
    confidence: 'High',
    source: 'KB-DOC-01 §4.1 · SRC-018 (implied), InferredFromDomain · v1.0-2026-04-10',
  },
  {
    id: 'TACIT-ATOMIZATION-VISUAL-PA-001',
    type: 'TacitKnowledge',
    content:
      'PA atomizer jar wall check — expert read during printing: healthy atomization shows a uniform "rain" of very small, evenly distributed droplets on the lower jar walls, appearing in rapid continuous succession with consistent density and small uniform size. ' +
      'Warning patterns: (1) No droplets at all → no atomization; check jet tube position (must be ≥15 mm above ink), gas flow in KEWB, and for clog. (2) Droplets appear then stop, cycling → intermittent atomization; watch KEWB for pressure spikes, check stirrer, consider aborting. (3) Droplets clustered in one area → asymmetric atomization; check jet tube centering. (4) Large blobs rather than fine droplets → ink too viscous or flow rate creating unstable droplets; check temperature and viscosity. (5) Walls wet but KEWB pressure elevated → possible downstream partial clog despite adequate atomization; run sheath-only check. ' +
      'Expert habit: glance at jar walls every few minutes during a run, watching for *changes* from baseline, not just presence/absence.',
    confidence: 'High',
    source: 'KB-DOC-01 §1.1 · SRC-018 (SRC-018), SRC-019 · v1.0-2026-04-10',
  },
  {
    id: 'TACIT-ATOMIZATION-SOUND-UA-001',
    type: 'TacitKnowledge',
    content:
      'UA (ultrasonic atomizer) audio signature: healthy operation produces a steady, consistent high-pitched tone (transducer frequency 1.6–2.4 MHz, often at or near the edge of adult audibility). ' +
      'Abnormal sounds and meanings: (1) Tone becomes intermittent or pulsing → ink level critically low; check vial immediately. (2) Tone pitch rises noticeably → ink level dropping; prepare to refill. (3) Loud rattling or irregular sound → vial seated incorrectly or gasket issue; stop UA and reseat. (4) Tone disappears while power is on → UA power below activation threshold; increase power knob slowly in 0.05 increments. (5) Higher power required than normal for same agitation → ink viscosity increased (temperature drop or solvent evaporation); check ink temperature. ' +
      'Teaching note: verbally describe the expected sound to trainees before their first session — pre-experience framing makes the sound more interpretable when encountered.',
    confidence: 'Medium',
    source: 'KB-DOC-01 §2.1 · SRC-018 (description), InferredFromDomain · v1.0-2026-04-10',
  },
  {
    id: 'TACIT-KEWB-PRESSURE-READ-001',
    type: 'TacitKnowledge',
    content:
      'KEWB pressure trend vs. point value — the critical novice error is checking a single value rather than watching the trend over time. ' +
      'Four pressure behaviors: (1) Stable flat line at nominal ± small noise → system operating normally; continue. (2) Steady upward drift (e.g., 4 → 4.5 → 5 → 5.5 PSI over minutes) → partial clog forming; abort before it reaches 1.2× nominal if significant print length remains. (3) Sudden spike then recovery → ink blob passing through transfer tube; watch for repeat spikes — if frequent, abort. (4) Sudden jump and stays high → full or near-full clog; abort immediately. ' +
      'The counterintuitive rule novices always get wrong: HIGH pressure = obstruction (gas cannot get through); LOW pressure = leak (gas escaping). Novices often intuit "high pressure = more flow" — this is backwards and leads to the wrong corrective action. ' +
      'Expert monitor habit: watch the KEWB pressure *graph* (trend line), not just the numeric readout.',
    confidence: 'High',
    source: 'KB-DOC-01 §3.1 · SRC-018 §8.2–8.3, SRC-019 §4.9 · v1.0-2026-04-10',
  },
  {
    id: 'TACIT-LINE-QUALITY-REFERENCE-001',
    type: 'TacitKnowledge',
    content:
      'Five canonical deposited line states and their corrective parameters. ' +
      'State 1 — Good line: uniform width, sharp well-defined edges, consistent metallic color, no gaps/blobs/scalloping. ' +
      'State 2 — Substrate adhesion problem: ink beads up or retracts, "holes" or "windows" where ink did not wet; color irregular. Fix: do NOT adjust printing parameters — address substrate surface first. ' +
      'State 3 — Under-deposition (ink flow too low for print speed): trace thinner than expected, intermittent gaps, width narrows. Fix: reduce print speed OR increase atomizer flow — one change at a time. ' +
      'State 4 — Over-deposition (ink flow too high for print speed): trace wider than expected, diffuse edges with satellite deposits, may pool at direction changes. Fix: increase print speed OR reduce atomizer flow — one change at a time. ' +
      'State 5 — Over-focusing (sheath gas too high): extremely narrow trace, potentially narrower than nozzle ID, thin and faint with poor coverage. Fix: reduce sheath gas. ' +
      'Expert judgment: experienced operators discriminate which parameter to adjust; novices see "something is wrong" but cannot identify whether it is speed, sheath, atomizer, or substrate.',
    confidence: 'High',
    source: 'KB-DOC-01 §1.3 · SRC-019 §5.10, SRC-018 §8.4 · v1.0-2026-04-10',
  },
  // ── KEWB alarm-based fault nodes (abstracted from internal deployment observation) ─────────

  {
    id: 'FAULT-BUBBLER-TEMP-LOW-001',
    type: 'FailureMode',
    content:
      'KEWB Critical alarm (Severity 3): Bubbler temperature dropped more than 2 °C below setpoint (BUB_HEAT_Temp > BUB_HEAT_SetPoint − 2). ' +
      'The bubbler heater maintains ink temperature for stable aerosolization — too cold causes viscosity shift and poor atomization. ' +
      'Recovery: acknowledge alarm in KEWB Alarms panel, check BUB_HEAT heater connection and setpoint, wait for temperature recovery before resuming print.',
    safetyAlert: 'Highest-severity KEWB alarm. Do not continue printing until bubbler temperature is within setpoint ±2 °C.',
    confidence: 'High',
    source: 'Internal deployment observation (KEWB alarm/config behavior) — raw source withheld from public corpus, see EXCLUDED_SOURCES in scripts/ingest-corpus.ts',
  },
  {
    id: 'FAULT-BUBBLER-TEMP-HIGH-001',
    type: 'FailureMode',
    content:
      'KEWB Error alarm (Severity 2): Bubbler temperature exceeded setpoint by more than 2 °C (BUB_HEAT_Temp < BUB_HEAT_SetPoint + 2). ' +
      'Excess heat accelerates solvent evaporation, raising ink viscosity and increasing clog risk. ' +
      'Recovery: acknowledge alarm, allow temperature to stabilize; reduce bubbler setpoint if recurring.',
    confidence: 'High',
    source: 'Internal deployment observation (KEWB alarm/config behavior) — raw source withheld from public corpus, see EXCLUDED_SOURCES in scripts/ingest-corpus.ts',
  },
  {
    id: 'FAULT-UA-TEMP-LOW-001',
    type: 'FailureMode',
    content:
      'KEWB Error alarm (Severity 2): Ultrasonic Atomizer heater (UA_HEAT) temperature dropped more than 2 °C below setpoint. ' +
      'UA temperature affects transducer efficiency and ink droplet size distribution — too cold reduces aerosolization quality. ' +
      'Recovery: acknowledge alarm, check HEATER_EN digital output state, wait for temperature recovery.',
    confidence: 'High',
    source: 'Internal deployment observation (KEWB alarm/config behavior) — raw source withheld from public corpus, see EXCLUDED_SOURCES in scripts/ingest-corpus.ts',
  },
  {
    id: 'FAULT-UA-TEMP-HIGH-001',
    type: 'FailureMode',
    content:
      'KEWB Error alarm (Severity 2): UA_HEAT temperature exceeded setpoint by more than 2 °C. ' +
      'Excess UA heater temperature may indicate a heater control loop fault. ' +
      'Recovery: acknowledge alarm, verify UA_HEAT setpoint vs. actual in KEWB; if overshoot persists, pause and investigate heater controller.',
    confidence: 'High',
    source: 'Internal deployment observation (KEWB alarm/config behavior) — raw source withheld from public corpus, see EXCLUDED_SOURCES in scripts/ingest-corpus.ts',
  },
  {
    id: 'FAULT-ATOMIZER-PRESSURE-HIGH-001',
    type: 'FailureMode',
    content:
      'KEWB Error alarm (Severity 2): Atomizer pressure exceeded the configured high threshold. ' +
      'Distinct from operator observing a rising pressure trend — this alarm fires when a system safety threshold is exceeded. ' +
      'Likely cause: nozzle or mist tube blockage preventing gas from flowing freely. ' +
      'CRITICAL: Do not increase ATM_MFC to compensate — pressure buildup risks nozzle damage. ' +
      'Recovery: acknowledge alarm, reduce ATM_MFC setpoint, inspect nozzle and mist tube for blockage.',
    safetyAlert: 'Do NOT increase atomizer flow to compensate for high pressure — nozzle damage and aerosol release risk.',
    confidence: 'High',
    source: 'Internal deployment observation (KEWB alarm/config behavior) — raw source withheld from public corpus, see EXCLUDED_SOURCES in scripts/ingest-corpus.ts',
  },
  {
    id: 'FAULT-PANELS-REMOVED-001',
    type: 'SafetyHazard',
    content:
      'KEWB Error alarm (Severity 2): Physical safety panel or door sensor triggered — panels removed or door opened during operation. ' +
      'System should pause on this alarm. Nanoparticle aerosol may be present inside the enclosure. ' +
      'Recovery: close/replace panels, acknowledge alarm in KEWB; do not re-enter work area until panels are secured and KEWB shows clear.',
    safetyAlert: 'Do not open printer enclosure while aerosol is active — silver nanoparticle exposure risk. Close panels and acknowledge alarm before resuming.',
    confidence: 'High',
    source: 'Internal deployment observation (KEWB alarm/config behavior) — raw source withheld from public corpus, see EXCLUDED_SOURCES in scripts/ingest-corpus.ts; AJ Health and Safety Guidelines (OEM P/N 9000876)',
  },
  {
    id: 'FAULT-FAILED-LEAK-CHECK-001',
    type: 'FailureMode',
    content:
      'UA Leak Check (KEWB Sequence 2) failed — pressure decay exceeded acceptable threshold. ' +
      'Two severity levels: (1) small leak — potentially recoverable; (2) large leak — hard stop, diagnosis required before continuing. ' +
      'Diagnosis order: (1) O-rings in ink vial assembly — check all are seated, not cracked, dry, discolored, or caked in ink; replace any damaged. ' +
      '(2) Cartridge seating — verify cartridge is fully against alignment pins and latch is secured. ' +
      '(3) Tube connections — check ink tube, vial assembly, and nozzle connections are fully seated. ' +
      'CRITICAL: Do not proceed to UA Start Process with a known leak — nanoparticle aerosol exposure risk.',
    safetyAlert: 'Failed leak check — do NOT start atomizer gas until leak is identified and corrected. Nanoparticle aerosol release risk.',
    confidence: 'High',
    source: 'Internal deployment observation (KEWB alarm/config behavior) — raw source withheld from public corpus, see EXCLUDED_SOURCES in scripts/ingest-corpus.ts',
  },

  // ── Equipment nodes (abstracted from internal deployment observation) ────────

  {
    id: 'EQUIP-ATM-MFC-001',
    type: 'Equipment',
    content:
      'ATM_MFC — Alicat mass flow controller (address A), range 0–4000 SCCM. ' +
      'Controls atomizer carrier gas flow: the gas that carries aerosolized ink from the atomizer through the mist tube to the nozzle. ' +
      'Increasing ATM_MFC increases ink deposition rate. ' +
      'In KEWB, labeled "Atomizer MFC" in the process display.',
    confidence: 'High',
    source: 'Internal deployment observation (KEWB alarm/config behavior) — raw source withheld from public corpus, see EXCLUDED_SOURCES in scripts/ingest-corpus.ts',
  },
  {
    id: 'EQUIP-S-MFC-001',
    type: 'Equipment',
    content:
      'S_MFC — Alicat mass flow controller (address B), range 0–4000 SCCM. ' +
      'Controls sheath gas flow: the annular focusing gas at the nozzle exit that compresses the aerosol stream. ' +
      'Increase S_MFC → decrease feature (line) width. Decrease S_MFC → increase feature width. ' +
      'In KEWB, labeled "Sheath MFC" in the process display.',
    confidence: 'High',
    source: 'Internal deployment observation (KEWB alarm/config behavior) — raw source withheld from public corpus, see EXCLUDED_SOURCES in scripts/ingest-corpus.ts',
  },
  {
    id: 'EQUIP-PLATEN-HEAT-001',
    type: 'Equipment',
    content:
      'PLATEN_HEAT — Omron heater controller, range 0–150 °C. ' +
      'Controls the substrate platen temperature. Elevated platen temperature dries printed ink more rapidly, ' +
      'locking features in place and reducing ink blow-out risk. ' +
      'Max range (150 °C) is below FR-4 glass transition temperature (~130–135 °C) by only 15–20 °C — ' +
      'use conservatively with temperature-sensitive substrates.',
    confidence: 'High',
    source: 'Internal deployment observation (KEWB alarm/config behavior) — raw source withheld from public corpus, see EXCLUDED_SOURCES in scripts/ingest-corpus.ts',
  },

  // ── New node: plume visual (doc-01 §1.2, referenced in cross-ref table) ────────
  {
    id: 'TACIT-PLUME-VISUAL-001',
    type: 'TacitKnowledge',
    content:
      'Aerosol plume appearance at the nozzle on the KEWB process camera — expert read. ' +
      'Healthy plume: tight, well-defined column of aerosol exiting coaxially; slight convergence below nozzle tip (sheath gas focusing effect); steady with minimal flickering; sharp boundary between plume and surrounding air. ' +
      'Warning appearances: (1) Wide, diffuse — no clear focus → sheath gas too low or standoff too large; increase sheath in small increments and check standoff. (2) Flickering or pulsing → intermittent atomization or oscillating partial clog; watch KEWB for pressure spikes. (3) Very narrow but thin line deposition → sheath too high (over-focusing); reduce sheath slightly. (4) Plume drifting to one side → nozzle orifice asymmetry (possible damage) or gas flow imbalance; inspect nozzle under magnification. (5) No visible plume but KEWB shows gas flowing → nozzle fully clogged; abort and disassemble. ' +
      'Expert note: operators develop a feel for what "their machine" looks like under standard conditions — verbal category descriptions give novices the cognitive scaffold before physical experience.',
    confidence: 'Medium',
    source: 'KB-DOC-01 §1.2 · Islam 2025, Smith 2017, peer CFD studies · v1.0-2026-04-10',
  },
];

// ─── Edges linking design fault nodes ─────────────────────────────

export const designFaultEdges: AJPEdge[] = [
  // Virtual impactor clog
  { from: 'SYMPT-ERRATIC-FLOW-001', to: 'FAULT-CLOG-VIRTUAL-IMPACTOR-001', type: 'INDICATES' },
  { from: 'SYMPT-VERY-HIGH-PRESSURE-001', to: 'FAULT-CLOG-VIRTUAL-IMPACTOR-001', type: 'INDICATES' },
  { from: 'FAULT-CLOG-VIRTUAL-IMPACTOR-001', to: 'HAZARD-NANOPARTICLE-001', type: 'REQUIRES' },

  // Fitting leak
  { from: 'SYMPT-PRESSURE-DROP-001', to: 'FAULT-LEAK-FITTING-001', type: 'INDICATES' },
  { from: 'FAULT-LEAK-FITTING-001', to: 'HAZARD-NANOPARTICLE-001', type: 'REQUIRES' },

  // O-ring leak
  { from: 'SYMPT-PRESSURE-DROP-001', to: 'FAULT-LEAK-ORING-001', type: 'INDICATES' },
  { from: 'FAULT-LEAK-ORING-001', to: 'HAZARD-NANOPARTICLE-001', type: 'REQUIRES' },

  // Dropout
  { from: 'SYMPT-LINE-GAPS-001', to: 'FAULT-DROPOUT-001', type: 'INDICATES' },
  { from: 'FAULT-DROPOUT-001', to: 'HAZARD-NANOPARTICLE-001', type: 'REQUIRES' },

  // Blob formation
  { from: 'SYMPT-BLOB-ON-TRACE-001', to: 'FAULT-BLOB-FORMATION-001', type: 'INDICATES' },
  { from: 'FAULT-BLOB-FORMATION-001', to: 'HAZARD-NANOPARTICLE-001', type: 'REQUIRES' },

  // Sinter faults
  { from: 'SYMPT-PCB-DISCOLOR-001', to: 'FAULT-SINTER-THERMAL-DAMAGE-001', type: 'INDICATES' },
  { from: 'FAULT-SINTER-THERMAL-DAMAGE-001', to: 'HAZARD-NANOPARTICLE-001', type: 'REQUIRES' },

  // Gas sequence
  { from: 'FAULT-GAS-SEQUENCE-WRONG-001', to: 'HAZARD-NANOPARTICLE-001', type: 'REQUIRES' },

  // Standoff faults → wide line
  { from: 'SYMPT-LINE-TOO-WIDE-001', to: 'FAULT-STANDOFF-TOO-LARGE-001', type: 'INDICATES' },
  { from: 'SYMPT-LINE-TOO-WIDE-001', to: 'FAULT-OVERSPRAY-001', type: 'INDICATES' },

  // Tacit knowledge linked to faults
  { from: 'FAULT-NOZZLE-DAMAGE-001', to: 'TACIT-NOZZLE-INSPECT-001', type: 'REQUIRES' },
  { from: 'FAULT-BLOB-FORMATION-001', to: 'TACIT-ABORT-DECISION-001', type: 'REQUIRES' },
  { from: 'FAULT-WEAK-ATOMIZATION-001', to: 'TACIT-ATOMIZATION-SOUND-UA-001', type: 'REQUIRES' },
  { from: 'FAULT-DROPOUT-001', to: 'TACIT-KEWB-PRESSURE-READ-001', type: 'REQUIRES' },
  { from: 'FAULT-CLOG-VIRTUAL-IMPACTOR-001', to: 'TACIT-KEWB-PRESSURE-READ-001', type: 'REQUIRES' },
  { from: 'FAULT-OVERSPRAY-001', to: 'TACIT-LINE-QUALITY-REFERENCE-001', type: 'REQUIRES' },
  { from: 'FAULT-STANDOFF-TOO-LARGE-001', to: 'TACIT-LINE-QUALITY-REFERENCE-001', type: 'REQUIRES' },
  { from: 'FAULT-OVERSPRAY-001', to: 'TACIT-PLUME-VISUAL-001', type: 'REQUIRES' },
  { from: 'FAULT-SHEATH-GAS-001', to: 'TACIT-PLUME-VISUAL-001', type: 'REQUIRES' },

  // Overspray fault ↔ symptoms
  { from: 'SYMPT-DIFFUSE-EDGES-001', to: 'FAULT-OVERSPRAY-001', type: 'INDICATES' },
  { from: 'SYMPT-DIFFUSE-EDGES-001', to: 'FAULT-STANDOFF-TOO-LARGE-001', type: 'INDICATES' },

  // Blob formation symptoms
  { from: 'SYMPT-BLOB-NOZZLE-TIP-001', to: 'FAULT-BLOB-FORMATION-001', type: 'INDICATES' },
  { from: 'SYMPT-KEWB-SPIKE-001', to: 'FAULT-BLOB-FORMATION-001', type: 'INDICATES' },
  { from: 'SYMPT-KEWB-SPIKE-001', to: 'FAULT-DROPOUT-001', type: 'INDICATES' },

  // Leak fitting symptom
  { from: 'SYMPT-WHITE-HAZE-FITTING-001', to: 'FAULT-LEAK-FITTING-001', type: 'INDICATES' },

  // No atomization symptom
  { from: 'SYMPT-NO-AEROSOL-PA-001', to: 'FAULT-NO-ATOMIZATION-001', type: 'INDICATES' },

  // Weak atomization symptoms
  { from: 'SYMPT-THIN-PLUME-001', to: 'FAULT-WEAK-ATOMIZATION-001', type: 'INDICATES' },
  { from: 'SYMPT-TONE-CHANGE-UA-001', to: 'FAULT-WEAK-ATOMIZATION-001', type: 'INDICATES' },

  // Sinter thermal damage symptoms
  { from: 'SYMPT-TRACE-CRACKING-001', to: 'FAULT-SINTER-THERMAL-DAMAGE-001', type: 'INDICATES' },

  // Standoff too large symptom
  { from: 'SYMPT-LOW-DENSITY-TRACE-001', to: 'FAULT-STANDOFF-TOO-LARGE-001', type: 'INDICATES' },

  // Incomplete sinter symptom
  { from: 'SYMPT-HIGH-RESISTANCE-POST-SINTER-001', to: 'FAULT-SINTER-INCOMPLETE-001', type: 'INDICATES' },

  // Stage home fail symptom
  { from: 'SYMPT-NO-STAGE-MOTION-001', to: 'FAULT-STAGE-HOME-FAIL-001', type: 'INDICATES' },

  // Weak atomization → nanoparticle hazard (insufficient aerosol focus)
  { from: 'FAULT-WEAK-ATOMIZATION-001', to: 'HAZARD-NANOPARTICLE-001', type: 'REQUIRES' },
  { from: 'FAULT-OVERSPRAY-001', to: 'HAZARD-NANOPARTICLE-001', type: 'REQUIRES' },

  // ── KEWB alarm faults → symptoms ──────────────────────────────
  { from: 'FAULT-BUBBLER-TEMP-LOW-001', to: 'FAULT-WEAK-ATOMIZATION-001', type: 'CAUSES' },
  { from: 'FAULT-UA-TEMP-LOW-001', to: 'FAULT-WEAK-ATOMIZATION-001', type: 'CAUSES' },
  { from: 'FAULT-ATOMIZER-PRESSURE-HIGH-001', to: 'FAULT-CLOG-PARTIAL-001', type: 'INDICATES' },
  { from: 'FAULT-PANELS-REMOVED-001', to: 'HAZARD-NANOPARTICLE-001', type: 'REQUIRES' },
  { from: 'FAULT-FAILED-LEAK-CHECK-001', to: 'FAULT-LEAK-ORING-001', type: 'INDICATES' },
  { from: 'FAULT-FAILED-LEAK-CHECK-001', to: 'FAULT-LEAK-FITTING-001', type: 'INDICATES' },
];
