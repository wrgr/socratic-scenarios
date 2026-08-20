/**
 * Deterministic Mentor fallback — keyless evaluation for Socratic Practice,
 * Scenario Mode, and the Workflow Demo.
 *
 * Scores a learner's free-text answer by keyword coverage of the probe's
 * expectedConcepts (which come from the reviewed knowledge graph), with a
 * penalty when the answer resembles a listed common wrong answer. Everything
 * is template output over probe data — there is no generation, so there is
 * nothing to hallucinate — and identical input always produces identical
 * output.
 *
 * Honesty contract: this is a keyword rubric, not language understanding.
 * A learner who paraphrases perfectly without the rubric's vocabulary will
 * be under-scored. Every evaluation is tagged `engine: 'deterministic'` and
 * the UI renders that distinctly (ProvenanceBadge) so a rubric match is
 * never presented as LLM judgment. The ablation probe is meaningless here
 * (scoring never reads retrievalContext), so the service is marked
 * `deterministic: true` and views hide the provenance toggle.
 */
import type { MentorContext, MentorEvaluation, MentorService } from './index';

// ─── Tokenizing ───────────────────────────────────────────────────

const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'are', 'was', 'were',
  'has', 'have', 'had', 'not', 'but', 'its', 'can', 'will', 'when', 'then',
  'than', 'them', 'they', 'you', 'your', 'into', 'onto', 'out', 'all', 'any',
  'may', 'must', 'should', 'would', 'could', 'because', 'which', 'while',
  'where', 'what', 'how', 'why', 'who', 'been', 'being', 'does', 'doing',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Cheap suffix stemmer so "clogging" matches "clog", "focused" matches "focus". */
function stem(t: string): string {
  if (t.length > 5 && t.endsWith('ing')) return t.slice(0, -3);
  if (t.length > 4 && t.endsWith('ed')) return t.slice(0, -2);
  if (t.length > 4 && t.endsWith('es')) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s')) return t.slice(0, -1);
  return t;
}

function stemSet(tokens: string[]): Set<string> {
  return new Set(tokens.map(stem));
}

/** Fraction of `concept`'s content words present in the response. */
function conceptCoverage(concept: string, responseStems: Set<string>): number {
  const conceptTokens = tokenize(concept);
  if (conceptTokens.length === 0) return 0;
  const matched = conceptTokens.filter((t) => responseStems.has(stem(t)));
  return matched.length / conceptTokens.length;
}

/** Shorten a concept phrase for use inside feedback text. */
function shorten(concept: string, maxWords = 9): string {
  const words = concept.trim().split(/\s+/);
  return words.length <= maxWords ? concept.trim() : `${words.slice(0, maxWords).join(' ')}…`;
}

// ─── Thresholds ───────────────────────────────────────────────────

const COVERED_AT = 0.6;   // concept counts as addressed
const TOUCHED_AT = 0.25;  // partial credit band
const WRONG_MATCH_AT = 0.7;
const WRONG_PENALTY = 0.15;

// ─── Service ──────────────────────────────────────────────────────

/**
 * Create the keyless deterministic Mentor. Same MentorService contract as the
 * LLM implementation; every result carries `engine: 'deterministic'`.
 */
export function createDeterministicMentorService(): MentorService {
  return {
    deterministic: true,

    async evaluate(ctx: MentorContext): Promise<MentorEvaluation> {
      const threshold = ctx.safetyGate ? 0.90 : 0.80;
      const reveal = ctx.priorAttempts >= 2;
      const concepts = ctx.expectedConcepts;

      // The rubric IS corpus data (expectedConcepts live on the reviewed
      // probe node), so grounding reflects that — not a prompt that never
      // existed. Node ids pass through from the caller when provided.
      const grounded = concepts.length > 0;
      const groundingNodeIds = ctx.groundingNodeIds ?? [];

      if (concepts.length === 0) {
        return {
          score: 0,
          feedback:
            'This probe has no machine-checkable concept rubric, so the keyless deterministic evaluator cannot grade it. Add a Gemini API key (⚙ gear) for LLM evaluation, or use Skip.',
          followUpProbe: ctx.probeQuestion,
          masteryPassed: false,
          grounded: false,
          groundingNodeIds: [],
          engine: 'deterministic',
        };
      }

      const responseStems = stemSet(tokenize(ctx.learnerResponse));
      const coverages = concepts.map((c) => conceptCoverage(c, responseStems));
      const covered = concepts.filter((_, i) => coverages[i] >= COVERED_AT);
      const touched = concepts.filter(
        (_, i) => coverages[i] >= TOUCHED_AT && coverages[i] < COVERED_AT,
      );
      const missing = concepts.filter((_, i) => coverages[i] < TOUCHED_AT);

      let score = (covered.length + 0.5 * touched.length) / concepts.length;

      const wrongHit = (ctx.commonWrongAnswers ?? []).find(
        (w) => conceptCoverage(w, responseStems) >= WRONG_MATCH_AT,
      );
      if (wrongHit) score = Math.max(0, score - WRONG_PENALTY);
      score = Math.round(score * 100) / 100;
      const masteryPassed = score >= threshold;

      // Feedback: template sentences over probe data only.
      const parts: string[] = [];
      if (covered.length > 0) {
        parts.push(`You addressed ${covered.length} of ${concepts.length} expected concepts, including “${shorten(covered[0])}”.`);
      } else if (touched.length > 0) {
        parts.push(`You touched on “${shorten(touched[0])}” but didn’t develop it far enough to count.`);
      } else {
        parts.push('Your answer didn’t use the vocabulary of any expected concept for this probe.');
      }
      if (wrongHit) {
        parts.push(`Careful — your answer resembles a common misconception: “${shorten(wrongHit)}”.`);
      }
      const gap = missing[0] ?? touched[0];
      if (gap && !masteryPassed) {
        parts.push(
          reveal
            ? `The key point you’re missing (attempt ${ctx.priorAttempts + 1}): “${gap}”.`
            : `The most important gap concerns “${shorten(gap)}” — think about how that fits before answering again.`,
        );
      }
      if (masteryPassed) {
        parts.push('That clears the mastery threshold on the keyword rubric.');
      }

      const followUpProbe = gap && !masteryPassed
        ? `What role does “${shorten(gap)}” play here?`
        : `You covered the expected concepts — in your own words, why does “${shorten(concepts[0])}” matter in practice?`;

      return {
        score,
        feedback: parts.join(' '),
        followUpProbe,
        masteryPassed,
        grounded,
        groundingNodeIds,
        engine: 'deterministic',
      };
    },
  };
}
