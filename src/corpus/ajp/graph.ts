/**
 * AJP knowledge graph: typed nodes and edges (equipment, steps, faults, hazards, probes).
 * Authoritative at runtime; provenance for cited sources lives in sources/SOURCES_LOG.md.
 * Also exports the pre-scripted demo scenario steps for Scenario Mode.
 * Source citations: Stanford SNF, Boise State IML SOPs, Optomec HD2 datasheet.
 */
import type { AJPNode, AJPEdge, ScenarioStepView } from '../../types/ajp';

// ─── Graph Nodes ──────────────────────────────────────────────────

export const ajpNodes: AJPNode[] = [
  // Equipment
  {
    id: 'EQUIP-HD2-ATOMIZER-001',
    type: 'Equipment',
    content: 'Ultrasonic atomizer (UA) uses transducer vibration to aerosolize 2–3 mL of ink into 2–5 μm droplets. Preferred for low-viscosity inks and fine features. Optimal current range: 0.4–0.6 mA.',
    confidence: 'High',
    source: 'Stanford SNF AJP SOP',
  },
  {
    id: 'EQUIP-HD2-HEAD-001',
    type: 'Equipment',
    content: 'Deposition head focuses aerosol via coaxial sheath gas through a tapered nozzle (100–1000 μm ID). Sheath gas prevents ink contact with nozzle walls — critical to preventing clogging.',
    confidence: 'High',
    source: 'Boise State IML SOP',
  },

  // Parameters
  {
    id: 'PARAM-SHEATH-FLOW-001',
    type: 'Parameter',
    content: 'Sheath gas pressure nominal range: 4.5–5.5 PSI for 150 μm nozzle. Excessive sheath disrupts focus; insufficient sheath causes ink-wall contact and clogging.',
    narratorText: 'Sheath gas: {value} PSI',
    confidence: 'High',
    source: 'Stanford SNF AJP SOP',
  },
  {
    id: 'PARAM-ATOMIZER-CURRENT-001',
    type: 'Parameter',
    content: 'UA atomizer current nominal: 0.4–0.6 mA. Below range: insufficient aerosolization. Above range: over-aerosolization, widened particle distribution.',
    confidence: 'High',
    source: 'Boise State IML SOP',
  },

  // Safety
  {
    id: 'HAZARD-NANOPARTICLE-001',
    type: 'SafetyHazard',
    content: 'Silver nanoparticle ink — respiratory and dermal hazard. Nitrile gloves + N95 or higher required. Ventilation must be active. Particles present on any ink-contacted surface.',
    safetyAlert: 'Nanoparticle ink — nitrile gloves + N95 required at all times',
    confidence: 'High',
    source: 'OSHA nanoparticle handling guidelines',
  },
  {
    id: 'HAZARD-ESD-001',
    type: 'SafetyHazard',
    content: 'ESD wrist strap required before handling PCB. Static discharge can permanently damage active components on the board being repaired.',
    safetyAlert: 'ESD wrist strap required before PCB contact',
    confidence: 'High',
    source: 'IPC-7711/7721 rework standard',
  },

  // Startup Steps
  {
    id: 'STEP-STARTUP-001',
    type: 'Step',
    content: 'Pre-operation safety check: verify ventilation active, confirm PPE (nitrile gloves + N95), inspect ink vial for contamination.',
    narratorText: 'PREPARATION: Ventilation hood — GREEN. Safety cabinet — ALL CLEAR.\nInk: silver nanoparticle suspension, 2.8 mL loaded.\nPPE station: gloves and N95 available.',
    mentorProbe: 'Before approaching the machine, what personal protective equipment do you need — and specifically what risk does each item address?',
    safetyAlert: 'Silver nanoparticle ink — nitrile gloves + N95 required throughout.',
    confidence: 'High',
    source: 'Stanford SNF AJP SOP',
  },
  {
    id: 'STEP-STARTUP-002',
    type: 'Step',
    content: 'Load PCB substrate onto chuck. Connect ESD wrist strap. Verify PCB is flat and secure against chuck surface.',
    narratorText: 'SUBSTRATE LOADING: PCB loaded on chuck (FR-4, 2-layer board).\nChuck temperature: 22°C (ambient).\nESD wrist strap available at workstation.',
    mentorProbe: 'Two things must happen before you leave this step. What are they, and why does each one matter for the repair outcome?',
    confidence: 'High',
    source: 'Boise State IML SOP',
  },
  {
    id: 'STEP-STARTUP-003',
    type: 'Step',
    content: 'Open sheath gas valve and set to nominal pressure (4.5–5.5 PSI for 150 μm nozzle). Confirm KEWB reading before atomizer start.',
    narratorText: 'SHEATH GAS SETUP: Nozzle — 150 μm standard.\nKEWB gas control: standby mode.\nNominal sheath pressure: 4.5–5.5 PSI.',
    mentorProbe: 'What is the sheath gas physically doing at the print head — and what happens to print quality if it\'s set 30% below nominal?',
    confidence: 'High',
    source: 'Stanford SNF AJP SOP',
  },
  {
    id: 'STEP-STARTUP-004',
    type: 'Step',
    content: 'Activate ultrasonic atomizer. Monitor KEWB current (0.4–0.6 mA nominal) and carrier gas flow. Confirm aerosolization in ink vial window.',
    narratorText: 'ATOMIZER STARTUP: Sheath gas 5.0 PSI ✓\nUA mode selected. Ink vial: 2.8 mL loaded.\nKEWB awaiting atomizer activation.',
    mentorProbe: 'Once you activate the atomizer, what two KEWB readings confirm it is running correctly — and what would cause each to be out of range?',
    confidence: 'High',
    source: 'Boise State IML SOP',
  },
  {
    id: 'STEP-STARTUP-005-FAULT',
    type: 'Step',
    content: 'Confirm plume formation on camera. Check for nominal line width on test trace. Elevated pressure + narrowed plume = partial clog indicator.',
    narratorText: 'PLUME CHECK — ANOMALY DETECTED:\n• Camera: plume present, but NARROWER than expected\n• KEWB pressure: 6.2 PSI — ABOVE nominal (4.5–5.5 PSI)\n• Test trace: line width reduced ~30%\n• Atomizer current: 0.5 mA — still nominal\nObservation window: last 3 minutes.',
    mentorProbe: 'You have three abnormal indicators and one normal one. What pattern do they form, and what does that tell you about where in the system the problem is located?',
    safetyAlert: 'Do NOT increase atomizer pressure to compensate — pressure buildup risk.',
    confidence: 'High',
    source: 'Stanford SNF AJP SOP',
  },

  // Failure modes
  {
    id: 'FAULT-CLOG-PARTIAL-001',
    type: 'FailureMode',
    content: 'Partial nozzle occlusion. KEWB pressure slightly above nominal. Deposition line narrowed. Atomizer current normal. Often precedes full clog if uncorrected. Do NOT increase atomizer pressure.',
    confidence: 'High',
    source: 'Stanford SNF AJP SOP; Boise State IML SOP',
  },

  // Symptoms
  {
    id: 'SYMPT-HIGH-PRESSURE-001',
    type: 'Symptom',
    content: 'KEWB pressure above nominal range for the nozzle size. Combined with reduced line width and normal atomizer current = partial clog signature.',
    confidence: 'High',
    source: 'Stanford SNF AJP SOP',
  },
  {
    id: 'SYMPT-LINE-NARROW-001',
    type: 'Symptom',
    content: 'Deposition line width reduced from nominal. Combined with elevated pressure = partial or full clog. Without pressure change = standoff or speed parameter issue.',
    confidence: 'High',
    source: 'Boise State IML SOP',
  },

  // Corrective actions
  {
    id: 'ACTION-SHEATH-INCREASE-001',
    type: 'CorrectiveAction',
    content: 'First-line response to partial clog: increase sheath gas by 0.5–1.0 PSI and monitor KEWB for 2 minutes. If pressure returns to nominal and line width recovers, partial clog is cleared.',
    narratorText: 'Sheath gas increased to 6.0 PSI.\nKEWB pressure dropping: 6.2 → 5.1 PSI over 90 seconds.\nLine width returning to nominal.\nPartial clog cleared. Monitor for recurrence in 15 minutes.',
    confidence: 'High',
    source: 'Boise State IML SOP',
  },
  {
    id: 'ACTION-NOZZLE-PURGE-001',
    type: 'CorrectiveAction',
    content: 'Full nozzle disassembly and sonication for complete clog (zero deposition, very high pressure). Recovery time: 4+ hours. Appropriate only when conservative measures have failed or full clog is confirmed.',
    confidence: 'High',
    source: 'Stanford SNF AJP SOP',
  },
];

