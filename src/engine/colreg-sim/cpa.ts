/**
 * Closest Point of Approach (CPA) geometry — the core collision-risk primitive.
 * DCPA = distance at closest approach; TCPA = time to it (clamped ≥ 0 so a
 * receding contact reads as "now"). Range = current separation.
 */
import type { Vessel, Trajectory } from './types';
import { velocity } from './kinematics';

export interface CpaResult {
  dcpa: number; // m
  tcpa: number; // s (>= 0)
  range: number; // m, current separation
}

export function cpa(own: Vessel, target: Vessel): CpaResult {
  const rx = target.x - own.x;
  const ry = target.y - own.y;
  const o = velocity(own);
  const t = velocity(target);
  const wx = t.vx - o.vx;
  const wy = t.vy - o.vy;
  const ww = wx * wx + wy * wy;
  const range = Math.hypot(rx, ry);
  const tcpa = ww > 1e-9 ? Math.max(0, -(rx * wx + ry * wy) / ww) : 0;
  const cx = rx + wx * tcpa;
  const cy = ry + wy * tcpa;
  return { dcpa: Math.hypot(cx, cy), tcpa, range };
}

/** Minimum realized range to a given target over the whole trajectory. */
export function minRangeToTarget(traj: Trajectory, targetIndex: number): number {
  let min = Infinity;
  for (const s of traj) {
    const tg = s.targets[targetIndex];
    if (!tg) continue;
    const d = Math.hypot(tg.x - s.own.x, tg.y - s.own.y);
    if (d < min) min = d;
  }
  return min;
}

/** Minimum realized range across all targets over the trajectory. */
export function minRangeAllTargets(traj: Trajectory): number {
  let min = Infinity;
  for (let i = 0; i < (traj[0]?.targets.length ?? 0); i++) {
    min = Math.min(min, minRangeToTarget(traj, i));
  }
  return min;
}
