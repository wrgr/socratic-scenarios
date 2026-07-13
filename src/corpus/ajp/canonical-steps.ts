/**
 * Canonical AJP HD2 Workflow — authoritative 17-step DAG.
 *
 * This is the single source of truth for the full Optomec HD2 Aerosol Jet
 * Printer procedure as operated via KEWB software.
 * Scenarios and synthetic-learner sessions are derived from this bank —
 * never from ad-hoc step lists.
 *
 * ── Architecture decisions recorded here ─────────────────────────────────
 *
 * LASER-SINTER ONLY: This corpus covers inline laser sintering exclusively
 * (KEWB Sequence 6 "Print Board with Laser Sintering"). Bench-top oven
 * sintering is not modelled. Removed from prior version: substrate Tg
 * verification, oven ramp/hold setup, thermal profile monitoring (CANON-POST-003
 * through -005 in the pre-2026-04 version). Rationale: the deployed HD2
 * uses the integrated laser sintering module; oven sintering is a different
 * process with different failure modes that would require a separate corpus.
 *
 * SOFTWARE NAME — KEWB: The HD2 control software is KEWB, confirmed via
 * internal deployment documentation and software naming conventions. Prior
 * corpus versions used the incorrect name "KE-W-A"; all nodes now use KEWB.
 *
 * STEP ORDERING: The numbered KEWB sequences (1–9 + Machine Start-Up/Shut Down)
 * are the authoritative source of procedure order. The prior version placed
 * "ESD Protection and Board Load" as STARTUP-002, which is incorrect — the
 * board loads at CANON-OP-001 (after UA Start and Z-height calibration):
 * the printer must jog over to the starting position before the damaged
 * board is placed, to avoid a crash.
 *
 * Sources: internal deployment observation (KEWB software behavior, sequence
 *          ordering — abstracted; raw configuration/documentation withheld
 *          from the public corpus, see EXCLUDED_SOURCES in
 *          scripts/ingest-corpus.ts), Stanford SNF AJP SOP, Boise State IML SOP.
 */
import type { ProficiencyLevel } from '../../types';

// ─── Types ────────────────────────────────────────────────────────

export interface CanonicalStep {
  id: string;
  phase: 'startup' | 'operation' | 'post-print' | 'shutdown';
  /** Display label shown to learner */
  title: string;
  /** Canonical narrator text (corpus-grounded, no generation) */
  content: string;
  /**
   * KEWB sequence that drives this step, if any.
   * Format: "<number> - <Name>" matching the Sequences/*.xml filename.
   * Null for operator-driven steps not wrapped in a KEWB sequence.
   */
  kewbSequence: string | null;
  /** Concept IDs this step exercises */
  conceptIds: string[];
  /**
   * Probe concept this step can test — refers to a domain concept, not a
   * specific probe node, so wording can be varied by the scenario generator.
   */
  probeConceptId: string | null;
  /**
   * IDs of existing SocraticProbe nodes that cover this step's concept.
   * Empty for steps where only multiple-choice or observational probing is used.
   */
  linkedProbeIds: string[];
  /** Step IDs that must precede this one */
  dependencies: string[];
  /** Sequence is safety-critical — cannot be permuted or skipped */
  safetyOrder: boolean;
  /** Wording, fault timing, or context can be varied for scenario generation */
  variationZone: boolean;
  /** Fault node IDs that are plausible injection targets at this step */
  faultCandidates: string[];
  /** Difficulty band for this step (lowest to highest) */
  difficultyRange: [ProficiencyLevel, ProficiencyLevel];
  /**
   * Whether this step involves direct measurement or testing of the board/trace.
   * Used to weight gap-detection priority for board-testing steps.
   */
  isBoardTest: boolean;
  /**
   * Whether this step is a hard pass/fail gate.
   * True for Leak Check: failure requires diagnosis before continuing.
   */
  isGate?: boolean;
}

// ─── Phase 1 — Startup (6 steps, all safety-ordered) ─────────────

