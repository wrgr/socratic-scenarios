/**
 * Shared geometry helpers for the COLREG benchmark sets — the ownship template and
 * the target constructors that place a vessel on an exact collision course. Used by
 * both the clear-visibility Imazu set (imazu.ts) and the restricted-visibility set
 * (restricted.ts) so the collision-course math lives in exactly one place.
 *
 * Internal state is SI with a compass heading convention (psi = 0 is North,
 * increasing clockwise); see engine/colreg-sim/types.ts.
 */
import type { SimScenario, Vessel } from '../../engine/colreg-sim';
import { KNOTS_TO_MS } from '../../engine/colreg-sim';

export const DEG = Math.PI / 180;
export const kn = (k: number) => k * KNOTS_TO_MS;
export const OWN_KN = 12;

export function ownship(): Vessel {
  return {
    id: 'own', label: 'Ownship', x: 0, y: 0, psi: 0, v: kn(OWN_KN), lengthM: 100,
    turnRadiusMin: 500, accelMax: 0.08, headingTau: 25, vMin: kn(3), vMax: kn(20),
  };
}

/**
 * A target placed at (bearing, range) off the ownship's bow, on an exact
 * collision course: its velocity is chosen so the relative velocity points
 * straight from the target to the ownship (DCPA = 0). The target speed is bumped
 * up if needed so a collision course exists from that bearing. Bearing is
 * signed (starboard +, port −), so the same helper builds port- and
 * starboard-side encounters.
 */
export function collisionTarget(id: string, bearingDeg: number, rangeM: number, speedKn: number): Vessel {
  const b = bearingDeg * DEG;
  const rhx = Math.sin(b), rhy = Math.cos(b);
  const ownV = kn(OWN_KN);
  // Need target speed >= ownV·|sin b| for a collision course to exist.
  const vTgt = Math.max(kn(speedKn), ownV * Math.abs(Math.sin(b)) * 1.05);
  const dot = ownV * rhy; // vO · rhat, with vO = (0, ownV)
  const disc = Math.max(0, dot * dot - (ownV * ownV - vTgt * vTgt));
  const s = dot + Math.sqrt(disc);
  const vx = 0 - s * rhx;
  const vy = ownV - s * rhy;
  return {
    id, label: id, x: rhx * rangeM, y: rhy * rangeM,
    psi: Math.atan2(vx, vy), v: Math.hypot(vx, vy), lengthM: 100,
  };
}

/** A slower vessel ahead on the same course — the ownship overtakes it (Rule 13). */
export function leadTarget(id: string, x: number, rangeM: number, speedKn: number): Vessel {
  return { id, label: id, x, y: rangeM, psi: 0, v: kn(speedKn), lengthM: 100 };
}

/** A faster vessel astern on the same course — it overtakes the ownship. */
export function asternTarget(id: string, rangeM: number, speedKn: number): Vessel {
  return { id, label: id, x: 0, y: -rangeM, psi: 0, v: kn(speedKn), lengthM: 100 };
}

type Diff = SimScenario['difficulty'];

/** Assemble a benchmark scenario with the shared ownship and a 20-min horizon. */
export function makeScenario(
  id: string,
  label: string,
  difficulty: Diff,
  targets: Vessel[],
  visibility: SimScenario['visibility'] = 'clear',
): SimScenario {
  return { id, label, description: label, difficulty, ownship: ownship(), targets, visibility, horizonS: 1200, dt: 4, intendedHeading: 0 };
}
