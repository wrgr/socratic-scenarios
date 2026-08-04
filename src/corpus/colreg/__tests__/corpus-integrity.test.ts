/**
 * Corpus integrity for the COLREG Collision Avoidance domain.
 * Runs the shared descriptor validator plus a domain-specific scenario count.
 */
import { describe, it, expect } from 'vitest';
import { colregDomain } from '../index';
import { collectDomainIssues } from '../../domain-integrity';

describe('COLREG corpus integrity', () => {
  it('has no structural integrity issues', () => {
    const issues = collectDomainIssues(colregDomain);
    expect(issues, issues.join('\n')).toEqual([]);
  });

  it('defines 5 scenarios', () => {
    expect(colregDomain.scenarios).toHaveLength(5);
  });

  it('covers the four core encounter rules in its graph', () => {
    const ids = new Set(colregDomain.nodes.map((n) => n.id));
    for (const rule of ['RULE-COLREG-13', 'RULE-COLREG-14', 'RULE-COLREG-15', 'RULE-COLREG-17']) {
      expect(ids.has(rule), `missing ${rule}`).toBe(true);
    }
  });
});
