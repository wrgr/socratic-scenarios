/**
 * Extended AJP fault type nodes for graph-retrieval differentiation.
 * Adds sheath-gas failure, full clog, and atomizer malfunction — each with distinct
 * symptom signatures — so In-Operation retrieval can meaningfully discriminate.
 * Source: Stanford SNF AJP SOP; Boise State IML SOP.
 */
import type { AJPNode, AJPEdge } from '../../types/ajp';

// ─── Extended Symptom Nodes ───────────────────────────────────────

export const extendedSymptomNodes: AJPNode[] = [
  {
    id: 'SYMPT-PRESSURE-DROP-001',
    type: 'Symptom',
    content:
      'KEWB pressure falling below nominal range or fluctuating erratically. Opposite of clog signature — pressure drop indicates insufficient gas supply, not flow restriction.',
    confidence: 'High',
    source: 'Stanford SNF AJP SOP',
  },
  {
    id: 'SYMPT-ZERO-DEPOSITION-001',
    type: 'Symptom',
    content:
      'No material deposited on substrate. Camera shows no plume or trace on substrate surface. Combined with very high KEWB pressure = full nozzle occlusion.',
    confidence: 'High',
    source: 'Boise State IML SOP',
  },
  {
    id: 'SYMPT-VERY-HIGH-PRESSURE-001',
    type: 'Symptom',
    content:
      'KEWB pressure significantly elevated — more than 50% above nominal range (e.g., >7.5 PSI on a 4.5–5.5 PSI system). Combined with zero deposition = full clog.',
    confidence: 'High',
    source: 'Stanford SNF AJP SOP',
  },
  {
    id: 'SYMPT-LOW-CURRENT-001',
    type: 'Symptom',
    content:
      'UA atomizer current below nominal range (<0.4 mA). Indicates insufficient transducer power or ink vial level too low for aerosolization. Not a nozzle fault.',
    confidence: 'High',
    source: 'Boise State IML SOP',
  },
  {
    id: 'SYMPT-NO-PLUME-001',
    type: 'Symptom',
    content:
      'Camera shows no aerosol plume despite atomizer activation. Combined with low current = atomizer not generating aerosol. Combined with high pressure = nozzle blocked.',
    confidence: 'High',
    source: 'Stanford SNF AJP SOP',
  },
];

// ─── Extended Fault Nodes ─────────────────────────────────────────

export const extendedFaultNodes: AJPNode[] = [
  {
    id: 'FAULT-SHEATH-GAS-001',
    type: 'FailureMode',
    content:
      'Sheath gas supply failure. KEWB pressure drops below nominal or fluctuates. Line quality degrades — ink contacts nozzle walls, immediate clogging risk. Common causes: regulator failure, kinked supply line, depleted gas cylinder.',
    safetyAlert: 'Restore sheath gas before continuing — ink-wall contact degrades nozzle rapidly.',
    confidence: 'High',
    source: 'Stanford SNF AJP SOP',
  },
  {
    id: 'FAULT-CLOG-FULL-001',
    type: 'FailureMode',
    content:
      'Complete nozzle occlusion. KEWB pressure >50% above nominal. Zero deposition. Requires full nozzle disassembly and sonication (4+ hours). Most costly failure mode. Prevention: always execute shutdown purge before idle periods.',
    safetyAlert: 'Do NOT attempt to force-clear with pressure — risk of fitting rupture.',
    confidence: 'High',
    source: 'Stanford SNF AJP SOP; Boise State IML SOP',
  },
  {
    id: 'FAULT-ATOMIZER-001',
    type: 'FailureMode',
    content:
      'Ultrasonic atomizer malfunction. Current below 0.4 mA, no plume visible. Most common causes: ink vial level too low (<0.5 mL), vial contamination, degraded ink, transducer fouling. Not a nozzle fault — pressure may be nominal.',
    confidence: 'High',
    source: 'Boise State IML SOP',
  },
];

// ─── Extended Corrective Action Nodes ────────────────────────────

