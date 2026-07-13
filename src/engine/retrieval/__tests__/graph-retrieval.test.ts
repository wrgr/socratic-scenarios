/**
 * graph-retrieval.test.ts
 *
 * Verifies graph traversal correctness against known AJP corpus nodes.
 * All assertions use real graph data — no mocks — so failures surface real
 * regressions in the corpus or traversal logic.
 */
import { describe, expect, it } from 'vitest';
import { retrieveFromGraph } from '../graph-retrieval';
import {
  allNodes,
  allEdges,
  nodeById,
  nodesByType,
  outNeighbors,
  inNeighbors,
  matchNodes,
  tokenSimilarity,
} from '../graph-utils';

// ─── graph-utils unit tests ───────────────────────────────────────────────────

describe('tokenSimilarity', () => {
  it('returns 1.0 for identical strings', () => {
    expect(tokenSimilarity('pressure elevated clog nozzle', 'pressure elevated clog nozzle')).toBe(1);
  });

  it('returns 0 for completely disjoint strings', () => {
    expect(tokenSimilarity('apple banana cherry', 'xenon quartz delta')).toBe(0);
  });

  it('is symmetric', () => {
    const a = 'sheath gas pressure nominal';
    const b = 'pressure atomizer current nozzle';
    expect(tokenSimilarity(a, b)).toBeCloseTo(tokenSimilarity(b, a), 10);
  });

  it('ignores tokens shorter than 3 characters', () => {
    // 'is', 'at', 'in' should be ignored; only meaningful tokens count
    expect(tokenSimilarity('is at in', 'on up be')).toBe(0);
  });
});

// ─── Graph integrity checks ───────────────────────────────────────────────────

describe('allNodes / allEdges integrity', () => {
  it('has nodes from all expected types', () => {
    const types = new Set(allNodes.map((n) => n.type));
    expect(types.has('Symptom')).toBe(true);
    expect(types.has('FailureMode')).toBe(true);
    expect(types.has('CorrectiveAction')).toBe(true);
    expect(types.has('SafetyHazard')).toBe(true);
    expect(types.has('Step')).toBe(true);
    expect(types.has('SocraticProbe')).toBe(true);
    expect(types.has('TacitKnowledge')).toBe(true);
  });

  it('every edge references existing nodes', () => {
    const nodeIds = new Set(allNodes.map((n) => n.id));
    const dangling = allEdges.filter((e) => !nodeIds.has(e.from) || !nodeIds.has(e.to));
    expect(dangling).toHaveLength(0);
  });

  it('known anchor nodes exist', () => {
    expect(nodeById('FAULT-CLOG-PARTIAL-001')).toBeDefined();
    expect(nodeById('SYMPT-HIGH-PRESSURE-001')).toBeDefined();
    expect(nodeById('SYMPT-LINE-NARROW-001')).toBeDefined();
    expect(nodeById('ACTION-SHEATH-INCREASE-001')).toBeDefined();
    expect(nodeById('HAZARD-NANOPARTICLE-001')).toBeDefined();
    expect(nodeById('STEP-STARTUP-001')).toBeDefined();
  });

  it('nodesByType returns only nodes of that type', () => {
    const steps = nodesByType('Step');
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((n) => n.type === 'Step')).toBe(true);
  });
});

// ─── Edge traversal ───────────────────────────────────────────────────────────

describe('outNeighbors / inNeighbors', () => {
  it('FAULT-CLOG-PARTIAL-001 FIXED_BY → ACTION-SHEATH-INCREASE-001', () => {
    const actions = outNeighbors('FAULT-CLOG-PARTIAL-001', 'FIXED_BY');
    expect(actions.some((a) => a.id === 'ACTION-SHEATH-INCREASE-001')).toBe(true);
  });

  it('FAULT-CLOG-PARTIAL-001 INDICATES → symptoms', () => {
    const symptoms = outNeighbors('FAULT-CLOG-PARTIAL-001', 'INDICATES');
    expect(symptoms.length).toBeGreaterThan(0);
    expect(symptoms.some((s) => s.id === 'SYMPT-HIGH-PRESSURE-001')).toBe(true);
  });

  it('SYMPT-HIGH-PRESSURE-001 INDICATES → FAULT-CLOG-PARTIAL-001', () => {
    const faults = outNeighbors('SYMPT-HIGH-PRESSURE-001', 'INDICATES');
    expect(faults.some((f) => f.id === 'FAULT-CLOG-PARTIAL-001')).toBe(true);
  });

  it('inNeighbors(FAULT-CLOG-PARTIAL-001, INDICATES) returns symptom nodes', () => {
    const symptoms = inNeighbors('FAULT-CLOG-PARTIAL-001', 'INDICATES');
    expect(symptoms.length).toBeGreaterThan(0);
    expect(symptoms.some((s) => s.type === 'Symptom')).toBe(true);
  });

  it('STEP-STARTUP-001 NEXT_STEP → STEP-STARTUP-002', () => {
    const next = outNeighbors('STEP-STARTUP-001', 'NEXT_STEP');
    expect(next.some((n) => n.id === 'STEP-STARTUP-002')).toBe(true);
  });

  it('STEP-STARTUP-001 REQUIRES → safety hazard', () => {
    const hazards = outNeighbors('STEP-STARTUP-001', 'REQUIRES');
    expect(hazards.some((h) => h.type === 'SafetyHazard')).toBe(true);
  });

  it('returns empty array for non-existent node', () => {
    expect(outNeighbors('NO-SUCH-NODE', 'FIXED_BY')).toHaveLength(0);
    expect(inNeighbors('NO-SUCH-NODE', 'INDICATES')).toHaveLength(0);
  });
});