const STARTUP: CanonicalStep[] = [
  {
    id: 'CANON-STARTUP-001',
    phase: 'startup',
    title: 'PPE and Ventilation Check',
    content:
      'Verify ventilation hood is active (GREEN indicator). Don nitrile gloves and N95 respirator. ' +
      'Inspect ink vial for contamination before approaching machine. ' +
      'Novacentrix Metalon JS-A426 silver nanoparticle ink — respiratory and dermal hazard throughout session.',
    kewbSequence: null,
    conceptIds: ['ajp-safety-protocols'],
    probeConceptId: 'ajp-safety-protocols',
    linkedProbeIds: [],
    dependencies: [],
    safetyOrder: true,
    variationZone: true,
    faultCandidates: [],
    difficultyRange: ['novice', 'beginner'],
    isBoardTest: false,
  },
  {
    id: 'CANON-STARTUP-002',
    phase: 'startup',
    title: 'Machine Initialization (KEWB Machine Start-Up)',
    content:
      'Log into KEWB software (login button, top right; username: eng). ' +
      'Run the "Machine Start-Up" sequence. KEWB zeroes all gas flows (ATM_MFC, S_MFC, ' +
      'DIVERT_MFC, BOOST_MFC → 0 SCCM), enables PlatenVacuum and ProcessVacuum, and turns on MachineLight. ' +
      'Verify sequence completes without alarm before proceeding.',
    kewbSequence: 'Machine Start-Up',
    conceptIds: ['ajp-startup-procedure', 'ajp-machine-systems'],
    probeConceptId: 'ajp-startup-procedure',
    linkedProbeIds: [],
    dependencies: ['CANON-STARTUP-001'],
    safetyOrder: true,
    variationZone: false,
    faultCandidates: ['FAULT-STAGE-HOME-FAIL-001'],
    difficultyRange: ['novice', 'beginner'],
    isBoardTest: false,
  },
  {
    id: 'CANON-STARTUP-003',
    phase: 'startup',
    title: 'System Assembly (Cassette Change)',
    content:
      'Assemble ink vial: seat membrane and O-ring in holder, attach to vial body, install ferrules. ' +
      'Sonicate ink 5–10 minutes, draw 3 mL into syringe, deposit through fill hole, replace fill screw hand-tight. ' +
      'Fill ultrasonic atomization well with DI water to bottom of splash guard. ' +
      'Assemble nozzle components in order (appropriate diameter for task), tighten cap hand-tight. ' +
      'Install cartridge in printer — align bayonet, slide firmly to back of motion assembly, ' +
      'secure clip and plug communication cable (red dot forward). ' +
      'Mount nozzle — align gas connections, secure with clip and thumb screw finger-tight. ' +
      'Insert ¼" tubing from nozzle body to ink vial ferrule until fully seated.',
    kewbSequence: '1 - Cassette Change',
    conceptIds: ['ajp-machine-systems', 'ajp-startup-procedure'],
    probeConceptId: 'ajp-machine-systems',
    linkedProbeIds: [],
    dependencies: ['CANON-STARTUP-002'],
    safetyOrder: false,
    variationZone: true,
    faultCandidates: ['FAULT-LEAK-ORING-001', 'FAULT-LEAK-FITTING-001'],
    difficultyRange: ['beginner', 'intermediate'],
    isBoardTest: false,
  },
  {
    id: 'CANON-STARTUP-004',
    phase: 'startup',
    title: 'UA Leak Check (KEWB Sequence 2) — Hard Gate',
    content:
      'Run "2 - UA Leak Check" sequence in KEWB. When prompted, plug the mist tube exit on the ink vial. ' +
      'KEWB turns on Sheath (S_MFC) and Atomizer (ATM_MFC) flows, waits for system pressure >2 PSI, ' +
      'then captures starting pressure and measures decay over a timed window. ' +
      'Three outcomes: (1) PASS — no leak, KEWB proceeds; ' +
      '(2) small leak detected — remove plug when prompted and reassess; ' +
      '(3) large leak — hard stop, check all O-rings in ink vial assembly, cartridge seating and latch, ' +
      'tube connections at ink tube/vial/nozzle. CRITICAL: Do not start UA process with a known leak — ' +
      'nanoparticle aerosol exposure risk. Re-assemble and re-run leak check until PASS before continuing.',
    kewbSequence: '2 - UA Leak Check',
    conceptIds: ['ajp-startup-procedure', 'ajp-safety-protocols', 'ajp-machine-systems'],
    probeConceptId: 'ajp-startup-procedure',
    linkedProbeIds: [],
    dependencies: ['CANON-STARTUP-003'],
    safetyOrder: true,
    variationZone: true,
    faultCandidates: ['FAULT-LEAK-ORING-001', 'FAULT-LEAK-FITTING-001'],
    difficultyRange: ['beginner', 'intermediate'],
    isBoardTest: false,
    isGate: true,
  },
  {
    id: 'CANON-STARTUP-005',
    phase: 'startup',
    title: 'UA Start Process (KEWB Sequence 3)',
    content:
      'Run "3 - UA Start Process" sequence. KEWB resets fixture to world coordinates, ' +
      'moves to dump zone, enables heater circuit, sets BUB_HEAT, UA_HEAT, and PLATEN_HEAT temperatures, ' +
      'then waits for temperature stabilization (this pause is expected — 3–5 minutes total). ' +
      'Once temps are stable, KEWB runs the startup recipe pre-configured for the loaded ink ' +
      '(baseline: Novacentrix Metalon JS-A426, see PARAM-INK-IDENTITY-001) and nozzle size. ' +
      'Normal indicators: KEWB shows "Recipe Has Started"; pressure in nominal band; ' +
      'bubbler, UA heater, and platen temps reaching setpoints. ' +
      'If an alarm fires (Bubbler Temp Too Low = Critical/Severity 3; UA Temp Too High = Error/Severity 2), ' +
      'acknowledge in KEWB Alarms panel and diagnose before proceeding.',
    kewbSequence: '3 - UA Start Process',
    conceptIds: ['ajp-startup-procedure', 'ajp-process-parameters', 'ajp-machine-systems'],
    probeConceptId: 'ajp-startup-procedure',
    linkedProbeIds: ['PROBE-GAS-SEQUENCE-START-001'],
    dependencies: ['CANON-STARTUP-004'],
    safetyOrder: true,
    variationZone: false,
    faultCandidates: ['FAULT-NO-ATOMIZATION-001', 'FAULT-ATOMIZER-PRESSURE-HIGH-001'],
    difficultyRange: ['beginner', 'intermediate'],
    isBoardTest: false,
  },
  {
    id: 'CANON-STARTUP-006',
    phase: 'startup',
    title: 'Z-Height Calibration (KEWB Sequence 4)',
    content:
      'Run "4 - Set Z-height with Alignment Camera to Nozzle offset" sequence. ' +
      'Stack 4 microscope slides with the top slide cantilevered ("diving board") under the nozzle. ' +
      'Using KEWB jog controls, step nozzle down until it just touches the top slide. ' +
      'Remove all but one slide. KEWB prints a + mark; align alignment camera crosshairs to the printed +, ' +
      'confirming X-Y registration and camera focus. ' +
      'Standoff distance nominal range: 3–7 mm. ' +
      'Verify nozzle will not collide with taller components on the substrate at the chosen Z offset.',
    kewbSequence: '4 - Set Z-height with Alignment Camera to Nozzle offset',
    conceptIds: ['ajp-process-parameters', 'ajp-machine-systems', 'ajp-startup-procedure'],
    probeConceptId: 'ajp-process-parameters',
    linkedProbeIds: [],
    dependencies: ['CANON-STARTUP-005'],
    safetyOrder: false,
    variationZone: true,
    faultCandidates: ['FAULT-STANDOFF-TOO-SMALL-001', 'FAULT-STANDOFF-TOO-LARGE-001'],
    difficultyRange: ['beginner', 'intermediate'],
    isBoardTest: false,
  },
];

