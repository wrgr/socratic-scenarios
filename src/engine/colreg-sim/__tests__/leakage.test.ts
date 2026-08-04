import { describe, it, expect } from 'vitest';
import {
  runLeakageExperiment,
  starboardProbe,
  boundLearnerCompleter,
  leakingLearnerCompleter,
  type LeakageConfig,
} from '../index';
import { colregDomain } from '../../../corpus/colreg';
import { collisionTarget, makeScenario } from '../../../corpus/colreg/benchmark-geometry';

const headOn = (id: string, range: number, speedKn: number) =>
  makeScenario(id, 'Head-on', 'beginner', [collisionTarget('A', 0, range, speedKn)]);

const scenarios = [headOn('HO-1', 6000, 12), headOn('HO-2', 5500, 11), headOn('HO-3', 6500, 13)];
const cfg: LeakageConfig = {
  corpusNodes: colregDomain.nodes,
  scenarios,
  probes: [starboardProbe(scenarios[0])],
  closedBookScenario: scenarios[0],
};

describe('leakage experiment — the instrument recovers the known ground truth (C1)', () => {
  it('judges a genuinely corpus-bound learner as corpus-bound', async () => {
    const report = await runLeakageExperiment(boundLearnerCompleter(), 'mock-bound', cfg);
    const p = report.perRule[0];
    // Removing the rule collapses the governed metric — the learner relied on it.
    expect(p.ablationDelta).toBeGreaterThan(0.5);
    // It follows the counterfactual rule (turns to port when the corpus says port).
    expect(p.counterfactualFollowed).toBe(true);
    // With no corpus it abstains rather than answering from priors.
    expect(report.closedBookAbstained).toBe(true);
    // The failure signature includes the governed component.
    expect(p.localizedGovernedComponent).toBe(true);
    expect(p.verdict).toBe('corpus-bound');
  });

  it('judges a leaking (prior-driven) learner as leaking', async () => {
    const report = await runLeakageExperiment(leakingLearnerCompleter(), 'mock-leaking', cfg);
    const p = report.perRule[0];
    // Removing or altering the rule changes nothing — the model uses pretrained priors.
    expect(p.ablationDelta).toBeLessThan(0.15);
    expect(p.counterfactualFollowed).toBe(false);
    // It answers closed-book instead of abstaining — the contamination baseline.
    expect(report.closedBookAbstained).toBe(false);
    expect(p.verdict).toBe('leaking');
  });

  it('the two hypotheses are separated by the ablation-delta on one instrument', async () => {
    const bound = (await runLeakageExperiment(boundLearnerCompleter(), 'b', cfg)).perRule[0];
    const leaking = (await runLeakageExperiment(leakingLearnerCompleter(), 'l', cfg)).perRule[0];
    // The same instrument, run bidirectionally, cleanly tells them apart.
    expect(bound.ablationDelta).toBeGreaterThan(leaking.ablationDelta + 0.5);
    expect(bound.verdict).not.toBe(leaking.verdict);
  });
});