// ─── Graph Edges ──────────────────────────────────────────────────

export const ajpEdges: AJPEdge[] = [
  // Startup sequence
  { from: 'STEP-STARTUP-001', to: 'STEP-STARTUP-002', type: 'NEXT_STEP' },
  { from: 'STEP-STARTUP-002', to: 'STEP-STARTUP-003', type: 'NEXT_STEP' },
  { from: 'STEP-STARTUP-003', to: 'STEP-STARTUP-004', type: 'NEXT_STEP' },
  { from: 'STEP-STARTUP-004', to: 'STEP-STARTUP-005-FAULT', type: 'NEXT_STEP' },

  // Equipment composition
  { from: 'EQUIP-HD2-HEAD-001', to: 'PARAM-SHEATH-FLOW-001', type: 'REQUIRES' },
  { from: 'EQUIP-HD2-ATOMIZER-001', to: 'PARAM-ATOMIZER-CURRENT-001', type: 'REQUIRES' },

  // Safety requirements
  { from: 'STEP-STARTUP-001', to: 'HAZARD-NANOPARTICLE-001', type: 'REQUIRES' },
  { from: 'STEP-STARTUP-002', to: 'HAZARD-ESD-001', type: 'REQUIRES' },

  // Fault causation chain
  { from: 'FAULT-CLOG-PARTIAL-001', to: 'SYMPT-HIGH-PRESSURE-001', type: 'INDICATES' },
  { from: 'FAULT-CLOG-PARTIAL-001', to: 'SYMPT-LINE-NARROW-001', type: 'INDICATES' },
  { from: 'FAULT-CLOG-PARTIAL-001', to: 'ACTION-SHEATH-INCREASE-001', type: 'FIXED_BY' },
  { from: 'FAULT-CLOG-PARTIAL-001', to: 'HAZARD-NANOPARTICLE-001', type: 'REQUIRES' },

  // Symptoms indicate fault
  { from: 'SYMPT-HIGH-PRESSURE-001', to: 'FAULT-CLOG-PARTIAL-001', type: 'INDICATES' },
  { from: 'SYMPT-LINE-NARROW-001', to: 'FAULT-CLOG-PARTIAL-001', type: 'INDICATES' },

  // Step 5 triggers fault check
  { from: 'STEP-STARTUP-005-FAULT', to: 'FAULT-CLOG-PARTIAL-001', type: 'CAUSES' },
];