export const extendedActionNodes: AJPNode[] = [
  {
    id: 'ACTION-SHEATH-GAS-RESTORE-001',
    type: 'CorrectiveAction',
    content:
      'Check sheath gas supply: verify regulator reading, check for kinked tubing, confirm cylinder is not depleted. Restore to nominal before resuming. If nozzle contacted ink during low-sheath period, inspect for partial clog.',
    narratorText:
      'Sheath gas supply line inspected. Kinked segment found at tubing junction — straightened. KEWB pressure returns to 5.0 PSI. Nozzle integrity check: pressure stable for 2 minutes. Proceed with caution — monitor for delayed clogging from brief ink-wall contact.',
    confidence: 'High',
    source: 'Stanford SNF AJP SOP',
  },
  {
    id: 'ACTION-NOZZLE-FULL-CLEAN-001',
    type: 'CorrectiveAction',
    content:
      'Full nozzle disassembly and sonication: (1) safe shutdown gas sequence; (2) disassemble printhead; (3) soak nozzle in appropriate solvent (30 min); (4) ultrasonic bath (15 min); (5) visual inspection; (6) reassemble and requalify. Recovery time: 4+ hours.',
    narratorText:
      'Full cleaning protocol initiated. Estimated recovery time: 4 hours. PCB removed and stored safely. Nozzle disassembled.',
    safetyAlert:
      'Nanoparticle-contaminated solvents — nitrile gloves + N95 + eye protection required for entire cleaning procedure.',
    confidence: 'High',
    source: 'Stanford SNF AJP SOP; Boise State IML SOP',
  },
  {
    id: 'ACTION-ATOMIZER-REFILL-001',
    type: 'CorrectiveAction',
    content:
      'Atomizer remediation: (1) check ink vial level — refill to 2 mL if below 0.5 mL; (2) if level adequate, check ink for contamination or age; (3) replace ink vial if degraded; (4) clean UA transducer if fouled; (5) restart atomizer and verify current returns to 0.4–0.6 mA.',
    narratorText:
      'Ink vial refilled to 2.5 mL. Atomizer restarted. KEWB current: 0.5 mA — nominal. Plume visible on camera. Resumed startup sequence.',
    safetyAlert: 'Nitrile gloves + N95 required for ink vial handling.',
    confidence: 'High',
    source: 'Boise State IML SOP',
  },
];

// ─── Extended Edges ───────────────────────────────────────────────

export const extendedEdges: AJPEdge[] = [
  // Sheath gas failure chain
  { from: 'SYMPT-PRESSURE-DROP-001', to: 'FAULT-SHEATH-GAS-001', type: 'INDICATES' },
  { from: 'FAULT-SHEATH-GAS-001', to: 'SYMPT-PRESSURE-DROP-001', type: 'INDICATES' },
  { from: 'FAULT-SHEATH-GAS-001', to: 'ACTION-SHEATH-GAS-RESTORE-001', type: 'FIXED_BY' },
  { from: 'FAULT-SHEATH-GAS-001', to: 'HAZARD-NANOPARTICLE-001', type: 'REQUIRES' },

  // Full clog chain
  { from: 'SYMPT-ZERO-DEPOSITION-001', to: 'FAULT-CLOG-FULL-001', type: 'INDICATES' },
  { from: 'SYMPT-VERY-HIGH-PRESSURE-001', to: 'FAULT-CLOG-FULL-001', type: 'INDICATES' },
  { from: 'FAULT-CLOG-FULL-001', to: 'SYMPT-ZERO-DEPOSITION-001', type: 'INDICATES' },
  { from: 'FAULT-CLOG-FULL-001', to: 'SYMPT-VERY-HIGH-PRESSURE-001', type: 'INDICATES' },
  { from: 'FAULT-CLOG-FULL-001', to: 'ACTION-NOZZLE-FULL-CLEAN-001', type: 'FIXED_BY' },
  { from: 'FAULT-CLOG-FULL-001', to: 'HAZARD-NANOPARTICLE-001', type: 'REQUIRES' },

  // Atomizer fault chain
  { from: 'SYMPT-LOW-CURRENT-001', to: 'FAULT-ATOMIZER-001', type: 'INDICATES' },
  { from: 'SYMPT-NO-PLUME-001', to: 'FAULT-ATOMIZER-001', type: 'INDICATES' },
  { from: 'FAULT-ATOMIZER-001', to: 'SYMPT-LOW-CURRENT-001', type: 'INDICATES' },
  { from: 'FAULT-ATOMIZER-001', to: 'SYMPT-NO-PLUME-001', type: 'INDICATES' },
  { from: 'FAULT-ATOMIZER-001', to: 'ACTION-ATOMIZER-REFILL-001', type: 'FIXED_BY' },
  { from: 'FAULT-ATOMIZER-001', to: 'HAZARD-NANOPARTICLE-001', type: 'REQUIRES' },

  // No-plume disambiguation (could be full clog OR atomizer fault)
  { from: 'SYMPT-NO-PLUME-001', to: 'FAULT-CLOG-FULL-001', type: 'INDICATES' },
];
