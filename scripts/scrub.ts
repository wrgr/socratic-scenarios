/**
 * Canonical sensitivity scrub filter — single source of truth.
 *
 * Removes site-/deployment-identifying and personal information from any text
 * that ships: kb-candidate `.md` files, dense-corpus chunks, or generated docs.
 * Applied by `scripts/scrub-kb.ts` (the `.md` files) and by
 * `scripts/ingest-corpus.ts` (each corpus chunk), so re-extraction reapplies the
 * scrubbing automatically instead of anyone hand-editing.
 *
 * Deterministic + idempotent: every replacement produces text the same rule
 * won't re-match, so running twice yields identical output. Encodes the
 * 2026-07 sensitivity decisions — see `sources/SOURCES_LOG.md` "Standing policy".
 */

export interface ScrubRule {
  id: string;
  pattern: RegExp;
  replacement: string;
}

/** Optomec employee names from the OEM manual revision log (redact). */
const EMPLOYEE_NAMES = [
  'Shayna Brocato', 'Eric Sandoval', 'Amy Anderson', 'Jerry Winton',
  'Skyler Sherman', 'Blake Azuela', 'Chris Mondragon', 'Archie Valdez',
  'Daniel Pulscher',
];
/** Distinctive surnames that also appear standalone in revision entries. */
const EMPLOYEE_SURNAMES = [
  'Brocato', 'Sandoval', 'Winton', 'Sherman', 'Azuela', 'Mondragon', 'Valdez', 'Pulscher',
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Structural rules, applied in order (specific → generic). */
const STRUCTURAL_RULES: ScrubRule[] = [
  // ── "Deployed Environment" framing → generic (order matters) ──
  { id: 'deployed-env-paren', pattern: /\s*\((?:in a )?[Dd]eployed [Ee]nvironment\)/g, replacement: '' },
  { id: 'deployed-env-in-a', pattern: /\s+in a [Dd]eployed [Ee]nvironment/g, replacement: '' },
  { id: 'deployed-env-kewb', pattern: /in KEWB-driven deployed environment/gi, replacement: 'via KEWB software' },
  { id: 'deployed-env-generic', pattern: /[Dd]eployed [Ee]nvironment/g, replacement: 'Optomec HD2' },

  // ── "Decathlon" internal codename → HD2 ──
  { id: 'decathlon-note', pattern: /[""]?Decathlon[""]? is Optomec's internal name for the HD2[^.]*\.\s*/g, replacement: '' },
  { id: 'decathlon-paren', pattern: /Decathlon \(= HD2[^)]*\)/g, replacement: 'the HD2' },
  { id: 'decathlon', pattern: /\bDecathlon\b/g, replacement: 'HD2' },

  // ── Site-specific recipe filenames (*.ini containing an underscore) ──
  // Generic config names (Startup.ini, mermaid.ini, ScenarioEngine.ini) are kept.
  { id: 'recipe-ini', pattern: /\b(?:\d+K\s+)?[A-Za-z0-9][\w+-]*_[\w+.-]*\.ini\b/g, replacement: '[site-specific recipe filename — redacted]' },

  // NOTE: real network addresses / camera serials / COM ports are NOT regex-scrubbed
  // here — a generic IPv4 pattern also matches document clause numbers (e.g. IPC
  // "3.9.1.2"), causing false-positive redactions in legitimate text. Those values
  // only ever appear in the raw machine-config exports, which are handled by
  // *exclusion* (EXCLUDED_SOURCES — never ingested), not by scrubbing.
];

/** Employee-name rules (full names first, then distinctive surnames). */
const NAME_RULES: ScrubRule[] = [
  ...EMPLOYEE_NAMES.map((n, i) => ({
    id: `emp-full-${i}`,
    pattern: new RegExp(`\\b${escapeRe(n)}\\b`, 'g'),
    replacement: '[name — redacted]',
  })),
  ...EMPLOYEE_SURNAMES.map((n, i) => ({
    id: `emp-surname-${i}`,
    pattern: new RegExp(`\\b${escapeRe(n)}\\b`, 'g'),
    replacement: '[name — redacted]',
  })),
];

/** All rules, in application order. */
export const SCRUB_RULES: ScrubRule[] = [...STRUCTURAL_RULES, ...NAME_RULES];

/** Scrub a string. Deterministic + idempotent. */
export function scrubText(input: string): string {
  let out = input;
  for (const rule of SCRUB_RULES) out = out.replace(rule.pattern, rule.replacement);
  return out;
}

/** Which rules fired, and how many times — for reporting/auditing. */
export function scrubReport(input: string): Array<{ ruleId: string; count: number }> {
  const report: Array<{ ruleId: string; count: number }> = [];
  for (const rule of SCRUB_RULES) {
    const matches = input.match(rule.pattern);
    if (matches?.length) report.push({ ruleId: rule.id, count: matches.length });
  }
  return report;
}
