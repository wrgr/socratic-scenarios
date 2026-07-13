#!/usr/bin/env tsx
/**
 * scripts/db/log-failure.ts
 *
 * Capture a failure observation — a moment when the knowledge system could not
 * adequately serve a learner's real query. These accumulate into a signal for
 * gap creation and corpus enrichment.
 *
 * Usage:
 *   npx tsx scripts/db/log-failure.ts \
 *     --query "pressure rising but nozzle looks fine" \
 *     --was-adequate false \
 *     --notes "No edge from PARAM-SHEATH-FLOW to FAULT-GAS-SEQ-001"
 *
 * Optional flags:
 *   --domain ajp
 *   --symptoms '["KEWA pressure rising","no visible plume change"]'
 *   --missing-node FAULT-GAS-SEQ-STARTUP-001    (node that should exist)
 *   --gap GAP-015                               (link to existing gap)
 *   --learner-id LEARNER-123
 *   --mode in-operation|socratic|scenario
 *
 * After logging, review failure_observations for patterns and promote recurring
 * failures to corpus_gaps via:
 *   npx tsx scripts/db/promote-failure-to-gap.ts --failure-id 42
 */

import { openDb, closeDb, now, logEvent, DB_PATH } from '../../src/db/index.js';

// ─── CLI args ─────────────────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const domain = arg('domain') ?? 'ajp';
const queryText = arg('query') ?? null;
const wasAdequateStr = arg('was-adequate') ?? 'false';
const wasAdequate = wasAdequateStr !== 'false' && wasAdequateStr !== '0';
const symptomsStr = arg('symptoms') ?? null;
const missingNodeId = arg('missing-node') ?? null;
const affectedGapId = arg('gap') ?? null;
const notes = arg('notes') ?? null;
const learnerId = arg('learner-id') ?? null;
const mode = arg('mode') ?? null;

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const db = openDb();

  const sessionContext = JSON.stringify({
    ...(learnerId ? { learner_id: learnerId } : {}),
    ...(mode ? { mode } : {}),
    timestamp: new Date().toISOString(),
  });

  const result = db.prepare(`
    INSERT INTO failure_observations
      (domain, session_context, symptoms_observed, query_text, graph_result,
       was_adequate, missing_node_id, affected_gap_id, notes, created_at)
    VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)
  `).run(
    domain,
    sessionContext,
    symptomsStr,
    queryText,
    wasAdequate ? 1 : 0,
    missingNodeId,
    affectedGapId,
    notes,
    now(),
  );

  const id = result.lastInsertRowid as number;

  logEvent(db, {
    domain,
    target_id: String(id),
    target_type: 'chunk',
    event_type: 'failure-captured',
    payload: {
      query_text: queryText,
      was_adequate: wasAdequate,
      missing_node_id: missingNodeId,
      affected_gap_id: affectedGapId,
    },
    source: 'scripts/db/log-failure.ts',
    notes,
  });

  console.log(`✓ Failure observation #${id} logged to: ${DB_PATH}`);

  if (!wasAdequate) {
    // Check if this pattern is recurring (same missing_node_id appearing ≥3 times)
    if (missingNodeId) {
      const count = (db.prepare(`
        SELECT COUNT(*) as n FROM failure_observations
        WHERE missing_node_id = ? AND was_adequate = 0
      `).get(missingNodeId) as { n: number }).n;

      if (count >= 3) {
        console.log(`\n  ⚠ Pattern detected: '${missingNodeId}' has appeared in ${count} inadequate responses.`);
        console.log(`  Consider creating a corpus gap or new node for this:`);
        console.log(`  npx tsx scripts/db/create-gap.ts --id GAP-NEW --summary "..." --affected-nodes "${missingNodeId}"`);
      }
    }

    // Remind about gap promotion
    console.log(`\n  Query: "${queryText ?? '(none)'}"`);
    console.log(`  Was adequate: ${wasAdequate}`);
    if (notes) console.log(`  Notes: ${notes}`);
  }

  closeDb(db);
}

main();
