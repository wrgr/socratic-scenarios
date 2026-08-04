/**
 * Generic learner agent — core types.
 *
 * A domain-agnostic generalization of the AJP-specific learner model
 * (src/engine/learner-model/): the unit of knowledge is a **Knowledge Component**
 * (KC) — a fact, skill, or rule (Koedinger, Corbett & Perfetti 2012, the KLI
 * framework). Every learner carries one `KnowledgeEstimate` per KC, updated from an
 * append-only log of `EvidenceEvent`s by a pluggable `MasteryEstimator`.
 *
 * See docs/learner-agent-design.md for the full rationale, the estimator ladder,
 * and references.
 */
import type { ProficiencyLevel } from '../../types';

export type KCId = string;

/** A unit of knowledge the domain teaches and the agent tracks. */
export interface KnowledgeComponent {
  id: KCId;
  label?: string;
  /** KCs that must be mastered before this one is on the learning frontier. */
  prerequisites?: KCId[];
  /** Safety-critical KCs gate at the higher mastery threshold. */
  safetyCritical?: boolean;
}

/** The domain the agent is parameterized by — KCs + gate thresholds. */
export interface DomainModel {
  id: string;
  kcs: KnowledgeComponent[];
  /** Mastery required to pass a normal gate (default 0.80). */
  masteryThreshold?: number;
  /** Mastery required for safety-critical KCs (default 0.90). */
  safetyThreshold?: number;
  /** Estimator certainty required before a gate can pass (default 0.60). */
  confidenceThreshold?: number;
}

/** The agent's belief about one KC. */
export interface KnowledgeEstimate {
  /** Continuous mastery, 0–1 (P(known) for BKT, logistic skill for Elo). */
  mastery: number;
  /** Coarse band derived from mastery, for display and calibration. */
  level: ProficiencyLevel;
  /** Estimator certainty, 0–1 — shrinks toward 0 with few observations. */
  confidence: number;
  attempts: number;
  /** Most recent observed outcome, 0–1. */
  lastOutcome?: number;
  /** Timestamp of the last observation (from the event, so updates stay pure). */
  lastAssessed?: number;
}

/** One observation. The `source` field keeps real and simulated evidence separable. */
export interface EvidenceEvent {
  timestamp: number;
  /** KCs this item exercised — its Q-matrix row. */
  kcIds: KCId[];
  itemId: string;
  /** Graded outcome, 0–1 (Mentor score, correctness, or transfer score). */
  outcome: number;
  kind: 'probe' | 'assessment' | 'scenario' | 'hint' | 'retrieval';
  /** Where the outcome came from — a real learner or a simulated proxy. */
  source: 'human' | 'simulated';
  /**
   * Item difficulty on the logit scale, used by Elo/IRT estimators (0 = average).
   * Ignored by estimators that don't model item difficulty.
   */
  difficulty?: number;
  details?: Record<string, unknown>;
}

/** The full learner state — serializable and reconstructable by replaying `history`. */
export interface LearnerState {
  id: string;
  domainId: string;
  knowledge: Record<KCId, KnowledgeEstimate>;
  history: EvidenceEvent[];
  /** Optional experiment condition / persona label. */
  context?: { condition?: string; role?: string };
  updatedAt: number;
}

/** Context an estimator may consult when stepping (e.g. item difficulty for Elo). */
export interface EstimatorStepContext {
  difficulty?: number;
}

/**
 * A pluggable mastery estimator. Implementations own the *belief math*; the agent
 * owns bookkeeping (attempts, level band, timestamps). `step` is pure.
 *
 * See the ladder in docs/learner-agent-design.md §4:
 *   heuristic (rung 0) → BKT (1) → AFM/PFA (2) → Elo/IRT (3) → DKT (4).
 */
export interface MasteryEstimator {
  readonly id: string;
  /** Starting mastery for a fresh KC (e.g. BKT prior, or 0.5 for Elo). */
  initialMastery(): number;
  /** Fold one outcome into the belief, returning the new mastery + confidence. */
  step(
    prev: KnowledgeEstimate,
    outcome: number,
    ctx: EstimatorStepContext,
  ): { mastery: number; confidence: number };
  /**
   * Predicted probability that the next outcome on this KC is correct, given the
   * current belief and item context. This is the quantity a *calibration* check
   * evaluates (does predicted 0.8 succeed ~80%?) and what next-item selection uses.
   * For BKT it is P(L)·(1−slip)+(1−P(L))·guess; for Elo σ(θ−d); for the heuristic,
   * the running mastery itself.
   */
  predict(prev: KnowledgeEstimate, ctx: EstimatorStepContext): number;
}
