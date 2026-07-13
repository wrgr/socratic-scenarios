/**
 * AJP operational parameter nodes and verification check nodes.
 *
 * PARAMETER NODES
 * ───────────────
 * Each Parameter node captures the quantitative operating envelope for one
 * machine variable: nominal range, danger thresholds, and the consequence of
 * out-of-range operation. These supplement the narrative content on Equipment
 * nodes and improve retrieval precision for queries that mention specific
 * values (e.g. "PSI is at 3.5 — is that OK?").
 *
 * VERIFICATIONCHECK NODES
 * ────────────────────────
 * Each VerificationCheck is a mandatory observable confirmation that a step
 * completed correctly. They are linked to their parent Step via VERIFIED_BY
 * edges. Surfacing them during step-context retrieval grounds Mentor probes
 * in observable pass/fail criteria rather than procedures alone.
 *
 * SUPPORTED_BY EDGES
 * ──────────────────
 * TacitKnowledge nodes that are grounded in published theory or peer-reviewed
 * data are linked to THEORY-* nodes via SUPPORTED_BY edges. This makes the
 * evidence chain traceable: perceptual heuristic → theoretical backing.
 *
 * Sources: Stanford SNF SOP (SRC-018), Boise State IML SOP (SRC-019),
 * Islam et al. (2025), Wilkinson et al. (2019), NIOSH CIB-70.
 */
import type { AJPNode, AJPEdge } from '../../types/ajp';

// ─── Parameter Nodes ──────────────────────────────────────────────

export const parameterNodes: AJPNode[] = [
  {
    id: 'PARAM-STANDOFF-001',
    type: 'Parameter',
    content:
      'Nozzle-to-substrate standoff distance: 2–5 mm nominal for 150 μm nozzle. ' +
      'Below 2 mm: risk of nozzle crash on substrate surface irregularities; ink accumulates on nozzle tip. ' +
      'Above 5 mm: aerosol diverges before reaching substrate — line widens and deposit thins. ' +
      'Adjust standoff (Z height) using the slide stack calibration procedure at each session start.',
    narratorText: 'Standoff: {value} mm',
    confidence: 'High',
    source: 'SRC-018 §3.2, Islam 2025',
  },
  {
    id: 'PARAM-PRINT-SPEED-001',
    type: 'Parameter',
    content:
      'Print (translation) speed nominal range: 1–5 mm/s for standard conductive trace printing. ' +
      'Too slow: ink piles up — wide, rounded cross-section, possible satellite droplets. ' +
      'Too fast: thin, discontinuous trace — gaps or resistive necks. ' +
      'Optimal speed is coupled to aerosol flux: if atomizer flow changes, revalidate speed on a sacrificial substrate.',
    narratorText: 'Print speed: {value} mm/s',
    confidence: 'High',
    source: 'SRC-018 §3.3, Wilkinson 2019',
  },
  {
    id: 'PARAM-CARRIER-FLOW-001',
    type: 'Parameter',
    content:
      'Carrier gas flow rate: 25–35 sccm nominal for UA mode. ' +
      'Carrier transports aerosol from atomizer to printhead. ' +
      'Low carrier: insufficient aerosol delivery, thin deposit or no deposition. ' +
      'High carrier without proportional sheath increase: focus ratio drops below 2, line broadens with overspray. ' +
      'Always re-check sheath:carrier ratio after any carrier adjustment (see TACIT-FOCUS-RATIO-001).',
    narratorText: 'Carrier gas: {value} sccm',
    confidence: 'High',
    source: 'SRC-018 §3.1, Islam 2025',
  },
  {
    id: 'PARAM-INK-IDENTITY-001',
    type: 'Parameter',
    content:
      'BASELINE ASSUMPTION, not a live inventory check — flag before treating as safety-authoritative: ' +
      'conductive ink is Novacentrix Metalon JS-A426 silver nanoparticle ink, printed straight from the ' +
      'bottle (no dilution), DI water solvent for addback, stored refrigerated below 5 °C. ' +
      'Dielectric/insulating ink is Norland NEA 121, diluted 2:1 (acetone : ink), UV-curable, stored in ' +
      'an amber or opaque vial (light-sensitive). ' +
      'This baseline was deliberately selected by the training program owner as the working assumption ' +
      'for this corpus — not derived from a confirmed site inventory check. Before relying on any ' +
      'ink-specific guidance in this corpus for a safety decision, confirm the ink product and lot ' +
      'actually loaded matches this baseline (see GAP-013, GAP-014).',
    narratorText: 'Baseline ink: Novacentrix Metalon JS-A426 (conductive), Norland NEA 121 (dielectric) — confirm before relying on for safety decisions.',
    confidence: 'Medium',
    source: 'Baseline/default assumption selected by the training program owner — see GAP-013',
  },
  {
    id: 'PARAM-SINTER-TEMP-001',
    type: 'Parameter',
    content:
      'Sintering temperature for Ag NP ink on FR-4 PCB substrate: 130–150 °C. ' +
      'Optimal conductivity (minimum Ag NP resistivity) typically achieved at 150–200 °C, but FR-4 Tg limits top temperature. ' +
      'Time–temperature tradeoff: 130 °C for 60–90 min approaches the conductivity of 150 °C for 30 min. ' +
      'Ramp rate: ≤5 °C/min from ambient to prevent cracking. ' +
      'Do NOT exceed the most thermally sensitive component datasheet limit when sintering over populated areas.',
    narratorText: 'Sinter temp: {value} °C',
    confidence: 'High',
    source: 'SRC-007, SRC-008, SRC-009 — consolidated in TACIT-SINTER-SUBSTRATE-LIMIT-001',
  },
  {
    id: 'PARAM-EXHAUST-FLOW-001',
    type: 'Parameter',
    content:
      'Exhaust (waste gas) flow rate: matched to combined sheath + carrier flow to maintain slight negative pressure in printhead. ' +
      'Under-exhaust: aerosol accumulates in printhead — deposition defects, long-term contamination. ' +
      'Over-exhaust on PA (pneumatic atomizer): excessive vacuum reduces effective aerosol delivery — dropout symptom. ' +
      'UA (ultrasonic atomizer) is less sensitive to exhaust variation than PA.',
    confidence: 'Medium',
    source: 'SRC-019 §4.2, InferredFromDomain',
  },
];

