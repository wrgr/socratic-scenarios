/**
 * Kinematic integration for the COLREG simulator.
 *
 * Ownship follows a first-order (Nomoto-style) course response toward a commanded
 * heading, rate-limited by `turnRateMax = v / turnRadiusMin` (so a faster ship
 * turns in a wider circle), and a rate-limited surge toward a commanded speed.
 * Targets advance on constant course/speed. Fixed-step forward Euler at a small
 * dt is plenty for a Rules trainer.
 */
import type { Vessel, Command, SimScenario, Trajectory, Maneuver } from './types';

/** Wrap an angle to (-π, π]. */
export function wrapPi(a: number): number {
  let x = a % (2 * Math.PI);
  if (x <= -Math.PI) x += 2 * Math.PI;
  if (x > Math.PI) x -= 2 * Math.PI;
  return x;
}

/** Velocity vector (East, North) for a vessel, m/s. */
export function velocity(v: Vessel): { vx: number; vy: number } {
  return { vx: v.v * Math.sin(v.psi), vy: v.v * Math.cos(v.psi) };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Max turn rate (rad/s) at the vessel's current speed, from its min turn radius. */
export function maxTurnRate(v: Vessel): number {
  const r = v.turnRadiusMin && v.turnRadiusMin > 0 ? v.turnRadiusMin : Infinity;
  return r === Infinity ? Infinity : v.v / r;
}

/** Advance the ownship one step under a held command. Pure — returns a new Vessel. */
export function stepOwnship(v: Vessel, cmd: Command, dt: number): Vessel {
  const tau = v.headingTau && v.headingTau > 0 ? v.headingTau : 20;
  // First-order desired turn rate toward the commanded heading, rate-limited.
  const headingErr = wrapPi(cmd.headingCmd - v.psi);
  const desiredRate = headingErr / tau;
  const rMax = maxTurnRate(v);
  const rate = Number.isFinite(rMax) ? clamp(desiredRate, -rMax, rMax) : desiredRate;
  const psi = wrapPi(v.psi + rate * dt);

  // Rate-limited surge toward commanded speed.
  const accelMax = v.accelMax && v.accelMax > 0 ? v.accelMax : Infinity;
  const dvWanted = cmd.speedCmd - v.v;
  const dv = Number.isFinite(accelMax)
    ? clamp(dvWanted, -accelMax * dt, accelMax * dt)
    : dvWanted;
  let speed = v.v + dv;
  if (v.vMin !== undefined) speed = Math.max(v.vMin, speed);
  if (v.vMax !== undefined) speed = Math.min(v.vMax, speed);

  return {
    ...v,
    psi,
    v: speed,
    x: v.x + speed * Math.sin(psi) * dt,
    y: v.y + speed * Math.cos(psi) * dt,
  };
}

/** Advance a target one step on constant course/speed. */
export function stepTarget(v: Vessel, dt: number): Vessel {
  return {
    ...v,
    x: v.x + v.v * Math.sin(v.psi) * dt,
    y: v.y + v.v * Math.cos(v.psi) * dt,
  };
}

/**
 * Integrate a full run. `ownControl(t, own)` returns the held command each step.
 * Returns the sampled trajectory including the initial state.
 */
export function integrate(
  scenario: SimScenario,
  ownControl: (t: number, own: Vessel) => Command,
): Trajectory {
  const { horizonS, dt } = scenario;
  let own = scenario.ownship;
  let targets = scenario.targets;
  const traj: Trajectory = [{ t: 0, own, targets }];
  const steps = Math.round(horizonS / dt);
  for (let i = 0; i < steps; i++) {
    const t = i * dt;
    const cmd = ownControl(t, own);
    own = stepOwnship(own, cmd, dt);
    targets = targets.map((tg) => stepTarget(tg, dt));
    traj.push({ t: (i + 1) * dt, own, targets });
  }
  return traj;
}

/**
 * Build a control function that holds the initial course/speed until `actTime`,
 * then holds the maneuver (offset heading, scaled speed). Used by the learner
 * (a single committed maneuver) and by the reference solver (each candidate).
 */
export function maneuverControl(
  ownship: Vessel,
  m: Maneuver,
): (t: number, own: Vessel) => Command {
  const psi0 = ownship.psi;
  const v0 = ownship.v;
  const before: Command = { headingCmd: psi0, speedCmd: v0 };
  const after: Command = {
    headingCmd: wrapPi(psi0 + m.courseOffset),
    speedCmd: v0 * m.speedFactor,
  };
  return (t: number) => (t >= m.actTime ? after : before);
}
