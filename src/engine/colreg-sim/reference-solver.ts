/**
 * Reference solver — a scenario-based / branching-course MPC (SB-MPC) style search
 * for the compliant, minimum-deviation maneuver, used as the "optimal" a learner
 * is graded against. It enumerates a finite set of control behaviors (course
 * offsets × speed factors × action times), simulates each on the same kinematics,
 * scores each with the same objective, and returns the least-cost domain-clearing
 * candidate. This mirrors the SB-MPC family (Johansen et al. 2016; Eriksen &
 * Breivik, "Branching-Course MPC", 2019) at a tractable, explainable scale.
 *
 * If no candidate clears the ship domain (a true in-extremis geometry) it returns
 * the candidate with the largest minimum clearance, flagged, rather than failing.
 */
import type { SimScenario, Trajectory, Maneuver } from './types';
import { integrate, maneuverControl } from './kinematics';
import { evaluate, type ObjectiveResult, type ObjectiveWeights, DEFAULT_WEIGHTS } from './objective';
import { chooseAvoidance } from './velocity-obstacle';

const DEG = Math.PI / 180;

export interface SolverGridPoint {
  maneuver: Maneuver;
  result: ObjectiveResult;
}

export interface ReferenceSolution {
  best: SolverGridPoint;
  trajectory: Trajectory;
  /** True if no candidate could clear the domain; `best` is the least-bad option. */
  inExtremis: boolean;
  /** All evaluated candidates (for visualization / debrief). */
  grid: SolverGridPoint[];
}

export interface SolverOptions {
  courseOffsetsDeg?: number[];
  speedFactors?: number[];
  actTimesS?: number[];
  weights?: ObjectiveWeights;
}

const DEFAULT_OPTIONS: Required<SolverOptions> = {
  // Bias toward starboard (Rules 8/14/15): more resolution on the starboard side.
  courseOffsetsDeg: [-45, -30, -15, 0, 15, 30, 45, 60, 75, 90],
  speedFactors: [1.0, 0.75, 0.5],
  actTimesS: [0],
  weights: DEFAULT_WEIGHTS,
};

export function solveReference(
  scenario: SimScenario,
  options: SolverOptions = {},
): ReferenceSolution {
  const opt = { ...DEFAULT_OPTIONS, ...options };
  const grid: SolverGridPoint[] = [];

  for (const offDeg of opt.courseOffsetsDeg) {
    for (const factor of opt.speedFactors) {
      for (const actTime of opt.actTimesS) {
        const maneuver: Maneuver = { courseOffset: offDeg * DEG, speedFactor: factor, actTime };
        const traj = integrate(scenario, maneuverControl(scenario.ownship, maneuver));
        const result = evaluate(scenario, traj, opt.weights);
        grid.push({ maneuver, result });
      }
    }
  }

  const feasible = grid.filter((g) => !g.result.metrics.incursion);
  let best: SolverGridPoint;
  let inExtremis = false;
  if (feasible.length > 0) {
    best = feasible.reduce((a, b) => (b.result.J < a.result.J ? b : a));
  } else {
    inExtremis = true;
    best = grid.reduce((a, b) =>
      b.result.metrics.minClearance > a.result.metrics.minClearance ? b : a,
    );
  }

  const trajectory = integrate(scenario, maneuverControl(scenario.ownship, best.maneuver));
  return { best, trajectory, inExtremis, grid };
}

/**
 * Velocity-obstacle reference — picks the least-course-change, starboard-biased
 * ownship velocity that lies outside every target's collision cone
 * (`chooseAvoidance`), then evaluates it with the same objective. A geometric,
 * analytic alternative to the SB-MPC sweep above; both are offered as the
 * "optimal" a learner is graded against.
 */
export function solveReferenceVO(
  scenario: SimScenario,
  options: Pick<SolverOptions, 'weights'> = {},
): ReferenceSolution {
  const choice = chooseAvoidance(scenario);
  const maneuver: Maneuver = {
    courseOffset: choice.headingOffset,
    speedFactor: choice.speedFactor,
    actTime: 0,
  };
  const trajectory = integrate(scenario, maneuverControl(scenario.ownship, maneuver));
  const result = evaluate(scenario, trajectory, options.weights ?? DEFAULT_WEIGHTS);
  const best: SolverGridPoint = { maneuver, result };
  return { best, trajectory, inExtremis: !choice.feasible, grid: [best] };
}
