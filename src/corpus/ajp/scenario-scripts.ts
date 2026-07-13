/**
 * Scripted ScenarioDefinition library for AJP Scenario Mode (design doc §4.3).
 * Six scenarios covering nominal walkthrough, clog response, gas sequence error,
 * sinter parameter decision, ESD risk, and leak diagnosis.
 *
 * Narrator text quotes corpus node content directly — no LLM generation.
 * Each scenario uses fault injection or safety gate nodes from the AJP graph.
 */
import type { ScenarioDefinition } from '../../engine/scenario/types';

// ─── SCENARIO-NOMINAL-001 ─────────────────────────────────────────

const SCENARIO_NOMINAL: ScenarioDefinition = {
  id: 'SCENARIO-NOMINAL-001',
  label: 'HD2 Full Nominal Run',
  description:
    'Walk through a complete Optomec HD2 print session from setup to verified sinter. No faults injected — five Mentor probe checkpoints test understanding of sequence dependencies and safety rules.',
  difficulty: 'beginner',
  steps: [
    {
      id: 'NOMINAL-STEP-001',
      phase: 'SETUP',
      narratorText:
        'The HD2 is powered on and KEWB is initialised. The PCB has been placed in the fixture and the nozzle is installed. Before starting gas flows, you are ready to review the startup checklist.',
      mentorProbeId: 'PROBE-NOZZLE-INSPECT-001',
    },
    {
      id: 'NOMINAL-STEP-002',
      phase: 'STARTUP',
      narratorText:
        'KEWB Sequence 3 (UA Start Process): sheath gas raised to nominal flow, atomizer gas enabled next, exhaust confirmed active. KEWB pressure in nominal band. UA emits a steady high-pitched tone — uniform mist visible in the vial.',
      mentorProbeId: 'PROBE-GAS-SEQUENCE-START-001',
      safetyGateNodeId: 'FAULT-GAS-SEQUENCE-WRONG-001',
    },
    {
      id: 'NOMINAL-STEP-003',
      phase: 'INK_LOAD',
      narratorText:
        'Ink is loaded and KEWB confirms stable pressure. A test trace is printed on a glass slide. The trace shows consistent width with sharp edges — no overspray observed.',
      mentorProbeId: 'PROBE-PRESSURE-INTERPRETATION-001',
    },
    {
      id: 'NOMINAL-STEP-004',
      phase: 'LINE_TUNE',
      narratorText:
        'Parameters are tuned. Print speed and flow are adjusted until the test trace width matches the design target. Z-height is verified at the actual PCB repair location using the 3-slide method.',
    },
    {
      id: 'NOMINAL-STEP-005',
      phase: 'PRINT',
      narratorText:
        'The repair trace is printed. KEWB pressure remains steady throughout. No anomalies detected. Post-print inspection under magnification shows consistent trace with no blobs or gaps.',
    },
    {
      id: 'NOMINAL-STEP-006',
      phase: 'POST_PRINT',
      narratorText:
        'KEWB Sequence 7 (Gas Shutdown): atomizer gas off first — 10-second wait for residual aerosol to clear the transfer line — exhaust off second — 60-second wait for pressure to equalize — sheath gas off last. Nozzle removed and stored.',
      mentorProbeId: 'PROBE-GAS-SEQUENCE-STOP-001',
    },
    {
      id: 'NOMINAL-STEP-007',
      phase: 'SINTER',
      narratorText:
        'KEWB Sequence 6 (Laser Sinter) complete. Post-sinter visual inspection: the trace shows a uniform silver metallic sheen — no dark or matte patches. A dark or matte appearance would indicate incomplete sintering and require a rescue sinter decision.',
      mentorProbeId: 'PROBE-SINTER-PARAMETERS-001',
      safetyGateNodeId: 'FAULT-SINTER-THERMAL-DAMAGE-001',
    },
    {
      id: 'NOMINAL-STEP-008',
      phase: 'VERIFY',
      narratorText:
        'Post-sinter continuity check: four-probe resistance measurement on the repaired trace. The measured resistance matches the theoretical value for the deposited silver geometry.',
    },
    {
      id: 'NOMINAL-STEP-009',
      phase: 'COMPLETE',
      narratorText:
        'Repair complete. Trace is conductive. PCB substrate shows no discoloration. All documentation is complete.',
    },
  ],
  faultInjections: [],
};

