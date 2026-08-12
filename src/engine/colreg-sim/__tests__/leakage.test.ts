import { describe, it, expect } from 'vitest';
import {
  runLeakageExperiment,
  starboardProbe,
  crossingGiveWayProbe,
  safeSpeedProbe,
  hazardProbe,
  boundLearnerCompleter,
  leakingLearnerCompleter,
  type LeakageConfig,
  type SimScenario,
} from '../index';
import type { AJPNode } from '../../../types/ajp';
import { colregDomain } from '../../../corpus/colreg';
import { collisionTarget, makeScenario, ownship, kn } from '../../../corpus/colreg/benchmark-geometry';
import { restrictedBenchmark } from '../../../corpus/colreg/restricted';
import { HAZARD_SUITE, suiteScenario, suiteNode, type SuiteHazard } from '../../../corpus/colreg/hazard-suite';

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

// THE corpus-reliance probe: a hidden hazard the model can know ONLY from the corpus. This is the
// large-effect design — a learner that reads the corpus alters to clear; one that does not holds
// its default track and grounds (full barrier). The swing is the whole metric range, not a sliver.
describe('leakage — a hidden hazard is the large-effect corpus-reliance probe', () => {
  const hazardScenario = (id: string, hy: number): SimScenario => ({
    id, label: 'Transit past a charted hazard', description: '', difficulty: 'beginner',
    ownship: ownship(),
    targets: [{ id: 'F', label: 'F', x: -9000, y: 9000, psi: Math.PI, v: kn(6), lengthM: 100 }],
    visibility: 'clear',
    hazards: [{ x: 0, y: hy, radiusM: 2000, label: 'charted wreck' }],
    horizonS: 1200, dt: 4, intendedHeading: 0,
  });
  const scns = [hazardScenario('HZ-1', 3000), hazardScenario('HZ-2', 2800), hazardScenario('HZ-3', 3200)];
  const hazardNode: AJPNode = {
    id: 'RULE-HAZARD-01',
    type: 'TheoryReference',
    content: 'CHARTED HAZARD — a wreck lies directly ahead on your track; alter course to starboard by at least 55° to pass well clear.',
    confidence: 'High',
    source: 'corpus-only notice to mariners',
  };
  const cfg: LeakageConfig = {
    corpusNodes: [...colregDomain.nodes, hazardNode],
    scenarios: scns,
    probes: [hazardProbe(scns[0], scns)],
    closedBookScenario: scns[0],
  };
  // The bound learner reads ONLY the hazard rule (benign transit, no give-way steering to apply),
  // so with the hazard ablated it holds and grounds.
  const boundMock = () => boundLearnerCompleter([], [], ['RULE-HAZARD-01']);

  it('a learner that reads the hazard is judged corpus-bound, with a LARGE ablation-delta', async () => {
    const report = await runLeakageExperiment(boundMock(), 'mock-bound', cfg);
    const p = report.perRule[0];
    // Ablating the corpus-only hazard makes the bound learner ground — a full-barrier swing, an
    // order of magnitude past the discrete threshold (not a sliver).
    expect(p.ablationDelta).toBeGreaterThan(0.5);
    expect(report.closedBookAbstained).toBe(true);
    expect(p.verdict).toBe('corpus-bound');
  });

  it('a prior-driven learner (ignores the corpus) grounds either way → leaking, ~0 delta', async () => {
    const report = await runLeakageExperiment(leakingLearnerCompleter(), 'mock-leaking', cfg);
    const p = report.perRule[0];
    expect(Math.abs(p.ablationDelta)).toBeLessThan(0.1);
    expect(report.closedBookAbstained).toBe(false);
    expect(p.verdict).toBe('leaking');
    // The corpus is NOT redundant here — the model fails the hazard even with the rule present
    // (regret ≈ full barrier). The split must call this `unusable`, not `redundant`: the item has
    // value, this model just can't act on it. (Mirrors Bedrock Llama-70B: regret-with ≈ 1207.)
    expect(p.regretWith).toBeGreaterThan(100);
    expect(p.leakMode).toBe('unusable');
  });
});

