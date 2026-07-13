#!/usr/bin/env tsx
/**
 * scripts/db/export.ts
 *
 * Exports chunks (with cached embeddings) from the knowledge database to
 * /public/ajp-corpus.json — the format consumed by dense-retrieval.ts.
 *
 * Chunks without a cached embedding are exported without the `embedding` field;
 * dense-retrieval.ts already handles missing embeddings gracefully.
 *
 * Usage:
 *   npm run db:export
 *   npx tsx scripts/db/export.ts [--domain ajp]
 */

import { openDb, closeDb, DB_PATH } from '../../src/db/index.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../../public/ajp-corpus.json');

// CLI args
const domainFilter = (() => {
  const idx = process.argv.indexOf('--domain');
  return idx !== -1 ? process.argv[idx + 1] : 'ajp';
})();

interface ExportedChunk {
  id: string;
  source: string;
  section: string;
  text: string;
  linkedNodeId?: string;
  embedding?: number[];
}

function main() {
  const db = openDb();

  console.log(`Exporting chunks for domain '${domainFilter}' from: ${DB_PATH}`);

  // Fetch all chunks for the domain
  const chunks = db.prepare(`
    SELECT c.id, c.concept_id, c.content, c.chunk_type, c.difficulty,
           c.role_context, c.linked_node_ids, c.content_hash
    FROM chunks c
    WHERE c.domain = ?
    ORDER BY c.id
  `).all(domainFilter) as Array<{
    id: string;
    concept_id: string | null;
    content: string;
    chunk_type: string;
    difficulty: string | null;
    role_context: string | null;
    linked_node_ids: string | null;
    content_hash: string;
  }>;

  console.log(`  Found ${chunks.length} chunks`);

  // Build a map of cached embeddings: target_id → Float32Array
  const embeddingMap = new Map<string, number[]>();
  const embRows = db.prepare(`
    SELECT target_id, embedding, provider, model
    FROM embeddings
    WHERE target_type = 'chunk'
    ORDER BY created_at DESC
  `).all() as Array<{ target_id: string; embedding: Buffer; provider: string; model: string }>;

  // For each embedding row, only keep the most recent (ORDER BY DESC, first wins)
  for (const row of embRows) {
    if (!embeddingMap.has(row.target_id)) {
      const arr = Array.from(new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4));
      embeddingMap.set(row.target_id, arr);
    }
  }

  console.log(`  Found ${embeddingMap.size} cached embeddings`);
  if (embRows.length > 0) {
    console.log(`  Latest embedding provider/model: ${embRows[0].provider}/${embRows[0].model}`);
  }

  // Build export objects
  const exported: ExportedChunk[] = [];
  let withEmbeddings = 0;

  for (const chunk of chunks) {
    const linkedIds: string[] = chunk.linked_node_ids ? JSON.parse(chunk.linked_node_ids) : [];

    const obj: ExportedChunk = {
      id: chunk.id,
      source: chunk.role_context ?? 'AJP Training Corpus',
      section: chunk.chunk_type,
      text: chunk.content,
      ...(linkedIds.length > 0 ? { linkedNodeId: linkedIds[0] } : {}),
    };

    const emb = embeddingMap.get(chunk.id);
    if (emb) {
      obj.embedding = emb;
      withEmbeddings++;
    }

    exported.push(obj);
  }

  // Ensure output directory exists
  const outDir = dirname(OUTPUT_PATH);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const output = { chunks: exported };
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');

  console.log(`\n✓ Exported to: ${OUTPUT_PATH}`);
  console.log(`  ${exported.length} chunks (${withEmbeddings} with cached embeddings)`);

  if (withEmbeddings < exported.length) {
    console.log(`  ⚠ ${exported.length - withEmbeddings} chunks have no embedding — run refresh-embeddings.ts to populate`);
  }

  closeDb(db);
}

main();