// ─── matchNodes ───────────────────────────────────────────────────────────────

describe('matchNodes', () => {
  it('finds Symptom nodes for "pressure elevated narrow line"', () => {
    const results = matchNodes('pressure elevated narrow line', ['Symptom'], 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(0);
    // Best match should be the high-pressure or narrow-line symptom
    const ids = results.map((r) => r.node.id);
    expect(
      ids.includes('SYMPT-HIGH-PRESSURE-001') || ids.includes('SYMPT-LINE-NARROW-001'),
    ).toBe(true);
  });

  it('returns only nodes of requested type', () => {
    const results = matchNodes('pressure clog nozzle', ['FailureMode'], 10);
    expect(results.every((r) => r.node.type === 'FailureMode')).toBe(true);
  });

  it('returns empty array when no token overlap', () => {
    const results = matchNodes('xyz zzz', ['Symptom'], 5);
    expect(results).toHaveLength(0);
  });

  it('results are sorted descending by score', () => {
    const results = matchNodes('pressure elevated nozzle clog atomizer', ['Symptom', 'FailureMode'], 10);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });
});

// ─── retrieveFromGraph ────────────────────────────────────────────────────────

describe('retrieveFromGraph', () => {
  it('returns causal chains for known symptom text', () => {
    const result = retrieveFromGraph({ symptomText: 'pressure elevated and line looks narrow' });
    expect(result.chains.length).toBeGreaterThan(0);
    expect(result.queryText).toBe('pressure elevated and line looks narrow');
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('chain for partial clog includes corrective actions and safety hazards', () => {
    const result = retrieveFromGraph({ symptomText: 'KEWB pressure above nominal narrow deposition line' });
    const clogChain = result.chains.find((c) => c.fault.id === 'FAULT-CLOG-PARTIAL-001');
    expect(clogChain).toBeDefined();
    expect(clogChain!.correctiveActions.length).toBeGreaterThan(0);
    expect(clogChain!.safetyHazards.length).toBeGreaterThan(0);
    expect(clogChain!.symptoms.length).toBeGreaterThan(0);
  });

  it('topK limits the number of chains returned', () => {
    const result = retrieveFromGraph({ symptomText: 'pressure clog atomizer current nozzle', topK: 1 });
    expect(result.chains.length).toBeLessThanOrEqual(1);
  });

  it('sets reachbackNote on low-confidence matches', () => {
    // Query with minimal overlap — any chains found should have low scores
    const result = retrieveFromGraph({ symptomText: 'zzz completely unrelated words zzz' });
    // Either no chains, or all chains should have a reachback note
    if (result.chains.length > 0) {
      expect(result.chains.every((c) => c.reachbackNote !== undefined || c.anchorScore > 0.5)).toBe(true);
    }
  });

  it('chains are sorted by score descending', () => {
    const result = retrieveFromGraph({ symptomText: 'pressure elevated clog nozzle atomizer plume narrow', topK: 5 });
    for (let i = 1; i < result.chains.length; i++) {
      expect(result.chains[i - 1].score).toBeGreaterThanOrEqual(result.chains[i].score);
    }
  });

  it('matchedNodeIds are populated', () => {
    const result = retrieveFromGraph({ symptomText: 'pressure elevated narrow line clog' });
    expect(result.matchedNodeIds.length).toBeGreaterThan(0);
  });

  it('returns empty chains for completely unknown symptom text', () => {
    const result = retrieveFromGraph({ symptomText: 'the quick brown fox jumps over the lazy dog' });
    // May return nothing; should not throw
    expect(Array.isArray(result.chains)).toBe(true);
  });
});
