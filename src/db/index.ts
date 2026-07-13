/**
 * Knowledge database connection.
 *
 * Used by scripts/db/ only — this file is NOT imported by the Vite client.
 * The client continues to use the exported /public/ajp-corpus.json at runtime.
 *
 * Usage in scripts:
 *   import { openDb, closeDb } from '../../src/db/index.js';
 *   const db = openDb();
 *   // ... use db ...
 *   closeDb(db);
 */

import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = resolve(__dirname, '../../knowledge/knowledge.db');

export type DB = Database.Database;

/** Open (or create) the knowledge database. */
export function openDb(path = DB_PATH): DB {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

/** Close the database. */
export function closeDb(db: DB): void {
  db.close();
}

/** SHA-256 of a string — used as content_hash for staleness detection. */
export function contentHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

/** ISO timestamp for created_at / updated_at fields. */
export function now(): string {
  return new Date().toISOString();
}

/** Log an enrichment event (append-only). */
export function logEvent(
  db: DB,
  opts: {
    domain?: string;
    target_id: string;
    target_type: 'node' | 'chunk' | 'gap' | 'edge' | 'elicitation' | 'source';
    event_type: string;
    payload?: Record<string, unknown>;
    source?: string;
    notes?: string;
  },
): void {
  db.prepare(`
    INSERT INTO enrichment_events
      (domain, target_id, target_type, event_type, payload, source, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    opts.domain ?? null,
    opts.target_id,
    opts.target_type,
    opts.event_type,
    opts.payload ? JSON.stringify(opts.payload) : null,
    opts.source ?? null,
    opts.notes ?? null,
    now(),
  );
}
