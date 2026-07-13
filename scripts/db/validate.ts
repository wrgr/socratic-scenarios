#!/usr/bin/env tsx
/**
 * scripts/db/validate.ts
 *
 * SHACL-inspired corpus integrity checks. Validates graph structure, confidence
 * levels, gap coverage, and embedding staleness. Run after migrate or any
 * enrichment operation.
 *
 * Usage:
 *   npm run db:validate
 *   npx tsx scripts/db/validate.ts [--strict]
 *
 * --strict: exit 1 on any warning (for CI use)
 */

import { openDb, closeDb } from '../../src/db/index.js';

type Severity = 'ERROR' | 'WARN' | 'INFO';

interface Finding {
  rule: string;
  severity: Severity;
  message: string;
  count?: number;
  examples?: string[];
}

const findings: Finding[] = [];
const strict = process.argv.includes('--strict');

function error(rule: string, message: string, examples?: string[]) {
  findings.push({ rule, severity: 'ERROR', message, examples });
}

function warn(rule: string, message: string, count?: number, examples?: string[]) {
  findings.push({ rule, severity: 'WARN', message, count, examples });
}

function info(rule: string, message: string) {
  findings.push({ rule, severity: 'INFO', message });
}

function main() {
  const db = openDb();

  // ── Rule 1: every FailureMode must have ≥1 INDICATES edge from a Symptom ────
  const faultsWithoutSymptoms = db.prepare(`
    SELECT n.id
    FROM nodes n
    WHERE n.type = 'FailureMode'
      AND NOT EXISTS (
        SELECT 1 FROM edges e
        WHERE e.to_node = n.id AND e.type = 'INDICATES'
      )
  `).all() as Array<{ id: string }>;

  if (faultsWithoutSymptoms.length > 0) {
    warn(
      'every-fault-has-symptom-indicator',
      `${faultsWithoutSymptoms.length} FailureMode node(s) have no incoming INDICATES edge from a Symptom`,
      faultsWithoutSymptoms.length,
      faultsWithoutSymptoms.slice(0, 5).map((r) => r.id),
    );
  } else {
    info('every-fault-has-symptom-indicator', 'All FailureMode nodes have ≥1 INDICATES edge ✓');
  }

  // ── Rule 2: SafetyHazard nodes must not have confidence 'Inferred' ────────
  const unsafeHazards = db.prepare(`
    SELECT id, confidence, source_tier
    FROM nodes
    WHERE type = 'SafetyHazard' AND (confidence = 'Low' OR source_tier = 'Inferred')
  `).all() as Array<{ id: string; confidence: string; source_tier: string }>;

  if (unsafeHazards.length > 0) {
    error(
      'safety-hazard-no-inferred-confidence',
      `${unsafeHazards.length} SafetyHazard node(s) have Low confidence or Inferred source — safety nodes must have High confidence from official sources`,
      unsafeHazards.map((r) => `${r.id} (${r.confidence}/${r.source_tier})`),
    );
  } else {
    info('safety-hazard-no-inferred-confidence', 'All SafetyHazard nodes have adequate confidence ✓');
  }

  // ── Rule 3: TacitKnowledge nodes should have ≥1 linked decision_frame ─────
  const tacitWithoutFrames = db.prepare(`
    SELECT n.id
    FROM nodes n
    WHERE n.type = 'TacitKnowledge'
      AND NOT EXISTS (
        SELECT 1 FROM decision_frames df WHERE df.linked_node_id = n.id
      )
  `).all() as Array<{ id: string }>;

  if (tacitWithoutFrames.length > 0) {
    warn(
      'tacit-has-decision-frame',
      `${tacitWithoutFrames.length} TacitKnowledge node(s) have no linked decision_frame — add via ExpertTrace session`,
      tacitWithoutFrames.length,
      tacitWithoutFrames.slice(0, 5).map((r) => r.id),
    );
  } else {
    info('tacit-has-decision-frame', 'All TacitKnowledge nodes have ≥1 decision_frame ✓');
  }

  // ── Rule 4: critical-priority gaps must not block SafetyHazard nodes ───────
  const blockedSafety = db.prepare(`
    SELECT g.id as gap_id, g.priority, g.affected_node_ids
    FROM corpus_gaps g
    WHERE g.status != 'resolved' AND g.priority = 'critical'
  `).all() as Array<{ gap_id: string; priority: string; affected_node_ids: string }>;

  const criticalSafetyBlocks: string[] = [];
  for (const gap of blockedSafety) {
    const affectedIds: string[] = gap.affected_node_ids ? JSON.parse(gap.affected_node_ids) : [];
    for (const nodeId of affectedIds) {
      const node = db.prepare('SELECT type FROM nodes WHERE id = ?').get(nodeId) as { type: string } | undefined;
      if (node?.type === 'SafetyHazard') {
        criticalSafetyBlocks.push(`${gap.gap_id} blocks ${nodeId}`);
      }
    }
  }

  if (criticalSafetyBlocks.length > 0) {
    error(
      'critical-gap-no-safety-block',
      `${criticalSafetyBlocks.length} critical gap(s) are blocking SafetyHazard nodes — must be resolved before deployment`,
      criticalSafetyBlocks,
    );
  } else {
    info('critical-gap-no-safety-block', 'No critical gaps blocking SafetyHazard nodes ✓');
  }

  // ── Rule 5: all nodes must have at least one source in node_sources ────────
  const nodesWithoutSources = db.prepare(`
    SELECT n.id, n.type
    FROM nodes n
    WHERE NOT EXISTS (
      SELECT 1 FROM node_sources ns WHERE ns.node_id = n.id
    )
  `).all() as Array<{ id: string; type: string }>;

  if (nodesWithoutSources.length > 0) {
    warn(
      'all-nodes-have-source',
      `${nodesWithoutSources.length} node(s) have no entry in node_sources — add provenance citations`,
      nodesWithoutSources.length,
      nodesWithoutSources.slice(0, 5).map((r) => `${r.id} (${r.type})`),
    );
  } else {
    info('all-nodes-have-source', 'All nodes have ≥1 source citation ✓');
  }

  // ── Rule 6: stale embeddings (content_hash mismatch) ─────────────────────
  const staleEmbeddings = db.prepare(`
    SELECT e.target_id, e.target_type
    FROM embeddings e
    LEFT JOIN chunks c ON e.target_type = 'chunk' AND e.target_id = c.id
    LEFT JOIN nodes  n ON e.target_type = 'node'  AND e.target_id = n.id
    WHERE (
      (e.target_type = 'chunk' AND c.content_hash IS NOT NULL AND e.content_hash != c.content_hash)
      OR
      (e.target_type = 'node'  AND n.content_hash IS NOT NULL AND e.content_hash != n.content_hash)
    )
  `).all() as Array<{ target_id: string; target_type: string }>;

  if (staleEmbeddings.length > 0) {
    warn(
      'no-stale-embeddings',
      `${staleEmbeddings.length} cached embedding(s) are stale (content changed) — run refresh-embeddings.ts`,
      staleEmbeddings.length,
      staleEmbeddings.slice(0, 5).map((r) => `${r.target_id} (${r.target_type})`),
    );
  } else {
    info('no-stale-embeddings', 'All embeddings are current ✓');
  }

  // ── Rule 7: dangling edges (endpoints not in nodes table) ─────────────────
  const danglingEdges = db.prepare(`
    SELECT e.id, e.from_node, e.to_node, e.type
    FROM edges e
    WHERE NOT EXISTS (SELECT 1 FROM nodes WHERE id = e.from_node)
       OR NOT EXISTS (SELECT 1 FROM nodes WHERE id = e.to_node)
  `).all() as Array<{ id: number; from_node: string; to_node: string; type: string }>;

  if (danglingEdges.length > 0) {
    error(
      'no-dangling-edges',
      `${danglingEdges.length} edge(s) reference node IDs that don't exist`,
      danglingEdges.slice(0, 5).map((e) => `${e.from_node} →[${e.type}]→ ${e.to_node}`),
    );
  } else {
    info('no-dangling-edges', 'All edges have valid endpoints ✓');
  }

  // ── Rule 8: open gaps summary ─────────────────────────────────────────────
  const openGaps = db.prepare(`
    SELECT id, priority, summary
    FROM corpus_gaps
    WHERE status = 'open'
    ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
  `).all() as Array<{ id: string; priority: string; summary: string }>;

  if (openGaps.length > 0) {
    const critCount = openGaps.filter((g) => g.priority === 'critical').length;
    const highCount = openGaps.filter((g) => g.priority === 'high').length;
    warn(
      'open-gaps-summary',
      `${openGaps.length} open gap(s): ${critCount} critical, ${highCount} high priority`,
      openGaps.length,
      openGaps.filter((g) => g.priority === 'critical').map((g) => `${g.id}: ${g.summary}`),
    );
  } else {
    info('open-gaps-summary', 'No open corpus gaps ✓');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  closeDb(db);

  const errors = findings.filter((f) => f.severity === 'ERROR');
  const warns = findings.filter((f) => f.severity === 'WARN');
  const infos = findings.filter((f) => f.severity === 'INFO');

  console.log('\n── Corpus Validation Report ─────────────────────────────────\n');

  for (const f of findings) {
    const icon = f.severity === 'ERROR' ? '✗' : f.severity === 'WARN' ? '⚠' : '✓';
    console.log(`${icon} [${f.rule}]`);
    console.log(`  ${f.message}`);
    if (f.examples && f.examples.length > 0) {
      for (const ex of f.examples) {
        console.log(`    · ${ex}`);
      }
    }
    console.log();
  }

  console.log(`─────────────────────────────────────────────────────────────`);
  console.log(`  ${errors.length} error(s)  ${warns.length} warning(s)  ${infos.length} passing`);

  if (errors.length > 0 || (strict && warns.length > 0)) {
    process.exit(1);
  }
}

main();
