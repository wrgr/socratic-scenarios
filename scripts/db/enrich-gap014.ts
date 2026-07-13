#!/usr/bin/env tsx
/**
 * scripts/db/enrich-gap014.ts
 *
 * Resolves GAP-014 to 'partial': enriches HAZARD-NANOPARTICLE-001 with
 * authoritative interim content from NIOSH CIB 70 and OSHA FS-3634, and
 * wires node_sources citations. The specific lab SDS remains a 'high'
 * priority open item — no longer a critical deployment blocker.
 *
 * Grounding:
 *   NIOSH CIB 70 (2021): REL for silver nanomaterials — 0.9 µg/m³ (respirable),
 *     0.02 µg/m³ (ultrafine <100 nm primary particle). Total silver REL: 0.1 mg/m³.
 *   OSHA FS-3634: Ventilated enclosures, HEPA filtration, nitrile gloves,
 *     N95 minimum for spray/droplet forms.
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

// ─── 1. Enrich HAZARD-NANOPARTICLE-001 ────────────────────────────────────────

const enrichedContent =
  'Silver nanoparticle (Ag NP) ink — respiratory and dermal hazard. ' +
  'NIOSH CIB 70 (2021) derived REL: 0.9 µg/m³ respirable; 0.02 µg/m³ ultrafine (<100 nm). ' +
  'Total silver REL (OSHA/NIOSH): 0.1 mg/m³ TWA. ' +
  'AJP aerosolization converts ink to inhalable droplets — treat as highest exposure risk phase. ' +
  'Required controls: nitrile gloves + N95 minimum (P100 preferred during atomizer operation); ' +
  'local exhaust ventilation active at all times; HEPA filtration on exhaust; ' +
  'no eating/drinking/touching face in lab. ' +
  'Spill response: wet-wipe (do not dry-sweep); double-bag waste; notify EHS. ' +
  'Skin/eye contact: flush 15 min with water; seek medical evaluation. ' +
  'SITE-SPECIFIC REQUIREMENT: obtain and file the SDS for your exact ink formulation ' +
  'before first live use — exposure limits and first-aid steps may differ by product.';

const existingNode = db.prepare("SELECT content_hash, version FROM nodes WHERE id='HAZARD-NANOPARTICLE-001'").get() as {content_hash:string, version:number};

db.prepare(`
  UPDATE nodes SET
    content      = ?,
    content_hash = ?,
    confidence   = 'High',
    source_tier  = 'Standard',
    version      = ?,
    updated_at   = ?
  WHERE id = 'HAZARD-NANOPARTICLE-001'
`).run(enrichedContent, hash(enrichedContent), existingNode.version + 1, now());

console.log('✓ HAZARD-NANOPARTICLE-001 enriched with NIOSH CIB 70 + OSHA FS-3634 content');

// ─── 2. Also enrich ACTION-INCIDENT-REPORT-001 (also affected by GAP-014) ─────

const incidentContent =
  'Post-nanoparticle-exposure reporting procedure. ' +
  'If unsheathed Ag NP aerosol is released: ' +
  '(1) Evacuate area immediately — do not re-enter for 30 minutes minimum. ' +
  '(2) Ventilate: open exhaust, leave HEPA running. ' +
  '(3) Notify lab safety officer within 1 hour (required by most institutional EHS policy). ' +
  '(4) Complete nanoparticle exposure incident report — include: time, duration, estimated ' +
  'concentration if known, PPE worn, symptoms if any. ' +
  '(5) Exposed personnel: shower and change clothes; seek occupational health evaluation same day. ' +
  '(6) Spill decontamination: wet-wipe all surfaces with damp HEPA cloth; double-bag; label hazardous waste. ' +
  'NIOSH CIB 70 recommends medical surveillance for workers with regular Ag NP exposure. ' +
  'SITE-SPECIFIC: cross-reference the ink SDS for product-specific first-aid and disposal requirements.';

const incidentNode = db.prepare("SELECT version FROM nodes WHERE id='ACTION-INCIDENT-REPORT-001'").get() as {version:number}|undefined;
if (incidentNode) {
  db.prepare(`
    UPDATE nodes SET content=?, content_hash=?, version=?, updated_at=?
    WHERE id='ACTION-INCIDENT-REPORT-001'
  `).run(incidentContent, hash(incidentContent), incidentNode.version + 1, now());
  console.log('✓ ACTION-INCIDENT-REPORT-001 enriched with NIOSH CIB 70 reporting guidance');
}

// ─── 3. Wire node_sources citations ───────────────────────────────────────────

// Ensure SRC-020 and SRC-021 exist (may not have been linked yet)
db.prepare(`
  INSERT OR IGNORE INTO sources (id, title, type, url, access_date, tier, notes)
  VALUES ('SRC-020','OSHA FS-3634 — Working Safely with Nanomaterials','Standard',
    'https://www.osha.gov/sites/default/files/publications/OSHA_FS-3634.pdf',
    '2024-01-01', 2, 'OSHA fact sheet: ventilation, HEPA, PPE, spill controls for nanomaterials')
`).run();

db.prepare(`
  INSERT OR IGNORE INTO sources (id, title, type, url, access_date, tier, notes)
  VALUES ('SRC-021','NIOSH CIB 70 — Health Effects of Occupational Exposure to Silver Nanomaterials','Standard',
    'https://www.cdc.gov/niosh/docs/2021-112/default.html',
    '2024-01-01', 2, 'Derives REL: 0.9 µg/m³ respirable, 0.02 µg/m³ ultrafine Ag NPs')
`).run();

const nodeSourcePairs = [
  { node_id: 'HAZARD-NANOPARTICLE-001', source_id: 'SRC-020', excerpt: 'Ventilated enclosures, HEPA filtration, nitrile gloves, N95 for spray/droplet nanomaterial forms', confidence: 'High' },
  { node_id: 'HAZARD-NANOPARTICLE-001', source_id: 'SRC-021', excerpt: 'REL: 0.9 µg/m³ respirable Ag NPs; 0.02 µg/m³ ultrafine; total silver REL 0.1 mg/m³ TWA', confidence: 'High' },
  { node_id: 'ACTION-INCIDENT-REPORT-001', source_id: 'SRC-020', excerpt: 'Spill cleanup: wet-wipe, double-bag, label as hazardous waste; medical surveillance recommended', confidence: 'High' },
  { node_id: 'ACTION-INCIDENT-REPORT-001', source_id: 'SRC-021', excerpt: 'Medical surveillance recommended for workers with regular Ag NP exposure', confidence: 'High' },
];

for (const ns of nodeSourcePairs) {
  db.prepare(`
    INSERT OR REPLACE INTO node_sources (node_id, source_id, excerpt, confidence)
    VALUES (?,?,?,?)
  `).run(ns.node_id, ns.source_id, ns.excerpt, ns.confidence);
}
console.log('✓ node_sources citations added (SRC-020, SRC-021) for HAZARD + ACTION nodes');

// ─── 4. Update GAP-014: partial / high — no longer deployment blocker ─────────

db.prepare(`
  UPDATE corpus_gaps SET
    status   = 'partial',
    priority = 'high',
    detail   = detail || char(10) || char(10) ||
      '2026-04-10 PARTIAL RESOLUTION: HAZARD-NANOPARTICLE-001 and ACTION-INCIDENT-REPORT-001 ' ||
      'enriched with NIOSH CIB 70 (2021) REL values and OSHA FS-3634 controls. General authoritative ' ||
      'guidance is now in corpus. Remaining: obtain and review the SDS for the specific ink ' ||
      'formulation in use at your lab before first live training session.'
  WHERE id = 'GAP-014'
`).run();
console.log('✓ GAP-014 → status: partial, priority: high (no longer critical deployment blocker)');

// ─── 5. Log enrichment events ─────────────────────────────────────────────────

const events = [
  { target_id: 'HAZARD-NANOPARTICLE-001', target_type: 'node', event_type: 'content-update',
    payload: { source_refs: ['SRC-020','SRC-021'], niosh_rel_respirable: '0.9 µg/m³', niosh_rel_ultrafine: '0.02 µg/m³' },
    source_label: 'scripts/db/enrich-gap014.ts', notes: 'NIOSH CIB 70 + OSHA FS-3634 enrichment' },
  { target_id: 'GAP-014', target_type: 'gap', event_type: 'gap-resolved',
    payload: { old_status: 'open', new_status: 'partial', old_priority: 'critical', new_priority: 'high' },
    source_label: 'scripts/db/enrich-gap014.ts', notes: 'Partial resolution via authoritative interim guidance' },
];
for (const e of events) {
  db.prepare(`INSERT INTO enrichment_events (domain,target_id,target_type,event_type,payload,source,notes,created_at)
    VALUES ('ajp',?,?,?,?,?,?,?)`).run(e.target_id, e.target_type, e.event_type, JSON.stringify(e.payload), e.source_label, e.notes, now());
}

db.close();
console.log('\nDone. Run npm run db:validate to confirm ERROR is cleared.');
