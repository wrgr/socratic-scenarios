#!/usr/bin/env tsx
/**
 * scripts/db/ingest-sources.ts
 *
 * Ingest all Available/Open sources from docs/corpus/full-corpus-source-catalog.csv
 * into the SQLite knowledge database as external-source chunks.
 *
 * This is the "full corpus" ingest step for the dense retrieval layer. Unlike the
 * legacy scripts/ingest-corpus.ts (which writes directly to public/ajp-corpus.json),
 * this script writes to SQLite so that:
 *   - All chunks (node-graph + external corpus) are unified in one store
 *   - Embeddings are cached and not re-fetched on every export
 *   - db:export produces a single coherent public/ajp-corpus.json
 *
 * FULL PIPELINE ORDER:
 *   1. npm run db:init              — create schema
 *   2. npm run db:migrate           — seed node graph (nodes, edges, base chunks)
 *   3. npm run db:ingest-kb         — ingest docs/kb-candidates/*.md
 *   4. npm run db:ingest-sources    — ingest CSV catalog (this script)
 *   5. npm run db:refresh-embeddings — generate/cache embeddings for all chunks
 *   6. npm run db:export            — write public/ajp-corpus.json
 *
 * Or as a single step: npm run db:full-setup
 *
 * ── THREE-STAGE PIPELINE PER SOURCE ─────────────────────────────
 *
 *  Stage 1 DOWNLOAD  → knowledge/source-cache/{id}.pdf  or  .html
 *  Stage 2 EXTRACT   → knowledge/source-cache/{id}.txt   (Gemini for PDFs)
 *  Stage 3 STORE     → knowledge.db chunks table
 *
 * Each stage output is cached to disk. On restart the script picks up from the
 * last completed stage — no re-downloading or re-calling Gemini unnecessarily.
 * Progress per source is saved to knowledge/ingest-progress.json immediately
 * after each stage completes.
 *
 * Usage:
 *   npm run db:ingest-sources
 *   npx tsx scripts/db/ingest-sources.ts [options]
 *
 * Options:
 *   --min-priority N     Only ingest sources with PriorityScore >= N (default: 1)
 *   --dry-run            Show status of all sources without writing anything
 *   --source-id ID       Target a single source by slug ID
 *   --reset-store        Re-chunk + re-store from cached .txt (no re-download, no Gemini)
 *   --reset-extract      Re-run Gemini extraction from cached download, then re-store
 *   --reset-download     Full re-download + re-extract + re-store for matched sources
 *   --reset-progress     Clear the progress file (cache files are kept)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { openDb, closeDb, contentHash, now, DB_PATH } from '../../src/db/index.js';
import type { DB } from '../../src/db/index.js';
import {
  readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync,
} from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chunkWords } from '../lib/chunk-text';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const CSV_PATH = resolve(ROOT, 'docs/corpus/full-corpus-source-catalog.csv');
const ENV_PATH = resolve(ROOT, '.env');
const PROGRESS_PATH = resolve(ROOT, 'knowledge/ingest-progress.json');
const CACHE_DIR = resolve(ROOT, 'knowledge/source-cache');

// ─── CLI args ─────────────────────────────────────────────────────────────────

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? (process.argv[idx + 1] ?? null) : null;
}

const MIN_PRIORITY = parseInt(getArg('--min-priority') ?? '1', 10);
const DRY_RUN = process.argv.includes('--dry-run');
const SINGLE_SOURCE = getArg('--source-id');

// Reset flags — each widens what gets re-run
const RESET_STORE = process.argv.includes('--reset-store') ||
                    process.argv.includes('--reset-extract') ||
                    process.argv.includes('--reset-download');
const RESET_EXTRACT = process.argv.includes('--reset-extract') ||
                      process.argv.includes('--reset-download');
const RESET_DOWNLOAD = process.argv.includes('--reset-download');
const RESET_PROGRESS = process.argv.includes('--reset-progress');

// Max PDF size to send to Gemini. Larger files exceed the inline-data token limit.
const MAX_PDF_MB = 25;

// ─── Progress tracker ─────────────────────────────────────────────────────────
//
// Persisted to knowledge/ingest-progress.json after each stage so that
// interrupted runs can resume at the exact stage that failed.

type StageStatus = 'ok' | 'error' | 'skipped';

interface SourceProgress {
  name: string;
  url: string;
  format: string;
  stages: {
    download: StageStatus;
    extract: StageStatus;
    store: StageStatus;
  };
  chunks?: number;
  error?: string;
  completedAt?: string;
}

interface ProgressState {
  version: 2;
  startedAt: string;
  lastUpdatedAt: string;
  sources: Record<string, SourceProgress>;
}

function loadProgress(): ProgressState {
  if (!RESET_PROGRESS && existsSync(PROGRESS_PATH)) {
    try {
      const raw = JSON.parse(readFileSync(PROGRESS_PATH, 'utf-8')) as ProgressState;
      // Migrate v1 → v2 if needed
      if ((raw as { version: number }).version < 2) {
        return freshProgress();
      }
      return raw;
    } catch {
      // corrupted — start fresh
    }
  }
  return freshProgress();
}

function freshProgress(): ProgressState {
  return {
    version: 2,
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    sources: {},
  };
}

function saveProgress(state: ProgressState): void {
  state.lastUpdatedAt = new Date().toISOString();
  writeFileSync(PROGRESS_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

// ─── API key ──────────────────────────────────────────────────────────────────

function loadApiKey(): string {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (process.env.VITE_GEMINI_API_KEY) return process.env.VITE_GEMINI_API_KEY;
  if (existsSync(ENV_PATH)) {
    const env = readFileSync(ENV_PATH, 'utf-8');
    const m1 = env.match(/GEMINI_API_KEY=(.+)/);
    if (m1) return m1[1].trim();
    const m2 = env.match(/VITE_GEMINI_API_KEY=(.+)/);
    if (m2) return m2[1].trim();
  }
  throw new Error('GEMINI_API_KEY not found. Set it in .env or environment.');
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────

interface CatalogRow {
  name: string;
  shortDescription: string;
  documentType: string;
  url: string;
  justification: string;
  availabilityFlag: string;
  provenanceTag: string;
  priorityScore: number;
  priorityRationale: string;
  suggestedIngestionFormat: string;
  estimatedSizeMB: number;
  accessNotes: string;
}

function parseCsvRow(line: string): string[] {
  const matches = line.match(/"([^"]*)"/g);
  return matches ? matches.map((m) => m.slice(1, -1)) : [];
}

function parseCatalog(csvPath: string): CatalogRow[] {
  const raw = readFileSync(csvPath, 'utf-8');
  const lines = raw.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const rows: CatalogRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvRow(lines[i]);
    if (f.length < 12) continue;
    rows.push({
      name: f[0],
      shortDescription: f[1],
      documentType: f[2],
      url: f[3],
      justification: f[4],
      availabilityFlag: f[5],
      provenanceTag: f[6],
      priorityScore: parseInt(f[7], 10) || 1,
      priorityRationale: f[8],
      suggestedIngestionFormat: f[9].toLowerCase(),
      estimatedSizeMB: parseFloat(f[10]) || 1,
      accessNotes: f[11],
    });
  }
  return rows;
}

function makeSourceId(name: string): string {
  return 'CSV-' + name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

// ─── Cache paths ──────────────────────────────────────────────────────────────

function slug(sourceId: string): string {
  return sourceId.replace('CSV-', '');
}

function rawCachePath(sourceId: string, fmt: string): string {
  const ext = (fmt === 'pdf' || fmt === 'sds') ? 'pdf' : 'html';
  return resolve(CACHE_DIR, `${slug(sourceId)}.${ext}`);
}

function textCachePath(sourceId: string): string {
  return resolve(CACHE_DIR, `${slug(sourceId)}.txt`);
}

function cacheExists(sourceId: string, fmt: string): { raw: boolean; text: boolean } {
  return {
    raw: existsSync(rawCachePath(sourceId, fmt)),
    text: existsSync(textCachePath(sourceId)),
  };
}

// ─── Stage 1: Download ────────────────────────────────────────────────────────
// Fetches the URL and saves the raw bytes/text to disk.
// Skipped if the raw cache file already exists (unless RESET_DOWNLOAD).

async function stageDownload(
  sourceId: string,
  row: CatalogRow,
): Promise<{ ok: boolean; fromCache: boolean; msg?: string }> {
  const rawPath = rawCachePath(sourceId, row.suggestedIngestionFormat);
  const isPdf = row.suggestedIngestionFormat === 'pdf' || row.suggestedIngestionFormat === 'sds';

  if (!RESET_DOWNLOAD && existsSync(rawPath)) {
    return { ok: true, fromCache: true };
  }

  // Size guard (estimate only — actual check after download)
  if (isPdf && row.estimatedSizeMB > MAX_PDF_MB) {
    return { ok: false, msg: `Estimated size ${row.estimatedSizeMB} MB exceeds ${MAX_PDF_MB} MB limit` };
  }

  console.log(`    [download] ${isPdf ? 'PDF' : 'HTML'} → ${rawPath.split('/').slice(-2).join('/')}`);

  try {
    const response = await fetch(row.url, {
      headers: { 'User-Agent': 'TeachMe-Corpus-Ingestion/1.0' },
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    if (isPdf) {
      const buf = await response.arrayBuffer();
      const actualMB = buf.byteLength / (1024 * 1024);
      if (actualMB > MAX_PDF_MB) {
        return { ok: false, msg: `Actual size ${actualMB.toFixed(1)} MB exceeds limit` };
      }
      writeFileSync(rawPath, Buffer.from(buf));
      console.log(`    [download] ✓ ${Math.round(buf.byteLength / 1024)} KB saved`);
    } else {
      const html = await response.text();
      writeFileSync(rawPath, html, 'utf-8');
      console.log(`    [download] ✓ ${Math.round(html.length / 1024)} KB saved`);
    }

    return { ok: true, fromCache: false };
  } catch (err) {
    return { ok: false, msg: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Stage 2: Extract ─────────────────────────────────────────────────────────
// Converts the raw cached file to plain text and saves to .txt cache.
// For PDFs: sends the cached file to Gemini Flash for extraction.
// For HTML: applies local regex stripping.
// Skipped if the .txt cache already exists (unless RESET_EXTRACT).

async function stageExtract(
  sourceId: string,
  row: CatalogRow,
  flashModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
): Promise<{ ok: boolean; fromCache: boolean; msg?: string }> {
  const txtPath = textCachePath(sourceId);
  const isPdf = row.suggestedIngestionFormat === 'pdf' || row.suggestedIngestionFormat === 'sds';

  if (!RESET_EXTRACT && existsSync(txtPath)) {
    return { ok: true, fromCache: true };
  }

  // Raw file must exist before extraction
  const rawPath = rawCachePath(sourceId, row.suggestedIngestionFormat);
  if (!existsSync(rawPath)) {
    return { ok: false, msg: 'Raw cache file missing — download stage must run first' };
  }

  console.log(`    [extract]  ${isPdf ? 'Gemini Flash PDF' : 'HTML strip'} → ${slug(sourceId)}.txt`);

  try {
    let text: string;

    if (isPdf) {
      const pdfBytes = readFileSync(rawPath);
      const base64 = pdfBytes.toString('base64');
      const result = await flashModel.generateContent([
        { inlineData: { data: base64, mimeType: 'application/pdf' } },
        `Extract complete text from this AJP (Aerosol Jet Printing) related document.
Preserve section headings and logical structure. Output plain text only.
Focus on operational content: procedures, parameters, fault modes, safety warnings, materials.
Skip boilerplate: title pages, approval signatures, table-of-contents page numbers.`,
      ]);
      text = result.response.text();
    } else {
      const html = readFileSync(rawPath, 'utf-8');
      text = html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    if (text.trim().length < 100) {
      return { ok: false, msg: 'Extracted text too short — source may be paywalled or empty' };
    }

    writeFileSync(txtPath, text, 'utf-8');
    console.log(`    [extract]  ✓ ${text.split(/\s+/).length} words`);
    return { ok: true, fromCache: false };
  } catch (err) {
    return { ok: false, msg: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Stage 3: Store ───────────────────────────────────────────────────────────
// Reads the .txt cache, chunks it, and writes chunks to SQLite.
// Always runs when reached — it's fast and idempotent via content_hash.

interface RawChunk { id: string; content: string; roleContext: string }

function chunkText(text: string, sourceId: string, label: string): RawChunk[] {
  return chunkWords(text).map((c) => ({
    id: `ext-${slug(sourceId)}-chunk-${c.index}`,
    content: c.content,
    roleContext: label,
  }));
}

function stageStore(
  sourceId: string,
  row: CatalogRow,
  db: DB,
): { ok: boolean; chunks: number; msg?: string } {
  const txtPath = textCachePath(sourceId);
  if (!existsSync(txtPath)) {
    return { ok: false, chunks: 0, msg: 'Text cache missing — extract stage must run first' };
  }

  try {
    const text = readFileSync(txtPath, 'utf-8');
    const chunks = chunkText(text, sourceId, row.name);
    console.log(`    [store]    ${chunks.length} chunks → SQLite`);

    // Upsert source record
    const tier = Math.max(1, 6 - row.priorityScore);
    db.prepare(`
      INSERT INTO sources (id, title, type, url, access_date, tier, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title, url = excluded.url,
        access_date = excluded.access_date, tier = excluded.tier, notes = excluded.notes
    `).run(
      sourceId, row.name, row.provenanceTag, row.url,
      new Date().toISOString().slice(0, 10), tier,
      `priority:${row.priorityScore}; format:${row.suggestedIngestionFormat}; ${row.accessNotes}`,
    );

    // Insert chunks in a single transaction
    db.transaction(() => {
      for (const chunk of chunks) {
        const hash = contentHash(chunk.content);
        db.prepare(`
          INSERT INTO chunks
            (id, domain, concept_id, content, chunk_type, difficulty, role_context,
             linked_node_ids, content_hash, created_at, updated_at)
          VALUES (?, 'ajp', NULL, ?, 'external-source', NULL, ?, NULL, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            content = excluded.content, role_context = excluded.role_context,
            content_hash = excluded.content_hash, updated_at = excluded.updated_at
        `).run(chunk.id, chunk.content, chunk.roleContext, hash, now(), now());
      }
    })();

    console.log(`    [store]    ✓ ${chunks.length} chunks written`);
    return { ok: true, chunks: chunks.length };
  } catch (err) {
    return { ok: false, chunks: 0, msg: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== AJP Full Corpus Source Ingest ===\n');
  console.log(`DB:           ${DB_PATH}`);
  console.log(`Catalog:      ${CSV_PATH}`);
  console.log(`Cache:        ${CACHE_DIR}`);
  console.log(`Progress:     ${PROGRESS_PATH}`);
  console.log(`Min priority: ${MIN_PRIORITY}`);

  if (DRY_RUN)         console.log('Mode:         DRY RUN');
  if (RESET_DOWNLOAD)  console.log('Mode:         RESET-DOWNLOAD (re-download + extract + store)');
  else if (RESET_EXTRACT) console.log('Mode:         RESET-EXTRACT (re-extract + store, keep raw cache)');
  else if (RESET_STORE)   console.log('Mode:         RESET-STORE (re-chunk from .txt cache)');
  if (RESET_PROGRESS)  console.log('Mode:         RESET-PROGRESS (cleared progress file)');
  console.log('');

  mkdirSync(CACHE_DIR, { recursive: true });

  const catalog = parseCatalog(CSV_PATH);
  const toIngest = catalog.filter((row) => {
    if (row.availabilityFlag !== 'Available/Open') return false;
    if (row.priorityScore < MIN_PRIORITY) return false;
    if (row.suggestedIngestionFormat === 'video') return false;
    if (!row.url.startsWith('http')) return false;
    if (SINGLE_SOURCE && makeSourceId(row.name) !== SINGLE_SOURCE) return false;
    return true;
  });

  console.log(`Catalog: ${catalog.length} total, ${toIngest.length} eligible\n`);

  // ── Dry run: show cache/progress state ──
  if (DRY_RUN) {
    const progress = loadProgress();
    console.log('Source status (download / extract / store):\n');
    for (const row of toIngest) {
      const id = makeSourceId(row.name);
      const p = progress.sources[id];
      const cache = cacheExists(id, row.suggestedIngestionFormat);
      const dl = cache.raw ? '✓raw' : '·raw';
      const ex = cache.text ? '✓txt' : '·txt';
      const st = p?.stages?.store === 'ok' ? `✓db(${p.chunks ?? '?'})` : '·db';
      const err = p?.error ? ` ERR: ${p.error.slice(0, 50)}` : '';
      console.log(`  [P${row.priorityScore}] ${dl} ${ex} ${st}  ${id.slice(0, 50)}${err}`);
    }
    const done = toIngest.filter((r) => {
      const p = progress.sources[makeSourceId(r.name)];
      return p?.stages?.store === 'ok';
    }).length;
    console.log(`\n${done}/${toIngest.length} fully stored.`);
    console.log('Dry run complete — no changes made.');
    return;
  }

  // ── Live run ──
  const progress = loadProgress();
  const apiKey = loadApiKey();
  const genai = new GoogleGenerativeAI(apiKey);
  const flashModel = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const db = openDb();

  let countOk = 0;
  let countSkipped = 0;
  let countErrors = 0;
  let totalNewChunks = 0;

  for (let i = 0; i < toIngest.length; i++) {
    const row = toIngest[i];
    const sourceId = makeSourceId(row.name);
    const label = `[${i + 1}/${toIngest.length}] P${row.priorityScore} ${sourceId}`;
    const prev = progress.sources[sourceId];

    // Skip if fully complete and no reset flag applies
    if (!RESET_STORE && prev?.stages?.store === 'ok') {
      console.log(`${label} — ✓ complete (${prev.chunks ?? 0} chunks)`);
      countSkipped++;
      continue;
    }

    console.log(`\n${label}`);
    console.log(`  ${row.name}`);
    console.log(`  ${row.url}`);

    // Initialize or carry forward progress entry
    const entry: SourceProgress = {
      name: row.name,
      url: row.url,
      format: row.suggestedIngestionFormat,
      stages: { download: 'skipped', extract: 'skipped', store: 'skipped' },
      ...prev,
    };

    // ── Stage 1: Download ──
    if (RESET_DOWNLOAD) {
      // Delete raw cache so it's re-fetched
      const rawPath = rawCachePath(sourceId, row.suggestedIngestionFormat);
      if (existsSync(rawPath)) { unlinkSync(rawPath); }
      entry.stages.download = 'skipped';
    }

    if (entry.stages.download !== 'ok' || RESET_DOWNLOAD) {
      const dl = await stageDownload(sourceId, row);
      entry.stages.download = dl.ok ? 'ok' : 'error';
      if (!dl.ok) {
        entry.error = `download: ${dl.msg}`;
        progress.sources[sourceId] = entry;
        saveProgress(progress);
        console.warn(`  ✗ Download failed: ${dl.msg}`);
        countErrors++;
        continue;
      }
      if (dl.fromCache) console.log(`    [download] ✓ from cache`);
    } else {
      console.log(`    [download] ✓ from cache (skip)`);
    }

    // ── Stage 2: Extract ──
    if (RESET_EXTRACT) {
      const txtPath = textCachePath(sourceId);
      if (existsSync(txtPath)) { unlinkSync(txtPath); }
      entry.stages.extract = 'skipped';
    }

    if (entry.stages.extract !== 'ok' || RESET_EXTRACT) {
      const ex = await stageExtract(sourceId, row, flashModel);
      entry.stages.extract = ex.ok ? 'ok' : 'error';
      if (!ex.ok) {
        entry.error = `extract: ${ex.msg}`;
        progress.sources[sourceId] = entry;
        saveProgress(progress);
        console.warn(`  ✗ Extraction failed: ${ex.msg}`);
        countErrors++;
        continue;
      }
      if (ex.fromCache) console.log(`    [extract]  ✓ from cache`);
    } else {
      console.log(`    [extract]  ✓ from cache (skip)`);
    }

    // ── Stage 3: Store ──
    const st = stageStore(sourceId, row, db);
    entry.stages.store = st.ok ? 'ok' : 'error';
    entry.chunks = st.chunks;
    if (!st.ok) {
      entry.error = `store: ${st.msg}`;
      progress.sources[sourceId] = entry;
      saveProgress(progress);
      console.warn(`  ✗ Store failed: ${st.msg}`);
      countErrors++;
      continue;
    }

    entry.error = undefined;
    entry.completedAt = new Date().toISOString();
    progress.sources[sourceId] = entry;
    saveProgress(progress);

    countOk++;
    totalNewChunks += st.chunks;
    console.log(`  ✓ Done  [progress saved]`);

    // Rate-limit between sources that needed Gemini (PDFs re-extracted)
    const needsGemini =
      entry.stages.extract !== 'ok' ||
      (row.suggestedIngestionFormat === 'pdf' || row.suggestedIngestionFormat === 'sds');
    if (needsGemini && i < toIngest.length - 1) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  closeDb(db);

  // ── Summary ──
  const allOk = Object.values(progress.sources).filter((s) => s.stages.store === 'ok').length;
  const allErrors = Object.values(progress.sources).filter((s) =>
    s.stages.download === 'error' || s.stages.extract === 'error' || s.stages.store === 'error'
  ).length;

  console.log('\n=== Ingest Complete ===\n');
  console.log(`  This run:      ${countOk} sources stored, ${countSkipped} skipped, ${countErrors} errors`);
  console.log(`  New chunks:    ${totalNewChunks}`);
  console.log(`  All-time:      ${allOk} stored, ${allErrors} with errors`);
  console.log(`  Cache:         ${CACHE_DIR}`);

  if (allErrors > 0) {
    console.log('\nSources with errors:');
    for (const [id, s] of Object.entries(progress.sources)) {
      if (s.error) console.log(`  ✗ ${id}\n      ${s.error}`);
    }
    console.log('\nRetry options:');
    console.log('  --reset-store     Re-chunk from cached .txt (no network)');
    console.log('  --reset-extract   Re-run Gemini from cached download');
    console.log('  --reset-download  Full re-download + extract + store');
    console.log('  Add --source-id CSV-... to target a single source');
  }

  console.log('\nNext steps:');
  console.log('  npm run db:refresh-embeddings   — generate embeddings for new chunks');
  console.log('  npm run db:export               — write public/ajp-corpus.json');
}

main().catch((err) => {
  console.error('\nIngest failed:', err);
  process.exit(1);
});
