import { describe, it, expect } from 'vitest';
import type { SimScenario, Vessel } from '../types';
import { KNOTS_TO_MS } from '../types';
import { colregGraphNodes } from '../../../corpus/colreg/nodes';
import { renderCorpus, renderScenario, parseDecision, decisionToManeuver, buildPrompt } from '../llm-learner';

const own: Vessel = { id: 'own', x: 0, y: 0, psi: 0, v: 6, lengthM: 100 };
const scenario: SimScenario = {
  id: 't', label: 't', description: '', difficulty: 'intermediate',
  ownship: own,
  targets: [{ id: 'A', label: 'A', x: 3000, y: 3000, psi: -Math.PI / 2, v: 5 * KNOTS_TO_MS, lengthM: 100 }],
  visibility: 'clear', horizonS: 1000, dt: 4, intendedHeading: 0,
};

describe('renderCorpus (the RAG context)', () => {
  it('lists rule nodes with their ids', () => {
    const text = renderCorpus(colregGraphNodes);
    expect(text).toContain('[RULE-COLREG-15]');
    expect(text).toContain('[RULE-COLREG-14]');
  });
  it('ablation drops a node from the context', () => {
    const text = renderCorpus(colregGraphNodes, { ablateIds: ['RULE-COLREG-15'] });
    expect(text).not.toContain('[RULE-COLREG-15]');
    expect(text).toContain('[RULE-COLREG-14]');
  });
  it('counterfactual swaps a node’s content', () => {
    const text = renderCorpus(colregGraphNodes, { counterfactual: { 'RULE-COLREG-15': 'give way to the vessel on your PORT side' } });
    expect(text).toContain('[RULE-COLREG-15] give way to the vessel on your PORT side');
  });
});

describe('renderScenario', () => {
  it('describes ownship and a starboard target', () => {
    const text = renderScenario(scenario);
    expect(text).toMatch(/Ownship: heading 0°/);
    expect(text).toContain('starboard');
    expect(text).toContain('Target A');
  });
  it('flags restricted visibility', () => {
    expect(renderScenario({ ...scenario, visibility: 'restricted' })).toContain('restricted');
  });
});

describe('parseDecision', () => {
  it('parses a clean JSON reply', () => {
    const d = parseDecision('{"courseOffsetDeg": 30, "speedFactor": 0.8, "citedRules": ["RULE-COLREG-15"], "abstained": false}');
    expect(d.courseOffsetDeg).toBe(30);
    expect(d.speedFactor).toBe(0.8);
    expect(d.citedRules).toEqual(['RULE-COLREG-15']);
  });
  it('tolerates code fences and prose, and clamps out-of-range values', () => {
    const d = parseDecision('Sure!\n```json\n{"courseOffsetDeg": 200, "speedFactor": 5, "abstained": false}\n```');
    expect(d.courseOffsetDeg).toBe(90); // clamped
    expect(d.speedFactor).toBe(1); // clamped
  });
  it('takes the first balanced object when prose (with braces) follows the JSON', () => {
    // The real Sonnet-on-`all` failure: valid JSON, then an explanation that itself contains braces.
    const reply =
      '{"courseOffsetDeg": 35, "speedFactor": 1, "citedRules": ["RULE-COLREG-15"], "abstained": false}\n\n' +
      'I altered to starboard per Rule {15} to pass astern of the give-way vessel.';
    const d = parseDecision(reply);
    expect(d.courseOffsetDeg).toBe(35);
    expect(d.citedRules).toEqual(['RULE-COLREG-15']);
  });
  it('handles a nested object and stops at its matching brace', () => {
    const d = parseDecision('{"courseOffsetDeg": 10, "speedFactor": 1, "meta": {"a": 1}, "abstained": false} trailing');
    expect(d.courseOffsetDeg).toBe(10);
  });
  it('throws with a snippet of the reply when there is no JSON', () => {
    expect(() => parseDecision('no json here')).toThrow(/no json here/i);
  });
  it('repairs UNQUOTED citedRules tokens (the Llama-4 / Nova slip) instead of failing', () => {
    const d = parseDecision('{"courseOffsetDeg": 30, "speedFactor": 1.0, "citedRules": [RULE-COLREG-15, RULE_HAZARD_01], "abstained": false, "reasoning": "x"}');
    expect(d.courseOffsetDeg).toBe(30);
    expect(d.citedRules).toEqual(['RULE-COLREG-15', 'RULE_HAZARD_01']);
    expect(d.abstained).toBe(false);
  });
});

describe('decisionToManeuver', () => {
  it('holds course when the learner abstains', () => {
    const m = decisionToManeuver({ courseOffsetDeg: 40, speedFactor: 0.5, citedRules: [], abstained: true });
    expect(m).toEqual({ courseOffset: 0, speedFactor: 1, actTime: 0 });
  });
  it('converts degrees to radians otherwise', () => {
    const m = decisionToManeuver({ courseOffsetDeg: 90, speedFactor: 0.75, citedRules: [], abstained: false });
    expect(m.courseOffset).toBeCloseTo(Math.PI / 2);
    expect(m.speedFactor).toBe(0.75);
  });
});

describe('buildPrompt', () => {
  it('embeds the corpus and forbids outside knowledge', () => {
    const p = buildPrompt(scenario, renderCorpus(colregGraphNodes));
    expect(p).toContain('Use ONLY the numbered rules');
    expect(p).toContain('[RULE-COLREG-15]');
    expect(p).toContain('Target A');
  });
});
