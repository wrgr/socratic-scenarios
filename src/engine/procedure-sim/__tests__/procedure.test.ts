import { describe, it, expect } from 'vitest';
import { tireChangeProcedure as P } from '../../../corpus/tire/procedure';
import {
  scoreAttempt,
  expertAttempt,
  recklessAttempt,
  learnerAttempt,
  competenceAtStage,
  ablate,
  FULL_COMPETENCE,
  NO_COMPETENCE,
  PROC_CURRICULUM,
  type ProcedureCompetence,
  type ProcMetrics,
} from '../index';
import { LearnerAgent, eloEstimator, type DomainModel, type EvidenceEvent } from '../../learner-agent';

const score = (theta: ProcedureCompetence) => scoreAttempt(P, learnerAttempt(P, theta));

describe('procedure instrument — construct validity', () => {
  it('the expert scores a perfect, violation-free run (J = 0)', () => {
    const r = scoreAttempt(P, expertAttempt(P));
    expect(r.J).toBe(0);
    expect(r.safetyViolation).toBe(false);
    expect(r.metrics).toEqual<ProcMetrics>({
      coreCompleteness: 1,
      finishCompleteness: 1,
      safetyScore: 1,
      orderScore: 1,
    });
  });

  it('a reckless (skips-safety) baseline is caught as a safety violation, far worse than expert', () => {
    const reckless = scoreAttempt(P, recklessAttempt(P));
    const expert = scoreAttempt(P, expertAttempt(P));
    expect(reckless.safetyViolation).toBe(true);
    expect(reckless.J).toBeGreaterThan(expert.J + 50);
    // It did the mechanical job — the instrument separates "competent-but-unsafe"
    // from "incompetent" (the do-nothing learner is worse still).
    expect(reckless.metrics.coreCompleteness).toBe(1);
    expect(scoreAttempt(P, learnerAttempt(P, NO_COMPETENCE)).J).toBeGreaterThan(reckless.J);
  });
});

describe('procedure instrument — KC → single-metric identifiability', () => {
  const map: { flag: keyof ProcedureCompetence; metric: keyof ProcMetrics }[] = [
    { flag: 'safety', metric: 'safetyScore' },
    { flag: 'coreSteps', metric: 'coreCompleteness' },
    { flag: 'sequencing', metric: 'orderScore' },
    { flag: 'finishing', metric: 'finishCompleteness' },
  ];
  const full = score(FULL_COMPETENCE).metrics;

  for (const { flag, metric } of map) {
    it(`ablating "${flag}" degrades only ${metric}`, () => {
      const m = score(ablate(FULL_COMPETENCE, flag)).metrics;
      expect(m[metric]).toBeLessThan(full[metric]); // the governed metric drops
      for (const other of Object.keys(m) as (keyof ProcMetrics)[]) {
        if (other !== metric) expect(m[other]).toBe(1); // every other metric is untouched
      }
    });
  }
});

describe('procedure instrument — competence → performance gradient', () => {
  it('acquiring the curriculum in order monotonically lowers J to 0', () => {
    const js = Array.from({ length: PROC_CURRICULUM.length + 1 }, (_, s) =>
      scoreAttempt(P, learnerAttempt(P, competenceAtStage(s))).J,
    );
    for (let i = 1; i < js.length; i++) expect(js[i]).toBeLessThan(js[i - 1]);
    expect(js[js.length - 1]).toBe(0);
  });

  it('the safety step is what clears the hard violation (safety-first curriculum)', () => {
    expect(scoreAttempt(P, learnerAttempt(P, competenceAtStage(0))).safetyViolation).toBe(true);
    expect(scoreAttempt(P, learnerAttempt(P, competenceAtStage(1))).safetyViolation).toBe(false);
  });
});

describe('pipeline: procedure outcomes drive the generic learner agent (domain #2)', () => {
  const domain: DomainModel = {
    id: 'tire',
    kcs: [
      { id: 'safety', safetyCritical: true },
      { id: 'coreSteps' },
      { id: 'sequencing' },
      { id: 'finishing' },
    ],
  };
  const metricOf: Record<string, keyof ProcMetrics> = {
    safety: 'safetyScore',
    coreSteps: 'coreCompleteness',
    sequencing: 'orderScore',
    finishing: 'finishCompleteness',
  };

  /** Run `trials` attempts by a θ-learner, feeding each competence's governed metric
   *  as an outcome into the agent. */
  function drive(theta: ProcedureCompetence, trials = 8): LearnerAgent {
    const agent = new LearnerAgent(domain, eloEstimator());
    let t = 0;
    for (let i = 0; i < trials; i++) {
      const m = scoreAttempt(P, learnerAttempt(P, theta)).metrics;
      for (const kc of domain.kcs) {
        const e: EvidenceEvent = {
          timestamp: ++t,
          kcIds: [kc.id],
          itemId: `trial-${i}`,
          outcome: m[metricOf[kc.id]],
          kind: 'scenario',
          source: 'simulated',
        };
        agent.observe(e);
      }
    }
    return agent;
  }

  it('a fully-competent learner drives every KC mastery high', () => {
    const agent = drive(FULL_COMPETENCE);
    for (const kc of domain.kcs) expect(agent.estimate(kc.id).mastery).toBeGreaterThan(0.8);
  });

  it('a safety-ablated learner is diagnosed low on safety but competent elsewhere', () => {
    const agent = drive(ablate(FULL_COMPETENCE, 'safety'));
    expect(agent.estimate('safety').mastery).toBeLessThan(0.2);
    expect(agent.estimate('coreSteps').mastery).toBeGreaterThan(0.8);
    expect(agent.estimate('finishing').mastery).toBeGreaterThan(0.8);
  });
});
