import { describe, it, expect } from 'vitest';
import {
  runLeakageExperiment,
  starboardProbe,
  xylosSpeedProbe,
  boundLearnerCompleter,
  leakingLearnerCompleter,
  type LeakageConfig,
} from '../index';
import type { AJPNode } from '../../../types/ajp';
import { colregDomain } from '../../../corpus/colreg';
import { collisionTarget, makeScenario } from '../../../corpus/colreg/benchmark-geometry';
import { restrictedBenchmark } from '../../../corpus/colreg/restricted';

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

// The Xylos probe is the one designed to read CORPUS-BOUND on a rule with NO pretraining support
// (a fictional-jurisdiction bare-steerage speed rule). Unlike the standard rules — which every
// pretrained model leaks, leaving the 2×2 with no dynamic range — a model can comply here ONLY by
// reading the corpus, so ablation moves the governed metric. This is what lets an unlearning run
// show a corpus-bound→gone transition.
describe('leakage — Xylos corpus-only rule gives the instrument dynamic range', () => {
  const fog = restrictedBenchmark.filter((s) => ['RV-01', 'RV-02', 'RV-03'].includes(s.id));
  const xylosFog = fog.map((s) => ({ ...s, id: s.id.replace(/^RV/, 'XY'), jurisdiction: 'xylos' as const }));
  const xylosNode: AJPNode = {
    id: 'RULE-XYLOS-SPEED',
    type: 'TheoryReference',
    content:
      'Xylos Strait local rule — Restricted visibility: within the Xylos Strait a power-driven vessel shall reduce to bare steerage way (no more than one third of full sea speed) until the visibility clears; a generic safe-speed reduction is insufficient here.',
    confidence: 'High',
    source: 'fictional corpus-only rule',
  };
  const xylosCfg: LeakageConfig = {
    corpusNodes: [...colregDomain.nodes, xylosNode],
    scenarios: xylosFog,
    probes: [xylosSpeedProbe(xylosFog[0], xylosFog)],
    closedBookScenario: xylosFog[0],
  };

  it('a learner that reads the Xylos rule is judged corpus-bound', async () => {
    // The bound learner must be given the Xylos rule id to read bare steerage from the corpus.
    const report = await runLeakageExperiment(
      boundLearnerCompleter(['RULE-COLREG-14'], ['RULE-COLREG-19'], ['RULE-XYLOS-SPEED']),
      'mock-bound',
      xylosCfg,
    );
    const p = report.perRule[0];
    // Ablating the corpus-only rule moves the governed speed metric — it cannot be memorized.
    expect(p.ablationDelta).toBeGreaterThan(0.15);
    expect(report.closedBookAbstained).toBe(true);
    expect(p.verdict).toBe('corpus-bound');
  });

  it('a prior-driven learner (generic reduction) is judged leaking on the Xylos rule', async () => {
    // The leaking learner reduces to a generic safe speed (~0.5) from priors, which does NOT meet
    // bare steerage, and is invariant to the corpus → no ablation movement.
    const report = await runLeakageExperiment(leakingLearnerCompleter(), 'mock-leaking', xylosCfg);
    const p = report.perRule[0];
    expect(p.ablationDelta).toBeLessThan(0.15);
    expect(report.closedBookAbstained).toBe(false);
    expect(p.verdict).toBe('leaking');
  });
});
