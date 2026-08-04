/**
 * Tier-2 validation harness — a competence-parameterized COLREG learner.
 *
 * This is a deterministic, mechanistic *model* of a learner (NOT an LLM and NOT a
 * human): a policy whose maneuver quality is governed by a small competence vector
 * θ. Each knowledge component maps to one dimension of good seamanship, so
 * ablating it degrades exactly the simulator metric that dimension governs —
 * turning "does the training add value?" into a measurable knowledge → behavior →
 * score chain. See docs/colreg-validation.md §2–3.
 *
 * A fully-competent learner behaves like the compliant (starboard-only) reference;
 * removing a component perturbs that ideal along one axis:
 *   role       — whether the learner acts at all
 *   starboard  — direction of the alteration (else it turns to port, a violation)
 *   substantial— magnitude (else a small, not-readily-apparent alteration)
 *   early      — timing (else it acts late)
 *   safeSpeed  — reduces speed in restricted visibility (else holds speed)
 *   multiShip  — accounts for all targets (else only the nearest, may hit others)
 */
import type { SimScenario, Maneuver } from './types';
import { integrate, maneuverControl } from './kinematics';
import { evaluate } from './objective';
import { primaryTarget } from './colreg-rules';
import type { Policy } from './benchmark';

const DEG = Math.PI / 180;

export interface Competence {
  role: boolean;
  starboard: boolean;
  substantial: boolean;
  early: boolean;
  safeSpeed: boolean;
  multiShip: boolean;
}

/** Knowledge components in the order the paradigm teaches them. */
export const CURRICULUM: (keyof Competence)[] = [
  'role', 'starboard', 'substantial', 'early', 'safeSpeed', 'multiShip',
];

export const NO_COMPETENCE: Competence = {
  role: false, starboard: false, substantial: false, early: false, safeSpeed: false, multiShip: false,
};
export const FULL_COMPETENCE: Competence = {
  role: true, starboard: true, substantial: true, early: true, safeSpeed: true, multiShip: true,
};

/** Competence with the first `stage` curriculum components acquired. */
export function competenceAtStage(stage: number): Competence {
  const c = { ...NO_COMPETENCE };
  for (let i = 0; i < stage && i < CURRICULUM.length; i++) c[CURRICULUM[i]] = true;
  return c;
}

/** A copy of `c` with one component removed. */
export function ablate(c: Competence, flag: keyof Competence): Competence {
  return { ...c, [flag]: false };
}

const OFFSETS_DEG = [0, 15, 30, 45, 60, 75];
const FACTORS = [1, 0.75, 0.5];

/** The best compliant (starboard-only) maneuver for a scoring scenario. */
function idealCompliant(scoring: SimScenario): { offsetDeg: number; factor: number } {
  let best = { offsetDeg: 0, factor: 1 };
  let bestJ = Infinity;
  for (const offsetDeg of OFFSETS_DEG) {
    for (const factor of FACTORS) {
      const m: Maneuver = { courseOffset: offsetDeg * DEG, speedFactor: factor, actTime: 0 };
      const r = evaluate(scoring, integrate(scoring, maneuverControl(scoring.ownship, m)));
      if (r.J < bestJ) { bestJ = r.J; best = { offsetDeg, factor }; }
    }
  }
  return best;
}

/** Build the avoidance policy for a given competence vector. */
export function learnerPolicy(theta: Competence): Policy {
  return (scenario: SimScenario): Maneuver => {
    if (!theta.role) return { courseOffset: 0, speedFactor: 1, actTime: 0 };

    // A learner blind to other ships scores its choice on the nearest target only.
    const idx = primaryTarget(scenario);
    const scoring = theta.multiShip
      ? scenario
      : { ...scenario, targets: [scenario.targets[idx]] };

    let { offsetDeg, factor } = idealCompliant(scoring);
    if (!theta.substantial) {
      // Timid: a small, not-readily-apparent course change and no bold speed cut.
      offsetDeg = Math.sign(offsetDeg) * Math.min(Math.abs(offsetDeg), 10);
      factor = Math.max(factor, 0.9);
    }
    if (!theta.starboard) offsetDeg = -offsetDeg; // turns the wrong way
    // Safe speed governs restricted visibility specifically.
    if (scenario.visibility === 'restricted') factor = theta.safeSpeed ? Math.min(factor, 0.6) : 1;
    const actTime = theta.early ? 0 : scenario.horizonS * 0.5;

    return { courseOffset: offsetDeg * DEG, speedFactor: factor, actTime };
  };
}
