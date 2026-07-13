/**
 * AJP corpus gap registry (design doc §5.2).
 *
 * Each gap is a typed record flagging knowledge that cannot be sourced from
 * currently available documents. Gaps are referenced in node content as
 * "GAP-NNN" strings — graph-retrieval.ts reads these to set reachbackNote on
 * any chain that touches a gap-flagged node.
 *
 * Acquisition path column gives the exact source needed. When a gap is
 * resolved: (1) add the data to the relevant corpus file, (2) set
 * status → 'resolved', (3) remove the GAP-NNN tag from the node content.
 *
 * See docs/expert-elicitation-log.md for the live question backlog.
 */

export type GapStatus = 'open' | 'partial' | 'resolved';

export interface CorpusGap {
  /** Canonical gap identifier, matches the GAP-NNN string in node content. */
  id: string;
  summary: string;
  /** What specifically is missing and why it matters for training. */
  detail: string;
  /** Where to get this data — be specific enough to act on. */
  acquisitionPath: string;
  /** Node IDs whose content contains this gap tag. */
  affectedNodeIds: string[];
  status: GapStatus;
  /** ISO date when resolved, or null. */
  resolvedDate?: string;
}

export const corpusGaps: CorpusGap[] = [
  {
    id: 'GAP-003',
    summary: 'Sheath gas setpoint table — nozzle size × lab elevation',
    detail:
      'Nominal sheath gas flow rate varies with nozzle ID (150/300/500/1000 μm) and lab elevation ' +
      '(air density affects aerodynamic focusing). Without the table, learners cannot select a ' +
      'starting sheath setpoint for a given nozzle, forcing trial-and-error that wastes ink and ' +
      'PCB surface. Currently affects PARAM-SHEATH-FLOW-001 parameter guidance.',
    acquisitionPath:
      'Photograph page 30 of the Optomec HD2 User Manual from the machine PC (KEWB "Help" menu → ' +
      'User Manual PDF). Table is titled "Recommended Sheath Gas Flow Rates". ' +
      'Alternatively, contact Optomec applications support.',
    affectedNodeIds: ['PARAM-SHEATH-FLOW-001'],
    status: 'open',
  },
  {
    id: 'GAP-010',
    summary: 'Stage fault codes and their meanings',
    detail:
      'KEWB Motion Manager displays numeric fault codes when the stage fails to home or move. ' +
      'Without the code catalog, FAULT-STAGE-HOME-FAIL-001 cannot differentiate electrical vs. ' +
      'mechanical faults by code — diagnosis requires manual inspection. This makes the corrective ' +
      'action node less specific than it should be.',
    acquisitionPath:
      'HD2 Operator Manual, Appendix B (Stage Fault Codes). Obtain from Optomec support portal or ' +
      'request during next service call. Ask specifically for Motion Manager fault code table.',
    affectedNodeIds: ['FAULT-STAGE-HOME-FAIL-001'],
    status: 'open',
  },
  {
    id: 'GAP-011',
    summary: 'KEWB software error code catalog',
    detail:
      'KEWB shows pop-up error codes for pressure alarms, flow faults, and communication errors. ' +
      'The catalog mapping codes to root causes is needed to make FAULT-KEWB-FREEZE-001 and ' +
      'related fault nodes actionable for a learner who sees a code number and needs to know ' +
      'what it means.',
    acquisitionPath:
      'HD2 Operator Manual, KEWB Error Codes section (typically Appendix C or Section 9). ' +
      'Same source as GAP-010 — request both at once from Optomec.',
    affectedNodeIds: ['FAULT-KEWB-FREEZE-001'],
    status: 'open',
  },
  {
    id: 'GAP-012',
    summary: 'Vision system camera specifications and field of view',
    detail:
      'The HD2 vision system is used for nozzle alignment and substrate inspection. Without ' +
      'knowing the camera field of view, magnification, and lighting setup, the training system ' +
      'cannot specify what the operator should be able to see at each inspection step. ' +
      'Affects TACIT-NOZZLE-INSPECT-001 (inspection under magnification — what is the actual ' +
      'achievable resolution?).',
    acquisitionPath:
      'HD2 Operator Manual, Vision System section. Also: photograph the camera spec label ' +
      'on the machine. Note model/part number and look up datasheet.',
    affectedNodeIds: ['TACIT-NOZZLE-INSPECT-001', 'TACIT-PLUME-VISUAL-001'],
    status: 'open',
  },
  {
    id: 'GAP-013',
    summary: 'Ink dilution ratios for specific formulations in use',
    detail:
      'Ag NP inks from different manufacturers (UTDots, Novacentrix, Clariant) have different ' +
      'base viscosities and require different solvent dilution ratios for AJP printing. ' +
      'RESOLVED AS A FLAGGED BASELINE, not a live inventory check: Novacentrix Metalon JS-A426 ' +
      '(conductive, no dilution) and Norland NEA 121 (dielectric, 2:1 acetone dilution) were ' +
      'deliberately selected by the training program owner as the working baseline — see the ' +
      'PARAM-INK-IDENTITY-001 node, cross-referenced from FAULT-INK-DEGRADED-001 and ' +
      'TACIT-INK-QUALITY-001. Confirm against the current ink lot at the deployment site before ' +
      'treating ink-specific guidance in this corpus as safety-authoritative.',
    acquisitionPath:
      'Baseline selected by the training program owner (see PARAM-INK-IDENTITY-001). To fully ' +
      'close: confirm current site inventory matches this product and lot before first live use.',
    affectedNodeIds: ['FAULT-INK-DEGRADED-001', 'TACIT-INK-QUALITY-001', 'PARAM-INK-IDENTITY-001'],
    status: 'resolved',
    resolvedDate: '2026-04-14',
  },
  {
    id: 'GAP-014',
    summary: 'Safety Data Sheet (SDS) for specific Ag NP ink formulation',
    detail:
      'Regulatory requirement: the SDS for the specific silver nanoparticle ink in use must be ' +
      'reviewed before the training system is used to train anyone who will handle the ink. ' +
      'Without the SDS, HAZARD-NANOPARTICLE-001 and ACTION-INCIDENT-REPORT-001 cannot reference ' +
      'the site-specific exposure limits, first-aid procedures, or disposal requirements. ' +
      'This is a BLOCKING gap for any live deployment — must be resolved before first use.',
    acquisitionPath:
      'Obtain from ink manufacturer website (search "[product name] SDS PDF"). ' +
      'Required before any operator touches the ink. File in lab safety binder and attach to ' +
      'the training corpus. Contact EHS officer if SDS is unavailable — do not proceed without it.',
    affectedNodeIds: ['HAZARD-NANOPARTICLE-001', 'ACTION-INCIDENT-REPORT-001'],
    status: 'partial',
    resolvedDate: '2026-04-13',
    // REVIEW FLAG: NanoAmor msds_Ag_NP.pdf ingested (4 chunks, gemini-embedding-001).
    // Generic Ag NP SDS — must verify that product name and lot number match the specific
    // ink formulation in use before this gap can be fully closed. If the ink is a different
    // vendor or formulation, obtain that vendor's SDS and re-ingest with --reset-store.
    // Track in lab safety binder. Re-run db:validate after confirming lot match.
  },
  {
    id: 'GAP-015',
    summary: 'Elevation correction table for sheath gas setpoints',
    detail:
      'Sheath gas pressure settings must be adjusted at different lab elevations because volumetric ' +
      'flow at a given pressure setpoint varies with ambient air pressure. Any facility not at ' +
      'near-sea-level altitude (approx. >500 m) will need different setpoints than the nominal ' +
      'values in the HD2 documentation. KB-DOC-03 §2.2 confirms this effect is real and ' +
      'operationally significant but the correction table has not been elicited.',
    acquisitionPath:
      'Same source as GAP-003 — HD2 Operator Manual Appendix or Optomec applications support. ' +
      'Also addressable by asking an experienced HD2 operator at a high-elevation facility ' +
      '(e.g., >1000 m) what setpoint adjustments they use vs. the manual values.',
    affectedNodeIds: ['PARAM-SHEATH-FLOW-001', 'TACIT-GAS-SEQUENCE-RATIONALE-001'],
    status: 'open',
  },
];

/** Look up a gap by its canonical ID (e.g., 'GAP-010'). */
export function getGapById(id: string): CorpusGap | undefined {
  return corpusGaps.find((g) => g.id === id);
}

/** Return all open gaps, sorted by id. */
export function getOpenGaps(): CorpusGap[] {
  return corpusGaps.filter((g) => g.status === 'open').sort((a, b) => a.id.localeCompare(b.id));
}

/** Return all node IDs that are affected by at least one open gap. */
export function getGapAffectedNodeIds(): Set<string> {
  return new Set(
    corpusGaps
      .filter((g) => g.status !== 'resolved')
      .flatMap((g) => g.affectedNodeIds),
  );
}

/** True if the node id is covered by an unresolved gap. */
export function isNodeGapAffected(nodeId: string): boolean {
  return getGapAffectedNodeIds().has(nodeId);
}