// ─── Demo Scenario Steps ──────────────────────────────────────────
// Pre-scripted Scenario Mode walkthrough. Each step is corpus-grounded
// (narratorText and mentorProbe sourced from graph nodes above).

export const DEMO_SCENARIO_STEPS: ScenarioStepView[] = [
  {
    stepId: 'STEP-STARTUP-001',
    situation: 'PREPARATION: Ventilation hood — GREEN. Safety cabinet — ALL CLEAR.\nInk: silver nanoparticle suspension, 2.8 mL loaded.\nPPE station: gloves and N95 available.',
    mentorProbe: 'Before approaching the machine, what personal protective equipment do you need — and specifically what risk does each item address?',
    safetyAlert: 'Silver nanoparticle ink — nitrile gloves + N95 required throughout.',
    isFaultStep: false,
    actions: [
      {
        id: 'a',
        label: 'Put on nitrile gloves and N95, verify ventilation is active, then approach machine',
        isCorrect: true,
        consequence: 'PPE confirmed. Ventilation active. You may proceed to substrate loading.',
      },
      {
        id: 'b',
        label: 'Skip PPE — the ink is in the vial and not yet aerosolized',
        isCorrect: false,
        consequence: 'Incorrect. Nanoparticles are present on any surface that has contacted the ink, including the vial exterior and workstation. PPE is required before handling.',
        scaffoldHint: 'Is nanoparticle exposure risk limited to the printing phase? When are particles present on surfaces?',
      },
      {
        id: 'c',
        label: 'Check KEWB software first to plan the run, then put on PPE',
        isCorrect: false,
        consequence: 'PPE must precede machine contact. KEWB setup happens after safety checks, not before.',
        scaffoldHint: 'What is the risk priority hierarchy for this system?',
      },
    ],
  },
  {
    stepId: 'STEP-STARTUP-002',
    situation: 'SUBSTRATE LOADING:\n• PCB loaded on chuck (FR-4, 2-layer board)\n• Chuck temperature: 22°C (ambient)\n• ESD wrist strap available at workstation',
    mentorProbe: 'Two things must happen before you leave this step. What are they, and why does each one matter for the repair outcome?',
    isFaultStep: false,
    actions: [
      {
        id: 'a',
        label: 'Connect ESD wrist strap, verify PCB is flat and secure against chuck',
        isCorrect: true,
        consequence: 'ESD protection active. PCB confirmed flat. Stage registration will proceed normally.',
      },
      {
        id: 'b',
        label: 'PCB looks secure — proceed to KEWB gas setup',
        isCorrect: false,
        consequence: 'Missing ESD protection. Static discharge can permanently damage the PCB being repaired.',
        scaffoldHint: 'The PCB has active components. What does that mean for handling requirements?',
      },
      {
        id: 'c',
        label: 'Set chuck temperature to 150°C for adhesion, then load PCB',
        isCorrect: false,
        consequence: 'Chuck heating before substrate loading is incorrect. Also, 150°C is a sintering temperature — not a startup setting for FR-4.',
        scaffoldHint: 'When in the process does chuck temperature matter? What is its purpose at startup vs. post-print?',
      },
    ],
  },
  {
    stepId: 'STEP-STARTUP-003',
    situation: 'SHEATH GAS SETUP:\n• Nozzle: 150 μm standard\n• KEWB gas control: standby mode\n• Nominal sheath pressure for this nozzle: 4.5–5.5 PSI',
    mentorProbe: 'What is the sheath gas physically doing at the print head — and what happens to print quality if it\'s set 30% below nominal?',
    isFaultStep: false,
    actions: [
      {
        id: 'a',
        label: 'Open sheath gas valve, dial to 5.0 PSI, confirm KEWB reading in range',
        isCorrect: true,
        consequence: 'KEWB reads 5.0 PSI — nominal. Sheath gas established. Ready for atomizer startup.',
      },
      {
        id: 'b',
        label: 'Set sheath gas to 8.0 PSI for extra protection against clogging',
        isCorrect: false,
        consequence: 'Excessive sheath gas overwhelms the aerosol focus — producing wide, blurry lines or no deposition.',
        scaffoldHint: 'What is the sheath gas optimizing? Is higher always better for focus?',
      },
      {
        id: 'c',
        label: 'Start the atomizer first, then establish sheath gas',
        isCorrect: false,
        consequence: 'Sheath gas must flow before atomizer start. Starting without sheath gas allows ink to contact nozzle walls — immediate clogging risk.',
        scaffoldHint: 'Why does step sequence matter here? What does the sheath gas protect?',
      },
    ],
  },
  {
    stepId: 'STEP-STARTUP-004',
    situation: 'ATOMIZER STARTUP:\n• Sheath gas: 5.0 PSI ✓\n• Ultrasonic atomizer (UA) mode selected\n• Ink vial: silver nanoparticle suspension, 2.8 mL\n• KEWB awaiting atomizer activation',
    mentorProbe: 'Once you activate the atomizer, what two KEWB readings confirm it is running correctly — and what would cause each to be out of range?',
    isFaultStep: false,
    actions: [
      {
        id: 'a',
        label: 'Activate atomizer, monitor KEWB current (target 0.4–0.6 mA) and carrier gas flow',
        isCorrect: true,
        consequence: 'Atomizer activated. KEWB: current 0.5 mA ✓, carrier gas nominal ✓. Ink aerosolizing — mist visible in vial window.',
      },
      {
        id: 'b',
        label: 'Set atomizer power to maximum for fastest aerosolization',
        isCorrect: false,
        consequence: 'High atomizer power causes over-aerosolization — particle size distribution widens, reducing line quality and increasing clogging risk.',
        scaffoldHint: 'The UA operates in a narrow optimal power band. What happens at either extreme?',
      },
      {
        id: 'c',
        label: 'Activate atomizer, then wait 10 minutes before checking KEWB',
        isCorrect: false,
        consequence: 'Delayed monitoring misses the critical first-minute stabilization window. Atomizer health must be confirmed immediately.',
        scaffoldHint: 'Why is the first minute of atomizer operation the highest-risk window?',
      },
    ],
  },
  {
    stepId: 'STEP-STARTUP-005-FAULT',
    situation: 'PLUME CHECK — ANOMALY DETECTED:\n• Camera: plume present, but NARROWER than expected\n• KEWB pressure: 6.2 PSI — ABOVE nominal range (4.5–5.5 PSI)\n• Test trace: line width reduced ~30%\n• Atomizer current: 0.5 mA — still nominal\nObservation window: last 3 minutes.',
    mentorProbe: 'You have three abnormal indicators and one normal one. What pattern do they form, and what does that tell you about where in the system the problem is located?',
    safetyAlert: 'Do NOT increase atomizer pressure to compensate — pressure buildup risk.',
    isFaultStep: true,
    actions: [
      {
        id: 'a',
        label: 'Partial nozzle clog — ink partially occluding the orifice',
        isCorrect: true,
        consequence: 'Correct. Elevated pressure + reduced line width + normal atomizer current = classic partial clog signature. The orifice restricts flow, raising upstream pressure, while atomization remains unaffected.',
      },
      {
        id: 'b',
        label: 'Sheath gas supply failure — insufficient gas pressure',
        isCorrect: false,
        consequence: 'Incorrect. Sheath gas failure would show falling pressure, not rising. KEWB shows elevated pressure, pointing to a downstream restriction — the nozzle orifice.',
        scaffoldHint: 'Which direction would a sheath gas failure push the pressure reading?',
      },
      {
        id: 'c',
        label: 'Atomizer malfunction — inconsistent particle generation',
        isCorrect: false,
        consequence: 'Incorrect. Atomizer current is nominal (0.5 mA) — the atomizer is functioning correctly. The fault is downstream of atomization.',
        scaffoldHint: 'The atomizer reading is normal. Where does that leave the fault location?',
      },
      {
        id: 'd',
        label: 'Stage calibration error — print head at wrong height',
        isCorrect: false,
        consequence: 'Incorrect. Stage error affects deposition placement accuracy, not pressure. Elevated KEWB pressure indicates a fluidic restriction — not a geometry problem.',
        scaffoldHint: 'What causes elevated pressure in a fluid system?',
      },
    ],
  },
  {
    stepId: 'STEP-RESOLUTION',
    situation: 'CONFIRMED: PARTIAL NOZZLE CLOG\n• KEWB pressure: 6.2 PSI (nominal: 4.5–5.5 PSI)\n• Trend: rising over last 3 minutes\n• Line width: reduced ~30%\n• Atomizer: nominal\n\nCorrective action required.',
    mentorProbe: 'There are two possible corrective paths — conservative adjustment vs. full disassembly. What determines which one to try first?',
    safetyAlert: 'Do NOT increase atomizer current or pressure — drives partial clog to full occlusion.',
    isFaultStep: false,
    actions: [
      {
        id: 'a',
        label: 'Increase sheath gas slightly (5.0 → 6.0 PSI) and monitor for 2 minutes',
        isCorrect: true,
        consequence: 'Sheath gas increased to 6.0 PSI. KEWB pressure drops: 6.2 → 5.0 PSI over 90 seconds. Line width returns to nominal. Partial clog cleared. Monitor for recurrence in 15 minutes.',
      },
      {
        id: 'b',
        label: 'Abort print and disassemble nozzle for full cleaning immediately',
        isCorrect: false,
        consequence: 'Premature. Full disassembly is for confirmed full clogs (zero deposition, very high pressure). A partial clog warrants conservative correction first. Unnecessary disassembly costs 4+ hours.',
        scaffoldHint: 'What is the criterion that distinguishes a partial vs. full clog response?',
      },
      {
        id: 'c',
        label: 'Increase atomizer current to push more ink through the partial clog',
        isCorrect: false,
        consequence: 'DANGEROUS. Never increase atomizer pressure/current to force through a clog — this converts a partial clog to a full occlusion and risks dangerous upstream pressure buildup.',
        scaffoldHint: 'What safety note is attached to the partial clog node?',
      },
      {
        id: 'd',
        label: 'Reduce print speed to compensate for the reduced flow rate',
        isCorrect: false,
        consequence: 'Speed reduction does not address the root cause. The clog persists and will worsen. This delays the repair without fixing the problem.',
        scaffoldHint: 'Does slowing down change what is happening at the nozzle orifice?',
      },
    ],
  },
];
