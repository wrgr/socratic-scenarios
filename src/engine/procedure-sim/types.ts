/**
 * Procedure simulator — a SECOND objective task instrument, for discrete procedural
 * domains, alongside the continuous-control COLREG simulator (engine/colreg-sim/).
 *
 * The point is the *method*, not the domain: it demonstrates that the same
 * measurement pattern — an objective instrument with **knowledge-component → single-
 * metric identifiability**, validated by naive-vs-expert construct validity — carries
 * from a continuous-control task to a discrete, ordered procedure. This directly
 * addresses the "single instrument / single domain" novelty risk in
 * docs/novelty-and-positioning.md.
 *
 * A learner's behavior is an ORDERED list of the steps they performed. The instrument
 * scores that sequence against a canonical procedure with safety-ordering constraints
 * and emits four independent metrics, each governed by one knowledge component.
 */
export type KCId = string;

/** Which metric bucket a step contributes to (also which competence governs it). */
export type StepBucket = 'safety' | 'core' | 'finish';

export interface Step {
  id: string;
  label: string;
  bucket: StepBucket;
  /**
   * Step ids that must be completed BEFORE this step. A constraint whose predecessor
   * is a `safety` step is a *safety-placement* constraint (feeds safetyScore);
   * otherwise it is a *sequencing* constraint (feeds orderScore).
   */
  after?: string[];
}

export interface ProcedureSpec {
  id: string;
  label: string;
  /** Steps in canonical (correct) order. */
  steps: Step[];
}

/** A learner's attempt: the ordered ids of the steps they performed. */
export interface Attempt {
  order: string[];
}

/** Four independent metrics — each governed by exactly one knowledge component. */
export interface ProcMetrics {
  /** Fraction of core steps performed (governed by `coreSteps`). */
  coreCompleteness: number;
  /** Fraction of finishing steps performed (governed by `finishing`). */
  finishCompleteness: number;
  /** Fraction of safety steps performed AND correctly placed (governed by `safety`). */
  safetyScore: number;
  /** Fraction of non-safety ordering constraints respected (governed by `sequencing`). */
  orderScore: number;
}

export interface ProcResult {
  metrics: ProcMetrics;
  /** Hard failure: any safety step omitted or placed after the step it guards. */
  safetyViolation: boolean;
  /** Objective cost, lower is better; 0 for the canonical procedure. */
  J: number;
}

/** Competence vector — each flag governs one metric (the identifiability property). */
export interface ProcedureCompetence {
  /** Performs the core mechanical steps. → coreCompleteness */
  coreSteps: boolean;
  /** Performs the finishing steps (torque, stow). → finishCompleteness */
  finishing: boolean;
  /** Performs the steps in the correct order. → orderScore */
  sequencing: boolean;
  /** Performs and correctly places the safety steps. → safetyScore */
  safety: boolean;
}
