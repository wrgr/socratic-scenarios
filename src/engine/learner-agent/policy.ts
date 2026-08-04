/**
 * Policy layer — the functions that *consume* learner state to drive instruction.
 *
 * Kept separate from the state/estimator so each is independently testable
 * (docs/learner-agent-design.md §5): mastery/safety gates, the prerequisite-aware
 * learning frontier, and ZPD next-item selection (Vygotsky 1978 — teach at the edge
 * of current capability). All are pure reads over `LearnerState` + `DomainModel`.
 */
import type { DomainModel, KCId, KnowledgeComponent, LearnerState } from './types';
import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_MASTERY_THRESHOLD,
  DEFAULT_SAFETY_THRESHOLD,
} from './agent';

export interface GateResult {
  passed: boolean;
  reasons: string[];
  masteryThreshold: number;
  confidenceThreshold: number;
}

function kcById(domain: DomainModel, kcId: KCId): KnowledgeComponent | undefined {
  return domain.kcs.find((k) => k.id === kcId);
}

/** The mastery threshold for a KC — the safety threshold if it is safety-critical. */
export function thresholdFor(domain: DomainModel, kcId: KCId): number {
  const kc = kcById(domain, kcId);
  if (kc?.safetyCritical) return domain.safetyThreshold ?? DEFAULT_SAFETY_THRESHOLD;
  return domain.masteryThreshold ?? DEFAULT_MASTERY_THRESHOLD;
}

/**
 * A mastery gate: pass only when mastery ≥ τ AND the estimate is confident enough.
 * Requiring confidence prevents advancing on a high mastery inferred from one lucky
 * outcome.
 */
export function masteryGate(state: LearnerState, domain: DomainModel, kcId: KCId): GateResult {
  const est = state.knowledge[kcId];
  const masteryThreshold = thresholdFor(domain, kcId);
  const confidenceThreshold = domain.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  const reasons: string[] = [];
  if (!est || est.attempts === 0) reasons.push('no attempts yet');
  else {
    if (est.mastery < masteryThreshold)
      reasons.push(`mastery ${est.mastery.toFixed(2)} < ${masteryThreshold}`);
    if (est.confidence < confidenceThreshold)
      reasons.push(`confidence ${est.confidence.toFixed(2)} < ${confidenceThreshold}`);
  }
  return { passed: reasons.length === 0, reasons, masteryThreshold, confidenceThreshold };
}

/** Convenience: is this KC mastered (gate passed)? */
export function isMastered(state: LearnerState, domain: DomainModel, kcId: KCId): boolean {
  return masteryGate(state, domain, kcId).passed;
}

/** Are all of a KC's prerequisites mastered? (KCs with none are always unlocked.) */
export function prerequisitesMet(
  state: LearnerState,
  domain: DomainModel,
  kcId: KCId,
): boolean {
  const kc = kcById(domain, kcId);
  const prereqs = kc?.prerequisites ?? [];
  return prereqs.every((p) => isMastered(state, domain, p));
}

/**
 * The learning frontier: KCs not yet mastered whose prerequisites are all met — the
 * set a learner is ready to work on now.
 */
export function frontier(state: LearnerState, domain: DomainModel): KnowledgeComponent[] {
  return domain.kcs.filter(
    (kc) => !isMastered(state, domain, kc.id) && prerequisitesMet(state, domain, kc.id),
  );
}

/**
 * ZPD next-item selection: from the ready frontier, pick the KC with the lowest
 * mastery — the one most in need of work and just within reach. Returns null when
 * everything reachable is mastered. Ties break by domain order (stable).
 */
export function selectNextKC(state: LearnerState, domain: DomainModel): KCId | null {
  const options = frontier(state, domain);
  if (options.length === 0) return null;
  let best = options[0];
  let bestMastery = state.knowledge[best.id]?.mastery ?? 0;
  for (const kc of options.slice(1)) {
    const m = state.knowledge[kc.id]?.mastery ?? 0;
    if (m < bestMastery) {
      best = kc;
      bestMastery = m;
    }
  }
  return best.id;
}

export interface MasterySummary {
  total: number;
  mastered: number;
  attempted: number;
  /** Mean mastery across all KCs, 0–1. */
  meanMastery: number;
  masteredKCs: KCId[];
}

/** Aggregate the learner's state across the domain — for a dashboard Mastery Map. */
export function summarize(state: LearnerState, domain: DomainModel): MasterySummary {
  const masteredKCs: KCId[] = [];
  let attempted = 0;
  let masterySum = 0;
  for (const kc of domain.kcs) {
    const est = state.knowledge[kc.id];
    masterySum += est?.mastery ?? 0;
    if (est && est.attempts > 0) attempted += 1;
    if (isMastered(state, domain, kc.id)) masteredKCs.push(kc.id);
  }
  return {
    total: domain.kcs.length,
    mastered: masteredKCs.length,
    attempted,
    meanMastery: domain.kcs.length ? masterySum / domain.kcs.length : 0,
    masteredKCs,
  };
}
