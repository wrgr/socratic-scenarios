#!/usr/bin/env tsx
/**
 * scripts/db/enrich-symptom-edges.ts
 *
 * Adds 5 new Symptom nodes + all INDICATES edges for the 8 FailureModes
 * that had no incoming symptom connections. Also adds FIXED_BY edges for
 * the 4 faults that had no edges at all.
 *
 * All content is grounded in: Stanford SNF SOP (SRC-018), Boise State IML
 * SOP (SRC-019), Wilkinson et al. 2019 AJP review, design-faults.ts
 * node content, and the expert diagnostic reasoning in kb-candidates/02.
 */

import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '../../knowledge/knowledge.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const now = () => new Date().toISOString();
const hash = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 16);

function upsertNode(id: string, type: string, content: string, confidence: string, sourceTier: string, metadata: Record<string, unknown> = {}) {
  const h = hash(content);
  const existing = db.prepare('SELECT version FROM nodes WHERE id=?').get(id) as {version:number}|undefined;
  db.prepare(`
    INSERT INTO nodes (id, domain, type, content, confidence, source_tier, metadata, content_hash, version, created_at, updated_at)
    VALUES (?, 'ajp', ?, ?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      content=excluded.content, confidence=excluded.confidence,
      content_hash=excluded.content_hash, version=version+1, updated_at=excluded.updated_at
  `).run(id, type, content, confidence, sourceTier, Object.keys(metadata).length ? JSON.stringify(metadata) : null, h, now(), now());
  console.log(`  ${existing ? '~' : '+'} ${id}`);
}

function addEdge(from: string, to: string, type: string) {
  // verify both endpoints exist before inserting
  const fromOk = db.prepare('SELECT 1 FROM nodes WHERE id=?').get(from);
  const toOk   = db.prepare('SELECT 1 FROM nodes WHERE id=?').get(to);
  if (!fromOk || !toOk) {
    console.warn(`  ⚠ skipping edge ${from} --[${type}]--> ${to}: endpoint missing`);
    return;
  }
  db.prepare(`INSERT OR IGNORE INTO edges (from_node, to_node, type, weight, created_at) VALUES (?,?,?,1.0,?)`).run(from, to, type, now());
}

