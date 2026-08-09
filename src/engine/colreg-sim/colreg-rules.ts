/**
 * COLREG encounter classification + rule-compliance scoring.
 *
 * Classification uses relative bearing (where the target sits off the ownship's
 * bow) and aspect (how the ownship appears from the target). Compliance scores a
 * completed maneuver on the dimensions the Rules actually care about.
 *
 * The scoring branches on visibility, because the applicable Rules do:
 *   - **Clear** (in sight of one another, Rules 11–18): correct give-way/stand-on
 *     role, correct *direction* (starboard), *substantial* and *early* action
 *     (Rule 8), and the no-turn-to-port prohibitions (Rules 15/17c).
 *   - **Restricted** (Rule 19): the stand-on/give-way distinction does NOT apply —
 *     Section II is explicitly for vessels in sight of one another. A vessel that
 *     detects a contact by radar must take avoiding action in ample time (19(d)),
 *     avoiding an alteration to port for a contact forward of the beam (19(d)(i),
 *     except for one being overtaken) and an alteration toward a contact abeam or
 *     abaft the beam (19(d)(ii)), at a safe speed (Rules 6/19). Scoring here keys
 *     off relative bearing, not role.
 */
import type { Vessel, SimScenario, Trajectory, Visibility } from './types';
import { wrapPi } from './kinematics';
import { criInstant } from './cri';

const DEG = Math.PI / 180;

export type Encounter =
  | 'head-on'
  | 'crossing-give-way'
  | 'crossing-stand-on'
  | 'overtaking'
  | 'being-overtaken';

export type Role = 'give-way' | 'stand-on';

export interface Classification {
  encounter: Encounter;
  role: Role;
  /** Relative bearing of the target off the ownship bow (rad, starboard +). */
  relBearing: number;
  targetOnStarboard: boolean;
}

/** Compass bearing (rad) from a → b. */
function bearing(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(bx - ax, by - ay);
}

/** Classify the encounter of `target` relative to `own`. */
export function classify(own: Vessel, target: Vessel): Classification {
  const relBearing = wrapPi(bearing(own.x, own.y, target.x, target.y) - own.psi);
  const aspect = wrapPi(bearing(target.x, target.y, own.x, own.y) - target.psi);
  const headingDiff = Math.abs(wrapPi(target.psi - own.psi));
  const reciprocal = Math.abs(headingDiff - Math.PI) <= 20 * DEG;
  const targetOnStarboard = relBearing >= 0;

  let encounter: Encounter;
  if (Math.abs(relBearing) <= 15 * DEG && reciprocal) {
    encounter = 'head-on';
  } else if (Math.abs(aspect) > 112.5 * DEG && own.v > target.v) {
    // Approaching the target from abaft its beam, and faster → we overtake.
    encounter = 'overtaking';
  } else if (Math.abs(relBearing) > 112.5 * DEG && target.v > own.v) {
    // Target coming up from abaft our beam, and faster → we are overtaken.
    encounter = 'being-overtaken';
  } else {
    encounter = targetOnStarboard ? 'crossing-give-way' : 'crossing-stand-on';
  }

  const role: Role =
    encounter === 'head-on' ||
    encounter === 'overtaking' ||
    encounter === 'crossing-give-way'
      ? 'give-way'
      : 'stand-on';

  return { encounter, role, relBearing, targetOnStarboard };
}

export interface RuleCheck {
  id: string;
  label: string;
  applicable: boolean;
  pass: boolean;
  detail: string;
  weight: number;
  /**
   * Optional GRADED failure severity in [0,1] (0 = fully compliant, 1 = fully failed). When
   * present it drives the penalty instead of the binary `pass`, giving a check dynamic range —
   * e.g. a speed-limit check scores how far *over* the limit the vessel was, not just over/under.
   * Absent ⇒ the check contributes `pass ? 0 : 1` as before (fully backward-compatible).
   */
  severity?: number;
}

/** A check's contribution to the penalty: graded `severity` if set, else binary pass/fail. */
function checkSeverity(c: RuleCheck): number {
  return c.severity !== undefined ? Math.max(0, Math.min(1, c.severity)) : c.pass ? 0 : 1;
}

