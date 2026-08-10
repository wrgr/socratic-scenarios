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

// Real models abstain in many phrasings, not just "I don't know" — and a narrow matcher would
// misread "the reference facts do not mention that" as a (wrong) answer and mis-score contamination.
// These markers are checked against the *normalized* text (lowercased, punctuation/articles
// stripped). Deliberately NOT included: "unspecified" (the ignorant mock's wrong guess — a failure,
// not an abstention) and bare "not know" (would catch unrelated text).
const ABSTAIN_MARKERS = [
  'don t know', 'do not know', 'dont know', 'does not know',
  'not mention', 'not mentioned', 'no mention', 'does not mention', 'do not mention',
  'not provided', 'not specified', 'not stated', 'not listed', 'not available', 'not given', 'not found',
  'no information', 'not enough information', 'insufficient information',
  'cannot be determined', 'can not be determined', 'cannot determine', 'unable to',
  'not in reference', 'not in facts', 'reference facts do not', 'facts do not', 'no data',
];

/** An explicit abstention — used to tell "read the corpus and it wasn't there" apart from a wrong
 * guess. Recognizes the common ways a real model declines, not just the literal "I don't know". */
export function isAbstention(output: string): boolean {
  const out = normalizeAnswer(output);
  return out === '' || out === 'unknown' || ABSTAIN_MARKERS.some((m) => out.includes(m));
}
