/**
 * Minimal .env loader for the dev eval scripts. Reads `.env` (gitignored) and sets
 * process.env, OVERRIDING any pre-existing value — so a key placed in .env wins over
 * a stale one baked into the container environment. No dependency; import for side
 * effect at the top of a script: `import './_env';`.
 *
 * Dev-script use only — never imported by the app or build.
 */
import { readFileSync } from 'node:fs';

try {
  const text = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([\w.]+)\s*=\s*(.*)$/);
    if (!m) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  /* no .env — rely on the ambient environment */
}
