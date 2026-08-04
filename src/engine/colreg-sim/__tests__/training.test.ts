import { describe, it, expect } from 'vitest';
import { imazuBenchmark } from '../../../corpus/colreg/imazu';
import { colregSimScenarios } from '../../../corpus/colreg/simulator-scenarios';
import { runBenchmark, runCase } from '../benchmark';
import { learnerPolicy, NO_COMPETENCE, FULL_COMPETENCE, ablate, competenceAtStage, CURRICULUM } from '../learner-policy';
import { diagnoseCorpusGaps } from '../diagnose';

const naive = runBenchmark(imazuBenchmark, learnerPolicy(NO_COMPETENCE));
const full = runBenchmark(imazuBenchmark, learnerPolicy(FULL_COMPETENCE));

describe('competence → task performance', () => {
  it('a fully-competent learner vastly outperforms a no-knowledge learner', () => {
    expect(full.clearedRate).toBeGreaterThan(naive.clearedRate + 0.4);
    expect(full.meanJ).toBeLessThan(naive.meanJ);
    expect(full.meanCompliancePenalty).toBeLessThan(naive.meanCompliancePenalty);
  });

  it('the curriculum reaches full competence at its last stage', () => {
    const last = runBenchmark(imazuBenchmark, learnerPolicy(competenceAtStage(CURRICULUM.length)));
    expect(last.clearedRate).toBeCloseTo(full.clearedRate, 5);
  });
});

describe('each ablated knowledge component degrades the metric it governs', () => {
  it('removing "starboard" raises the COLREG compliance penalty', () => {
    const r = runBenchmark(imazuBenchmark, learnerPolicy(ablate(FULL_COMPETENCE, 'starboard')));
    expect(r.meanCompliancePenalty).toBeGreaterThan(full.meanCompliancePenalty + 0.05);
  });
  it('removing "substantial" raises the compliance penalty', () => {
    const r = runBenchmark(imazuBenchmark, learnerPolicy(ablate(FULL_COMPETENCE, 'substantial')));
    expect(r.meanCompliancePenalty).toBeGreaterThan(full.meanCompliancePenalty);
  });
  it('removing "role" collapses performance to about the no-knowledge level', () => {
    const r = runBenchmark(imazuBenchmark, learnerPolicy(ablate(FULL_COMPETENCE, 'role')));
    expect(r.clearedRate).toBeLessThan(full.clearedRate - 0.3);
  });
  it('removing "multiShip" lowers the cleared rate on multi-target cases', () => {
    const multi = imazuBenchmark.filter((s) => s.targets.length > 1);
    const fullMulti = runBenchmark(multi, learnerPolicy(FULL_COMPETENCE));
    const ablated = runBenchmark(multi, learnerPolicy(ablate(FULL_COMPETENCE, 'multiShip')));
    expect(ablated.clearedRate).toBeLessThan(fullMulti.clearedRate);
  });
  it('removing "safeSpeed" fails the safe-speed rule in restricted visibility', () => {
    const restricted = colregSimScenarios.find((s) => s.id === 'SIM-RESTRICTED')!;
    const withSpeed = runCase(restricted, learnerPolicy(FULL_COMPETENCE));
    const without = runCase(restricted, learnerPolicy(ablate(FULL_COMPETENCE, 'safeSpeed')));
    expect(without.metrics.compliancePenalty).toBeGreaterThan(withSpeed.metrics.compliancePenalty);
  });
});

describe('corpus-gap diagnosis localizes the missing knowledge', () => {
  it('a starboard-ablated learner is diagnosed as a starboard-rule gap', () => {
    const r = runBenchmark(imazuBenchmark, learnerPolicy(ablate(FULL_COMPETENCE, 'starboard')));
    const findings = diagnoseCorpusGaps(imazuBenchmark, r.perCase);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].component).toBe('starboard');
    expect(findings[0].inspect).toContain('RULE-COLREG-15');
  });
  it('a fully-competent learner shows no starboard/role gap', () => {
    const findings = diagnoseCorpusGaps(imazuBenchmark, full.perCase);
    expect(findings.find((f) => f.component === 'starboard')).toBeUndefined();
    expect(findings.find((f) => f.component === 'role')).toBeUndefined();
  });
});
