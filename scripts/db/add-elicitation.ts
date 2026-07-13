#!/usr/bin/env tsx
/**
 * scripts/db/add-elicitation.ts
 *
 * Record an ExpertTrace elicitation session and its CDM/ACTA decision frames.
 *
 * Usage (interactive — reads decision frames from stdin as JSON):
 *   npx tsx scripts/db/add-elicitation.ts \
 *     --session ELICIT-2026-04-15-001 \
 *     --expert EXP-001 \
 *     --date 2026-04-15 \
 *     --format ExpertTrace-07 \
 *     --sections A,B,C,D \
 *     --context '{"material":"Ag-NP","nozzle_size":"150um","standoff_mm":2,"session_age_minutes":20}' \
 *     --notes "Path to raw session notes or summary"
 *
 * Then pipe decision frames JSON to stdin:
 *   echo '[{"id":"FRAME-001","observed_cues":["KEWA pressure rising"],...}]' | \
 *   npx tsx scripts/db/add-elicitation.ts --session ELICIT-2026-04-15-001
 *
 * Or run without stdin to just record the session header and add frames later.
 *
 * Decision frame JSON shape (array of objects):
 * {
 *   id: string                    // e.g. "FRAME-ELICIT-001-001"
 *   linked_node_id?: string       // TacitKnowledge or FailureMode node ID
 *   observed_cues: string[]       // what the expert noticed
 *   hypothesis_set: string[]      // candidate diagnoses
 *   discriminators: Array<{check: string, eliminates: string[]}>
 *   fast_test?: string            // 60-second discriminating check
 *   decision?: "abort"|"continue"|"monitor"|"adjust"
 *   decision_rationale?: string
 *   cost_of_wrong?: string
 *   outcome?: string
 *   counterfactual?: string
 *   timing_in_session?: "startup"|"mid-session"|"end"|"cross-session"
 *   anchor_artifact?: string      // path/URL to supporting image or log
 * }
 */

import { openDb, closeDb, now, logEvent, DB_PATH } from '../../src/db/index.js';
import { readFileSync } from 'fs';

// ─── CLI args ─────────────────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const sessionId = arg('session') ?? `ELICIT-${new Date().toISOString().slice(0, 10)}-${Date.now()}`;
const expertId = arg('expert') ?? null;
const sessionDate = arg('date') ?? new Date().toISOString().slice(0, 10);
const format = arg('format') ?? 'ExpertTrace-07';
const sections = arg('sections') ?? null;
const contextStr = arg('context') ?? null;
const notes = arg('notes') ?? null;
const domain = arg('domain') ?? 'ajp';

// ─── Main ─────────────────────────────────────────────────────────────────────

interface DecisionFrameInput {
  id?: string;
  linked_node_id?: string;
  observed_cues?: string[];
  hypothesis_set?: string[];
  discriminators?: Array<{ check: string; eliminates: string[] }>;
  fast_test?: string;
  decision?: string;
  decision_rationale?: string;
  cost_of_wrong?: string;
  outcome?: string;
  counterfactual?: string;
  timing_in_session?: string;
  anchor_artifact?: string;
}

