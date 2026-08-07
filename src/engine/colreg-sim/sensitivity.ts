/**
 * Instrument sensitivity analysis — turns the "weighting choices" limitation into
 * a measurable result (docs/novelty-and-positioning.md §4; paper §Limitations).
 *
 * The transfer instrument depends on three groups of weighting choices: the
 * elliptical **ship-domain** radii, the **CRI** parameters, and the **objective**
 * weights (margin/compliance/deviation). A reviewer's fair worry is that the
 * protocol's *conclusions* — the ranking of learners by competence — are an
 * artifact of those choices. This module falsifies that worry by holding every
 * learner's *behavior* fixed (trajectories computed once) and re-scoring under
 * perturbed weights, then asking whether two orderings survive:
 *
 *   (R1) Policy separation: naive (hold-course) is ranked worst, below both the
 *        VO and SB-MPC reference solvers.
 *   (R2) Competence gradient: mean J is monotone non-increasing as the six
 *        knowledge components are acquired in curriculum order.
 *
 * Stability is reported two ways: the fraction of perturbations that preserve the
 * key invariant, and Kendall's τ between the perturbed and nominal orderings.
 *
 * CRI is deliberately excluded from the perturbation: it is a reported diagnostic
 * readout, not a term in the scored objective J (see objective.ts), so the ranking
 * is invariant to CRI weights *by construction*. We perturb only the two groups
 * that actually enter J — the ship domain and the objective weights.
 *
 * All randomness is a seeded PRNG (no Math.random), so the report is deterministic
 * and reproducible in a no-key session.
 */
import type { SimScenario, Trajectory } from './types';
import { integrate, maneuverControl } from './kinematics';
import { evaluate, DEFAULT_WEIGHTS, type ObjectiveWeights } from './objective';
import { DEFAULT_DOMAIN, type DomainParams } from './ship-domain';
import { holdCoursePolicy, voPolicy, mpcPolicy, type Policy } from './benchmark';
import { competenceAtStage, learnerPolicy, CURRICULUM } from './learner-policy';

const EPS = 1e-9;

/** Deterministic mulberry32 PRNG — integer/bitwise only, no Math.random. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Kendall's τ between two score vectors over the same items (lower score = better).
 * +1 = identical pairwise ordering, −1 = fully reversed. Tied pairs are ignored.
 */
export function kendallTau(a: number[], b: number[]): number {
  let concordant = 0;
  let discordant = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 1; j < a.length; j++) {
      const s = Math.sign(a[i] - a[j]) * Math.sign(b[i] - b[j]);
      if (s > 0) concordant++;
      else if (s < 0) discordant++;
    }
  }
  const denom = concordant + discordant;
  return denom === 0 ? 1 : (concordant - discordant) / denom;
}

/** One group of weighting choices to score under. */
interface Weighting {
  weights: ObjectiveWeights;
  domain: DomainParams;
}

/** Multiplicative factors for every tunable parameter (1.0 = unchanged). */
interface Factors {
  margin: number;
  compliance: number;
  deviation: number;
  fore: number;
  aft: number;
  star: number;
  port: number;
  speedGrowth: number;
}

const UNIT_FACTORS: Factors = {
  margin: 1, compliance: 1, deviation: 1,
  fore: 1, aft: 1, star: 1, port: 1, speedGrowth: 1,
};

const PARAM_KEYS = Object.keys(UNIT_FACTORS) as (keyof Factors)[];

function applyFactors(f: Factors): Weighting {
  return {
    weights: {
      margin: DEFAULT_WEIGHTS.margin * f.margin,
      compliance: DEFAULT_WEIGHTS.compliance * f.compliance,
      deviation: DEFAULT_WEIGHTS.deviation * f.deviation,
    },
    domain: {
      fore: DEFAULT_DOMAIN.fore * f.fore,
      aft: DEFAULT_DOMAIN.aft * f.aft,
      star: DEFAULT_DOMAIN.star * f.star,
      port: DEFAULT_DOMAIN.port * f.port,
      speedGrowth: DEFAULT_DOMAIN.speedGrowth * f.speedGrowth,
    },
  };
}

export interface RankStability {
  /** How the perturbations were drawn ("nominal" / "one-at-a-time" / "joint"). */
  label: string;
  n: number;
  /** Fraction of perturbations preserving the ordering's key invariant. */
  invariantRate: number;
  /** Mean Kendall τ of the perturbed vs nominal ordering. */
  meanTau: number;
  /** Worst (minimum) Kendall τ observed across the ensemble. */
  minTau: number;
}

export interface SensitivityReport {
  nScenarios: number;
  nPerturbations: number;
  /** Nominal mean J per policy [naive, VO, SB-MPC]. */
  nominalPolicyJ: { naive: number; vo: number; mpc: number };
  /** Nominal mean J per curriculum stage (0…6 components acquired). */
  nominalGradientJ: number[];
  /** Policy-separation ranking (R1) stability across the ensemble. */
  policy: RankStability;
  /** Competence-gradient monotonicity (R2) stability across the ensemble. */
  gradient: RankStability;
}