// ─── Verification Check Nodes ─────────────────────────────────────

export const verificationCheckNodes: AJPNode[] = [
  {
    id: 'VERIFY-PPE-001',
    type: 'VerificationCheck',
    content:
      'PPE verification before machine approach: (1) Nitrile gloves worn — no bare skin on hands. ' +
      '(2) N95 or higher respirator fitted and seal-checked. ' +
      '(3) Eye protection on if working with open ink. ' +
      'Pass criterion: all three items confirmed before any contact with ink, vials, or ink-contacted surfaces.',
    confidence: 'High',
    source: 'NIOSH CIB-70, SRC-018 §1',
  },
  {
    id: 'VERIFY-GAS-PRESSURE-001',
    type: 'VerificationCheck',
    content:
      'Sheath gas pressure verification before atomizer start: KEWB reads within nominal range for the installed nozzle size. ' +
      '150 μm nozzle: 4.5–5.5 PSI. ' +
      'Pass criterion: steady reading within ±0.2 PSI of target for ≥30 seconds without adjustment. ' +
      'Fail action: check regulator, inspect for leaks at fittings, confirm nozzle is correctly seated.',
    confidence: 'High',
    source: 'SRC-018 §4.2',
  },
  {
    id: 'VERIFY-ATOMIZER-CURRENT-001',
    type: 'VerificationCheck',
    content:
      'Atomizer current verification after UA activation: KEWB current 0.4–0.6 mA within 60 seconds of atomizer start. ' +
      'Visible mist should be present in ink vial window. ' +
      'Pass criterion: current in range AND visible mist confirmed. ' +
      'Fail: current < 0.4 mA — check ink volume (≥0.5 mL required), vial seating, and transducer contact. ' +
      'Fail: current > 0.6 mA — over-power; reduce atomizer setting immediately.',
    confidence: 'High',
    source: 'SRC-019 §4.3',
  },
  {
    id: 'VERIFY-PLUME-001',
    type: 'VerificationCheck',
    content:
      'Plume quality check on sacrificial substrate before printing on actual PCB. ' +
      'Print 3+ test lines. Pass criteria: (1) lines present and continuous; (2) line width within ±20% of target; ' +
      '(3) edges well-defined, not diffuse or ragged; (4) no blobs or satellite droplets. ' +
      'If any criterion fails, diagnose before proceeding to actual substrate.',
    confidence: 'High',
    source: 'SRC-018 §5.1, SRC-019 §5.5',
  },
  {
    id: 'VERIFY-SINTER-RESISTANCE-001',
    type: 'VerificationCheck',
    content:
      'Post-sinter electrical verification: measure trace resistance after PCB returns to room temperature. ' +
      'Pass criterion by trace type: digital signal line <100 Ω; power rail <10 Ω; RF/analog — verify against impedance budget. ' +
      'Also measure: repair trace → nearest adjacent trace (must be open circuit — no accidental bridge). ' +
      'Fail: >100 Ω on digital signal — inspect visually, consider re-sinter or reprint. ' +
      'Fail: open circuit — gap present, must reprint.',
    confidence: 'Medium',
    source: 'TACIT-SINTER-RESISTANCE-001, SRC-007',
  },
];