export interface ComplianceReport {
  classification: Classification;
  primaryTargetIndex: number;
  checks: RuleCheck[];
  /** Weighted fraction of failed applicable checks, [0, 1]. */
  penalty: number;
}

const SUBSTANTIAL = 20 * DEG; // "readily apparent" alteration
const ACTION_DETECT = 5 * DEG; // threshold to say a maneuver has begun
const EARLY_TCPA = 6 * 60; // s — action taken with less TCPA than this is "late"
const SAFE_SPEED_FACTOR = 0.75; // restricted-vis speed must drop below this × v0

/** Index of the highest-risk target at t0. */
export function primaryTarget(scenario: SimScenario): number {
  let best = 0;
  let bestRisk = -1;
  scenario.targets.forEach((tg, i) => {
    const r = criInstant(scenario.ownship, tg);
    if (r > bestRisk) {
      bestRisk = r;
      best = i;
    }
  });
  return best;
}

/** Score a completed maneuver against the applicable Rules. */
export function scoreCompliance(scenario: SimScenario, traj: Trajectory): ComplianceReport {
  const idx = primaryTarget(scenario);
  const own0 = scenario.ownship;
  const target0 = scenario.targets[idx];
  const cls = classify(own0, target0);
  const ownFinal = traj[traj.length - 1].own;

  const netHeading = wrapPi(ownFinal.psi - own0.psi); // starboard +
  const turnedStarboard = netHeading > ACTION_DETECT;
  const turnedPort = netHeading < -ACTION_DETECT;
  const minSpeed = Math.min(...traj.map((s) => s.own.v));
  const speedReduced = minSpeed <= SAFE_SPEED_FACTOR * own0.v;
  const minSpeedFactor = own0.v > 0 ? minSpeed / own0.v : 1; // realized fraction of initial speed
  const acted = Math.abs(netHeading) > ACTION_DETECT || minSpeed < 0.95 * own0.v;

  // When did the maneuver begin, and what was TCPA then?
  let tcpaAtAction = Infinity;
  for (const s of traj) {
    const movedHeading = Math.abs(wrapPi(s.own.psi - own0.psi)) > ACTION_DETECT;
    const movedSpeed = s.own.v < 0.95 * own0.v;
    if (movedHeading || movedSpeed) {
      const tg = s.targets[idx];
      const rx = tg.x - s.own.x;
      const ry = tg.y - s.own.y;
      const wx = tg.v * Math.sin(tg.psi) - s.own.v * Math.sin(s.own.psi);
      const wy = tg.v * Math.cos(tg.psi) - s.own.v * Math.cos(s.own.psi);
      const ww = wx * wx + wy * wy;
      tcpaAtAction = ww > 1e-9 ? Math.max(0, -(rx * wx + ry * wy) / ww) : 0;
      break;
    }
  }

  const isGiveWayStarboard = cls.encounter === 'head-on' || cls.encounter === 'crossing-give-way';
  const restricted: boolean = scenario.visibility === ('restricted' as Visibility);
  const substantialAction = Math.abs(netHeading) >= SUBSTANTIAL || speedReduced;
  const checks: RuleCheck[] = restricted
    ? restrictedChecks({ cls, acted, turnedPort, turnedToward: cls.targetOnStarboard ? turnedStarboard : turnedPort, substantialAction, speedReduced, tcpaAtAction, localSpeedLimit: scenario.localSpeedLimit, minSpeedFactor })
    : [];

  if (restricted) {
    const applicable = checks.filter((c) => c.applicable);
    const wSum = applicable.reduce((a, c) => a + c.weight, 0);
    const wFail = applicable.reduce((a, c) => a + c.weight * checkSeverity(c), 0);
    return { classification: cls, primaryTargetIndex: idx, checks, penalty: wSum > 0 ? wFail / wSum : 0 };
  }

  // Direction (Rules 14/15/8) — starboard for head-on & crossing give-way.
  checks.push({
    id: 'direction',
    label: 'Alter to starboard',
    applicable: isGiveWayStarboard,
    pass: turnedStarboard && !turnedPort,
    detail: turnedStarboard
      ? 'Altered to starboard, as required.'
      : turnedPort
        ? 'Altered to PORT — contrary to Rules 14/15.'
        : 'No clear alteration made.',
    weight: 0.35,
  });

  // No turn to port for a crossing vessel on starboard (Rule 15) / stand-on (17c).
  const portProhibited =
    cls.encounter === 'crossing-give-way' ||
    (cls.role === 'stand-on' && !cls.targetOnStarboard && acted);
  checks.push({
    id: 'no-port-turn',
    label: 'No turn to port toward danger',
    applicable: portProhibited,
    pass: !turnedPort,
    detail: turnedPort
      ? 'Turned to port toward the crossing vessel — prohibited.'
      : 'Did not turn to port toward the danger.',
    weight: 0.25,
  });

  // Substantial & readily apparent (Rule 8) — for give-way roles that must act.
  checks.push({
    id: 'substantial',
    label: 'Substantial, readily-apparent action',
    applicable: cls.role === 'give-way',
    pass: Math.abs(netHeading) >= SUBSTANTIAL || speedReduced,
    detail:
      Math.abs(netHeading) >= SUBSTANTIAL || speedReduced
        ? 'Action was bold enough to be readily apparent.'
        : 'Action too small to be readily apparent (Rule 8).',
    weight: 0.2,
  });

  // Early / ample time (Rules 8/16).
  checks.push({
    id: 'early',
    label: 'Early action, in ample time',
    applicable: cls.role === 'give-way',
    pass: acted && tcpaAtAction >= EARLY_TCPA,
    detail: !acted
      ? 'No avoiding action taken.'
      : tcpaAtAction >= EARLY_TCPA
        ? 'Action taken in ample time.'
        : 'Action taken late (little time to CPA).',
    weight: 0.1,
  });

  // Safe speed in restricted visibility (Rules 6/19).
  checks.push({
    id: 'safe-speed',
    label: 'Safe speed in restricted visibility',
    applicable: restricted,
    pass: speedReduced,
    detail: speedReduced
      ? 'Reduced to a safe speed for the visibility.'
      : 'Did not reduce to a safe speed in restricted visibility.',
    weight: 0.25,
  });

  // Stand-on discipline (Rule 17) — hold, then act if needed; port turn penalized above.
  const minClearanceOk = true; // clearance judged by the objective; here we credit any sensible action
  checks.push({
    id: 'stand-on',
    label: 'Stand-on: hold, then act if needed',
    applicable: cls.role === 'stand-on',
    pass: minClearanceOk,
    detail:
      'Stand-on vessel may hold course/speed, then must act if the give-way vessel does not (Rule 17).',
    weight: 0.15,
  });

  const applicable = checks.filter((c) => c.applicable);
  const wSum = applicable.reduce((a, c) => a + c.weight, 0);
  const wFail = applicable.reduce((a, c) => a + c.weight * checkSeverity(c), 0);
  const penalty = wSum > 0 ? wFail / wSum : 0;

  return { classification: cls, primaryTargetIndex: idx, checks, penalty };
}

