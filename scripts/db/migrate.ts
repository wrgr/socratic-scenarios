#!/usr/bin/env tsx
/**
 * scripts/db/migrate.ts
 *
 * One-time seed migration: imports all existing TypeScript corpus arrays into
 * the SQLite knowledge database. Run after db:init.
 *
 * After this runs, knowledge.db is the source of truth. The TS files in
 * src/corpus/ajp/ become frozen seed data (do not delete — they are still
 * used by the Vite client at runtime via in-memory graph).
 *
 * Usage:
 *   npm run db:migrate
 *   npx tsx scripts/db/migrate.ts [--reset]
 *
 * --reset: drop and re-create all rows (idempotent re-run)
 */

import { openDb, closeDb, contentHash, now, logEvent, DB_PATH } from '../../src/db/index.js';
import type { DB } from '../../src/db/index.js';
import type { AJPNode, AJPEdge } from '../../src/types/ajp.js';

// ─── Import all corpus modules ────────────────────────────────────────────────

import { ajpNodes, ajpEdges } from '../../src/corpus/ajp/graph.js';
import {
  extendedSymptomNodes,
  extendedFaultNodes,
  extendedActionNodes,
  extendedEdges,
} from '../../src/corpus/ajp/graph-faults.js';
import {
  designFaultNodes,
  designSymptomNodes,
  designTacitNodes,
  designFaultEdges,
} from '../../src/corpus/ajp/design-faults.js';
import { designActionNodes, designActionEdges } from '../../src/corpus/ajp/design-actions.js';
import { consequenceNodes, consequenceEdges } from '../../src/corpus/ajp/consequences.js';
import { tacitKnowledgeNodes, tacitKnowledgeEdges } from '../../src/corpus/ajp/tacit-knowledge.js';
import { ajpProbeNodes, ajpProbeEdges } from '../../src/corpus/ajp/probes.js';
import { ajpCorpusChunks } from '../../src/corpus/ajp/chunks.js';
import { corpusGaps } from '../../src/corpus/ajp/corpus-gaps.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract source_tier from a source string. */
function inferSourceTier(source?: string): string {
  if (!source) return 'Inferred';
  const s = source.toLowerCase();
  if (s.includes('sop') || s.includes('optomec') || s.includes('vendor')) return 'OfficialDoc';
  if (s.includes('ipc') || s.includes('osha') || s.includes('niosh')) return 'Standard';
  if (s.includes('peer') || s.includes('src-0') || s.includes('src-01') || s.includes('src-02')) return 'PeerReview';
  if (s.includes('stanford') || s.includes('boise') || s.includes('snf') || s.includes('iml')) return 'OfficialDoc';
  if (s.includes('expert') || s.includes('interview') || s.includes('elicit')) return 'Elicited';
  return 'Inferred';
}

/** Insert an AJPNode into the nodes table. Upserts by id. */
function insertNode(db: DB, node: AJPNode & Record<string, unknown>, domain = 'ajp'): void {
  const hash = contentHash(node.content);

  // Serialize all fields beyond the base AJPNode shape into metadata JSON.
  const baseKeys = new Set(['id', 'type', 'content', 'confidence']);
  const metadata: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (!baseKeys.has(k) && v !== undefined && v !== null) {
      metadata[k] = v;
    }
  }

  const source = (node.source as string | undefined) ?? undefined;

  db.prepare(`
    INSERT INTO nodes (id, domain, type, content, confidence, source_tier, metadata, content_hash, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      content      = excluded.content,
      confidence   = excluded.confidence,
      source_tier  = excluded.source_tier,
      metadata     = excluded.metadata,
      content_hash = excluded.content_hash,
      version      = version + 1,
      updated_at   = excluded.updated_at
  `).run(
    node.id,
    domain,
    node.type,
    node.content,
    node.confidence ?? 'Low',
    inferSourceTier(source),
    Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
    hash,
    now(),
    now(),
  );
}

/** Insert an AJPEdge into the edges table. Ignores duplicate from/to/type combos. */
function insertEdge(db: DB, edge: AJPEdge): void {
  db.prepare(`
    INSERT OR IGNORE INTO edges (from_node, to_node, type, weight, context, created_at)
    VALUES (?, ?, ?, 1.0, NULL, ?)
  `).run(edge.from, edge.to, edge.type, now());
}

