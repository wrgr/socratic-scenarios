/**
 * The QA objective: a programmatic answer checker. This is the second domain's analogue of the
 * COLREG objective — but instead of a control-regret simulator, the score is answer-correctness,
 * computed by string normalization + containment. No simulator, no reference policy: the verifier
 * IS the objective, which is exactly what makes the second domain's ground truth independent of
 * anything we hand-designed about the task dynamics.
 */

const ARTICLES = new Set(['a', 'an', 'the']);

/** Normalize an answer for comparison: lowercase, strip punctuation, drop articles, collapse space. */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !ARTICLES.has(w))
    .join(' ')
    .trim();
}

/** True if the model's output contains the expected answer (normalized, whole-token match). */
export function answerCorrect(output: string, expected: string): boolean {
  const exp = normalizeAnswer(expected);
  if (!exp) return false;
  const out = normalizeAnswer(output);
  if (!out) return false;
  // Whole-phrase match on token boundaries — so "veltricite" matches inside a sentence but a
  // prefix like "dorn" does not match "dornalium", and "i don t know" never matches a value token.
  return new RegExp(`(^|\\s)${escapeRe(exp)}(\\s|$)`).test(out);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** An explicit abstention ("I don't know") — used to tell "read the corpus and it wasn't there"
 * apart from a wrong guess. */
export function isAbstention(output: string): boolean {
  const out = normalizeAnswer(output);
  return out === 'i don t know' || out === 'i dont know' || out === 'unknown' || out === '' || /(^|\s)don t know(\s|$)/.test(out);
}
