/**
 * Corpus-gap diagnosis — the "spot issues and fix them" half of the RAG-bounded
 * validation loop (docs/colreg-validation.md §3).
 *
 * When a learner is bound to a corpus with no outside information, its task
 * failures are *diagnostic of the corpus*. Because each knowledge component maps
 * to a specific simulator metric, a failure signature localizes which corpus
 * knowledge is missing or wrong — pointing at the exact nodes/rules to inspect.
 * Run a RAG-bounded learner across the benchmark → diagnose → fix the corpus →
 * re-run and confirm the signature clears.
 *
 * This attributes from the per-case ObjectiveResults (their COLREG compliance
 * checks + safety metrics), so it works for any policy, not just the mechanistic
 * learner in learner-policy.ts.
 */
import type { SimScenario } from './types';
import type { ObjectiveResult } from './objective';

export type GapComponent = 'role' | 'starboard' | 'substantial' | 'early' | 'safeSpeed' | 'coordination';

export interface CorpusFinding {
  component: GapComponent;
  /** Number of cases exhibiting the failure signature. */
  failCount: number;
  /** Fraction of cases, [0, 1]. */
  rate: number;
  summary: string;
  /** Corpus nodes / rules to inspect and, if absent or wrong, fix. */
  inspect: string[];
}

const INSPECT: Record<GapComponent, string[]> = {
  role: ['RULE-COLREG-16', 'RULE-COLREG-17', 'PROBE-COLREG-CROSSING-001'],
  starboard: ['RULE-COLREG-14', 'RULE-COLREG-15', 'PROBE-COLREG-STARBOARD-001'],
  substantial: ['RULE-COLREG-08', 'PROBE-COLREG-SUBSTANTIAL-001'],
  early: ['RULE-COLREG-08', 'RULE-COLREG-16'],
  safeSpeed: ['RULE-COLREG-06', 'RULE-COLREG-19', 'PROBE-COLREG-SAFE-SPEED-001'],
  coordination: ['multi-ship handling (no single corpus node — candidate gap)'],
};

const SUMMARY: Record<GapComponent, string> = {
  role: 'Learner often takes no avoiding action and is struck — give-way/stand-on duty may be missing from the corpus.',
  starboard: 'Learner alters to port in head-on/crossing give-way — the alter-to-starboard rule may be missing or wrong.',
  substantial: 'Alterations are too small to be readily apparent — Rule 8 "substantial action" may be under-specified.',
  early: 'Action is taken late — the "ample time" guidance (Rules 8/16) may be missing.',
  safeSpeed: 'Speed not reduced in restricted visibility — safe-speed rules (6/19) may be missing.',
  coordination: 'Clears the nearest ship but hits another in multi-ship cases — the corpus lacks multi-target coordination guidance.',
};

function failsCheck(r: ObjectiveResult, ids: string[]): boolean {
  return r.compliance.checks.some((c) => ids.includes(c.id) && c.applicable && !c.pass);
}

/**
 * Diagnose likely corpus gaps from a policy's per-case results. `scenarios` and
 * `results` are parallel arrays (same order, e.g. from `runBenchmark(...).perCase`).
 */
export function diagnoseCorpusGaps(
  scenarios: SimScenario[],
  results: ObjectiveResult[],
): CorpusFinding[] {
  const n = results.length || 1;
  const count: Record<GapComponent, number> = {
    role: 0, starboard: 0, substantial: 0, early: 0, safeSpeed: 0, coordination: 0,
  };

  results.forEach((r, i) => {
    const sc = scenarios[i];
    // role: did essentially nothing and was struck.
    if (r.metrics.incursion && r.metrics.deviationPct < 0.02) count.role += 1;
    if (failsCheck(r, ['direction', 'no-port-turn'])) count.starboard += 1;
    if (failsCheck(r, ['substantial'])) count.substantial += 1;
    if (failsCheck(r, ['early'])) count.early += 1;
    if (failsCheck(r, ['safe-speed'])) count.safeSpeed += 1;
    // coordination: complied yet still hit someone in a multi-ship case.
    if (sc && sc.targets.length > 1 && r.metrics.incursion && r.metrics.compliancePenalty < 0.2) {
      count.coordination += 1;
    }
  });

  return (Object.keys(count) as GapComponent[])
    .filter((k) => count[k] > 0)
    .map((k) => ({
      component: k,
      failCount: count[k],
      rate: count[k] / n,
      summary: SUMMARY[k],
      inspect: INSPECT[k],
    }))
    .sort((a, b) => b.failCount - a.failCount);
}