// ─── Phase 2 — Operation (4 steps) ────────────────────────────────

const OPERATION: CanonicalStep[] = [
  {
    id: 'CANON-OP-001',
    phase: 'operation',
    title: 'Load New Part and Fiducial Alignment (KEWB Sequence 5)',
    content:
      'Copy repair toolpath to flash drive, drop into "User Toolpaths" folder on printer computer. ' +
      'Run "5 - Load New Part" sequence. ' +
      'IMPORTANT: Allow the printer to jog to the starting position BEFORE placing the board — ' +
      'placing early risks a nozzle collision with board components. ' +
      'Once at position, place damaged board in fixture, close printer door. ' +
      'Jog in positive Z to clear the board, bring board into focus, ' +
      'and center the first fiducial in the crosshairs per the repair diagram. ' +
      'Set the second fiducial offset in the dialog and center it. ' +
      'Inspect board surface under alignment camera before committing — remove contamination (fingerprint oils, ' +
      'flux residue) with IPA wipe and lint-free swab, unidirectional, minimum 30 s dry time. ' +
      'Connect ESD wrist strap before any PCB handling.',
    kewbSequence: '5 - Load New Part',
    conceptIds: ['ajp-machine-systems', 'ajp-safety-protocols', 'ajp-process-parameters'],
    probeConceptId: 'ajp-machine-systems',
    linkedProbeIds: ['PROBE-ESD-PROTOCOL-001'],
    dependencies: ['CANON-STARTUP-006'],
    safetyOrder: false,
    variationZone: true,
    faultCandidates: ['FAULT-ESD-DAMAGE-001', 'FAULT-CONTAMINATION-PRE-PRINT-001', 'FAULT-STAGE-HOME-FAIL-001'],
    difficultyRange: ['beginner', 'intermediate'],
    isBoardTest: false,
  },
  {
    id: 'CANON-OP-002',
    phase: 'operation',
    title: 'Print and Inline Laser Sinter (KEWB Sequence 6)',
    content:
      'Run "6 - Print Board with Laser Sintering" sequence. ' +
      'When prompted, enter print speed, rapid speed, and number of print loops per repair instructions ' +
      '(recommended starting values: print speed 2–3 mm/s, rapid speed 10 mm/s, 2–4 loops). ' +
      'Hit proceed — KEWB runs the toolpath, then prompts for laser sinter parameters ' +
      '(laser print speed, rapid speed, number of passes). ' +
      'Monitor KEWB pressure during print: flat ±2% = nominal; rising staircase = developing clog. ' +
      'Watch plume on process camera. ' +
      'Do NOT leave machine unattended during the first 5 minutes. ' +
      'Once sequence completes, KEWB returns printer to dump zone.',
    kewbSequence: '6 - Print Board with Laser Sintering',
    conceptIds: ['ajp-process-parameters', 'ajp-print-quality', 'ajp-fault-diagnosis'],
    probeConceptId: 'ajp-print-quality',
    linkedProbeIds: ['PROBE-PRESSURE-INTERPRETATION-001'],
    dependencies: ['CANON-OP-001'],
    safetyOrder: false,
    variationZone: true,
    faultCandidates: [
      'FAULT-CLOG-PARTIAL-001', 'FAULT-CLOG-FULL-001',
      'FAULT-BLOB-FORMATION-001', 'FAULT-OVERSPRAY-001',
      'FAULT-DROPOUT-001', 'FAULT-SINTER-INCOMPLETE-001',
    ],
    difficultyRange: ['intermediate', 'expert'],
    isBoardTest: false,
  },
  {
    id: 'CANON-OP-003',
    phase: 'operation',
    title: 'In-Process Monitoring',
    content:
      'During the print run: check KEWB pressure trend (rising = clog developing), ' +
      'inspect plume visually (narrowing + pressure rise = partial clog signature), ' +
      'watch for blob accumulation on nozzle tip via process camera. ' +
      'Every 15 minutes: spot-check deposited line width under camera. ' +
      'Log any anomalies immediately. ' +
      'If a KEWB alarm fires: navigate to Alarms button (bottom right), click "Ack All Alarms" as needed, ' +
      'diagnose before resuming. ' +
      'If blob falls on PCB: abort sequence immediately and assess for shorts before sintering.',
    kewbSequence: null,
    conceptIds: ['ajp-fault-diagnosis', 'ajp-print-quality', 'ajp-process-parameters'],
    probeConceptId: 'ajp-fault-diagnosis',
    linkedProbeIds: ['PROBE-PRESSURE-INTERPRETATION-001', 'PROBE-ABORT-DECISION-001'],
    dependencies: ['CANON-OP-002'],
    safetyOrder: false,
    variationZone: true,
    faultCandidates: [
      'FAULT-CLOG-PARTIAL-001', 'FAULT-CLOG-FULL-001',
      'FAULT-BLOB-FORMATION-001', 'FAULT-DROPOUT-001',
      'FAULT-ATOMIZER-PRESSURE-HIGH-001',
    ],
    difficultyRange: ['intermediate', 'expert'],
    isBoardTest: false,
  },
  {
    id: 'CANON-OP-004',
    phase: 'operation',
    title: 'End-of-Print Nozzle and Sequence Check',
    content:
      'After KEWB sequence completes and printer returns to dump zone: ' +
      'open door, inspect nozzle tip under camera or magnification before removing board. ' +
      'Check for blob accumulation or dried ink on tip exterior. Document any anomalies. ' +
      'Do not remove board until all motion has stopped and KEWB shows idle status.',
    kewbSequence: null,
    conceptIds: ['ajp-machine-systems', 'ajp-fault-diagnosis'],
    probeConceptId: 'ajp-fault-diagnosis',
    linkedProbeIds: [],
    dependencies: ['CANON-OP-003'],
    safetyOrder: false,
    variationZone: true,
    faultCandidates: ['FAULT-BLOB-FORMATION-001', 'FAULT-NOZZLE-DAMAGE-001'],
    difficultyRange: ['beginner', 'intermediate'],
    isBoardTest: false,
  },
];

