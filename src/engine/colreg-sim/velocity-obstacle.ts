/**
 * Velocity Obstacle (VO) analysis — the complementary, velocity-space view of the
 * collision-avoidance problem (Fiorini & Shiller 1998; Kuwata et al. 2014 for the
 * COLREGs-aware maritime variant).
 *
 * For the ownship O and a target T, the VO is the set of ownship velocities whose
 * relative velocity `vO − vT` points into the "collision cone" — the cone from O
 * that subtends a safety disk of radius Rs around T. Choosing an ownship velocity
 * OUTSIDE every target's VO guarantees the domains stay clear; biasing the choice
 * to starboard keeps it COLREG-consistent.
 *
 * The VO uses a circular safety radius Rs (a circular approximation of the
 * elliptical ship domain, which the objective/scoring uses in full). Directions
 * are compass bearings (atan2(East, North)) to match the heading convention.
 */
import type { SimScenario, Vessel } from './types';
import { wrapPi } from './kinematics';
import { domainRadii } from './ship-domain';

export interface Vec2 {
  vx: number;
  vy: number;
}

export interface CollisionCone {
  targetId: string;
  /** Cone apex in velocity space = the target's velocity. */
  apex: Vec2;
  /** Central bearing of the cone (from own toward target), rad compass. */
  axis: number;
  /** Half-angle of the cone, rad. */
  halfAngle: number;
  /** Current range to the target, m. */
  range: number;
  /** True if the target is already within Rs — the whole velocity space is a VO. */
  enveloping: boolean;
}

/** Velocity vector for a vessel (East, North), m/s. */
export function ownVelocity(v: Vessel): Vec2 {
  return { vx: v.v * Math.sin(v.psi), vy: v.v * Math.cos(v.psi) };
}

/**
 * Circular safety radius for the VO — the largest of the elliptical domain's
 * directional radii, so the circle *contains* the domain. That keeps the VO
 * consistent with the elliptical scoring: a velocity outside the (circular) VO
 * clears the disk, hence clears the ellipse too (VO-clear ⇒ no domain incursion).
 * A tighter average radius would let a VO-clear velocity still penetrate the
 * longer fore/starboard axes of the ellipse.
 */
export function safetyRadius(own: Vessel): number {
  const r = domainRadii(own);
  return Math.max(r.fore, r.aft, r.star, r.port);
}

/** The collision cone (VO) of `target` for `own`, using safety radius `Rs`. */
export function collisionCone(own: Vessel, target: Vessel, Rs: number): CollisionCone {
  const rx = target.x - own.x;
  const ry = target.y - own.y;
  const range = Math.hypot(rx, ry);
  const axis = Math.atan2(rx, ry); // compass bearing own → target
  if (range <= Rs) {
    return { targetId: target.id, apex: ownVelocity(target), axis, halfAngle: Math.PI, range, enveloping: true };
  }
  const halfAngle = Math.asin(Rs / range);
  return { targetId: target.id, apex: ownVelocity(target), axis, halfAngle, range, enveloping: false };
}

/** Is a given ownship velocity inside this collision cone (a collision course)? */
export function inCone(vel: Vec2, cone: CollisionCone): boolean {
  if (cone.enveloping) return true;
  const wx = vel.vx - cone.apex.vx;
  const wy = vel.vy - cone.apex.vy;
  if (Math.hypot(wx, wy) < 1e-6) return false; // matching target velocity → constant range
  const bearing = Math.atan2(wx, wy);
  return Math.abs(wrapPi(bearing - cone.axis)) <= cone.halfAngle;
}

/** All target collision cones for a scenario (Rs defaults to the ownship domain). */
export function velocityObstacles(scenario: SimScenario, Rs?: number): CollisionCone[] {
  const rs = Rs ?? safetyRadius(scenario.ownship);
  return scenario.targets.map((t) => collisionCone(scenario.ownship, t, rs));
}

export interface AvoidanceChoice {
  feasible: boolean;
  /** Heading offset from the ownship's initial heading, rad (starboard +). */
  headingOffset: number;
  /** Speed factor applied to the ownship's initial speed. */
  speedFactor: number;
  /** The chosen ownship velocity (East, North). */
  velocity: Vec2;
}

/**
 * Pick a COLREG-consistent VO-clear ownship velocity: the least course change
 * (starboard-biased) whose velocity lies outside every target cone. Searches a
 * discrete grid of heading offsets × speed factors — the velocity-space analogue
 * of the SB-MPC sweep. Returns feasible:false with the least-bad option if the
 * geometry is enveloping.
 */
export function chooseAvoidance(scenario: SimScenario, Rs?: number): AvoidanceChoice {
  const rs = Rs ?? safetyRadius(scenario.ownship);
  const cones = scenario.targets.map((t) => collisionCone(scenario.ownship, t, rs));
  const own = scenario.ownship;
  const psi0 = own.psi;
  const v0 = own.v;

  const offsetsDeg: number[] = [];
  for (let d = 0; d <= 90; d += 5) {
    offsetsDeg.push(d); // starboard first (bias)
    if (d !== 0) offsetsDeg.push(-d);
  }
  const speedFactors = [1.0, 0.75, 0.5];

  let best: AvoidanceChoice | null = null;
  let bestCost = Infinity;
  for (const offDeg of offsetsDeg) {
    const off = (offDeg * Math.PI) / 180;
    for (const f of speedFactors) {
      const psi = wrapPi(psi0 + off);
      const speed = v0 * f;
      const vel: Vec2 = { vx: speed * Math.sin(psi), vy: speed * Math.cos(psi) };
      if (cones.some((c) => inCone(vel, c))) continue;
      // Cost: course change + speed loss, with a small starboard preference.
      const cost = Math.abs(offDeg) + (offDeg < 0 ? 8 : 0) + (1 - f) * 40;
      if (cost < bestCost) {
        bestCost = cost;
        best = { feasible: true, headingOffset: off, speedFactor: f, velocity: vel };
      }
    }
  }

  if (best) return best;
  // Enveloping / no clear velocity — hold course as the least-bad default.
  return {
    feasible: false,
    headingOffset: 0,
    speedFactor: 1,
    velocity: ownVelocity(own),
  };
}
