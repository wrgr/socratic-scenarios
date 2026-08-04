/**
 * Procedure policies — the expert, a reckless baseline, and a competence-
 * parameterized learner whose knowledge vector θ maps one-to-one onto the four
 * metrics (mirroring COLREG's learner-policy.ts).
 *
 *   coreSteps  — performs the core steps            → coreCompleteness
 *   finishing  — performs the finishing steps       → finishCompleteness
 *   safety     — performs + places the safety steps → safetyScore
 *   sequencing — performs steps in the right order  → orderScore
 *
 * Degradations are constructed to stay isolated: dropping a bucket lowers only that
 * bucket's completeness (a skipped step is not an ordering error), and the
 * sequencing degradation swaps a single NON-safety constrained pair, so it never
 * disturbs safety placement.
 */
import type { Attempt, ProcedureCompetence, ProcedureSpec } from './types';

export const FULL_COMPETENCE: ProcedureCompetence = {
  coreSteps: true,
  finishing: true,
  sequencing: true,
  safety: true,
};
export const NO_COMPETENCE: ProcedureCompetence = {
  coreSteps: false,
  finishing: false,
  sequencing: false,
  safety: false,
};

/** Knowledge components in the order the paradigm teaches them (safety first). */
export const PROC_CURRICULUM: (keyof ProcedureCompetence)[] = [
  'safety',
  'coreSteps',
  'sequencing',
  'finishing',
];

export function competenceAtStage(stage: number): ProcedureCompetence {
  const c = { ...NO_COMPETENCE };
  for (let i = 0; i < stage && i < PROC_CURRICULUM.length; i++) c[PROC_CURRICULUM[i]] = true;
  return c;
}

export function ablate(
  c: ProcedureCompetence,
  flag: keyof ProcedureCompetence,
): ProcedureCompetence {
  return { ...c, [flag]: false };
}

/** The canonical, fully-correct attempt. */
export function expertAttempt(spec: ProcedureSpec): Attempt {
  return { order: spec.steps.map((s) => s.id) };
}

/** Build the attempt a learner with competence θ would produce. */
export function learnerAttempt(spec: ProcedureSpec, theta: ProcedureCompetence): Attempt {
  const include = (bucket: string) =>
    bucket === 'safety' ? theta.safety : bucket === 'finish' ? theta.finishing : theta.coreSteps;

  // Start from canonical order, keeping only the steps the learner knows to perform.
  const order = spec.steps.filter((s) => include(s.bucket)).map((s) => s.id);

  if (!theta.sequencing) {
    // Break exactly one non-safety ordering constraint: swap the first such pair whose
    // endpoints are both present. Leaves safety placement untouched.
    const bucketOf = new Map(spec.steps.map((s) => [s.id, s.bucket]));
    const present = new Set(order);
    for (const step of spec.steps) {
      const dep = step.id;
      for (const pre of step.after ?? []) {
        if (bucketOf.get(pre) === 'safety') continue; // don't disturb safety
        if (present.has(pre) && present.has(dep)) {
          const i = order.indexOf(pre);
          const j = order.indexOf(dep);
          [order[i], order[j]] = [order[j], order[i]];
          return { order };
        }
      }
    }
  }
  return { order };
}

/** A learner who does the mechanical job but skips safety — the compelling baseline. */
export function recklessAttempt(spec: ProcedureSpec): Attempt {
  return learnerAttempt(spec, { coreSteps: true, finishing: true, sequencing: true, safety: false });
}
