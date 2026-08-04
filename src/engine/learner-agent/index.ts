/**
 * Generic learner agent — public surface.
 *
 * A domain-agnostic learner model: KC-indexed mastery estimates updated from an
 * event log by a pluggable estimator, plus the policies that consume that state.
 * Generalizes src/engine/learner-model/ (AJP-specific) to any domain.
 *
 * Quick start:
 *
 *   import { LearnerAgent, eloEstimator } from '@/engine/learner-agent';
 *   const domain = { id: 'colreg', kcs: [{ id: 'starboard' }, { id: 'safeSpeed' }] };
 *   const agent = new LearnerAgent(domain, eloEstimator());
 *   agent.observe({ timestamp: 1, kcIds: ['starboard'], itemId: 'p1',
 *                   outcome: 0.9, kind: 'probe', source: 'human' });
 *   agent.estimate('starboard').mastery; // → rises toward 1
 *
 * See docs/learner-agent-design.md.
 */
export type {
  KCId,
  KnowledgeComponent,
  DomainModel,
  KnowledgeEstimate,
  EvidenceEvent,
  LearnerState,
  EstimatorStepContext,
  MasteryEstimator,
} from './types';

export {
  heuristicEstimator,
  bktEstimator,
  eloEstimator,
  defaultEstimator,
  DEFAULT_BKT,
  type HeuristicOptions,
  type BktParams,
  type EloOptions,
} from './estimators';

export {
  LearnerAgent,
  applyEvent,
  replay,
  createLearnerState,
  levelFromMastery,
  DEFAULT_MASTERY_THRESHOLD,
  DEFAULT_SAFETY_THRESHOLD,
  DEFAULT_CONFIDENCE_THRESHOLD,
} from './agent';

export {
  masteryGate,
  isMastered,
  prerequisitesMet,
  thresholdFor,
  frontier,
  selectNextKC,
  summarize,
  type GateResult,
  type MasterySummary,
} from './policy';

export {
  mulberry32,
  simulateIrt,
  simulateBkt,
  calibration,
  runEstimator,
  type IrtResponse,
  type BktGenParams,
  type BktSample,
  type ReliabilityBin,
  type CalibrationResult,
  type RunResult,
} from './validation';
