/**
 * Corpus-sufficiency verdict — the product face of the necessity audit, shared by BOTH domains
 * (COLREG regret and fact-QA accuracy). It rolls the per-item verdicts (relied-on / redundant /
 * unusable / inconclusive) into a single corpus-level judgement: is the corpus actually carrying
 * the load for this query set?
 *
 * The claim it supports is co-equal with necessity, and it has one hard scoping condition made
 * explicit here: **sufficiency is always relative to the probed query set.** "Sufficient" means
 * "for these queries"; an item scored redundant here may be necessary for queries not exercised.
 * The count-based rollup below therefore always reports the query count, and the FALSE-SUFFICIENCY
 * case is the one that most needs it — a corpus that looks sufficient only because the model
 * already knows the answers is fragile to exactly the distribution shift the bounded query set
 * cannot see. Detecting that fragility is what makes a bounded-query sufficiency claim honest
 * rather than naive: necessity ≈ 0 everywhere is the measurable warning that task success is
 * coming from priors, not the corpus.
 */

export type Sufficiency = 'contributing' | 'redundant' | 'unusable' | 'partial' | 'empty';

export interface AuditCounts {
  relied: number;
  redundant: number;
  unusable: number;
  inconclusive: number;
  /** Did the learner answer the closed-book (no-corpus) baseline from priors? */
  closedBookContaminated: boolean;
  /** Number of queries the audit was measured over (the scope of the claim). */
  queries: number;
}

export interface SufficiencyReport {
  verdict: Sufficiency;
  headline: string;
  /** The always-attached scope caveat (bounded query set). */
  scope: string;
}

/**
 * Roll per-item verdict counts into a corpus-sufficiency verdict.
 *
 *  - `contributing` — every probed item is relied upon: the corpus carries the load, lean.
 *  - `redundant`    — nothing relied upon and the model answers closed-book: FALSE SUFFICIENCY —
 *                     task success is coming from priors, the corpus adds ~nothing and is fragile
 *                     to distribution shift. The most important case to surface.
 *  - `unusable`     — items present but the model fails even with them: content is not the
 *                     bottleneck, the model (or prompting/retrieval) is.
 *  - `partial`      — a mix: some relied-on, some prunable (redundant), some model-limited (unusable).
 */
export function sufficiencyVerdict(c: AuditCounts): SufficiencyReport {
  const total = c.relied + c.redundant + c.unusable + c.inconclusive;
  const scope =
    `scope: measured over ${c.queries} queries — items scored redundant here may still be ` +
    `necessary for queries not in this set (sufficiency is relative to the query distribution).`;
  if (total === 0) return { verdict: 'empty', headline: 'no items probed', scope };

  if (c.relied === 0 && c.redundant >= c.unusable && c.redundant > 0) {
    const coast = c.closedBookContaminated ? ' (the model answers this closed-book)' : '';
    return {
      verdict: 'redundant',
      headline:
        `FALSE SUFFICIENCY — 0/${total} items relied upon; ${c.redundant} already known${coast}. The ` +
        `corpus is not contributing on this query set; task success rides on priors and is fragile ` +
        `to distribution shift. Re-test against queries the model cannot answer closed-book.`,
      scope,
    };
  }
  if (c.relied === 0 && c.unusable > 0) {
    return {
      verdict: 'unusable',
      headline:
        `UNUSABLE — 0/${total} items relied upon; ${c.unusable} present-but-unexploited. The content ` +
        `is there, the model fails to act on it; the bottleneck is the model/prompting/retrieval, ` +
        `not corpus coverage.`,
      scope,
    };
  }
  if (c.redundant === 0 && c.unusable === 0 && c.relied > 0) {
    return {
      verdict: 'contributing',
      headline: `CONTRIBUTING — ${c.relied}/${total} items relied upon; the corpus carries the load, no dead weight.`,
      scope,
    };
  }
  return {
    verdict: 'partial',
    headline:
      `PARTIAL — ${c.relied} relied-on · ${c.redundant} redundant (prunable) · ${c.unusable} ` +
      `unusable (model-limited)${c.inconclusive ? ` · ${c.inconclusive} inconclusive` : ''}.`,
    scope,
  };
}
