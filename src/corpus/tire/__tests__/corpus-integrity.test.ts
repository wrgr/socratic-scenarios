/**
 * Corpus integrity for the Roadside Tire Change domain.
 * Runs the shared descriptor validator (mirrors the AJP structural checks) plus a
 * domain-specific scenario count.
 */
import { describe, it, expect } from 'vitest';
import { tireDomain } from '../index';
import { collectDomainIssues } from '../../domain-integrity';

describe('Roadside Tire Change corpus integrity', () => {
  it('has no structural integrity issues', () => {
    const issues = collectDomainIssues(tireDomain);
    expect(issues, issues.join('\n')).toEqual([]);
  });

  it('defines 5 scenarios', () => {
    expect(tireDomain.scenarios).toHaveLength(5);
  });

  it('every fault scenario references a consequence that exists', () => {
    const consequenceIds = new Set(tireDomain.consequences.map((c) => c.id));
    const missing = tireDomain.scenarios
      .flatMap((s) => s.faultInjections)
      .filter((fi) => !consequenceIds.has(fi.missedConsequenceId))
      .map((fi) => fi.missedConsequenceId);
    expect(missing).toEqual([]);
  });
});
