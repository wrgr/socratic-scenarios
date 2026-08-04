/** Procedure simulator — a discrete procedural task instrument. Public surface. */
export type {
  KCId,
  StepBucket,
  Step,
  ProcedureSpec,
  Attempt,
  ProcMetrics,
  ProcResult,
  ProcedureCompetence,
} from './types';
export { scoreAttempt } from './score';
export {
  FULL_COMPETENCE,
  NO_COMPETENCE,
  PROC_CURRICULUM,
  competenceAtStage,
  ablate,
  expertAttempt,
  learnerAttempt,
  recklessAttempt,
} from './policy';
