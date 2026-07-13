#!/usr/bin/env tsx
/**
 * scripts/scrub-kb.ts
 *
 * Apply the canonical sensitivity scrub filter (scripts/scrub.ts) to every
 * kb-candidate `.md` file in place. Idempotent — safe to run after any
 * (re)extraction so scrubbing is never a manual step.
 *
 *   npm run scrub:kb            # scrub in place
 *   npm run scrub:kb -- --check # report only, non-zero exit if anything would change (CI gate)
 *
 * Also scrubs docs/DATA_CATALOG.md-adjacent notes? No — only kb-candidates.
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { scrubText, scrubReport } from './scrub';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KB_DIR = resolve(ROOT, 'docs/kb-candidates');
const checkOnly = process.argv.includes('--check');

const files = readdirSync(KB_DIR).filter((f) => f.endsWith('.md')).sort();
let changed = 0;

for (const f of files) {
  const path = resolve(KB_DIR, f);
  const before = readFileSync(path, 'utf8');
  const after = scrubText(before);
  if (after === before) continue;

  changed++;
  const report = scrubReport(before).map((r) => `${r.ruleId}×${r.count}`).join(', ');
  if (checkOnly) {
    console.log(`  WOULD SCRUB  ${f}  (${report})`);
  } else {
    writeFileSync(path, after, 'utf8');
    console.log(`  scrubbed     ${f}  (${report})`);
  }
}

if (changed === 0) {
  console.log(`✓ All ${files.length} kb-candidates already clean — no changes.`);
} else if (checkOnly) {
  console.error(`\n✗ ${changed} file(s) contain un-scrubbed sensitive content. Run: npm run scrub:kb`);
  process.exit(1);
} else {
  console.log(`\n✓ Scrubbed ${changed} of ${files.length} file(s).`);
}
