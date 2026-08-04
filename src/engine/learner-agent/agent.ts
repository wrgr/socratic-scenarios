/**
 * LearnerAgent — ties a learner's state to a domain and a pluggable estimator.
 *
 * The core is a **pure reducer**, `applyEvent(state, event, …) → state`, so a
 * learner's whole trajectory can be replayed from its event log (and re-derived if
 * the estimator changes). The class is a thin, ergonomic wrapper over that reducer.
 *
 * The agent is deliberately evidence-source-agnostic: `observe()` takes the same
 * `EvidenceEvent` whether the outcome came from a real learner or a simulated proxy
 * (the `source` field records which). Tutoring and the in-silico validation studies
 * therefore run the identical update path. See docs/learner-agent-design.md.
 */
import type { ProficiencyLevel } from '../../types';
import type {
  DomainModel,
  EvidenceEvent,
  KCId,
  KnowledgeEstimate,
  LearnerState,
  MasteryEstimator,
} from './types';

export const DEFAULT_MASTERY_THRESHOLD = 0.8;
export const DEFAULT_SAFETY_THRESHOLD = 0.9;
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.6;

/** Map a continuous mastery (0–1) to a proficiency band. Novice until first attempt. */
export function levelFromMastery(mastery: number, attempts: number): ProficiencyLevel {
  if (attempts <= 0) return 'novice';
  if (mastery < 0.2) return 'novice';
  if (mastery < 0.4) return 'beginner';
  if (mastery < 0.6) return 'intermediate';
  if (mastery < 0.8) return 'advanced';
  return 'expert';
}

function freshEstimate(estimator: MasteryEstimator): KnowledgeEstimate {
  const mastery = estimator.initialMastery();
  return { mastery, level: levelFromMastery(mastery, 0), confidence: 0, attempts: 0 };
}

/** A new learner state with every domain KC initialized by the estimator. */
export function createLearnerState(
  domain: DomainModel,
  estimator: MasteryEstimator,
  opts: { id?: string; context?: LearnerState['context']; createdAt?: number } = {},
): LearnerState {
  const knowledge: Record<KCId, KnowledgeEstimate> = {};
  for (const kc of domain.kcs) knowledge[kc.id] = freshEstimate(estimator);
  return {
    id: opts.id ?? cryptoRandomId(),
    domainId: domain.id,
    knowledge,
    history: [],
    context: opts.context,
    updatedAt: opts.createdAt ?? 0,
  };
}

/**
 * Fold one observation into the state (pure — returns a new object, mutates nothing).
 * Every KC the item exercised (its Q-matrix row, `event.kcIds`) is updated.
 */
export function applyEvent(
  state: LearnerState,
  event: EvidenceEvent,
  estimator: MasteryEstimator,
): LearnerState {
  const knowledge = { ...state.knowledge };
  for (const kcId of event.kcIds) {
    const prev = knowledge[kcId] ?? freshEstimate(estimator);
    const { mastery, confidence } = estimator.step(prev, event.outcome, {
      difficulty: event.difficulty,
    });
    const attempts = prev.attempts + 1;
    knowledge[kcId] = {
      mastery,
      confidence,
      attempts,
      level: levelFromMastery(mastery, attempts),
      lastOutcome: event.outcome,
      lastAssessed: event.timestamp,
    };
  }
  return {
    ...state,
    knowledge,
    history: [...state.history, event],
    updatedAt: event.timestamp,
  };
}

/** Rebuild a learner state from scratch by replaying its events in order. */
export function replay(
  domain: DomainModel,
  estimator: MasteryEstimator,
  events: readonly EvidenceEvent[],
  opts: { id?: string; context?: LearnerState['context'] } = {},
): LearnerState {
  let state = createLearnerState(domain, estimator, opts);
  for (const e of events) state = applyEvent(state, e, estimator);
  return state;
}

export class LearnerAgent {
  readonly domain: DomainModel;
  readonly estimator: MasteryEstimator;
  private _state: LearnerState;

  constructor(
    domain: DomainModel,
    estimator: MasteryEstimator,
    initial?: LearnerState | { id?: string; context?: LearnerState['context'] },
  ) {
    this.domain = domain;
    this.estimator = estimator;
    this._state =
      initial && 'knowledge' in initial
        ? initial
        : createLearnerState(domain, estimator, initial ?? {});
  }

  /** Current state (read-only snapshot). */
  get state(): LearnerState {
    return this._state;
  }

  /** Fold one observation in and return the updated state. */
  observe(event: EvidenceEvent): LearnerState {
    this._state = applyEvent(this._state, event, this.estimator);
    return this._state;
  }

  /** Belief about a single KC (a fresh estimate if unseen). */
  estimate(kcId: KCId): KnowledgeEstimate {
    return this._state.knowledge[kcId] ?? freshEstimate(this.estimator);
  }
}

// A tiny id helper that works in browser and node without importing anything.
function cryptoRandomId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'learner-' + Math.random().toString(36).slice(2, 10);
}
