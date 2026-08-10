import { describe, it, expect } from 'vitest';
import { sufficiencyVerdict } from '../audit-sufficiency';

const base = { relied: 0, redundant: 0, unusable: 0, inconclusive: 0, closedBookContaminated: false, queries: 10 };

describe('corpus sufficiency verdict', () => {
  it('every item relied upon → contributing', () => {
    const s = sufficiencyVerdict({ ...base, relied: 5 });
    expect(s.verdict).toBe('contributing');
    expect(s.headline).toMatch(/CONTRIBUTING/);
  });

  it('nothing relied upon + all redundant + closed-book contamination → FALSE SUFFICIENCY', () => {
    const s = sufficiencyVerdict({ ...base, redundant: 5, closedBookContaminated: true });
    expect(s.verdict).toBe('redundant');
    expect(s.headline).toMatch(/FALSE SUFFICIENCY/);
    expect(s.headline).toMatch(/closed-book/);
  });

  it('nothing relied upon + items unusable → unusable (model-limited, not coverage)', () => {
    const s = sufficiencyVerdict({ ...base, unusable: 4 });
    expect(s.verdict).toBe('unusable');
    expect(s.headline).toMatch(/UNUSABLE/);
  });

  it('a mix → partial with the breakdown', () => {
    const s = sufficiencyVerdict({ ...base, relied: 3, redundant: 2, unusable: 1 });
    expect(s.verdict).toBe('partial');
    expect(s.headline).toMatch(/3 relied-on/);
    expect(s.headline).toMatch(/2 redundant/);
    expect(s.headline).toMatch(/1 unusable/);
  });

  it('always attaches the bounded-query scope caveat', () => {
    for (const c of [{ relied: 5 }, { redundant: 5 }, { unusable: 5 }, { relied: 2, redundant: 2 }]) {
      const s = sufficiencyVerdict({ ...base, ...c });
      expect(s.scope).toMatch(/relative to the query distribution/);
      expect(s.scope).toMatch(/10 queries/);
    }
  });
});