function logEvent(targetId: string, targetType: string, eventType: string, payload: Record<string,unknown>) {
  db.prepare(`INSERT INTO enrichment_events (domain,target_id,target_type,event_type,payload,source,created_at)
    VALUES ('ajp',?,?,?,?,?,?)`).run(targetId, targetType, eventType, JSON.stringify(payload), 'scripts/db/enrich-symptom-edges.ts', now());
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1 — New Symptom nodes
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── New Symptom nodes ──');

upsertNode(
  'SYMPT-KEWA-UNRESPONSIVE-001',
  'Symptom',
  'KEWA software interface stops responding to user input: buttons, sliders, and status displays are frozen. ' +
  'Gas flows may remain active at their last set values — no software control is possible. ' +
  'Distinguish from normal latency: freeze persists >10 seconds with no update to any display field. ' +
  'If freeze occurs mid-print with atomizer running, manual physical gas controls must be used immediately.',
  'High',
  'OfficialDoc',
  { source: 'SRC-018 Section 8.1' },
);

upsertNode(
  'SYMPT-SUBSTRATE-CONTAMINATION-VIS-001',
  'Symptom',
  'Visible contamination on substrate surface under oblique white light or UV illumination: ' +
  'fingerprint oils (iridescent sheen or matte haze); flux residue (yellowish, tacky, crystalline); ' +
  'ESD foam particles (fibrous debris); conformal coating remnants (glossy patches with sharp boundary). ' +
  'Observable during pre-print substrate inspection — must be identified before PCB reaches chuck. ' +
  'UV light (365 nm) reveals oils and flux residues invisible under white light.',
  'High',
  'OfficialDoc',
  { source: 'SRC-018 Section 3.2, SRC-019 Section 2.1' },
);

upsertNode(
  'SYMPT-TRACE-DEWET-001',
  'Symptom',
  'Deposited ink retracts or beads up on the substrate surface within seconds of deposition — ' +
  'visible on the process camera as a trace that forms and then contracts or breaks into droplets. ' +
  'Distinct from evaporation narrowing (which is gradual and uniform) or clog gaps (which are fixed-width breaks): ' +
  'dewetting shows sharp lateral retraction and/or spherical bead formation. ' +
  'Most visible on the first 5–10 mm of a trace where the camera has clear line-of-sight.',
  'High',
  'PeerReview',
  { source: 'Wilkinson et al. 2019 (surface energy discussion); SRC-018 Section 6.3' },
);

upsertNode(
  'SYMPT-IRREGULAR-TRACE-SHAPE-001',
  'Symptom',
  'Deposited trace has unpredictable shape variation not attributable to gas parameters or speed: ' +
  'width oscillates without correlation to KEWA readings, edge quality inconsistent over short distances, ' +
  'and shape defects appear in different forms at different locations (unlike parameter faults, which are consistent). ' +
  'Key discriminator from partial clog: adjusting sheath gas produces no consistent improvement. ' +
  'Key discriminator from standoff error: problem appears even at verified correct standoff. ' +
  'Under process camera: trace pattern looks "random" rather than systematically wrong.',
  'High',
  'OfficialDoc',
  { source: 'SRC-018 Section 8.5 (nozzle inspection criteria); SRC-019 Section 3.4' },
);

upsertNode(
  'SYMPT-ESD-EVENT-001',
  'Symptom',
  'Observable ESD event during PCB handling or setup: audible snap or crack, visible spark at point of contact, ' +
  'or sudden unexpected behavior of active components (LED flicker, microcontroller reset). ' +
  'Latent ESD damage has no immediate observable — manifests later as: circuit fails electrical test ' +
  'despite visually acceptable trace and confirmed continuity; component behavior degraded without visible physical damage. ' +
  'ESD damage is often invisible and irreversible — prevention (wrist strap + ESD mat) is the only reliable control.',
  'High',
  'Standard',
  { source: 'IPC-7711C/7721C ESD control requirements; SRC-019 Section 2.3' },
);

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2 — New CorrectiveAction nodes for isolated faults
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── New CorrectiveAction nodes ──');

upsertNode(
  'ACTION-SUBSTRATE-PREP-001',
  'CorrectiveAction',
  'Substrate decontamination before AJP print: ' +
  '(1) IPA wipe — unidirectional single stroke with cleanroom swab; never scrub or backtrack. ' +
  '(2) For flux residue: IPA wipe, 30-second dry time, second IPA wipe, 60-second dry time. ' +
  '(3) For conformal coating remnants: mechanical removal with wooden stick only — no metal tools on PCB. ' +
  '(4) Post-clean: inspect under oblique light before placing on chuck. Do not touch cleaned area. ' +
  '(5) Load within 5 minutes of cleaning — do not store cleaned PCB in open air.',
  'High',
  'OfficialDoc',
  { source: 'SRC-018 Section 3.2, SRC-019 Section 2.1' },
);

upsertNode(
  'ACTION-INK-REPLACE-001',
  'CorrectiveAction',
  'Degraded ink remediation: ' +
  '(1) Perform correct shutdown sequence before removing vial. ' +
  '(2) If settled layer: attempt 60-second sonication bath — re-inspect under light. If layer re-forms within 5 minutes: discard. ' +
  '(3) Color shift (dark gray/brown) or gel texture: discard immediately — do not attempt to use. ' +
  '(4) Replace with fresh vial from sealed storage (refrigerated, <6 months from manufacture). ' +
  '(5) Allow fresh ink to reach room temperature (15 minutes minimum) before loading. ' +
  '(6) Print test trace on sacrificial substrate before committing to PCB. ' +
  'Ink disposal: treat as nanoparticle hazardous waste — double-bag, label, EHS collection.',
  'High',
  'OfficialDoc',
  { source: 'SRC-018 Section 4.2, SRC-019 Section 4.1; ink manufacturer handling guidance' },
);

upsertNode(
  'ACTION-KEWA-RECOVERY-001',
  'CorrectiveAction',
  'KEWA software freeze recovery: ' +
  'CRITICAL FIRST: if gas flows are active, use PHYSICAL gas control knobs to zero ALL flows before any software action. ' +
  '(1) Atomizer gas physical knob → 0. Wait 10 seconds. ' +
  '(2) Exhaust physical knob → 0. Wait 60 seconds. ' +
  '(3) Sheath physical knob → 0. ' +
  '(4) Force-quit KEWA from Task Manager. ' +
  '(5) Restart KEWA — it will re-home stage on startup (allow 2–3 minutes). ' +
  '(6) Inspect nozzle before restarting gas flows — freeze during print may indicate developing clog. ' +
  'Do NOT attempt software restart while gas flows are active.',
  'High',
  'OfficialDoc',
  { source: 'SRC-018 Section 8.1 (KEWA recovery procedure)', safetyAlert: 'Zero gas flows with physical controls BEFORE software restart.' },
);

upsertNode(
  'ACTION-SURFACE-TREAT-001',
  'CorrectiveAction',
  'Adhesion remediation for Ag NP ink on low-adhesion substrates: ' +
  '(1) Confirm substrate is clean (IPA wipe per ACTION-SUBSTRATE-PREP-001). ' +
  '(2) For PCB copper or FR-4 surface: mild abrasion with 400-grit abrasive paper (unidirectional) increases mechanical adhesion. IPA wipe after. ' +
  '(3) Mild thermal preheating (50–60°C chuck, 5 minutes) improves adhesion for most Ag NP formulations on FR-4. ' +
  '(4) For conformal-coated surfaces: adhesion may be inherently poor — consult ink manufacturer compatibility table. ' +
  '(5) Print test trace on sacrificial substrate at same conditions before PCB. ' +
  'Do not proceed to PCB if test trace shows dewetting.',
  'Medium',
  'PeerReview',
  { source: 'Wilkinson et al. 2019 (substrate surface energy section); SRC-018 Section 6.3' },
);

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3 — INDICATES edges (symptom → fault)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── INDICATES edges (symptom → fault) ──');

const indicatesEdges: Array<[string, string]> = [
  // FAULT-CONTAMINATION-PRE-PRINT-001
  ['SYMPT-SUBSTRATE-CONTAMINATION-VIS-001', 'FAULT-CONTAMINATION-PRE-PRINT-001'],
  ['SYMPT-LINE-GAPS-001',                   'FAULT-CONTAMINATION-PRE-PRINT-001'],
  ['SYMPT-LOW-DENSITY-TRACE-001',           'FAULT-CONTAMINATION-PRE-PRINT-001'],

  // FAULT-ESD-DAMAGE-001
  ['SYMPT-ESD-EVENT-001',                   'FAULT-ESD-DAMAGE-001'],
  ['SYMPT-HIGH-RESISTANCE-POST-SINTER-001', 'FAULT-ESD-DAMAGE-001'],

  // FAULT-GAS-SEQUENCE-WRONG-001
  ['SYMPT-WHITE-HAZE-FITTING-001',          'FAULT-GAS-SEQUENCE-WRONG-001'],
  ['SYMPT-DIFFUSE-EDGES-001',               'FAULT-GAS-SEQUENCE-WRONG-001'],

  // FAULT-INK-DEGRADED-001
  ['SYMPT-THIN-PLUME-001',                  'FAULT-INK-DEGRADED-001'],
  ['SYMPT-LOW-DENSITY-TRACE-001',           'FAULT-INK-DEGRADED-001'],
  ['SYMPT-LOW-CURRENT-001',                 'FAULT-INK-DEGRADED-001'],

  // FAULT-KEWA-FREEZE-001
  ['SYMPT-KEWA-UNRESPONSIVE-001',           'FAULT-KEWA-FREEZE-001'],
  ['SYMPT-NO-STAGE-MOTION-001',             'FAULT-KEWA-FREEZE-001'],

  // FAULT-NOZZLE-DAMAGE-001
  ['SYMPT-IRREGULAR-TRACE-SHAPE-001',       'FAULT-NOZZLE-DAMAGE-001'],
  ['SYMPT-DIFFUSE-EDGES-001',               'FAULT-NOZZLE-DAMAGE-001'],
  ['SYMPT-LINE-TOO-WIDE-001',               'FAULT-NOZZLE-DAMAGE-001'],
  ['SYMPT-BLOB-NOZZLE-TIP-001',             'FAULT-NOZZLE-DAMAGE-001'],

  // FAULT-POOR-ADHESION-001
  ['SYMPT-TRACE-DEWET-001',                 'FAULT-POOR-ADHESION-001'],
  ['SYMPT-SUBSTRATE-CONTAMINATION-VIS-001', 'FAULT-POOR-ADHESION-001'],
  ['SYMPT-LINE-GAPS-001',                   'FAULT-POOR-ADHESION-001'],
  ['SYMPT-LOW-DENSITY-TRACE-001',           'FAULT-POOR-ADHESION-001'],
  ['SYMPT-HIGH-RESISTANCE-POST-SINTER-001', 'FAULT-POOR-ADHESION-001'],

  // FAULT-STANDOFF-TOO-SMALL-001
  ['SYMPT-LINE-NARROW-001',                 'FAULT-STANDOFF-TOO-SMALL-001'],
  ['SYMPT-BLOB-ON-TRACE-001',               'FAULT-STANDOFF-TOO-SMALL-001'],
];

for (const [from, to] of indicatesEdges) {
  addEdge(from, to, 'INDICATES');
  console.log(`  ${from} --[INDICATES]--> ${to}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4 — FIXED_BY + REQUIRES edges for previously isolated faults
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── FIXED_BY edges ──');

const fixedByEdges: Array<[string, string]> = [
  ['FAULT-CONTAMINATION-PRE-PRINT-001', 'ACTION-SUBSTRATE-PREP-001'],
  ['FAULT-INK-DEGRADED-001',            'ACTION-INK-REPLACE-001'],
  ['FAULT-KEWA-FREEZE-001',             'ACTION-KEWA-RECOVERY-001'],
  ['FAULT-POOR-ADHESION-001',           'ACTION-SURFACE-TREAT-001'],
  ['FAULT-POOR-ADHESION-001',           'ACTION-SUBSTRATE-PREP-001'],
  ['FAULT-NOZZLE-DAMAGE-001',           'ACTION-NOZZLE-FULL-CLEAN-001'],
  ['FAULT-STANDOFF-TOO-SMALL-001',      'ACTION-ABORT-PRINT-001'],
];

for (const [from, to] of fixedByEdges) {
  addEdge(from, to, 'FIXED_BY');
  console.log(`  ${from} --[FIXED_BY]--> ${to}`);
}

console.log('\n── REQUIRES edges (safety) ──');

const requiresEdges: Array<[string, string]> = [
  ['FAULT-CONTAMINATION-PRE-PRINT-001', 'HAZARD-NANOPARTICLE-001'],
  ['FAULT-INK-DEGRADED-001',            'HAZARD-NANOPARTICLE-001'],
  ['FAULT-POOR-ADHESION-001',           'HAZARD-ESD-001'],
  ['FAULT-ESD-DAMAGE-001',              'HAZARD-ESD-001'],
  ['FAULT-KEWA-FREEZE-001',             'HAZARD-NANOPARTICLE-001'],
];

for (const [from, to] of requiresEdges) {
  addEdge(from, to, 'REQUIRES');
  console.log(`  ${from} --[REQUIRES]--> ${to}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 5 — Enrichment event log
// ═══════════════════════════════════════════════════════════════════════════════

logEvent('ajp', 'node', 'edge-added', {
  description: 'Added 5 new Symptom nodes + 4 new CorrectiveAction nodes',
  indicates_edges: indicatesEdges.length,
  fixed_by_edges: fixedByEdges.length,
  requires_edges: requiresEdges.length,
  grounding: ['SRC-018', 'SRC-019', 'Wilkinson et al. 2019', 'IPC-7711C/7721C'],
});

db.close();

console.log('\n✓ Enrichment complete. Run npm run db:validate to confirm all 8 faults now have INDICATES edges.');
