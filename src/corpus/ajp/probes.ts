/**
 * SocraticProbe nodes for AJP training — Phase 3 multi-agent layer.
 * Each node targets a high-value knowledge gap identified in the AJP Training System
 * Design Document (Section 4.2). Nodes carry expectedConcepts arrays consumed by the
 * LLM Mentor service to evaluate free-text learner responses without revealing answers.
 * Mastery thresholds are elevated (0.85–0.90) for safety-critical probes.
 * Sources: Stanford SNF SOP, Boise State IML SOP, peer literature.
 */
import type { AJPNode, AJPEdge } from '../../types/ajp';

export const ajpProbeNodes: AJPNode[] = [
  {
    id: 'PROBE-GAS-SEQUENCE-START-001',
    type: 'SocraticProbe',
    content:
      'Before you turn on the atomizer gas, what needs to be verified about the sheath gas — and why does the startup sequence order matter?',
    expectedConcepts: [
      'Sheath gas must be flowing and at nominal pressure before atomizer startup',
      'Sheath gas prevents ink from contacting nozzle walls during atomization',
      'Starting atomizer without sheath allows unsheathed aerosol to release into lab environment',
      'Wrong sequence causes immediate nozzle clogging from unsheathed ink at the nozzle tip',
      'KEWB pressure reading must confirm sheath is in nominal range before proceeding',
    ],
    commonWrongAnswers: [
      'Just check that the sheath is switched on',
      'The order does not matter as long as both gases end up flowing',
      'The atomizer gas creates the necessary focusing pressure',
    ],
    masteryThreshold: 0.90,
    safetyAlert: 'Safety-critical: wrong startup sequence releases unsheathed nanoparticle aerosol.',
    confidence: 'High',
    source: 'Stanford SNF SOP Section 9, Boise State IML SOP Section 7.1',
  },

  {
    id: 'PROBE-GAS-SEQUENCE-STOP-001',
    type: 'SocraticProbe',
    content:
      'Describe the correct gas shutdown sequence step by step, including the two timed waits. What happens to the nozzle if you skip those waits or reverse the order?',
    expectedConcepts: [
      'Atomizer gas off first',
      'Wait 10 seconds for residual aerosol to clear the transfer line',
      'Exhaust gas off second',
      'Wait 60 seconds for pressure to equalize',
      'Sheath gas off last',
      'Skipping waits or reversing sequence drives residual ink back into the nozzle orifice',
      'Dried residual ink causes a nozzle clog that requires 4+ hours of cleaning to clear',
    ],
    commonWrongAnswers: [
      'Just turn everything off at the same time',
      'Turn off sheath first to stop the aerosol',
      'The waits are just to be safe, not technically required',
    ],
    masteryThreshold: 0.90,
    safetyAlert: 'Wrong shutdown sequence is the leading cause of nozzle clog.',
    confidence: 'High',
    source: 'Stanford SNF SOP Section 10, Boise State IML SOP Section 7.1',
  },

  {
    id: 'PROBE-PRESSURE-INTERPRETATION-001',
    type: 'SocraticProbe',
    content:
      'You start the sheath gas and KEWB shows a pressure reading. Describe the two distinct failure conditions this reading can indicate, and explain which direction — high versus low — corresponds to which problem.',
    expectedConcepts: [
      'High pressure indicates a downstream restriction — nozzle or impactor clog',
      'Low pressure indicates insufficient gas supply — leak in fitting, O-ring, or tubing',
      'Clog is a flow restriction that raises upstream pressure',
      'Leak is a gas escape that prevents pressure from building to nominal',
      'Neither condition allows proceeding — both require diagnosis and correction first',
      'Corrective actions are opposite: clog requires nozzle inspection; leak requires assembly inspection',
    ],
    commonWrongAnswers: [
      'High pressure means the gas is flowing too fast, so reduce the setpoint',
      'Low pressure means there is not enough gas, so increase the setpoint',
      'Either direction is OK as long as the reading is not zero',
    ],
    masteryThreshold: 0.85,
    confidence: 'High',
    source: 'Boise State IML SOP Section 5, Stanford SNF SOP startup procedure',
  },

  {
    id: 'PROBE-NOZZLE-INSPECT-001',
    type: 'SocraticProbe',
    content:
      'Before installing a nozzle, what do you look for under magnification — and what observation would cause you to reject the nozzle and reach for a replacement?',
    expectedConcepts: [
      'Inspect the tip under a microscope or loupe before installation',
      'A healthy nozzle has a clean circular orifice with sharp symmetrical edges',
      'Reject for any asymmetry, chipping, or cracking of the orifice edge',
      'Reject for residue inside the orifice that does not clean off',
      'Ceramic nozzle tips are fragile and cannot be reshaped once damaged',
      'Damaged orifice geometry causes unpredictable deposition that cannot be corrected by parameter changes',
    ],
    commonWrongAnswers: [
      'Just look at the outside of the nozzle body for visible cracks',
      'Try printing a test line and reject only if quality is poor',
      'All nozzles from the same box should be fine if they are new',
    ],
    masteryThreshold: 0.80,
    confidence: 'High',
    source: 'SRC-019 Section 1.6, SRC-018 Section 8.3',
  },

  {
    id: 'PROBE-SINTER-PARAMETERS-001',
    type: 'SocraticProbe',
    content:
      'The laser sinter pass produced a dark, matte trace — resistance measures 18 Ω. You need to decide whether to attempt a bench-top rescue sinter. What profiles are available for Novacentrix Metalon JS-A426, and which do you choose given a mixed FR4/polyimide substrate? What is the key risk on either side of the decision?',
    expectedConcepts: [
      'Three valid OEM profiles for JS-A426: 100 °C / 12 hr, 185 °C / 4 hr, 250 °C / 10 min',
      'Dark/matte appearance and >10 Ω indicates incomplete sintering — a rescue sinter pass is warranted',
      'FR4 glass transition is approximately 130–135 °C — 185 °C exceeds FR4 Tg; choose 100 °C / 12 hr for FR4 sections or verify substrate is low-Tg FR4',
      'Polyimide can typically tolerate 250 °C — substrate type determines which profile is safe',
      'Too cool: trace remains high-resistance — can re-sinter; recoverable failure',
      'Too hot: PCB substrate delamination, discoloration, component damage — often irreversible total loss',
      'Too hot is a worse outcome because the PCB itself is destroyed, not just the trace',
    ],
    commonWrongAnswers: [
      'Higher temperature is always better — sinter faster and move on',
      '100°C is too low to achieve conductivity — skip straight to 250°C',
      'Both under- and over-sintering risks are equally recoverable',
      '175°C for 3–4 hours (not an OEM-specified profile for JS-A426)',
    ],
    masteryThreshold: 0.85,
    confidence: 'High',
    source: 'Novacentrix Metalon JS-A426 manufacturer-recommended profile (baseline ink, see PARAM-INK-IDENTITY-001); peer literature on Ag NP sintering (SRC-007, SRC-008)',
  },

  {
    id: 'PROBE-ESD-PROTOCOL-001',
    type: 'SocraticProbe',
    content:
      'Before picking up the PCB to load it for repair, walk through your ESD protection steps and explain why each one matters specifically for this operation.',
    expectedConcepts: [
      'Put on ESD wrist strap before touching the PCB',
      'Verify the wrist strap ground connection with a tester — not by assumption',
      'ESD mat on work surface before placing the PCB',
      'Touch the ESD mat before picking up the board to equalize charge',
      'ESD damage is often invisible and latent — may not appear until the board is in service',
      'Active components near the repair area are at risk even if not in the repair trace path',
    ],
    commonWrongAnswers: [
      'Just avoid touching the component legs directly',
      'ESD is only a concern in dry weather',
      'The PCB is grounded through the machine chuck once it is placed',
    ],
    masteryThreshold: 0.90,
    safetyAlert: 'ESD damage is irreversible. Wrist strap must be verified with a tester, not assumed to work.',
    confidence: 'High',
    source: 'HAZARD-ESD-001, IPC-7711/7721 rework standard',
  },

  {
    id: 'PROBE-TACIT-LINE-QUALITY-001',
    type: 'SocraticProbe',
    content:
      'Describe the five canonical line defect patterns you can observe during or after deposition. For each defect, what is the first parameter change you would make?',
    expectedConcepts: [
      'Overspray (wide fuzzy edges): increase sheath gas flow or reduce standoff distance',
      'Dropout / gaps (intermittent line): check for partial clog; reduce print speed; increase atomizer flow',
      'Blobs (discrete accumulations): reduce atomizer flow; clean impactor; wipe nozzle tip',
      'Too thin / weak trace: reduce print speed to allow more material per unit length',
      'Too wide / thick: increase print speed; reduce atomizer flow or passes',
      'Change one parameter at a time and run a qualification print on sacrificial substrate after each change',
    ],
    commonWrongAnswers: [
      'Just increase the atomizer power to fix any deposition problem',
      'Gaps and no-deposition are the same problem',
      'Wide lines are caused by high atomizer pressure',
    ],
    masteryThreshold: 0.80,
    confidence: 'High',
    source: 'SRC-018 Section 8.4, SRC-019 Section 5.9-5.10, peer literature',
  },

  {
    id: 'PROBE-ABORT-DECISION-001',
    type: 'SocraticProbe',
    content:
      'Mid-print, you notice blobs forming on the nozzle tip and occasional pressure spikes in KEWB. Walk through your decision process: do you stop immediately, wipe and continue, or abort the run?',
    expectedConcepts: [
      'First response: stop the print motion immediately while keeping gas flows stable',
      'Wipe the nozzle tip with a cotton swab — a single blob is a wipe-and-continue situation',
      'Monitor for recurrence over the next few minutes',
      'If blobbing recurs: abort the print run — the root cause is not a tip accumulation but a system problem',
      'If a blob falls onto the PCB: abort immediately and inspect for shorts before any sintering',
      'Never sinter a board with a potential blob deposit — it could short adjacent traces permanently',
    ],
    commonWrongAnswers: [
      'Continue printing — blobs usually just get incorporated into the trace',
      'Abort immediately on the first blob without trying to wipe',
      'Increase sheath gas to push the blob off the nozzle tip',
    ],
    masteryThreshold: 0.90,
    safetyAlert: 'If a blob falls on adjacent PCB features: abort and assess for shorts before sintering.',
    confidence: 'High',
    source: 'FAULT-BLOB-FORMATION-001, practitioner knowledge',
  },

  // ── KB-DOC-01 / KB-DOC-08: new perceptual signal probes ──────────

  {
    id: 'PROBE-ATOMIZATION-PA-001',
    type: 'SocraticProbe',
    content:
      'You look through the glass at the PA atomizer jar during a print run. Describe what healthy atomization looks like on the jar walls — and name two patterns that would make you consider stopping the print.',
    expectedConcepts: [
      'Fine, uniform droplets covering the lower jar walls continuously — a steady mist coating',
      'No bare dry patches on the jar wall (bare patches indicate partial clog or low ink level)',
      'Large blobs or streaks running down the walls indicate ink viscosity problem or temperature issue',
      'Cycling appearance (mist then bare then mist) indicates intermittent partial clog',
      'No atomization visible at all indicates pump blockage or low ink level — stop immediately',
    ],
    masteryThreshold: 0.85,
    confidence: 'High',
    source: 'KB-DOC-01 §1.1 · SRC-018, SRC-019 · v1.0-2026-04-10',
  },

  {
    id: 'PROBE-PLUME-VISUAL-001',
    type: 'SocraticProbe',
    content:
      'Describe what a healthy aerosol plume looks like at the nozzle tip on the process camera — then describe two plume appearances that require immediate parameter adjustment and what you would change first.',
    expectedConcepts: [
      'Healthy plume: tight coaxial column, slight convergence below nozzle tip, steady with no visible flicker or drift',
      'Wide diffuse plume: sheath gas is too low — increase sheath flow first before adjusting other parameters',
      'Plume drifts sideways or is asymmetric: possible nozzle damage or partial blockage on one side — inspect nozzle tip',
      'No visible plume despite gas flowing: complete blockage or ink depletion — abort',
      'Plume pulsing on and off: atomizer intermittent — check ink level and PA jar assembly',
    ],
    masteryThreshold: 0.85,
    confidence: 'High',
    source: 'KB-DOC-01 §1.2 · SRC-018, SRC-019 · v1.0-2026-04-10',
  },

  {
    id: 'PROBE-UA-SOUND-001',
    type: 'SocraticProbe',
    content:
      'The ultrasonic atomizer makes a sound during operation. What does normal sound like, and what two sound changes are early warning signals of different problems?',
    expectedConcepts: [
      'Normal: steady, consistent high-pitched tone at a constant frequency and amplitude',
      'Intermittent or pulsing tone: ink level is critically low — check and refill vial before continuing',
      'Pitch rising gradually: ink level is dropping — monitor and plan to stop before depletion',
      'Irregular rattling or grinding quality: vial is incorrectly seated or the transducer is not in full contact with the vial',
      'No sound at all despite UA enabled: UA may have failed or vial is not making contact',
    ],
    masteryThreshold: 0.80,
    confidence: 'Medium',
    source: 'KB-DOC-01 §2.1 · SRC-018 · v1.0-2026-04-10',
  },
];

