/**
 * provenance.test.ts — the grounded/naive tag and the ablation diff logic.
 * Pure functions, no API key required.
 */
import { describe, expect, it } from 'vitest';
import {
  isGrounded,
  extractGroundingNodeIds,
  tokenOverlap,
  diffEvaluations,
} from '../provenance';

// A sample string in the shape formatProbeRetrievalContext produces.
const SAMPLE_CONTEXT = `=== Background Knowledge (graph) ===
[TACIT-ESD-HANDLING-001 · relevance 42%]
ESD discipline: the discharge you cannot see or feel...

=== Safety Considerations ===
[HAZARD-ESD-001] ⚠ ESD wrist strap required — Static discharge can damage components.

=== Related Probe Concepts ===
[PROBE-ESD-PROTOCOL-001] Expected concepts: wrist strap, grounding`;

describe('isGrounded', () => {
  it('is false for missing/empty/whitespace context', () => {
    expect(isGrounded(undefined)).toBe(false);
    expect(isGrounded('')).toBe(false);
    expect(isGrounded('   \n ')).toBe(false);
  });
  it('is true for real corpus context', () => {
    expect(isGrounded(SAMPLE_CONTEXT)).toBe(true);
  });
});

describe('extractGroundingNodeIds', () => {
  it('recovers node ids from a formatted context (background, hazard, probe)', () => {
    expect(extractGroundingNodeIds(SAMPLE_CONTEXT).sort()).toEqual(
      ['HAZARD-ESD-001', 'PROBE-ESD-PROTOCOL-001', 'TACIT-ESD-HANDLING-001'],
    );
  });
  it('returns [] for no context and de-dupes repeats', () => {
    expect(extractGroundingNodeIds(undefined)).toEqual([]);
    expect(extractGroundingNodeIds('[TACIT-X-001] a [TACIT-X-001] b')).toEqual(['TACIT-X-001']);
  });
  it('does not pick up ordinary prose', () => {
    expect(extractGroundingNodeIds('the AJP nozzle is ceramic; no bracketed ids here')).toEqual([]);
  });
});

describe('tokenOverlap', () => {
  it('is 1 for identical text and for two empty strings', () => {
    expect(tokenOverlap('star pattern torque', 'star pattern torque')).toBe(1);
    expect(tokenOverlap('', '')).toBe(1);
  });
  it('is low for disjoint text', () => {
    expect(tokenOverlap('starboard alteration bearing', 'ceramic nozzle sinter')).toBeLessThan(0.2);
  });
});

describe('diffEvaluations', () => {
  it('flags NOT rag-dependent when grounded and ablated agree (baked-in)', () => {
    const same = { score: 0.8, feedback: 'You covered the star pattern and torque spec well.' };
    const d = diffEvaluations(same, { ...same });
    expect(d.scoreDelta).toBe(0);
    expect(d.feedbackSimilarity).toBe(1);
    expect(d.ragDependent).toBe(false);
  });

  it('flags rag-dependent on a material score change', () => {
    const d = diffEvaluations(
      { score: 0.9, feedback: 'Correct — grounded in the corpus.' },
      { score: 0.5, feedback: 'Correct — grounded in the corpus.' },
    );
    expect(d.scoreDelta).toBeCloseTo(0.4);
    expect(d.ragDependent).toBe(true);
  });

  it('flags rag-dependent when feedback diverges even at equal score', () => {
    const d = diffEvaluations(
      { score: 0.7, feedback: 'You named the KEWB pressure reading rule from the corpus context.' },
      { score: 0.7, feedback: 'Generally reasonable but vague about mechanisms.' },
    );
    expect(d.feedbackSimilarity).toBeLessThan(0.5);
    expect(d.ragDependent).toBe(true);
  });
});