// ─── Phase 3 — Post-Print / Board Testing (4 steps, laser-sinter only) ───

const POST_PRINT: CanonicalStep[] = [
  {
    id: 'CANON-POST-001',
    phase: 'post-print',
    title: 'Post-Sinter Visual Inspection',
    content:
      'Inspect sintered trace under magnification (10–40×). ' +
      'PASS indicators: metallic silver, reflective, fused flush with substrate surface. ' +
      'REJECT indicators: dark or matte appearance (incomplete sinter — laser energy or passes insufficient), ' +
      'yellowing or discoloration around trace (thermal damage to substrate or adjacent components), ' +
      'cracking or delamination (rapid thermal gradient or adhesion failure). ' +
      'If trace is incomplete: assess whether re-sinter pass is feasible given substrate condition. ' +
      'Do NOT run electrical tests before completing visual — a cracked trace can show continuity then open under vibration.',
    kewbSequence: null,
    conceptIds: ['ajp-print-quality', 'ajp-fault-diagnosis'],
    probeConceptId: 'ajp-print-quality',
    linkedProbeIds: ['PROBE-TACIT-LINE-QUALITY-001'],
    dependencies: ['CANON-OP-004'],
    safetyOrder: false,
    variationZone: true,
    faultCandidates: ['FAULT-SINTER-INCOMPLETE-001', 'FAULT-SINTER-THERMAL-DAMAGE-001'],
    difficultyRange: ['intermediate', 'expert'],
    isBoardTest: true,
  },
  {
    id: 'CANON-POST-002',
    phase: 'post-print',
    title: 'Post-Sinter Resistance Measurement',
    content:
      'Measure resistance of sintered trace using 4-probe technique to exclude lead resistance. ' +
      'Target for a well-sintered continuous Ag trace of typical repair length: <1 Ω. ' +
      '>10 Ω indicates incomplete sintering — candidate for re-sinter pass if substrate permits. ' +
      'Record measured value for documentation. ' +
      'A trace that passes visual but fails resistance usually indicates subsurface porosity from incomplete sintering.',
    kewbSequence: null,
    conceptIds: ['ajp-print-quality', 'ajp-process-parameters'],
    probeConceptId: 'ajp-print-quality',
    linkedProbeIds: [],
    dependencies: ['CANON-POST-001'],
    safetyOrder: false,
    variationZone: true,
    faultCandidates: ['FAULT-SINTER-INCOMPLETE-001'],
    difficultyRange: ['intermediate', 'advanced'],
    isBoardTest: true,
  },
  {
    id: 'CANON-POST-003',
    phase: 'post-print',
    title: 'Continuity and Isolation Test',
    content:
      'Test full circuit path continuity for the repaired net (target: ≤1 Ω end-to-end). ' +
      'Test isolation to all adjacent nets (target: >1 MΩ). ' +
      'Shorts to adjacent nets are a common failure from overspray — ' +
      'the isolation test catches this before board-level power-on. ' +
      'Document all test results with net labels.',
    kewbSequence: null,
    conceptIds: ['ajp-print-quality', 'ajp-fault-diagnosis'],
    probeConceptId: 'ajp-print-quality',
    linkedProbeIds: [],
    dependencies: ['CANON-POST-002'],
    safetyOrder: false,
    variationZone: true,
    faultCandidates: ['FAULT-OVERSPRAY-001'],
    difficultyRange: ['advanced', 'expert'],
    isBoardTest: true,
  },
  {
    id: 'CANON-POST-004',
    phase: 'post-print',
    title: 'Functional Verification and Documentation',
    content:
      'If board function can be safely verified: power-on test per equipment spec. ' +
      'Compare output to pre-damage baseline. Document pass/fail against acceptance criteria. ' +
      'Record: operator ID, date, ink batch (Novacentrix Metalon JS-A426 lot), nozzle diameter, ' +
      'print speed and loops, laser sinter speed and passes, resistance values, and functional result.',
    kewbSequence: null,
    conceptIds: ['ajp-print-quality', 'ajp-safety-protocols'],
    probeConceptId: null,
    linkedProbeIds: [],
    dependencies: ['CANON-POST-003'],
    safetyOrder: false,
    variationZone: false,
    faultCandidates: [],
    difficultyRange: ['intermediate', 'expert'],
    isBoardTest: true,
  },
];

