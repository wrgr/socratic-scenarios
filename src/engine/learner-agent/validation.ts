/**
 * Validation harness for the mastery estimators — the "is the measurement valid?"
 * layer that backs the C2 claim in docs/novelty-and-positioning.md.
 *
 * Two checks, both on synthetic data drawn from a KNOWN ground truth so error is
 * computable:
 *   - **Recovery** — given data generated from a known latent (an IRT ability, or a
 *     BKT learning process), does the estimator's belief converge to that truth?
 *   - **Calibration** — of the events an estimator predicts at probability p, do a
 *     fraction ≈ p actually come out correct? (The precise form of "P(known)=0.8
 *     items succeed ~80%.") Summarized by Expected Calibration Error (ECE).
 *
 * Everything is deterministic given a seed (a small mulberry32 PRNG) so the tests
 * and the paper's numbers reproduce exactly — no API key, no wall-clock, no
 * Math.random.
 */
import type { KnowledgeEstimate, MasteryEstimator } from './types';

// ─── Deterministic PRNG (mulberry32) ────────────────────────────────────────────

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const bernoulli = (rng: () => number, p: number) => (rng() < p ? 1 : 0);

// ─── Ground-truth generators ─────────────────────────────────────────────────────

export interface IrtResponse {
  outcome: number;
  difficulty: number;
}

/**
 * Static-ability (IRT / Rasch) responder: P(correct) = σ(ability − difficulty).
 * Models a learner whose skill does NOT change — the regime Elo/IRT target.
 */
export function simulateIrt(
  rng: () => number,
  ability: number,
  difficulties: readonly number[],
): IrtResponse[] {
  return difficulties.map((d) => ({ outcome: bernoulli(rng, sigmoid(ability - d)), difficulty: d }));
}

export interface BktGenParams {
  pInit: number;
  pTransit: number;
  pSlip: number;
  pGuess: number;
}

export interface BktSample {
  outcomes: number[];
  /** True hidden known-state at each opportunity (before responding). */
  known: boolean[];
}

/**
 * BKT generative process: L₀ ~ Bernoulli(pInit); at each opportunity respond
 * correct with prob (1−slip) if known else guess; then L transitions to known with
 * prob pTransit (and stays known). Models a learner who is actually *learning*.
 */
export function simulateBkt(rng: () => number, params: BktGenParams, n: number): BktSample {
  const { pInit, pTransit, pSlip, pGuess } = params;
  let isKnown = rng() < pInit;
  const outcomes: number[] = [];
  const known: boolean[] = [];
  for (let i = 0; i < n; i++) {
    known.push(isKnown);
    outcomes.push(bernoulli(rng, isKnown ? 1 - pSlip : pGuess));
    if (!isKnown && rng() < pTransit) isKnown = true;
  }
  return { outcomes, known };
}

// ─── Calibration (reliability curve + ECE) ───────────────────────────────────────

export interface ReliabilityBin {
  /** Bin midpoint (nominal probability). */
  p: number;
  /** Mean predicted probability of the points in this bin. */
  confidence: number;
  /** Empirical fraction correct in this bin. */
  accuracy: number;
  count: number;
}

export interface CalibrationResult {
  bins: ReliabilityBin[];
  /** Expected Calibration Error — Σ (nᵦ/N)·|accuracyᵦ − confidenceᵦ|, 0 = perfect. */
  ece: number;
  n: number;
}

/** Bin (predicted, outcome) pairs and compute the reliability curve + ECE. */
export function calibration(
  points: readonly { p: number; y: number }[],
  nBins = 10,
): CalibrationResult {
  const bins: ReliabilityBin[] = Array.from({ length: nBins }, (_, i) => ({
    p: (i + 0.5) / nBins,
    confidence: 0,
    accuracy: 0,
    count: 0,
  }));
  for (const { p, y } of points) {
    const idx = Math.min(nBins - 1, Math.max(0, Math.floor(p * nBins)));
    bins[idx].confidence += p;
    bins[idx].accuracy += y;
    bins[idx].count += 1;
  }
  let ece = 0;
  const n = points.length || 1;
  for (const b of bins) {
    if (b.count === 0) continue;
    b.confidence /= b.count;
    b.accuracy /= b.count;
    ece += (b.count / n) * Math.abs(b.accuracy - b.confidence);
  }
  return { bins, ece, n: points.length };
}

// ─── Driving an estimator over a response stream ─────────────────────────────────

const freshEstimate = (est: MasteryEstimator): KnowledgeEstimate => ({
  mastery: est.initialMastery(),
  level: 'novice',
  confidence: 0,
  attempts: 0,
});

export interface RunResult {
  /** Final belief after consuming the whole stream. */
  final: KnowledgeEstimate;
  /** (predicted, outcome) pairs — one per response, BEFORE that response was folded in. */
  points: { p: number; y: number }[];
}

/**
 * Feed a stream of (outcome, difficulty) responses through an estimator, recording
 * the pre-response prediction at each step (for calibration) and the final belief
 * (for recovery). Pure over the estimator.
 */
export function runEstimator(
  estimator: MasteryEstimator,
  stream: readonly { outcome: number; difficulty?: number }[],
): RunResult {
  let est = freshEstimate(estimator);
  const points: { p: number; y: number }[] = [];
  for (const r of stream) {
    const ctx = { difficulty: r.difficulty };
    points.push({ p: estimator.predict(est, ctx), y: r.outcome });
    const { mastery, confidence } = estimator.step(est, r.outcome, ctx);
    est = { ...est, mastery, confidence, attempts: est.attempts + 1, lastOutcome: r.outcome };
  }
  return { final: est, points };
}