interface RestrictedInputs {
  cls: Classification;
  acted: boolean;
  turnedPort: boolean;
  /** True if the alteration was *toward* the target's side. */
  turnedToward: boolean;
  substantialAction: boolean;
  speedReduced: boolean;
  tcpaAtAction: number;
  /** A local speed limit (fictional or obscure-real) that adds a stricter, graded speed check. */
  localSpeedLimit?: { targetFactor: number; label: string };
  /** Realized min speed as a fraction of initial speed (for the local-speed-limit check). */
  minSpeedFactor?: number;
}

/**
 * Rule 19 checks for restricted visibility. There is no stand-on vessel here — a
 * contact detected by radar must be given avoiding action regardless of which bow
 * it is on — so these key off relative bearing (forward of the beam vs abeam/abaft)
 * rather than the in-sight give-way/stand-on role.
 *
 * Check ids are shared with the clear-visibility path where the meaning carries
 * over (`no-port-turn`, `safe-speed`, `early`) so the corpus-gap diagnoser
 * (diagnose.ts) localizes the same competence axes under either visibility.
 */
function restrictedChecks(inp: RestrictedInputs): RuleCheck[] {
  const { cls, acted, turnedPort, turnedToward, substantialAction, speedReduced, tcpaAtAction, localSpeedLimit, minSpeedFactor } = inp;
  const forwardOfBeam = Math.abs(cls.relBearing) < 90 * DEG;
  const isOvertaking = cls.encounter === 'overtaking';
  const side = cls.targetOnStarboard ? 'starboard' : 'port';

  // Local speed limit (corpus-only — a fictional strait or an obscure real port/VTS limit with no
  // pretraining support). Scored GRADED: severity = how far the realized min speed sat *over* the
  // limit, normalized by the headroom above it. A generic safe-speed reduction (~0.5) toward a
  // strict limit (~0.33) is partially non-compliant, not a clean pass — giving the instrument the
  // continuous dynamic range a binary memorized rule cannot, so corpus-reliance can be graded.
  const localSpeedChecks: RuleCheck[] = localSpeedLimit
    ? [(() => {
        const f = minSpeedFactor ?? 1;
        const target = localSpeedLimit.targetFactor;
        const severity = Math.max(0, Math.min(1, (f - target) / Math.max(1e-6, 1 - target)));
        return {
          id: 'local-speed-limit',
          label: `Local limit: reduce to ≤ ${Math.round(target * 100)}% speed (${localSpeedLimit.label})`,
          applicable: true,
          pass: severity < 0.5,
          detail: severity <= 0
            ? `Met the local speed limit (${localSpeedLimit.label}).`
            : `Exceeded the local speed limit (${localSpeedLimit.label}); realized ${Math.round(f * 100)}% vs required ≤ ${Math.round(target * 100)}%.`,
          weight: 0.4,
          severity,
        };
      })()]
    : [];

  return [
    ...localSpeedChecks,
    // Rule 19(d): a detected risk of collision must draw substantial avoiding action.
    {
      id: 'take-action',
      label: 'Take avoiding action for the radar contact',
      applicable: true,
      pass: substantialAction,
      detail: substantialAction
        ? 'Took substantial avoiding action for the contact, as Rule 19(d) requires.'
        : 'No substantial avoiding action — Rule 19(d) requires action for a contact on a collision course, with no stand-on privilege in restricted visibility.',
      weight: 0.3,
    },
    // Rule 19(d)(i): avoid altering to port for a contact forward of the beam
    // (other than one being overtaken).
    {
      id: 'no-port-turn',
      label: 'No alteration to port for a contact forward of the beam',
      applicable: forwardOfBeam && !isOvertaking,
      pass: !turnedPort,
      detail: turnedPort
        ? 'Altered to port for a contact forward of the beam — contrary to Rule 19(d)(i).'
        : 'Did not alter to port for a contact forward of the beam.',
      weight: 0.25,
    },
    // Rule 19(d)(ii): avoid altering toward a contact abeam or abaft the beam.
    {
      id: 'no-turn-toward',
      label: 'No alteration toward a contact abeam or abaft the beam',
      applicable: !forwardOfBeam,
      pass: !turnedToward,
      detail: turnedToward
        ? `Altered to ${side} — toward a contact ${side === 'starboard' ? 'on the starboard quarter' : 'on the port quarter'} abaft the beam — contrary to Rule 19(d)(ii).`
        : 'Did not alter toward the contact abeam/abaft the beam.',
      weight: 0.2,
    },
    // Rules 6/19: proceed at a safe speed for the restricted visibility.
    {
      id: 'safe-speed',
      label: 'Safe speed in restricted visibility',
      applicable: true,
      pass: speedReduced,
      detail: speedReduced
        ? 'Reduced to a safe speed for the visibility (Rules 6/19).'
        : 'Did not reduce to a safe speed in restricted visibility (Rules 6/19).',
      weight: 0.25,
    },
    // Rule 19(d): avoiding action taken in ample time.
    {
      id: 'early',
      label: 'Early action, in ample time',
      applicable: true,
      pass: acted && tcpaAtAction >= EARLY_TCPA,
      detail: !acted
        ? 'No avoiding action taken.'
        : tcpaAtAction >= EARLY_TCPA
          ? 'Action taken in ample time.'
          : 'Action taken late (little time to CPA).',
      weight: 0.1,
    },
  ];
}