// ─── Phase 4 — Shutdown (3 steps) ─────────────────────────────────

const SHUTDOWN: CanonicalStep[] = [
  {
    id: 'CANON-SHUTDOWN-001',
    phase: 'shutdown',
    title: 'Shutdown UA Process (KEWB Sequence 7)',
    content:
      'Run "7 - Shutdown UA Process" sequence. ' +
      'KEWB resets fixture to world coordinates, moves to dump zone, turns off Javelin divert valve, ' +
      'then runs the shutdown recipe. ' +
      'Wait until KEWB shows idle — all gas flows return to zero and heating is disabled. ' +
      'Do not disassemble while sequence is running.',
    kewbSequence: '7 - Shutdown UA Process',
    conceptIds: ['ajp-startup-procedure'],
    probeConceptId: 'ajp-startup-procedure',
    linkedProbeIds: ['PROBE-GAS-SEQUENCE-STOP-001'],
    dependencies: ['CANON-POST-004'],
    safetyOrder: true,
    variationZone: false,
    faultCandidates: ['FAULT-CLOG-FULL-001'],
    difficultyRange: ['beginner', 'intermediate'],
    isBoardTest: false,
  },
  {
    id: 'CANON-SHUTDOWN-002',
    phase: 'shutdown',
    title: 'Machine Shut Down (KEWB Machine Shut Down)',
    content:
      'Run "Machine Shut Down" sequence. KEWB resets fixture to world coordinates, ' +
      'zeroes all gas flows (ATM_MFC, S_MFC, DIVERT_MFC, BOOST_MFC → 0), ' +
      'disables PlatenVacuum and ProcessVacuum, turns off MachineLight, ' +
      'and moves stage to home position (X 200, Y 150, Z –5 in Main coordinates). ' +
      'Verify sequence completes without alarm.',
    kewbSequence: 'Machine Shut Down',
    conceptIds: ['ajp-startup-procedure'],
    probeConceptId: null,
    linkedProbeIds: [],
    dependencies: ['CANON-SHUTDOWN-001'],
    safetyOrder: true,
    variationZone: false,
    faultCandidates: [],
    difficultyRange: ['novice', 'beginner'],
    isBoardTest: false,
  },
  {
    id: 'CANON-SHUTDOWN-003',
    phase: 'shutdown',
    title: 'Disassembly, Cleaning, and Storage',
    content:
      'Reverse assembly steps to remove cartridge and nozzle. ' +
      'Sonicate all ink-contacted components in a beaker of the base solvent (DI water for JS-A426) — ' +
      'longer the ink sits, the more likely it corrodes internal components; clean promptly. ' +
      'Inspect O-rings under magnification; replace any that appear dry, cracked, or ink-caked. ' +
      'Store remaining Novacentrix Metalon JS-A426 ink refrigerated at <5 °C. ' +
      'Store Norland NEA 121 dielectric in amber or opaque vials (UV-curable — light-sensitive). ' +
      'Dispose of ink-contaminated solvent per lab chemical waste procedures (silver nanoparticle waste).',
    kewbSequence: null,
    conceptIds: ['ajp-machine-systems', 'ajp-safety-protocols', 'ajp-startup-procedure'],
    probeConceptId: 'ajp-machine-systems',
    linkedProbeIds: [],
    dependencies: ['CANON-SHUTDOWN-002'],
    safetyOrder: false,
    variationZone: false,
    faultCandidates: [],
    difficultyRange: ['beginner', 'intermediate'],
    isBoardTest: false,
  },
];

