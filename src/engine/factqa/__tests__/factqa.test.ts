import { describe, it, expect } from 'vitest';
import {
  buildKB,
  runFactQAExperiment,
  boundQALearner,
  memorizedQALearner,
  ignorantQALearner,
  partiallyMemorizedQALearner,
  answerCorrect,
  normalizeAnswer,
  isAbstention,
  type FactQAConfig,
} from '../index';

const { facts, items } = buildKB();
const cfg: FactQAConfig = { facts, items };

describe('fact-QA verifier', () => {
  it('matches a value on token boundaries, not prefixes, and rejects abstentions', () => {
    expect(answerCorrect('The mineral is veltricite.', 'veltricite')).toBe(true);
    expect(answerCorrect('veltricite', 'veltricite')).toBe(true);
    expect(answerCorrect('dorn', 'dornalium')).toBe(false); // prefix must not match
    expect(answerCorrect("I don't know", 'veltricite')).toBe(false);
    expect(normalizeAnswer('The  Year, 2231!')).toBe('year 2231');
  });

  it('recognizes real abstention phrasings (not just the literal "I don\'t know")', () => {
    for (const s of [
      "I don't know",
      'The reference facts do not mention that.',
      'That information is not provided in the facts.',
      'It is not specified.',
      'There is no information about that.',
      'Unknown',
      'It cannot be determined from the reference facts.',
      "I'm unable to answer that from the provided facts.",
    ]) expect(isAbstention(s)).toBe(true);
    // But a wrong guess is NOT an abstention (the ignorant learner's failure mode).
    expect(isAbstention('unspecified')).toBe(false);
    expect(isAbstention('veltricite')).toBe(false);
    expect(isAbstention('Aada Nurmi')).toBe(false);
  });
});

describe('fact-QA necessity instrument — recovers the known ground truth (C1, second objective)', () => {
  it('judges a corpus-bound learner as corpus-bound, with necessity ≈ 1 and clean localization', async () => {
    const report = await runFactQAExperiment(boundQALearner(facts, items), 'mock-bound', cfg);
    // Fictional facts: the bound learner answers with the corpus, loses the answer when ablated.
    expect(report.perFact.every((p) => p.necessity > 0.5)).toBe(true);
    expect(report.perFact.every((p) => p.accWith > 0.9)).toBe(true);
    expect(report.perFact.every((p) => p.accWithout < 0.1)).toBe(true);
    // Follows the counterfactual (answers the false value when the corpus is altered).
    expect(report.perFact.every((p) => p.counterfactualFollowed)).toBe(true);
    // Abstains closed-book rather than inventing a fictional fact.
    expect(report.closedBookAbstained).toBe(true);
    expect(report.perFact.every((p) => p.verdict === 'corpus-bound')).toBe(true);
    // Localization: every verdict names the attribute it governs.
    expect(report.perFact.every((p) => typeof p.attr === 'string')).toBe(true);
  });

  it('judges a memorized learner as leaking/redundant (answers with or without the corpus)', async () => {
    const report = await runFactQAExperiment(memorizedQALearner(facts, items), 'mock-memorized', cfg);
    expect(report.perFact.every((p) => Math.abs(p.necessity) < 0.15)).toBe(true);
    expect(report.perFact.every((p) => p.accWith > 0.9)).toBe(true);
    expect(report.closedBookAbstained).toBe(false); // answered from memory = contamination
    expect(report.perFact.every((p) => p.verdict === 'leaking')).toBe(true);
    expect(report.perFact.every((p) => p.leakMode === 'redundant')).toBe(true);
  });

  it('judges an ignorant corpus-ignoring learner as leaking/unusable (wrong even with the corpus)', async () => {
    const report = await runFactQAExperiment(ignorantQALearner(), 'mock-ignorant', cfg);
    expect(report.perFact.every((p) => Math.abs(p.necessity) < 0.15)).toBe(true);
    expect(report.perFact.every((p) => p.accWith < 0.1)).toBe(true); // fails even with the fact present
    expect(report.perFact.every((p) => p.verdict === 'leaking')).toBe(true);
    expect(report.perFact.every((p) => p.leakMode === 'unusable')).toBe(true);
  });

  it('the corpus-value audit separates the three regimes on one instrument', async () => {
    const bound = (await runFactQAExperiment(boundQALearner(facts, items), 'b', cfg)).perFact;
    const memo = (await runFactQAExperiment(memorizedQALearner(facts, items), 'm', cfg)).perFact;
    const ign = (await runFactQAExperiment(ignorantQALearner(), 'i', cfg)).perFact;
    // Relied-on ranks strictly above both leaking regimes by necessity.
    const meanNec = (ps: { necessity: number }[]) => ps.reduce((s, p) => s + p.necessity, 0) / ps.length;
    expect(meanNec(bound)).toBeGreaterThan(meanNec(memo) + 0.5);
    expect(meanNec(bound)).toBeGreaterThan(meanNec(ign) + 0.5);
    // Redundant and unusable share ~0 necessity but split on with-corpus accuracy.
    expect(memo.every((p) => p.leakMode === 'redundant')).toBe(true);
    expect(ign.every((p) => p.leakMode === 'unusable')).toBe(true);
  });

  it('dose-response: mean necessity falls monotonically as the known-fact set grows (construct validity)', async () => {
    const meanNec = async (frac: number) => {
      const known = new Set(facts.slice(0, Math.round(frac * facts.length)).map((f) => f.id));
      const rep = await runFactQAExperiment(partiallyMemorizedQALearner(facts, items, known), `k${frac}`, cfg);
      return rep.perFact.reduce((s, p) => s + p.necessity, 0) / rep.perFact.length;
    };
    const curve = await Promise.all([0, 0.25, 0.5, 0.75, 1].map(meanNec));
    // Endpoints: naive = fully reliant, fully-taught = independent.
    expect(curve[0]).toBeGreaterThan(0.95);
    expect(curve[4]).toBeLessThan(0.05);
    // Monotone non-increasing across the whole gradient (no simulator, no step function).
    for (let i = 1; i < curve.length; i++) expect(curve[i]).toBeLessThanOrEqual(curve[i - 1] + 1e-9);
  });
});
