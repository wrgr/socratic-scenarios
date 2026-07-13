#!/usr/bin/env tsx
/**
 * scripts/db/refresh-embeddings.ts
 *
 * Populate or refresh chunk embeddings in the SQLite knowledge database using
 * Gemini text-embedding-004. Skips rows that already match current content_hash
 * unless --force is passed.
 *
 * Usage:
 *   npm run db:refresh-embeddings
 *   npx tsx scripts/db/refresh-embeddings.ts [--domain ajp] [--force]
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { openDb, closeDb, now } from '../../src/db/index.js';
import { createSimulatedProvider } from '../../src/engine/retrieval/simulated-provider.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const domainFilter = (() => {
  const idx = process.argv.indexOf('--domain');
  return idx !== -1 ? process.argv[idx + 1] : 'ajp';
})();

const force = process.argv.includes('--force');

function loadApiKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (process.env.VITE_GEMINI_API_KEY) return process.env.VITE_GEMINI_API_KEY;

  const envPath = resolve(ROOT, '.env');
  if (existsSync(envPath)) {
    const env = readFileSync(envPath, 'utf8');
    const gemini = env.match(/^GEMINI_API_KEY=(.+)$/m)?.[1];
    if (gemini) return gemini.trim();
    const viteGemini = env.match(/^VITE_GEMINI_API_KEY=(.+)$/m)?.[1];
    if (viteGemini) return viteGemini.trim();
  }

  throw new Error('Missing GEMINI_API_KEY or VITE_GEMINI_API_KEY in env/.env');
}

interface ChunkRow {
  id: string;
  content: string;
  content_hash: string;
}

async function selectEmbeddingModel(genai: GoogleGenerativeAI): Promise<{
  modelName: string;
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;
}> {
  const candidates = ['gemini-embedding-001', 'text-embedding-004', 'embedding-001'] as const;
  let lastError: unknown = null;

  for (const candidate of candidates) {
    const model = genai.getGenerativeModel({ model: candidate });
    try {
      await model.embedContent('embedding health check');
      return { modelName: candidate, model };
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  Model '${candidate}' unavailable: ${msg}`);
    }
  }

  throw new Error(`No supported embedding model available. Last error: ${String(lastError)}`);
}

function float32Buffer(values: number[]): Buffer {
  const arr = Float32Array.from(values);
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
}

async function main() {
  const apiKey = loadApiKey();
  const genai = new GoogleGenerativeAI(apiKey);
  let providerName = 'gemini';
  let modelName = '';
  let model: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null;
  let useSimulatedFallback = false;

  try {
    const selected = await selectEmbeddingModel(genai);
    modelName = selected.modelName;
    model = selected.model;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  Gemini embedding unavailable; falling back to deterministic TF-IDF (${msg})`);
    providerName = 'simulated';
    modelName = 'tfidf-v1';
    useSimulatedFallback = true;
  }

  const db = openDb();

  const chunks = db.prepare(`
    SELECT id, content, content_hash
    FROM chunks
    WHERE domain = ?
    ORDER BY id
  `).all(domainFilter) as ChunkRow[];

  if (chunks.length === 0) {
    console.log(`No chunks found for domain '${domainFilter}'.`);
    closeDb(db);
    return;
  }

  const existingRows = db.prepare(`
    SELECT target_id, content_hash
    FROM embeddings
    WHERE target_type = 'chunk' AND provider = ? AND model = ?
  `).all(providerName, modelName) as Array<{ target_id: string; content_hash: string }>;
  const existingById = new Map(existingRows.map((r) => [r.target_id, r.content_hash]));

  const pending = useSimulatedFallback
    ? chunks // keep a single shared vector space for all chunks
    : force
      ? chunks
      : chunks.filter((c) => existingById.get(c.id) !== c.content_hash);

  console.log(`Refreshing embeddings for domain '${domainFilter}'`);
  console.log(`  Provider/model: ${providerName}/${modelName}`);
  console.log(`  Total chunks: ${chunks.length}`);
  console.log(`  Pending: ${pending.length}${force ? ' (forced)' : ''}`);

  if (pending.length === 0) {
    console.log('  Nothing to refresh.');
    closeDb(db);
    return;
  }

  const upsert = db.prepare(`
    INSERT INTO embeddings (target_id, target_type, provider, model, embedding, content_hash, created_at)
    VALUES (?, 'chunk', ?, ?, ?, ?, ?)
    ON CONFLICT(target_id, target_type, provider, model) DO UPDATE SET
      embedding    = excluded.embedding,
      content_hash = excluded.content_hash,
      created_at   = excluded.created_at
  `);

  if (useSimulatedFallback) {
    const simulated = createSimulatedProvider();
    const vectors = await simulated.embed(pending.map((c) => c.content));

    const tx = db.transaction(() => {
      const createdAt = now();
      for (let i = 0; i < pending.length; i++) {
        upsert.run(
          pending[i].id,
          providerName,
          modelName,
          float32Buffer(vectors[i]),
          pending[i].content_hash,
          createdAt,
        );
      }
    });
    tx();
    console.log(`  Embedded ${pending.length}/${pending.length}`);
  } else {
    const BATCH_SIZE = 10;
    const DELAY_MS = 500;
    let completed = 0;

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);

      const embeddings = await Promise.all(
        batch.map(async (chunk) => {
          const result = await model!.embedContent(chunk.content);
          return { chunk, values: result.embedding.values };
        }),
      );

      const tx = db.transaction(() => {
        const createdAt = now();
        for (const item of embeddings) {
          upsert.run(
            item.chunk.id,
            providerName,
            modelName,
            float32Buffer(item.values),
            item.chunk.content_hash,
            createdAt,
          );
        }
      });
      tx();

      completed += embeddings.length;
      console.log(`  Embedded ${completed}/${pending.length}`);

      if (i + BATCH_SIZE < pending.length) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }
  }

  const totalNow = db.prepare(`
    SELECT COUNT(*) AS c
    FROM embeddings
    WHERE target_type = 'chunk' AND provider = ? AND model = ?
  `).get(providerName, modelName) as { c: number };

  console.log(`\n✓ Embedding refresh complete.`);
  console.log(`  Cached chunk embeddings: ${totalNow.c}`);

  closeDb(db);
}

main().catch((err) => {
  console.error('refresh-embeddings failed:', err);
  process.exit(1);
});