export interface SensitivityConfig {
  scenarios: SimScenario[];
  /** One-at-a-time factor sweep applied to each parameter singly. */
  oatFactors?: number[];
  /** Number of joint (all-parameters-at-once) random perturbations. */
  jointSamples?: number;
  /** Joint perturbation half-width: each factor ∈ [1−δ, 1+δ]. */
  jointDelta?: number;
  /** PRNG seed (determinism). */
  seed?: number;
}

/** Precompute each policy's trajectory on each scenario (behavior held fixed). */
function trajectories(scenarios: SimScenario[], policy: Policy): Trajectory[] {
  return scenarios.map((s) => integrate(s, maneuverControl(s.ownship, policy(s))));
}

function meanJUnder(scenarios: SimScenario[], trajs: Trajectory[], w: Weighting): number {
  return mean(trajs.map((t, i) => evaluate(scenarios[i], t, w.weights, w.domain).J));
}

/**
 * Run the sensitivity analysis. Behavior (trajectories) is computed once under the
 * default weighting; only the *scoring* weights are perturbed, isolating the
 * instrument's dependence on the weighting choices.
 */
export function runSensitivity(config: SensitivityConfig): SensitivityReport {
  const { scenarios } = config;
  const oatFactors = config.oatFactors ?? [0.5, 0.75, 1.25, 1.5];
  const jointSamples = config.jointSamples ?? 200;
  const jointDelta = config.jointDelta ?? 0.4;
  const rng = mulberry32(config.seed ?? 0x5eed);

  // Fixed behaviors: the three reference policies and the seven curriculum stages.
  const policyTrajs = {
    naive: trajectories(scenarios, holdCoursePolicy),
    vo: trajectories(scenarios, voPolicy),
    mpc: trajectories(scenarios, mpcPolicy),
  };
  const gradientTrajs = Array.from({ length: CURRICULUM.length + 1 }, (_, stage) =>
    trajectories(scenarios, learnerPolicy(competenceAtStage(stage))),
  );

  const policyJ = (w: Weighting): number[] => [
    meanJUnder(scenarios, policyTrajs.naive, w),
    meanJUnder(scenarios, policyTrajs.vo, w),
    meanJUnder(scenarios, policyTrajs.mpc, w),
  ];
  const gradientJ = (w: Weighting): number[] =>
    gradientTrajs.map((trajs) => meanJUnder(scenarios, trajs, w));

  // Nominal (default-weight) orderings — the reference the perturbations are judged against.
  const nominal = applyFactors(UNIT_FACTORS);
  const nomPolicy = policyJ(nominal);
  const nomGradient = gradientJ(nominal);

  // Build the perturbation ensemble: one-at-a-time sweep + joint random samples.
  const factorSets: Factors[] = [];
  for (const key of PARAM_KEYS) {
    for (const f of oatFactors) factorSets.push({ ...UNIT_FACTORS, [key]: f });
  }
  for (let s = 0; s < jointSamples; s++) {
    const f = { ...UNIT_FACTORS };
    for (const key of PARAM_KEYS) f[key] = 1 + jointDelta * (2 * rng() - 1);
    factorSets.push(f);
  }

  // R1: naive is strictly the worst-scoring (highest J) of the three policies.
  const policyInvariant = (j: number[]) => j[0] > j[1] + EPS && j[0] > j[2] + EPS;
  // R2: mean J is monotone non-increasing across curriculum stages.
  const gradientMonotone = (j: number[]) => {
    for (let i = 1; i < j.length; i++) if (j[i] > j[i - 1] + EPS) return false;
    return true;
  };

  let policyHeld = 0;
  let gradientHeld = 0;
  const policyTaus: number[] = [];
  const gradientTaus: number[] = [];

  for (const f of factorSets) {
    const w = applyFactors(f);
    const pj = policyJ(w);
    const gj = gradientJ(w);
    if (policyInvariant(pj)) policyHeld++;
    if (gradientMonotone(gj)) gradientHeld++;
    policyTaus.push(kendallTau(nomPolicy, pj));
    gradientTaus.push(kendallTau(nomGradient, gj));
  }

  const n = factorSets.length;
  return {
    nScenarios: scenarios.length,
    nPerturbations: n,
    nominalPolicyJ: { naive: nomPolicy[0], vo: nomPolicy[1], mpc: nomPolicy[2] },
    nominalGradientJ: nomGradient,
    policy: {
      label: 'naive strictly worst',
      n,
      invariantRate: policyHeld / n,
      meanTau: mean(policyTaus),
      minTau: Math.min(...policyTaus),
    },
    gradient: {
      label: 'competence gradient monotone',
      n,
      invariantRate: gradientHeld / n,
      meanTau: mean(gradientTaus),
      minTau: Math.min(...gradientTaus),
    },
  };
}
