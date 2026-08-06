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

  it('covers the full amalgamated rulebook (Rules 1–41) and Annexes I–V', () => {
    const ids = new Set(colregDomain.nodes.map((n) => n.id));
    // Every numbered rule 1–41 (Parts A–F) has a TheoryReference node.
    for (let n = 1; n <= 41; n++) {
      const id = `RULE-COLREG-${String(n).padStart(2, '0')}`;
      expect(ids.has(id), `missing ${id}`).toBe(true);
    }
    // All five annexes are present.
    for (const annex of ['I', 'II', 'III', 'IV', 'V']) {
      expect(ids.has(`ANNEX-COLREG-${annex}`), `missing ANNEX-COLREG-${annex}`).toBe(true);
    }
  });

  it('teaches the added operational topics via probes', () => {
    const probeIds = new Set(colregDomain.probes.map((p) => p.id));
    for (const probe of [
      'PROBE-COLREG-LIGHTS-001',
      'PROBE-COLREG-NARROW-CHANNEL-001',
      'PROBE-COLREG-TSS-001',
      'PROBE-COLREG-SAILING-001',
      'PROBE-COLREG-INLAND-INTL-001',
      'PROBE-COLREG-FOG-SIGNALS-001',
    ]) {
      expect(probeIds.has(probe), `missing ${probe}`).toBe(true);
    }
  });
});