/** Insert a corpus chunk. Upserts by id. */
function insertChunk(
  db: DB,
  chunk: {
    id: string;
    conceptId?: string;
    content: string;
    chunkType: string;
    difficulty?: string;
    roleContext?: string;
    linkedNodeIds?: string[];
    similarityScores?: Record<string, number>;
  },
  domain = 'ajp',
): void {
  const hash = contentHash(chunk.content);
  db.prepare(`
    INSERT INTO chunks (id, domain, concept_id, content, chunk_type, difficulty, role_context, linked_node_ids, content_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      content         = excluded.content,
      chunk_type      = excluded.chunk_type,
      difficulty      = excluded.difficulty,
      role_context    = excluded.role_context,
      linked_node_ids = excluded.linked_node_ids,
      content_hash    = excluded.content_hash,
      updated_at      = excluded.updated_at
  `).run(
    chunk.id,
    domain,
    chunk.conceptId ?? null,
    chunk.content,
    chunk.chunkType,
    chunk.difficulty ?? null,
    chunk.roleContext ?? null,
    chunk.linkedNodeIds ? JSON.stringify(chunk.linkedNodeIds) : null,
    hash,
    now(),
    now(),
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`Migrating corpus to: ${DB_PATH}\n`);
  const db = openDb();

  // Gather all nodes and edges
  const allNodes: AJPNode[] = [
    ...ajpNodes,
    ...extendedSymptomNodes,
    ...extendedFaultNodes,
    ...extendedActionNodes,
    ...designFaultNodes,
    ...designSymptomNodes,
    ...designTacitNodes,
    ...designActionNodes,
    ...consequenceNodes,
    ...tacitKnowledgeNodes,
    ...ajpProbeNodes,
  ];

  const allEdges: AJPEdge[] = [
    ...ajpEdges,
    ...(extendedEdges ?? []),
    ...(designFaultEdges ?? []),
    ...(designActionEdges ?? []),
    ...(consequenceEdges ?? []),
    ...(tacitKnowledgeEdges ?? []),
    ...(ajpProbeEdges ?? []),
  ];

  // ── Seed built-in sources ──
  const seedSources = [
    { id: 'SRC-018', title: 'Stanford SNF Optomec AJ300 SOP', type: 'OfficialDoc', tier: 1 },
    { id: 'SRC-019', title: 'Boise State IML AJP SOP v1.0', type: 'OfficialDoc', tier: 1 },
    { id: 'SRC-020', title: 'OSHA Working Safely with Nanomaterials', type: 'Standard', tier: 2 },
    { id: 'SRC-021', title: 'NIOSH CIB 70 — Silver Nanomaterials', type: 'Standard', tier: 2 },
    { id: 'SRC-022', title: 'IPC-7711C/7721C PCB Rework Standard', type: 'Standard', tier: 2 },
  ];

  console.log(`Inserting ${seedSources.length} sources...`);
  for (const src of seedSources) {
    db.prepare(`
      INSERT OR IGNORE INTO sources (id, title, type, tier)
      VALUES (?, ?, ?, ?)
    `).run(src.id, src.title, src.type, src.tier);
  }

  // ── Migrate nodes ──
  console.log(`Migrating ${allNodes.length} nodes...`);
  const nodeInsert = db.transaction(() => {
    for (const node of allNodes) {
      insertNode(db, node, 'ajp');
    }
  });
  nodeInsert();

  // ── Migrate edges (only if both endpoints exist) ──
  console.log(`Migrating ${allEdges.length} edges...`);
  const nodeIds = new Set(allNodes.map((n) => n.id));
  let edgesInserted = 0;
  let edgesSkipped = 0;

  const edgeInsert = db.transaction(() => {
    for (const edge of allEdges) {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
        console.warn(`  ⚠ Skipping edge ${edge.from} → ${edge.to}: endpoint not found`);
        edgesSkipped++;
        continue;
      }
      insertEdge(db, edge);
      edgesInserted++;
    }
  });
  edgeInsert();

  if (edgesSkipped > 0) {
    console.log(`  (${edgesSkipped} edges skipped — dangling endpoint)`);
  }

  // ── Migrate chunks ──
  console.log(`Migrating ${ajpCorpusChunks.length} chunks...`);
  const chunkInsert = db.transaction(() => {
    for (const chunk of ajpCorpusChunks) {
      insertChunk(db, {
        id: chunk.id,
        conceptId: chunk.conceptId,
        content: chunk.content,
        chunkType: chunk.chunkType,
        difficulty: chunk.difficulty,
        roleContext: chunk.roleContext,
      }, 'ajp');
    }
  });
  chunkInsert();

  // ── Migrate corpus gaps ──
  console.log(`Migrating ${corpusGaps.length} corpus gaps...`);
  const gapInsert = db.transaction(() => {
    for (const gap of corpusGaps) {
      db.prepare(`
        INSERT INTO corpus_gaps (id, domain, summary, detail, acquisition_path, affected_node_ids, status, priority, created_at)
        VALUES (?, 'ajp', ?, ?, ?, ?, ?, 'medium', ?)
        ON CONFLICT(id) DO UPDATE SET
          summary           = excluded.summary,
          detail            = excluded.detail,
          acquisition_path  = excluded.acquisition_path,
          affected_node_ids = excluded.affected_node_ids,
          status            = excluded.status
      `).run(
        gap.id,
        gap.summary,
        gap.detail,
        gap.acquisitionPath,
        JSON.stringify(gap.affectedNodeIds),
        gap.status,
        now(),
      );
    }
  });
  gapInsert();

  // GAP-014 (SDS for Ag NP ink): was critical; downgraded to high after NanoAmor MSDS
  // was partially ingested (2026-04-13). Remains 'high' until lot-number verification
  // against the specific ink in use is confirmed and status is set to 'resolved'.
  db.prepare(`UPDATE corpus_gaps SET priority = 'high' WHERE id = 'GAP-014' AND status != 'resolved'`).run();

  // ── Log the migration event ──
  logEvent(db, {
    target_id: 'ajp',
    target_type: 'node',
    event_type: 'seed-migration',
    payload: {
      nodes: allNodes.length,
      edges: allEdges.length,
      edgesInserted,
      chunks: ajpCorpusChunks.length,
      gaps: corpusGaps.length,
    },
    source: 'scripts/db/migrate.ts',
    notes: 'Initial seed from src/corpus/ajp/ TypeScript arrays',
  });

  // ── Summary ──
  const nodeCt = (db.prepare('SELECT COUNT(*) as n FROM nodes').get() as { n: number }).n;
  const edgeCt = (db.prepare('SELECT COUNT(*) as n FROM edges').get() as { n: number }).n;
  const chunkCt = (db.prepare('SELECT COUNT(*) as n FROM chunks').get() as { n: number }).n;
  const gapCt = (db.prepare('SELECT COUNT(*) as n FROM corpus_gaps').get() as { n: number }).n;

  console.log(`\n✓ Migration complete:`);
  console.log(`  nodes:  ${nodeCt}`);
  console.log(`  edges:  ${edgeCt}`);
  console.log(`  chunks: ${chunkCt}`);
  console.log(`  gaps:   ${gapCt}`);

  closeDb(db);
}

main();