// ─── Exports ──────────────────────────────────────────────────────

/** All 17 canonical steps in phase order */
export const CANONICAL_STEPS: CanonicalStep[] = [
  ...STARTUP,
  ...OPERATION,
  ...POST_PRINT,
  ...SHUTDOWN,
];

/** Steps by phase */
export const CANONICAL_STEPS_BY_PHASE = {
  startup: STARTUP,
  operation: OPERATION,
  'post-print': POST_PRINT,
  shutdown: SHUTDOWN,
} as const;

/** Lookup by step ID */
export function getCanonicalStep(id: string): CanonicalStep | undefined {
  return CANONICAL_STEPS.find((s) => s.id === id);
}

/** All steps that exercise a given concept */
export function getStepsForConcept(conceptId: string): CanonicalStep[] {
  return CANONICAL_STEPS.filter((s) => s.conceptIds.includes(conceptId));
}

/** Steps that are valid fault injection points for a given fault */
export function getFaultInjectionSteps(faultId: string): CanonicalStep[] {
  return CANONICAL_STEPS.filter((s) => s.faultCandidates.includes(faultId));
}

/** Hard gate steps — failure requires diagnosis before the workflow can continue */
export const GATE_STEPS = CANONICAL_STEPS.filter((s) => s.isGate === true);

/** Steps that are board-testing steps */
export const BOARD_TEST_STEPS = CANONICAL_STEPS.filter((s) => s.isBoardTest);

/** Steps driven by a named KEWB sequence */
export const KEWB_SEQUENCE_STEPS = CANONICAL_STEPS.filter((s) => s.kewbSequence !== null);