// ─── Parameter and Verification Check Edges ───────────────────────

export const parameterEdges: AJPEdge[] = [
  // Parameters belong to their Equipment/Step context
  { from: 'EQUIP-HD2-HEAD-001', to: 'PARAM-STANDOFF-001', type: 'REQUIRES' },
  { from: 'STEP-STARTUP-003', to: 'PARAM-CARRIER-FLOW-001', type: 'REQUIRES' },
  { from: 'STEP-STARTUP-004', to: 'PARAM-CARRIER-FLOW-001', type: 'REQUIRES' },
  { from: 'EQUIP-HD2-ATOMIZER-001', to: 'PARAM-CARRIER-FLOW-001', type: 'REQUIRES' },

  // Faults caused by out-of-range parameters
  { from: 'PARAM-STANDOFF-001', to: 'FAULT-BLOB-FORMATION-001', type: 'CAUSES' },
  { from: 'PARAM-STANDOFF-001', to: 'FAULT-CLOG-PARTIAL-001', type: 'CAUSES' },
  { from: 'PARAM-PRINT-SPEED-001', to: 'FAULT-DROPOUT-001', type: 'CAUSES' },
  { from: 'PARAM-CARRIER-FLOW-001', to: 'FAULT-OVERSPRAY-001', type: 'CAUSES' },
  { from: 'PARAM-SINTER-TEMP-001', to: 'FAULT-SINTER-INCOMPLETE-001', type: 'CAUSES' },
  { from: 'PARAM-SINTER-TEMP-001', to: 'FAULT-SINTER-THERMAL-DAMAGE-001', type: 'CAUSES' },

  // Verification checks linked to their Steps via VERIFIED_BY
  { from: 'STEP-STARTUP-001', to: 'VERIFY-PPE-001', type: 'VERIFIED_BY' },
  { from: 'STEP-STARTUP-003', to: 'VERIFY-GAS-PRESSURE-001', type: 'VERIFIED_BY' },
  { from: 'STEP-STARTUP-004', to: 'VERIFY-ATOMIZER-CURRENT-001', type: 'VERIFIED_BY' },
  { from: 'STEP-STARTUP-005-FAULT', to: 'VERIFY-PLUME-001', type: 'VERIFIED_BY' },
];

// ─── SUPPORTED_BY Edges — Tacit Knowledge → Theory ────────────────
// These make the evidence chain explicit: each tacit node that has a
// theoretical backing in peer literature links to the relevant THEORY-* node.

export const supportedByEdges: AJPEdge[] = [
  // Gas sequence rationale is supported by tacit knowledge theory (Polanyi/Collins classification)
  { from: 'TACIT-GAS-SEQUENCE-RATIONALE-001', to: 'THEORY-TACIT-KNOWLEDGE-001', type: 'SUPPORTED_BY' },
  { from: 'TACIT-FOCUS-RATIO-001', to: 'THEORY-TACIT-KNOWLEDGE-001', type: 'SUPPORTED_BY' },
  { from: 'TACIT-DIAGNOSIS-LOOP-001', to: 'THEORY-TACIT-KNOWLEDGE-001', type: 'SUPPORTED_BY' },
  { from: 'TACIT-DIAGNOSIS-SINGLE-CHANGE-001', to: 'THEORY-TACIT-KNOWLEDGE-001', type: 'SUPPORTED_BY' },
  { from: 'TACIT-SUBSTRATE-VS-PARAM-001', to: 'THEORY-TACIT-KNOWLEDGE-001', type: 'SUPPORTED_BY' },
];