// ─── SCENARIO-CLOG-MID-PRINT-001 ─────────────────────────────────

const SCENARIO_CLOG: ScenarioDefinition = {
  id: 'SCENARIO-CLOG-MID-PRINT-001',
  label: 'Clog Mid-Print',
  description:
    'A partial clog develops during printing. KEWB pressure begins to rise and line quality degrades. The learner must decide to abort before the clog progresses and a blob falls on the PCB.',
  difficulty: 'intermediate',
  steps: [
    {
      id: 'CLOG-STEP-001',
      phase: 'SETUP',
      narratorText:
        'HD2 startup complete. KEWB nominal. Ink loaded and test trace verified. Print of repair trace has begun.',
    },
    {
      id: 'CLOG-STEP-002',
      phase: 'PRINT',
      narratorText:
        'KEWB pressure is nominal and the trace is printing normally. Line width matches the tuned target.',
      mentorProbeId: 'PROBE-PRESSURE-INTERPRETATION-001',
    },
    {
      id: 'CLOG-STEP-003',
      phase: 'PRINT',
      narratorText:
        'KEWB pressure has risen 15% above nominal and continues to climb slowly. The trace appears slightly narrower than before. KEWB current draw is unchanged.',
      faultInjectionId: 'FAULT-CLOG-PARTIAL-001',
      safetyGateNodeId: 'FAULT-BLOB-FORMATION-001',
    },
    {
      id: 'CLOG-STEP-004',
      phase: 'PRINT',
      narratorText:
        'Pressure continues to rise. KEWB shows a spike event. A blob has formed on the nozzle tip — visible in the nozzle camera. The stage is still moving.',
      mentorProbeId: 'PROBE-ABORT-DECISION-001',
      safetyGateNodeId: 'FAULT-BLOB-FORMATION-001',
    },
    {
      id: 'CLOG-STEP-005',
      phase: 'POST_PRINT',
      narratorText:
        'Abort sequence executed. KEWB Sequence 7 (Gas Shutdown): atomizer off, 10-second wait, exhaust off, 60-second wait, sheath off. Nozzle and PCB inspected under magnification. No blob on PCB confirmed. Fault diagnosis begins.',
    },
    {
      id: 'CLOG-STEP-006',
      phase: 'CLEAN',
      narratorText:
        'Nozzle cleaned. Impactor inspected. Root cause identified as partial impactor occlusion. System restarted after cleaning.',
    },
    {
      id: 'CLOG-STEP-007',
      phase: 'COMPLETE',
      narratorText:
        'Reprint successful after clog resolution. Trace passes continuity check.',
    },
  ],
  faultInjections: [
    {
      faultNodeId: 'FAULT-CLOG-PARTIAL-001',
      triggerStepId: 'CLOG-STEP-003',
      narratorAnnouncement:
        'KEWB pressure has risen above nominal and continues to climb. A developing partial clog is indicated. Continued printing risks a blob forming and falling on the PCB.',
      missedConsequenceId: 'CONSEQUENCE-CLOG-UNDETECTED-PRINT-001',
    },
  ],
};

// ─── SCENARIO-GAS-SEQUENCE-ERROR-001 ─────────────────────────────

