/**
 * Benchmark runner — evaluates an avoidance *policy* across a set of scenarios and
 * aggregates the scoring-instrument metrics. This is the executable core of the
 * validation story (docs/colreg-validation.md): before any learning study means
 * anything, the environment + metric must separate a good policy from a bad one.
 * Running hold-course (naive) vs VO / SB-MPC (expert) across the Imazu set and
 * showing a clean separation is the instrument's construct-validity check.
 */
import type { SimScenario, Maneuver } from './types';
import { integrate, maneuverControl } from './kinematics';
import { evaluate, type ObjectiveResult } from './objective';
import { solveReference } from './reference-solver';
import { chooseAvoidance } from './velocity-obstacle';

/** A policy maps a scenario to the single maneuver it would commit. */
export type Policy = (scenario: SimScenario) => Maneuver;

/** An async policy — e.g. an LLM learner that must await a completion. */
export type AsyncPolicy = (scenario: SimScenario) => Promise<Maneuver>;

/** Naive baseline: hold course and speed. */
export const holdCoursePolicy: Policy = () => ({ courseOffset: 0, speedFactor: 1, actTime: 0 });

/** Expert: the SB-MPC reference maneuver. */
export const mpcPolicy: Policy = (s) => solveReference(s).best.maneuver;

/** Expert: the velocity-obstacle avoidance maneuver. */
export const voPolicy: Policy = (s) => {
  const c = chooseAvoidance(s);
  return { courseOffset: c.headingOffset, speedFactor: c.speedFactor, actTime: 0 };
};

/** Evaluate a fixed maneuver on a scenario. */
export function evaluateManeuver(scenario: SimScenario, maneuver: Maneuver): ObjectiveResult {
  return evaluate(scenario, integrate(scenario, maneuverControl(scenario.ownship, maneuver)));
}

/** Run one scenario under a policy and return the full objective result. */
export function runCase(scenario: SimScenario, policy: Policy): ObjectiveResult {
  return evaluateManeuver(scenario, policy(scenario));
}

export interface BenchmarkResult {
  n: number;
  /** Fraction of cases that kept every ship domain clear (no incursion). */
  clearedRate: number;
  /** Mean objective J (lower is better). */
  meanJ: number;
  /** Mean COLREG compliance penalty, [0, 1] (lower is better). */
  meanCompliancePenalty: number;
  /** Mean route deviation, fraction. */
  meanDeviationPct: number;
  /** Mean peak collision-risk index. */
  meanCriMax: number;
  /** Per-case objective results (same order as the input scenarios). */
  perCase: ObjectiveResult[];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function aggregate(perCase: ObjectiveResult[]): BenchmarkResult {
  return {
    n: perCase.length,
    clearedRate: perCase.filter((r) => !r.metrics.incursion).length / (perCase.length || 1),
    meanJ: mean(perCase.map((r) => r.J)),
    meanCompliancePenalty: mean(perCase.map((r) => r.metrics.compliancePenalty)),
    meanDeviationPct: mean(perCase.map((r) => r.metrics.deviationPct)),
    meanCriMax: mean(perCase.map((r) => r.metrics.criMax)),
    perCase,
  };
}

/** Evaluate a policy across a benchmark set and aggregate the metrics. */
export function runBenchmark(scenarios: SimScenario[], policy: Policy): BenchmarkResult {
  return aggregate(scenarios.map((s) => runCase(s, policy)));
}

/** Async variant — awaits each maneuver in sequence (e.g. an LLM learner). */
export async function runBenchmarkAsync(scenarios: SimScenario[], policy: AsyncPolicy): Promise<BenchmarkResult> {
  const perCase: ObjectiveResult[] = [];
  for (const s of scenarios) perCase.push(evaluateManeuver(s, await policy(s)));
  return aggregate(perCase);
}
