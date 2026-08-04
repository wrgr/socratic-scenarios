import { describe, it, expect } from 'vitest';
import { imazuBenchmark } from '../../../corpus/colreg/imazu';
import { colregSimScenarios } from '../../../corpus/colreg/simulator-scenarios';
import { runBenchmark, holdCoursePolicy, mpcPolicy, voPolicy } from '../benchmark';
import { solveReferenceVO } from '../reference-solver';

describe('Imazu benchmark — construct validity of the scoring instrument', () => {
  const naive = runBenchmark(imazuBenchmark, holdCoursePolicy);
  const mpc = runBenchmark(imazuBenchmark, mpcPolicy);
  const vo = runBenchmark(imazuBenchmark, voPolicy);

  it('defines 22 cases', () => {
    expect(imazuBenchmark).toHaveLength(22);
  });

  it('do-nothing collides on nearly every case (targets are on collision courses)', () => {
    expect(naive.clearedRate).toBeLessThan(0.15);
    expect(naive.meanCriMax).toBeGreaterThan(0.8);
  });

  it('the SB-MPC expert clears far more domains, at lower cost, than naive', () => {
    expect(mpc.clearedRate).toBeGreaterThan(naive.clearedRate + 0.4);
    expect(mpc.meanJ).toBeLessThan(naive.meanJ);
    expect(mpc.meanCompliancePenalty).toBeLessThan(naive.meanCompliancePenalty + 0.001);
  });

  it('the VO expert also separates clearly from naive', () => {
    expect(vo.clearedRate).toBeGreaterThan(naive.clearedRate + 0.3);
    expect(vo.meanJ).toBeLessThan(naive.meanJ);
  });
});

describe('VO reference solver', () => {
  it('returns a domain-clearing maneuver for a solvable single-ship crossing', () => {
    const s = imazuBenchmark.find((x) => x.id === 'IMAZU-03')!;
    const sol = solveReferenceVO(s);
    expect(sol.inExtremis).toBe(false);
    expect(sol.best.result.metrics.incursion).toBe(false);
  });

  // Regression: the VO safety radius must contain the elliptical domain, or a
  // VO-clear velocity can still penetrate the longer fore/starboard axes.
  it('VO-clear implies elliptical-domain-clear on the interactive crossing scenario', () => {
    const s = colregSimScenarios.find((x) => x.id === 'SIM-CROSSING')!;
    const sol = solveReferenceVO(s);
    expect(sol.best.result.metrics.incursion).toBe(false);
  });
});