const SCENARIO_GAS_SEQUENCE: ScenarioDefinition = {
  id: 'SCENARIO-GAS-SEQUENCE-ERROR-001',
  label: 'Gas Sequence Error',
  description:
    'Atomizer gas is enabled before sheath gas during startup — the most common procedural error. Learner must recognise and correct the sequence before unsheathed nanoparticle aerosol is released.',
  difficulty: 'intermediate',
  steps: [
    {
      id: 'GAS-SEQ-STEP-001',
      phase: 'STARTUP',
      narratorText:
        'HD2 is powered on. KEWB is initialised. You are about to begin the gas startup sequence.',
      mentorProbeId: 'PROBE-GAS-SEQUENCE-START-001',
    },
    {
      id: 'GAS-SEQ-STEP-002',
      phase: 'STARTUP',
      narratorText:
        'Atomizer gas flow has been enabled — but sheath gas has not yet been started. KEWB shows atomizer current rising. No sheath gas flow is present to focus or contain the aerosol.',
      faultInjectionId: 'FAULT-GAS-SEQUENCE-WRONG-001',
      safetyGateNodeId: 'FAULT-GAS-SEQUENCE-WRONG-001',
    },
    {
      id: 'GAS-SEQ-STEP-003',
      phase: 'STARTUP',
      narratorText:
        'Atomizer OFF. Gas flows zeroed. Nozzle inspected — partial clog from unsheathed aerosol. System safe state restored. Incident documentation initiated.',
    },
    {
      id: 'GAS-SEQ-STEP-004',
      phase: 'STARTUP',
      narratorText:
        'Correct startup sequence: Sheath gas ON → stable → Atomizer gas ON → Exhaust ON. KEWB confirms nominal pressure across all channels.',
    },
    {
      id: 'GAS-SEQ-STEP-005',
      phase: 'COMPLETE',
      narratorText:
        'Startup complete. The gas sequence error was caught and corrected before aerosol release. System ready for ink load.',
    },
  ],
  faultInjections: [
    {
      faultNodeId: 'FAULT-GAS-SEQUENCE-WRONG-001',
      triggerStepId: 'GAS-SEQ-STEP-002',
      narratorAnnouncement:
        'Atomizer gas is active without sheath gas. Unsheathed Ag NP aerosol is being generated with no focusing flow. Nanoparticle exposure hazard — correct immediately.',
      missedConsequenceId: 'CONSEQUENCE-NANOPARTICLE-EXPOSURE-001',
    },
  ],
};

// ─── SCENARIO-SINTER-DECISION-001 ─────────────────────────────────

const SCENARIO_SINTER: ScenarioDefinition = {
  id: 'SCENARIO-SINTER-DECISION-001',
  label: 'Rescue Sinter Decision',
  description:
    'The inline laser sinter pass (KEWB Sequence 6) completed but the trace looks dark and matte — resistance measures 18 Ω. The learner must decide whether to attempt a bench-top rescue sinter, select the correct OEM profile for a mixed FR4/polyimide substrate, and understand the asymmetric risk: too cool is recoverable, too hot destroys the board.',
  difficulty: 'advanced',
  steps: [
    {
      id: 'SINTER-STEP-001',
      phase: 'POST_PRINT',
      narratorText:
        'KEWB Sequence 6 (Laser Sinter) completed. Post-sinter inspection: the trace appears dark and matte — not the expected bright silver sheen. Four-probe resistance measurement reads 18 Ω on a trace expected to be < 1 Ω when fully sintered. The substrate is a mixed FR4/polyimide board. FR4 sections have a glass transition temperature of approximately 130–135 °C.',
      mentorProbeId: 'PROBE-SINTER-PARAMETERS-001',
    },
    {
      id: 'SINTER-STEP-002',
      phase: 'SINTER',
      narratorText:
        'You have decided to attempt a bench-top rescue sinter. Three OEM-specified profiles are available for Novacentrix Metalon JS-A426: 100 °C / 12 hr, 185 °C / 4 hr, and 250 °C / 10 min. The FR4 sections of the board set the thermal ceiling. You must select a profile and justify the choice.',
      safetyGateNodeId: 'FAULT-SINTER-THERMAL-DAMAGE-001',
    },
    {
      id: 'SINTER-STEP-003',
      phase: 'SINTER',
      narratorText:
        'Rescue sinter running at 100 °C for 12 hours — the only OEM profile that stays below the FR4 glass transition temperature. The bench-top oven thermocouple is at air level; substrate temperature confirmed within 3 °C of air setpoint using a contact thermocouple.',
    },
    {
      id: 'SINTER-STEP-004',
      phase: 'VERIFY',
      narratorText:
        'Rescue sinter complete. PCB removed and cooled to room temperature. Four-probe resistance measurement on the repaired trace.',
    },
    {
      id: 'SINTER-STEP-005',
      phase: 'COMPLETE',
      narratorText:
        'Resistance now reads 0.4 Ω — within acceptable range. Substrate shows no discoloration or delamination. The 100 °C / 12 hr profile was the correct choice: it achieved conductivity without exceeding the FR4 Tg.',
    },
  ],
  faultInjections: [],
};

// ─── SCENARIO-ESD-RISK-001 ─────────────────────────────────────────

