#!/usr/bin/env tsx
/**
 * scripts/db/init.ts
 *
 * Initialize (or re-initialize) the knowledge database schema.
 * Safe to run multiple times — uses CREATE TABLE IF NOT EXISTS.
 *
 * Usage:
 *   npm run db:init
 *   npx tsx scripts/db/init.ts
 */

import { openDb, closeDb, DB_PATH } from '../../src/db/index.js';
import { DDL } from '../../src/db/schema.js';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

function main() {
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  console.log(`Initializing knowledge database at: ${DB_PATH}`);
  const db = openDb();

  // Execute each statement individually (SQLite doesn't support multi-statement exec)
  const statements = DDL
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let count = 0;
  for (const stmt of statements) {
    try {
      db.exec(stmt + ';');
      count++;
    } catch (err) {
      console.error(`Failed on statement:\n${stmt}\n`, err);
      closeDb(db);
      process.exit(1);
    }
  }

  console.log(`✓ Schema initialized (${count} statements executed)`);

  // Verify tables exist
  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
    .all() as Array<{ name: string }>;
  console.log(`✓ Tables: ${tables.map((t) => t.name).join(', ')}`);

  closeDb(db);
}

main();
