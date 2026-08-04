/**
 * Mastery estimators — the pluggable "belief math" behind the learner agent.
 *
 * Three rungs of the ladder in docs/learner-agent-design.md §4, each a faithful,
 * minimal implementation of the source method:
 *
 *   - `heuristicEstimator`  — running success rate + attempt-ramped confidence.
 *     Mirrors the existing AJP learner model (src/engine/learner-model/index.ts).
 *   - `bktEstimator`        — Bayesian Knowledge Tracing (Corbett & Anderson 1994):
 *     a two-state HMM per KC with slip/guess/learn parameters; mastery = P(Lₙ).
 *   - `eloEstimator`        — Elo for skill (Pelánek 2016): logistic ability with an
 *     uncertainty-decaying update; models item difficulty and cold-starts at 0.5.
 *
 * All are pure: `step(prev, outcome, ctx)` returns the new mastery + confidence and
 * touches nothing else.
 */
import type { KnowledgeEstimate, MasteryEstimator, EstimatorStepContext } from './types';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const clampProb = (x: number) => Math.max(1e-3, Math.min(1 - 1e-3, x));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const logit = (p: number) => Math.log(p / (1 - p));

/** Confidence grows with observations: 0 at start, → 1 as attempts accumulate. */
function attemptConfidence(attempts: number, saturateAt = 5): number {
  return clamp01(attempts / saturateAt);
}

// ─── Rung 0: heuristic running rate (mirrors the current AJP model) ─────────────

export interface HeuristicOptions {
  /** Attempts at which confidence saturates to 1 (default 5). */
  saturateAt?: number;
}

export function heuristicEstimator(opts: HeuristicOptions = {}): MasteryEstimator {
  const saturateAt = opts.saturateAt ?? 5;
  return {
    id: 'heuristic',
    initialMastery: () => 0,
    step(prev: KnowledgeEstimate, outcome: number) {
      const n = prev.attempts;
      // Running mean of outcomes — the same recurrence as updateProficiency().
      const mastery = clamp01((prev.mastery * n + clamp01(outcome)) / (n + 1));
      return { mastery, confidence: attemptConfidence(n + 1, saturateAt) };
    },
    predict: (prev: KnowledgeEstimate) => prev.mastery,
  };
}

// ─── Rung 1: Bayesian Knowledge Tracing (Corbett & Anderson 1994) ───────────────

export interface BktParams {
  /** P(L₀): prior probability the KC is already known. */
  pInit: number;
  /** P(T): probability of learning the KC at each opportunity. */
  pTransit: number;
  /** P(S): probability of slipping (known but answers wrong). */
  pSlip: number;
  /** P(G): probability of guessing (unknown but answers right). */
  pGuess: number;
}

/** Literature-typical defaults; fit per-KC from data when available. */
export const DEFAULT_BKT: BktParams = { pInit: 0.2, pTransit: 0.15, pSlip: 0.1, pGuess: 0.2 };

export function bktEstimator(params: Partial<BktParams> = {}): MasteryEstimator {
  const { pInit, pTransit, pSlip, pGuess } = { ...DEFAULT_BKT, ...params };
  return {
    id: 'bkt',
    initialMastery: () => clampProb(pInit),
    step(prev: KnowledgeEstimate, outcome: number) {
      const pL = prev.mastery; // current P(known)
      const correct = outcome >= 0.5; // BKT is defined over binary evidence
      // Posterior P(known | observation).
      const post = correct
        ? (pL * (1 - pSlip)) / (pL * (1 - pSlip) + (1 - pL) * pGuess)
        : (pL * pSlip) / (pL * pSlip + (1 - pL) * (1 - pGuess));
      // Learning step: a chance to acquire the KC on this opportunity.
      const pLnext = post + (1 - post) * pTransit;
      // Confidence: how far the belief has moved off the maximally-uncertain 0.5.
      const confidence = clamp01(Math.abs(pLnext - 0.5) * 2);
      return { mastery: clampProb(pLnext), confidence };
    },
    // P(correct) = P(known)·(1−slip) + P(unknown)·guess.
    predict: (prev: KnowledgeEstimate) => prev.mastery * (1 - pSlip) + (1 - prev.mastery) * pGuess,
  };
}

// ─── Rung 3: Elo for skill (Pelánek 2016) ───────────────────────────────────────

export interface EloOptions {
  /** Base sensitivity of the update in logits (default 1.2). */
  kBase?: number;
  /** How fast the step size decays with attempts — the uncertainty function (default 0.1). */
  kDecay?: number;
  /** Attempts at which confidence saturates (default 5). */
  saturateAt?: number;
}

/**
 * Elo maintains a learner skill θ (logits). Expected performance on an item of
 * difficulty d is σ(θ − d); the skill moves by K·(outcome − expected), with K
 * shrinking as evidence accumulates (Pelánek's uncertainty function). Mastery is
 * reported at a reference difficulty of 0, i.e. σ(θ). Graded outcomes work directly
 * because the expectation is continuous — no binarization needed.
 */
export function eloEstimator(opts: EloOptions = {}): MasteryEstimator {
  const kBase = opts.kBase ?? 1.2;
  const kDecay = opts.kDecay ?? 0.1;
  const saturateAt = opts.saturateAt ?? 5;
  return {
    id: 'elo',
    initialMastery: () => 0.5, // σ(0)
    step(prev: KnowledgeEstimate, outcome: number, ctx: EstimatorStepContext) {
      const theta = logit(clampProb(prev.mastery));
      const d = ctx.difficulty ?? 0;
      const expected = sigmoid(theta - d);
      const k = kBase / (1 + kDecay * prev.attempts);
      const thetaNext = theta + k * (clamp01(outcome) - expected);
      return {
        mastery: clampProb(sigmoid(thetaNext)),
        confidence: attemptConfidence(prev.attempts + 1, saturateAt),
      };
    },
    // Expected performance on an item of difficulty d: σ(θ − d).
    predict: (prev: KnowledgeEstimate, ctx: EstimatorStepContext) =>
      sigmoid(logit(clampProb(prev.mastery)) - (ctx.difficulty ?? 0)),
  };
}

/** The pragmatic default: Elo cold-starts well and calibrates item difficulty for free. */
export const defaultEstimator = (): MasteryEstimator => eloEstimator();
