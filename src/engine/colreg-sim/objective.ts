/**
 * Performance objective for a completed run.
 *
 * One hard barrier (ship-domain incursion — the only hard safety constraint) plus
 * three graded terms: the 2× ship-domain **margin objective** (a target to open
 * toward, NOT a pass/fail threshold), COLREG **compliance**, and route
 * **deviation** (the optimality proxy for time/fuel). The weights make the barrier
 * dominate absolutely and margin+compliance dominate deviation, but finitely — so
 * a slightly smaller margin can be traded for much less deviation when sea-room is
 * tight, which is the good-seamanship judgment being taught.
 */
import type { SimScenario, Trajectory } from './types';
import { M_TO_NM } from './types';
import { criMax } from './cri';
import { assessInstant, DEFAULT_DOMAIN, type DomainParams } from './ship-domain';
import { minRangeAllTargets } from './cpa';
import { scoreCompliance, type ComplianceReport } from './colreg-rules';

export interface ObjectiveWeights {
  margin: number;
  compliance: number;
  deviation: number;
}

export const DEFAULT_WEIGHTS: ObjectiveWeights = {
  margin: 1.0,
  compliance: 1.5,
  deviation: 0.5,
};

/** Target clearance factor for the margin objective (2× the ship domain). */
export const TARGET_CLEARANCE = 2.0;

export interface SimMetrics {
  /** Peak collision risk index over the run, [0, 1]. */
  criMax: number;
  /** Minimum ship-domain clearance factor over the run (1 = boundary, ≥2 = 2× margin). */
  minClearance: number;
  /** True if the ship domain was penetrated (the hard-safety floor was breached). */
  incursion: boolean;
  /** Graded shortfall against the 2× margin, [0, 1] (0 once minClearance ≥ 2). */
  marginShortfall: number;
  /** COLREG compliance penalty, [0, 1]. */
  compliancePenalty: number;
  /** Route deviation vs the direct route, fraction ≥ 0 (∝ extra time/fuel). */
  deviationPct: number;
  /** Own path length, NM. */
  pathLengthNm: number;
  /** Minimum realized range to any target, NM. */
  minRangeNm: number;
}

export interface ObjectiveResult {
  J: number;
  terms: { barrier: number; margin: number; compliance: number; deviation: number };
  metrics: SimMetrics;
  compliance: ComplianceReport;
}

function pathLength(traj: Trajectory): number {
  let d = 0;
  for (let i = 1; i < traj.length; i++) {
    d += Math.hypot(traj[i].own.x - traj[i - 1].own.x, traj[i].own.y - traj[i - 1].own.y);
  }
  return d;
}

/**
 * Progress made along the intended track (component of net displacement on the
 * intended heading). A pure course change reduces progress even though the path
 * length is unchanged, so this is what makes "minimum deviation" penalize turns.
 */
function progressAlongTrack(scenario: SimScenario, traj: Trajectory): number {
  const start = traj[0].own;
  const end = traj[traj.length - 1].own;
  const dirx = Math.sin(scenario.intendedHeading);
  const diry = Math.cos(scenario.intendedHeading);
  return (end.x - start.x) * dirx + (end.y - start.y) * diry;
}

export function evaluate(
  scenario: SimScenario,
  traj: Trajectory,
  weights: ObjectiveWeights = DEFAULT_WEIGHTS,
  domain: DomainParams = DEFAULT_DOMAIN,
): ObjectiveResult {
  // Worst-case domain clearance over the whole run.
  let minClearance = Infinity;
  for (const s of traj) {
    const a = assessInstant(s.own, s.targets, domain);
    if (a.minClearance < minClearance) minClearance = a.minClearance;
  }
  const incursion = minClearance < 1;
  const marginShortfall = Math.max(
    0,
    Math.min(1, (TARGET_CLEARANCE - minClearance) / (TARGET_CLEARANCE - 1)),
  );

  const compliance = scoreCompliance(scenario, traj);

  // Deviation = ground lost against the intended track (time/fuel proxy): a pure
  // turn keeps path length but loses progress, so this rewards the *smallest*
  // sufficient maneuver. Normalized by the nominal straight-run distance.
  const directDistance = scenario.ownship.v * scenario.horizonS;
  const path = pathLength(traj);
  const progress = progressAlongTrack(scenario, traj);
  const deviationPct = directDistance > 0 ? Math.max(0, (path - progress) / directDistance) : 0;

  const barrier = incursion ? 1000 + (1 - minClearance) * 1000 : 0;
  const terms = {
    barrier,
    margin: weights.margin * marginShortfall,
    compliance: weights.compliance * compliance.penalty,
    deviation: weights.deviation * deviationPct,
  };
  const J = terms.barrier + terms.margin + terms.compliance + terms.deviation;

  const metrics: SimMetrics = {
    criMax: criMax(traj),
    minClearance,
    incursion,
    marginShortfall,
    compliancePenalty: compliance.penalty,
    deviationPct,
    pathLengthNm: path * M_TO_NM,
    minRangeNm: minRangeAllTargets(traj) * M_TO_NM,
  };

  return { J, terms, metrics, compliance };
}