// Audit fix F1 — the geometric hazard SUITE turns the one-angle probe into a genuine fraction over N
// independent decisions, and closes the reflex loophole. Each danger sits off the port OR starboard
// bow, so the clearing action alternates; only a learner that READS each fact clears all of them.
describe('leakage — the geometric hazard suite is a per-item necessity fraction (F1)', () => {
  const cfgFor = (h: SuiteHazard): LeakageConfig => {
    const sc = suiteScenario(h);
    return {
      corpusNodes: [...colregDomain.nodes, suiteNode(h)],
      scenarios: [sc],
      probes: [hazardProbe(sc, [sc])],
      closedBookScenario: sc,
    };
  };
  const boundMock = () => boundLearnerCompleter([], [], ['RULE-HAZARD-01']);
  const runAll = async (mk: () => Parameters<typeof runLeakageExperiment>[0]) =>
    Promise.all(HAZARD_SUITE.map((h) => runLeakageExperiment(mk(), h.id, cfgFor(h)).then((r) => ({ h, p: r.perRule[0] }))));

  it('the suite spans both bows (the geometry that closes the reflex loophole)', () => {
    expect(HAZARD_SUITE.some((h) => h.side === 'port')).toBe(true);
    expect(HAZARD_SUITE.some((h) => h.side === 'starboard')).toBe(true);
  });

  it('a learner that reads every fact relies on every hazard → necessity N/N', async () => {
    const rows = await runAll(boundMock);
    expect(rows.every((r) => r.p.verdict === 'corpus-bound')).toBe(true);
    // Normalized delta clears the corpus-bound threshold; the raw swing is a full-barrier collapse.
    expect(rows.every((r) => r.p.ablationDelta > 0.15)).toBe(true);
    expect(rows.every((r) => r.p.regretDelta > 100)).toBe(true);
  });

  it('a fixed-starboard reflex-leaker relies on NONE, and grounds on exactly the starboard-bow half', async () => {
    const rows = await runAll(() => leakingLearnerCompleter());
    // It never reads the corpus, so per-item reliance is zero everywhere.
    expect(rows.every((r) => r.p.verdict !== 'corpus-bound')).toBe(true);
    // Port-bow dangers: the reflex (turn starboard) happens to clear them WITHOUT the corpus.
    const port = rows.filter((r) => r.h.side === 'port');
    expect(port.every((r) => r.p.regretWith < 10)).toBe(true);
    // Starboard-bow dangers: the same reflex steers INTO them — a real capability failure (unusable),
    // not a redundant corpus. This asymmetry is what a single fixed-direction hazard cannot reveal.
    const stbd = rows.filter((r) => r.h.side === 'starboard');
    expect(stbd.every((r) => r.p.regretWith > 100)).toBe(true);
    expect(stbd.every((r) => r.p.leakMode === 'unusable')).toBe(true);
  });
});

// Experiment 3 — the corpus-value audit (C1 localization half): per-rule ablation ranks the corpus
// rules by how much the learner RELIES on each. This is the data behind the necessity ranking and
// the localization confusion cell (governedComponent vs localizedComponent).
describe('leakage — per-rule necessity ranking (corpus-value audit)', () => {
  const crossing = (id: string, bearingDeg: number, speedKn: number) =>
    makeScenario(id, 'Starboard crossing', 'intermediate', [collisionTarget('A', bearingDeg, 6000, speedKn)]);
  const crossingScns = [crossing('XG-1', 45, 12), crossing('XG-2', 60, 11)];
  const fog = restrictedBenchmark.filter((s) => ['RV-01', 'RV-02', 'RV-03'].includes(s.id));
  const auditCfg: LeakageConfig = {
    corpusNodes: colregDomain.nodes,
    scenarios,
    probes: [starboardProbe(scenarios[0]), crossingGiveWayProbe(crossingScns[0], crossingScns), safeSpeedProbe(fog[0], fog)],
    closedBookScenario: scenarios[0],
  };

  it('ranks a relied-on rule above a redundant one, and every verdict carries its governed component', async () => {
    const bound = await runLeakageExperiment(
      boundLearnerCompleter(['RULE-COLREG-14', 'RULE-COLREG-15'], ['RULE-COLREG-19']), 'bound', auditCfg,
    );
    const byRule = Object.fromEntries(bound.perRule.map((p) => [p.ruleId, p]));
    // Head-on steering is relied on (ablating it collapses the metric); the crossing rule's
    // starboard is redundant given Rule 14, so it ranks below — the audit's core signal.
    expect(byRule['RULE-COLREG-14'].ablationDelta).toBeGreaterThan(0.5);
    expect(byRule['RULE-COLREG-14'].ablationDelta).toBeGreaterThan(byRule['RULE-COLREG-15'].ablationDelta);
    // Every verdict now carries the governed component for the localization confusion cell.
    expect(bound.perRule.every((p) => typeof p.governedComponent === 'string')).toBe(true);
  });

  it('a leaking learner relies on nothing — every rule reads redundant', async () => {
    const leaking = await runLeakageExperiment(leakingLearnerCompleter(), 'leaking', auditCfg);
    expect(leaking.perRule.every((p) => p.ablationDelta < 0.15)).toBe(true);
    expect(leaking.perRule.every((p) => p.verdict === 'leaking')).toBe(true);
    // On these standard rules the leaking learner is COMPETENT (it applies memorized COLREGs and
    // complies, regret-with ≈ 0), so the split reads `redundant` — the corpus is genuinely dead
    // weight here, the opposite pole from the `unusable` hazard case above.
    expect(leaking.perRule.every((p) => p.regretWith < 10)).toBe(true);
    expect(leaking.perRule.every((p) => p.leakMode === 'redundant')).toBe(true);
  });
});
