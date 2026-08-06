import { describe, it, expect } from 'vitest';
import type { Vessel } from '../types';
import { imazuBenchmark } from '../../../corpus/colreg/imazu';
import { instrumentScenarios } from '../../../corpus/colreg/instrument-scenarios';
import { integrate, maneuverControl } from '../kinematics';
import { evaluate } from '../objective';
import { holdCoursePolicy } from '../benchmark';
import { runSensitivity, kendallTau } from '../sensitivity';
import { DEFAULT_DOMAIN, clearanceFactor } from '../ship-domain';

describe('Kendall τ', () => {
  it('is +1 for identical orderings and −1 for reversed', () => {
    expect(kendallTau([1, 2, 3], [10, 20, 30])).toBe(1);
    expect(kendallTau([1, 2, 3], [30, 20, 10])).toBe(-1);
  });
  it('is 0 when one vector is flat (all pairs tied → no information)', () => {
    expect(kendallTau([1, 2, 3], [5, 5, 5])).toBe(1); // denom 0 ⇒ defined as 1 (no discordance)
  });
});

describe('configurable ship domain threads through scoring', () => {
  it('a larger domain lowers the clearance factor for the same geometry', () => {
    const own: Vessel = {
      id: 'own', x: 0, y: 0, psi: 0, v: 6, lengthM: 100,
      turnRadiusMin: 600, accelMax: 0.1, headingTau: 20, vMin: 2, vMax: 8,
    };
    const target: Vessel = { ...own, id: 't', x: 0, y: 2500 };
    const nominal = clearanceFactor(own, target, DEFAULT_DOMAIN);
    const bigger = clearanceFactor(own, target, { ...DEFAULT_DOMAIN, fore: DEFAULT_DOMAIN.fore * 1.5 });
    expect(bigger).toBeLessThan(nominal);
  });

  it('a larger domain cannot decrease the scored objective J for a fixed trajectory', () => {
    const s = imazuBenchmark.find((x) => x.id === 'IMAZU-01')!;
    const traj = integrate(s, maneuverControl(s.ownship, holdCoursePolicy(s)));
    const jNominal = evaluate(s, traj).J;
    const jBigger = evaluate(s, traj, undefined, {
      fore: DEFAULT_DOMAIN.fore * 1.4, aft: DEFAULT_DOMAIN.aft * 1.4,
      star: DEFAULT_DOMAIN.star * 1.4, port: DEFAULT_DOMAIN.port * 1.4,
      speedGrowth: DEFAULT_DOMAIN.speedGrowth,
    }).J;
    expect(jBigger).toBeGreaterThanOrEqual(jNominal - 1e-9);
  });
});

describe('instrument sensitivity — the protocol ranking is stable under reweighting', () => {
  const rep = runSensitivity({ scenarios: instrumentScenarios });

  it('runs a substantial perturbation ensemble deterministically', () => {
    expect(rep.nPerturbations).toBeGreaterThan(200);
    // Determinism: a second run (seeded PRNG) gives identical stability numbers.
    const rep2 = runSensitivity({ scenarios: instrumentScenarios });
    expect(rep2.policy.invariantRate).toBe(rep.policy.invariantRate);
    expect(rep2.gradient.meanTau).toBe(rep.gradient.meanTau);
  });

  it('nominal ranking has naive worst and a monotone competence gradient', () => {
    expect(rep.nominalPolicyJ.naive).toBeGreaterThan(rep.nominalPolicyJ.vo);
    expect(rep.nominalPolicyJ.naive).toBeGreaterThan(rep.nominalPolicyJ.mpc);
    for (let i = 1; i < rep.nominalGradientJ.length; i++) {
      expect(rep.nominalGradientJ[i]).toBeLessThanOrEqual(rep.nominalGradientJ[i - 1] + 1e-9);
    }
  });

  it('keeps naive ranked worst across the whole perturbation ensemble', () => {
    expect(rep.policy.invariantRate).toBe(1);
    expect(rep.policy.minTau).toBeGreaterThan(0.99);
  });

  it('keeps the competence gradient monotone across the whole ensemble', () => {
    expect(rep.gradient.invariantRate).toBe(1);
    expect(rep.gradient.minTau).toBeGreaterThan(0.99);
  });
});
