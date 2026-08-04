/**
 * Collision Risk Index (CRI) — the standard maritime risk scalar.
 *
 * Uses the widely-cited closed form
 *   r = ( a1·(DCPA/Ds)² + a2·(TCPA/Ts)² + a3·(D/Ds)² )^(−1/2)
 * (e.g. Li et al., "Collision Risk Index Calculation Based on an Improved Ship
 * Domain Model", J. Mar. Sci. Eng. 2022, Eq. 9), clamped to [0, 1]. Ds is a
 * minimum safety distance and Ts a decision reaction time; risk rises as DCPA,
 * TCPA and current range fall below them. Defaults: Ds = 0.5 NM, Ts = 15 min.
 */
import type { Vessel, Trajectory } from './types';
import { NM_TO_M } from './types';
import { cpa } from './cpa';

export interface CriParams {
  /** Minimum safety distance, metres. */
  Ds: number;
  /** Decision reaction time, seconds. */
  Ts: number;
  /** Weights on the DCPA, TCPA and range terms. */
  a1: number;
  a2: number;
  a3: number;
}

export const DEFAULT_CRI: CriParams = {
  Ds: 0.5 * NM_TO_M,
  Ts: 15 * 60,
  a1: 1,
  a2: 1,
  a3: 1,
};

/** Instantaneous CRI for one target (0 = no risk, 1 = maximal). */
export function criInstant(own: Vessel, target: Vessel, p: CriParams = DEFAULT_CRI): number {
  const { dcpa, tcpa, range } = cpa(own, target);
  const sum =
    p.a1 * (dcpa / p.Ds) ** 2 + p.a2 * (tcpa / p.Ts) ** 2 + p.a3 * (range / p.Ds) ** 2;
  if (sum <= 1e-9) return 1;
  const r = 1 / Math.sqrt(sum);
  return Math.max(0, Math.min(1, r));
}

/** Maximum CRI across all targets and all time samples over the trajectory. */
export function criMax(traj: Trajectory, p: CriParams = DEFAULT_CRI): number {
  let max = 0;
  for (const s of traj) {
    for (const tg of s.targets) {
      const r = criInstant(s.own, tg, p);
      if (r > max) max = r;
    }
  }
  return max;
}

/** Per-target CRI time series (for plotting / the live readout). */
export function criSeries(traj: Trajectory, p: CriParams = DEFAULT_CRI): number[][] {
  const n = traj[0]?.targets.length ?? 0;
  const series: number[][] = Array.from({ length: n }, () => []);
  for (const s of traj) {
    s.targets.forEach((tg, i) => series[i].push(criInstant(s.own, tg, p)));
  }
  return series;
}
