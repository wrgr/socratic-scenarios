/**
 * COLREG collision-avoidance simulator — shared types + unit helpers.
 *
 * Internal state is SI (metres, seconds, m/s) with a compass heading convention
 * (psi = 0 is North, increasing clockwise), so velocity is
 * `vx = v·sin(psi)` (East), `vy = v·cos(psi)` (North). Display converts to knots
 * and nautical miles.
 *
 * The model is deliberately kinematic + first-order (Nomoto-style course
 * response), which is the right altitude for a Rules trainer — turn-rate and
 * acceleration limits (a faster ship turns in a wider circle) stand in for
 * hydrodynamics. See docs/colreg-simulator-design.md.
 */

export const KNOTS_TO_MS = 0.514444;
export const MS_TO_KNOTS = 1 / KNOTS_TO_MS;
export const NM_TO_M = 1852;
export const M_TO_NM = 1 / NM_TO_M;

export interface Vessel {
  id: string;
  label?: string;
  /** Position, metres (local tangent plane). */
  x: number;
  y: number;
  /** Heading, radians, compass convention (0 = North, clockwise +). */
  psi: number;
  /** Speed, m/s. */
  v: number;
  /** Ship length, metres — sizes the ship domain. */
  lengthM: number;
  /** Ownship maneuvering limits (targets ignore these). */
  vMax?: number;
  vMin?: number;
  /** Minimum turn radius, metres. turnRateMax = v / turnRadiusMin (speed-coupled). */
  turnRadiusMin?: number;
  /** Surge accel/decel limit, m/s^2. */
  accelMax?: number;
  /** First-order course-response time constant, seconds (Nomoto-style). */
  headingTau?: number;
}

/** A held control command: desired heading + desired speed. */
export interface Command {
  headingCmd: number; // rad
  speedCmd: number; // m/s
}

/** One sampled instant of a simulation run. */
export interface TrajectoryState {
  t: number; // s
  own: Vessel;
  targets: Vessel[];
}

export type Trajectory = TrajectoryState[];

export type Visibility = 'clear' | 'restricted';

export interface SimScenario {
  id: string;
  label: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  ownship: Vessel;
  targets: Vessel[];
  visibility: Visibility;
  /**
   * Optional LOCAL speed limit imposed by the scenario's jurisdiction — a rule that may have NO
   * pretraining support (a fictional strait like Xylos, or an obscure real port/VTS limit a
   * model has not memorized). `targetFactor` is the required speed as a fraction of full sea
   * speed (e.g. 0.33 = bare steerage). The compliance check scores how far *over* this limit the
   * vessel was (graded), giving the leakage instrument the dynamic range a memorized COLREG rule
   * cannot: a model that has never seen the limit can comply only by reading the corpus.
   * `undefined` = the standard COLREG regime (generic safe-speed only).
   */
  localSpeedLimit?: { targetFactor: number; label: string };
  /**
   * Static hazards the ownship must avoid (charted wreck / shoal / exclusion zone). These are
   * scored by the objective barrier exactly like a domain incursion, but are **not** rendered into
   * the prompt — the model can only learn of them from the CORPUS. That makes them the ideal
   * large-effect corpus-reliance probe: a model without the corpus rule has no way to know the
   * hazard is there, holds its default track, and grounds (full barrier penalty); a corpus-bound
   * model reads the hazard and clears it. Corpus present-vs-ablated then swings the metric across
   * its whole range, not a sliver. Position is SI metres in the ownship's local frame.
   */
  hazards?: { x: number; y: number; radiusM: number; label: string }[];
  /** Simulation horizon, seconds. */
  horizonS: number;
  /** Integration timestep, seconds. */
  dt: number;
  /** The direct-route heading deviation is measured against, radians. */
  intendedHeading: number;
}

/** A control schedule: a single maneuver committed at `actTime`. */
export interface Maneuver {
  /** Heading offset from the ownship's initial heading, radians (starboard +). */
  courseOffset: number;
  /** Multiplier on the ownship's initial speed (1 = unchanged). */
  speedFactor: number;
  /** When the maneuver is applied, seconds from start. */
  actTime: number;
}