// ─── Edges linking probes to their target concept nodes ─────────────

export const ajpProbeEdges: AJPEdge[] = [
  { from: 'PROBE-GAS-SEQUENCE-START-001', to: 'FAULT-GAS-SEQUENCE-WRONG-001', type: 'PROBES' },
  { from: 'PROBE-GAS-SEQUENCE-STOP-001', to: 'FAULT-GAS-SEQUENCE-WRONG-001', type: 'PROBES' },
  { from: 'PROBE-PRESSURE-INTERPRETATION-001', to: 'STEP-STARTUP-003', type: 'PROBES' },
  { from: 'PROBE-PRESSURE-INTERPRETATION-001', to: 'FAULT-CLOG-PARTIAL-001', type: 'PROBES' },
  { from: 'PROBE-PRESSURE-INTERPRETATION-001', to: 'FAULT-LEAK-FITTING-001', type: 'PROBES' },
  { from: 'PROBE-NOZZLE-INSPECT-001', to: 'FAULT-NOZZLE-DAMAGE-001', type: 'PROBES' },
  { from: 'PROBE-NOZZLE-INSPECT-001', to: 'TACIT-NOZZLE-INSPECT-001', type: 'PROBES' },
  { from: 'PROBE-SINTER-PARAMETERS-001', to: 'FAULT-SINTER-INCOMPLETE-001', type: 'PROBES' },
  { from: 'PROBE-SINTER-PARAMETERS-001', to: 'FAULT-SINTER-THERMAL-DAMAGE-001', type: 'PROBES' },
  { from: 'PROBE-ESD-PROTOCOL-001', to: 'HAZARD-ESD-001', type: 'PROBES' },
  { from: 'PROBE-ESD-PROTOCOL-001', to: 'FAULT-ESD-DAMAGE-001', type: 'PROBES' },
  { from: 'PROBE-TACIT-LINE-QUALITY-001', to: 'FAULT-OVERSPRAY-001', type: 'PROBES' },
  { from: 'PROBE-TACIT-LINE-QUALITY-001', to: 'FAULT-DROPOUT-001', type: 'PROBES' },
  { from: 'PROBE-ABORT-DECISION-001', to: 'FAULT-BLOB-FORMATION-001', type: 'PROBES' },
  { from: 'PROBE-ABORT-DECISION-001', to: 'TACIT-ABORT-DECISION-001', type: 'PROBES' },
  // ── KB-DOC-01 / KB-DOC-08: new perceptual signal probes ──────────
  { from: 'PROBE-ATOMIZATION-PA-001', to: 'TACIT-ATOMIZATION-VISUAL-PA-001', type: 'PROBES' },
  { from: 'PROBE-ATOMIZATION-PA-001', to: 'FAULT-WEAK-ATOMIZATION-001', type: 'PROBES' },
  { from: 'PROBE-PLUME-VISUAL-001', to: 'TACIT-PLUME-VISUAL-001', type: 'PROBES' },
  { from: 'PROBE-UA-SOUND-001', to: 'TACIT-ATOMIZATION-SOUND-UA-001', type: 'PROBES' },
];
