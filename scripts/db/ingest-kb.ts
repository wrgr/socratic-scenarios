#!/usr/bin/env tsx
/**
 * scripts/db/ingest-kb.ts
 *
 * Ingest docs/kb-candidates/*.md files into the knowledge database as chunks.
 * Each markdown file is segmented by ## headings. The frontmatter (YAML between
 * --- delimiters) specifies metadata: linked_node_ids, confidence, source, domain.
 *
 * Usage:
 *   npm run db:ingest-kb
 *   npx tsx scripts/db/ingest-kb.ts [--file path/to/file.md] [--domain ajp]
 *
 * Frontmatter example (optional — file works without it):
 *   ---
 *   domain: ajp
 *   linked_node_ids: [FAULT-CLOG-PARTIAL-001, FAULT-CLOG-FULL-001]
 *   source: docs/kb-candidates/02_fault_diagnosis_reasoning.md
 *   confidence: Medium
 *   chunk_type: discrimination-heuristic
 *   ---
 */

import { openDb, closeDb, contentHash, now, logEvent, DB_PATH } from '../../src/db/index.js';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KB_DIR = resolve(__dirname, '../../docs/kb-candidates');

// ─── CLI args ─────────────────────────────────────────────────────────────────

const fileArg = (() => {
  const idx = process.argv.indexOf('--file');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

const domainArg = (() => {
  const idx = process.argv.indexOf('--domain');
  return idx !== -1 ? process.argv[idx + 1] : 'ajp';
})();

// ─── Parsing ──────────────────────────────────────────────────────────────────

interface Frontmatter {
  domain?: string;
  linked_node_ids?: string[];
  source?: string;
  confidence?: string;
  chunk_type?: string;
  difficulty?: string;
  role_context?: string;
}

interface ParsedChunk {
  id: string;
  heading: string;
  content: string;
  frontmatter: Frontmatter;
}

function parseFrontmatter(raw: string): { fm: Frontmatter; body: string } {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) return { fm: {}, body: raw };
  try {
    const fm = yaml.load(fmMatch[1]) as Frontmatter;
    return { fm: fm ?? {}, body: fmMatch[2] };
  } catch {
    return { fm: {}, body: raw };
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

/**
 * Split a markdown document into chunks by ## heading.
 * The document title (# heading) is used as a prefix for chunk IDs.
 */
function segmentMarkdown(filePath: string, raw: string): ParsedChunk[] {
  const { fm, body } = parseFrontmatter(raw);
  const fileSlug = slugify(basename(filePath, '.md'));

  // Split on ## headings
  const sections = body.split(/(?=^## )/m);
  const chunks: ParsedChunk[] = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed || trimmed.length < 50) continue; // skip very short sections

    const headingMatch = trimmed.match(/^#{1,3} (.+)/m);
    const heading = headingMatch ? headingMatch[1].trim() : 'overview';
    const headingSlug = slugify(heading);

    // Remove heading line from content
    const contentWithoutHeading = trimmed.replace(/^#{1,3} .+\n?/, '').trim();
    if (contentWithoutHeading.length < 50) continue;

    chunks.push({
      id: `kb-${fileSlug}-${headingSlug}`,
      heading,
      content: contentWithoutHeading,
      frontmatter: fm,
    });
  }

  // If no ## headings found, treat the whole body as one chunk
  if (chunks.length === 0 && body.trim().length > 50) {
    chunks.push({
      id: `kb-${fileSlug}-full`,
      heading: fileSlug,
      content: body.trim(),
      frontmatter: fm,
    });
  }

  return chunks;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  if (!existsSync(KB_DIR)) {
    console.error(`KB directory not found: ${KB_DIR}`);
    process.exit(1);
  }

  const db = openDb();

  // Determine files to process
  let files: string[];
  if (fileArg) {
    const abs = resolve(fileArg);
    if (!existsSync(abs)) {
      console.error(`File not found: ${abs}`);
      process.exit(1);
    }
    files = [abs];
  } else {
    files = readdirSync(KB_DIR)
      .filter((f) => f.endsWith('.md'))
      .map((f) => resolve(KB_DIR, f));
  }

  console.log(`Ingesting ${files.length} file(s) into: ${DB_PATH}\n`);

  let totalChunks = 0;
  let totalNew = 0;
  let totalUpdated = 0;

  for (const filePath of files) {
    const raw = readFileSync(filePath, 'utf8');
    const chunks = segmentMarkdown(filePath, raw);
    const domain = chunks[0]?.frontmatter?.domain ?? domainArg;

    console.log(`  ${basename(filePath)} → ${chunks.length} chunk(s) [domain: ${domain}]`);

    const ingestTx = db.transaction(() => {
      for (const chunk of chunks) {
        const fm = chunk.frontmatter;
        const hash = contentHash(chunk.content);
        const chunkType = fm.chunk_type ?? 'case-study';
        const linkedNodeIds = fm.linked_node_ids ?? [];

        // Check if chunk already exists with same hash (no-op if unchanged)
        const existing = db.prepare('SELECT content_hash FROM chunks WHERE id = ?').get(chunk.id) as { content_hash: string } | undefined;

        if (existing && existing.content_hash === hash) {
          console.log(`    (unchanged) ${chunk.id}`);
          totalChunks++;
          continue;
        }

        const isNew = !existing;

        db.prepare(`
          INSERT INTO chunks (id, domain, concept_id, content, chunk_type, difficulty, role_context, linked_node_ids, content_hash, created_at, updated_at)
          VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
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
          fm.domain ?? domain,
          chunk.content,
          chunkType,
          fm.difficulty ?? null,
          fm.role_context ?? null,
          linkedNodeIds.length > 0 ? JSON.stringify(linkedNodeIds) : null,
          hash,
          now(),
          now(),
        );

        logEvent(db, {
          domain: fm.domain ?? domain,
          target_id: chunk.id,
          target_type: 'chunk',
          event_type: 'kb-candidate-ingested',
          payload: {
            file: basename(filePath),
            heading: chunk.heading,
            linked_node_ids: linkedNodeIds,
            content_length: chunk.content.length,
            is_new: isNew,
          },
          source: `scripts/db/ingest-kb.ts:${basename(filePath)}`,
        });

        console.log(`    ${isNew ? '+ new' : '~ updated'} ${chunk.id}`);
        totalChunks++;
        if (isNew) totalNew++;
        else totalUpdated++;
      }
    });

    ingestTx();
  }

  console.log(`\n✓ Ingestion complete: ${totalChunks} chunks (${totalNew} new, ${totalUpdated} updated)`);
  console.log(`  Run 'npm run db:export' to regenerate /public/ajp-corpus.json`);

  closeDb(db);
}

main();