function main() {
  const db = openDb();

  console.log(`Recording elicitation session: ${sessionId}`);
  console.log(`  Domain: ${domain}`);
  console.log(`  Expert: ${expertId ?? '(anonymous)'}`);
  console.log(`  Date:   ${sessionDate}`);
  console.log(`  Format: ${format}`);

  // Upsert the session header
  db.prepare(`
    INSERT INTO elicitation_sessions
      (id, domain, expert_id, session_date, context, interview_format, sections_completed, raw_notes, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
    ON CONFLICT(id) DO UPDATE SET
      expert_id          = excluded.expert_id,
      session_date       = excluded.session_date,
      context            = excluded.context,
      interview_format   = excluded.interview_format,
      sections_completed = excluded.sections_completed,
      raw_notes          = excluded.raw_notes
  `).run(
    sessionId,
    domain,
    expertId,
    sessionDate,
    contextStr,
    format,
    sections ? JSON.stringify(sections.split(',').map((s) => s.trim())) : null,
    notes,
    now(),
  );

  logEvent(db, {
    domain,
    target_id: sessionId,
    target_type: 'elicitation',
    event_type: 'tacit-elicited',
    payload: { expert_id: expertId, session_date: sessionDate, format, sections },
    source: 'scripts/db/add-elicitation.ts',
  });

  // Read decision frames from stdin (if piped)
  let frames: DecisionFrameInput[] = [];
  if (!process.stdin.isTTY) {
    const stdin = readFileSync('/dev/stdin', 'utf8').trim();
    if (stdin) {
      try {
        frames = JSON.parse(stdin);
        if (!Array.isArray(frames)) {
          console.error('stdin must be a JSON array of decision frames');
          process.exit(1);
        }
      } catch (err) {
        console.error('Failed to parse stdin as JSON:', err);
        process.exit(1);
      }
    }
  }

  if (frames.length > 0) {
    console.log(`\nInserting ${frames.length} decision frame(s)...`);

    const insertTx = db.transaction(() => {
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const frameId = frame.id ?? `FRAME-${sessionId}-${String(i + 1).padStart(3, '0')}`;

        db.prepare(`
          INSERT INTO decision_frames
            (id, session_id, linked_node_id, observed_cues, hypothesis_set,
             discriminators, fast_test, decision, decision_rationale, cost_of_wrong,
             outcome, counterfactual, timing_in_session, anchor_artifact, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            linked_node_id     = excluded.linked_node_id,
            observed_cues      = excluded.observed_cues,
            hypothesis_set     = excluded.hypothesis_set,
            discriminators     = excluded.discriminators,
            fast_test          = excluded.fast_test,
            decision           = excluded.decision,
            decision_rationale = excluded.decision_rationale,
            cost_of_wrong      = excluded.cost_of_wrong,
            outcome            = excluded.outcome,
            counterfactual     = excluded.counterfactual,
            timing_in_session  = excluded.timing_in_session,
            anchor_artifact    = excluded.anchor_artifact
        `).run(
          frameId,
          sessionId,
          frame.linked_node_id ?? null,
          frame.observed_cues ? JSON.stringify(frame.observed_cues) : null,
          frame.hypothesis_set ? JSON.stringify(frame.hypothesis_set) : null,
          frame.discriminators ? JSON.stringify(frame.discriminators) : null,
          frame.fast_test ?? null,
          frame.decision ?? null,
          frame.decision_rationale ?? null,
          frame.cost_of_wrong ?? null,
          frame.outcome ?? null,
          frame.counterfactual ?? null,
          frame.timing_in_session ?? null,
          frame.anchor_artifact ?? null,
          now(),
        );

        logEvent(db, {
          domain,
          target_id: frameId,
          target_type: 'elicitation',
          event_type: 'tacit-elicited',
          payload: {
            session_id: sessionId,
            linked_node_id: frame.linked_node_id,
            timing: frame.timing_in_session,
            hypothesis_count: frame.hypothesis_set?.length ?? 0,
          },
          source: 'scripts/db/add-elicitation.ts',
        });

        console.log(`  ✓ ${frameId}${frame.linked_node_id ? ` → ${frame.linked_node_id}` : ''}`);
      }
    });

    insertTx();

    // If any frames have a linked_node_id that doesn't exist yet, warn
    const missingNodes: string[] = [];
    for (const frame of frames) {
      if (frame.linked_node_id) {
        const exists = db.prepare('SELECT 1 FROM nodes WHERE id = ?').get(frame.linked_node_id);
        if (!exists) missingNodes.push(frame.linked_node_id);
      }
    }
    if (missingNodes.length > 0) {
      console.log(`\n  ⚠ ${missingNodes.length} linked_node_id(s) not yet in nodes table:`);
      missingNodes.forEach((id) => console.log(`    · ${id}`));
      console.log(`  Create these nodes (e.g., TacitKnowledge type) to link the frames.`);
    }
  }

  console.log(`\n✓ Session ${sessionId} recorded in: ${DB_PATH}`);
  console.log(`  Status: draft — run this script with --session and --status reviewed when codified`);

  closeDb(db);
}

main();