const SCENARIO_ESD: ScenarioDefinition = {
  id: 'SCENARIO-ESD-RISK-001',
  label: 'ESD Risk — Board Handling',
  description:
    'Before picking up the PCB for fixture placement, the learner must complete all ESD precautions in correct order. Skipping or reordering steps exposes the board to invisible, irreversible ESD damage.',
  difficulty: 'beginner',
  steps: [
    {
      id: 'ESD-STEP-001',
      phase: 'SETUP',
      narratorText:
        'The PCB is on the bench ready to be moved to the HD2 fixture. Lab humidity is 35% RH — below the 40% threshold where static charge accumulation increases significantly.',
      mentorProbeId: 'PROBE-ESD-PROTOCOL-001',
      safetyGateNodeId: 'FAULT-ESD-DAMAGE-001',
    },
    {
      id: 'ESD-STEP-002',
      phase: 'SETUP',
      narratorText:
        'Wrist strap donned and tested with tester on ESD mat. Both hands touched ESD mat before picking up board. Board transported on ESD mat surface. Fixture verified ESD-safe. Ionising blower activated (humidity < 40% RH).',
    },
    {
      id: 'ESD-STEP-003',
      phase: 'SETUP',
      narratorText:
        'PCB secured in fixture. ESD precautions complete. Ready to proceed with nozzle installation and startup.',
    },
    {
      id: 'ESD-STEP-004',
      phase: 'COMPLETE',
      narratorText:
        'Setup complete. All ESD precautions followed in correct sequence. Board integrity preserved.',
    },
  ],
  faultInjections: [],
};

// ─── SCENARIO-LEAK-DIAGNOSIS-001 ──────────────────────────────────

const SCENARIO_LEAK: ScenarioDefinition = {
  id: 'SCENARIO-LEAK-DIAGNOSIS-001',
  label: 'Leak Diagnosis at Startup',
  description:
    'KEWB pressure is below nominal during startup and a faint white haze is visible near a fitting. Learner must zero all gas, isolate the leak, and resolve it before starting the atomizer.',
  difficulty: 'intermediate',
  steps: [
    {
      id: 'LEAK-STEP-001',
      phase: 'STARTUP',
      narratorText:
        'Sheath gas has been enabled. KEWB sheath pressure reads 8% below the nominal band and continues to drift lower. You have not yet enabled atomizer gas.',
      faultInjectionId: 'FAULT-LEAK-ORING-001',
      safetyGateNodeId: 'FAULT-LEAK-FITTING-001',
    },
    {
      id: 'LEAK-STEP-002',
      phase: 'STARTUP',
      narratorText:
        'Visual inspection confirms a faint white haze near the printhead connection. This is consistent with a gas leak at the O-ring or fitting. Atomizer gas has NOT been started.',
      safetyGateNodeId: 'FAULT-LEAK-FITTING-001',
    },
    {
      id: 'LEAK-STEP-003',
      phase: 'STARTUP',
      narratorText:
        'Sheath gas zeroed. Printhead disassembled. O-ring at printhead is cracked and lacks Apiezon grease. O-ring replaced and re-greased. Printhead reassembled.',
    },
    {
      id: 'LEAK-STEP-004',
      phase: 'STARTUP',
      narratorText:
        'Sheath gas restored. KEWB pressure is now stable in the nominal band for 90 seconds. No white haze visible. Leak resolved. Atomizer gas can now be started.',
    },
    {
      id: 'LEAK-STEP-005',
      phase: 'COMPLETE',
      narratorText:
        'Leak correctly diagnosed and resolved before atomizer startup. No nanoparticle exposure occurred. System ready to print.',
    },
  ],
  faultInjections: [
    {
      faultNodeId: 'FAULT-LEAK-ORING-001',
      triggerStepId: 'LEAK-STEP-001',
      narratorAnnouncement:
        'Sheath pressure is below nominal and drifting lower. A gas leak is suspected. Starting the atomizer now would risk unsheathed nanoparticle aerosol release.',
      missedConsequenceId: 'CONSEQUENCE-NANOPARTICLE-EXPOSURE-001',
    },
  ],
};

// ─── Exported library ──────────────────────────────────────────────

export const ajpScenarioScripts: ScenarioDefinition[] = [
  SCENARIO_NOMINAL,
  SCENARIO_CLOG,
  SCENARIO_GAS_SEQUENCE,
  SCENARIO_SINTER,
  SCENARIO_ESD,
  SCENARIO_LEAK,
];

export function getScenarioById(id: string): ScenarioDefinition | undefined {
  return ajpScenarioScripts.find((s) => s.id === id);
}
