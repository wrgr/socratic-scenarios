/**
 * Scoring instrument for a procedural attempt.
 *
 * Four metrics, each isolated to one knowledge component so that ablating a
 * competence degrades exactly one metric (the identifiability property the paper's
 * measurement claim rests on):
 *   - coreCompleteness / finishCompleteness — did they perform the core / finishing steps?
 *   - safetyScore     — safety steps performed AND placed before the step they guard.
 *   - orderScore      — non-safety ordering constraints respected (among performed steps).
 *
 * Omissions are counted ONLY in the completeness metrics; ordering metrics judge the
 * relative order of the steps that WERE performed (a skipped step is not also an
 * ordering error), which is what keeps the metrics independent.
 */
import type { Attempt, ProcedureSpec, ProcMetrics, ProcResult, Step } from './types';

const frac = (num: number, den: number) => (den === 0 ? 1 : num / den);

interface Constraint {
  before: string;
  after: string;
  safety: boolean;
}

function constraints(spec: ProcedureSpec): Constraint[] {
  const bucket = new Map(spec.steps.map((s) => [s.id, s.bucket]));
  const out: Constraint[] = [];
  for (const step of spec.steps) {
    for (const pre of step.after ?? []) {
      out.push({ before: pre, after: step.id, safety: bucket.get(pre) === 'safety' });
    }
  }
  return out;
}

export function scoreAttempt(spec: ProcedureSpec, attempt: Attempt): ProcResult {
  const pos = new Map<string, number>();
  attempt.order.forEach((id, i) => pos.set(id, i));
  const performed = (id: string) => pos.has(id);
  const byBucket = (b: Step['bucket']) => spec.steps.filter((s) => s.bucket === b);

  const core = byBucket('core');
  const finish = byBucket('finish');
  const safety = byBucket('safety');
  const cons = constraints(spec);

  const coreCompleteness = frac(core.filter((s) => performed(s.id)).length, core.length);
  const finishCompleteness = frac(finish.filter((s) => performed(s.id)).length, finish.length);

  // Safety: each safety step must be performed AND precede every performed step it guards.
  let safeOk = 0;
  for (const s of safety) {
    if (!performed(s.id)) continue;
    const guards = cons.filter((c) => c.before === s.id && performed(c.after));
    const placedRight = guards.every((c) => (pos.get(s.id) as number) < (pos.get(c.after) as number));
    if (placedRight) safeOk += 1;
  }
  const safetyScore = frac(safeOk, safety.length);
  const safetyViolation = safetyScore < 1;

  // Order: non-safety constraints, judged only when BOTH endpoints were performed.
  const nonSafety = cons.filter((c) => !c.safety);
  const considered = nonSafety.filter((c) => performed(c.before) && performed(c.after));
  const respected = considered.filter((c) => (pos.get(c.before) as number) < (pos.get(c.after) as number));
  const orderScore = frac(respected.length, considered.length);

  const metrics: ProcMetrics = { coreCompleteness, finishCompleteness, safetyScore, orderScore };

  // Objective: a safety violation is the hard barrier (as ship-domain incursion is in
  // COLREG); the rest are graded, weighted core > order > finish.
  const barrier = safetyViolation ? 100 + (1 - safetyScore) * 100 : 0;
  const graded = 3 * (1 - coreCompleteness) + 2 * (1 - orderScore) + 1 * (1 - finishCompleteness);
  const J = barrier + graded;

  return { metrics, safetyViolation, J };
}
