/**
 * Elliptical, COLREG-asymmetric ship domain — a simplified Coldwell/Fujii-style
 * model. The domain is an ellipse in the ownship body frame with four directional
 * radii (fore/aft/starboard/port); the starboard radius is larger than port to
 * reflect the give-way-to-starboard convention, and all radii scale with ship
 * length and speed (a faster ship claims more water ahead).
 *
 * `clearanceFactor` is the normalized elliptical distance of a target from the
 * ownship: < 1 means the target is inside the domain (a violation / near-miss);
 * = 1 is on the boundary; ≥ 2 is the "2× domain" safety-margin target used as an
 * optimization objective (not a hard threshold — see objective.ts).
 *
 * The multiples are pedagogical, chosen to read clearly on screen; they are
 * documented as illustrative rather than a calibrated operational domain.
 */
import type { Vessel } from './types';
import { MS_TO_KNOTS } from './types';

export interface DomainRadii {
  fore: number;
  aft: number;
  star: number;
  port: number;
}

/** Directional domain radii (metres) for a vessel, scaled by length and speed. */
export function domainRadii(v: Vessel): DomainRadii {
  const L = v.lengthM;
  const knots = v.v * MS_TO_KNOTS;
  // Grows modestly with speed; 1.0 at ~0 kn, ~1.3 at 10 kn, ~1.6 at 20 kn.
  const speedScale = 1 + 0.03 * knots;
  return {
    fore: 6.0 * L * speedScale,
    aft: 4.0 * L * speedScale,
    star: 3.5 * L * speedScale,
    port: 2.5 * L * speedScale,
  };
}

/**
 * Normalized elliptical distance of `target` from `own`'s domain, in own's body
 * frame. sqrt of the ellipse value: < 1 inside (violation), 1 on boundary,
 * ≥ 2 at twice the domain. Uses the fore/aft and star/port radius appropriate to
 * the target's quadrant.
 */
export function clearanceFactor(own: Vessel, target: Vessel): number {
  const dx = target.x - own.x;
  const dy = target.y - own.y;
  // Body frame: forward = heading dir (sin,cos); starboard = (cos,-sin).
  const forward = dx * Math.sin(own.psi) + dy * Math.cos(own.psi);
  const right = dx * Math.cos(own.psi) - dy * Math.sin(own.psi);
  const r = domainRadii(own);
  const aLon = forward >= 0 ? r.fore : r.aft;
  const bLat = right >= 0 ? r.star : r.port;
  const ellipse = (forward / aLon) ** 2 + (right / bLat) ** 2;
  return Math.sqrt(ellipse);
}

export interface DomainAssessment {
  /** Minimum clearance factor over all targets (the worst case). */
  minClearance: number;
  /** True if any target penetrated the domain (clearance < 1) — the hard floor. */
  incursion: boolean;
  /** Per-target minimum clearance factor. */
  perTarget: number[];
}

/** Assess a single instant across all targets. */
export function assessInstant(own: Vessel, targets: Vessel[]): DomainAssessment {
  const perTarget = targets.map((t) => clearanceFactor(own, t));
  const minClearance = perTarget.length ? Math.min(...perTarget) : Infinity;
  return { minClearance, incursion: minClearance < 1, perTarget };
}
