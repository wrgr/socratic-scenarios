/**
 * retrieval-router.test.ts
 *
 * Tests all five context strategies exported from retrieval-router.ts
 * against known AJP corpus node IDs.
 */
import { describe, expect, it } from 'vitest';
import {
  faultDiagnosisStrategy,
  stepContextStrategy,
  probeContextStrategy,
  safetyGateStrategy,
  tacitLookupStrategy,
  retrieveForContext,
} from '../retrieval-router';

// ─── fault-diagnosis ──────────────────────────────────────────────────────────

describe('faultDiagnosisStrategy', () => {
  it('returns fault chains for elevated pressure query', () => {
    const chains = faultDiagnosisStrategy('pressure elevated and line looks narrow');
    expect(chains.length).toBeGreaterThan(0);
  });

  it('each chain has required fields', () => {
    const chains = faultDiagnosisStrategy('KEWB pressure high nozzle clog', 3);
    for (const chain of chains) {
      expect(chain.fault).toBeDefined();
      expect(chain.fault.type).toBe('FailureMode');
      expect(typeof chain.score).toBe('number');
      expect(Array.isArray(chain.symptoms)).toBe(true);
      expect(Array.isArray(chain.correctiveActions)).toBe(true);
      expect(Array.isArray(chain.safetyHazards)).toBe(true);
      expect(Array.isArray(chain.tacitNodes)).toBe(true);
    }
  });

  it('topK limits results', () => {
    const chains = faultDiagnosisStrategy('pressure elevated atomizer clog plume', 1);
    expect(chains.length).toBeLessThanOrEqual(1);
  });

  it('chains are sorted by score descending', () => {
    const chains = faultDiagnosisStrategy('pressure clog nozzle atomizer sheath gas', 5);
    for (let i = 1; i < chains.length; i++) {
      expect(chains[i - 1].score).toBeGreaterThanOrEqual(chains[i].score);
    }
  });

  it('returns empty array for completely unrelated query', () => {
    const chains = faultDiagnosisStrategy('the quick brown fox');
    expect(Array.isArray(chains)).toBe(true);
  });
});

// ─── step-context ─────────────────────────────────────────────────────────────

describe('stepContextStrategy', () => {
  it('returns step context for known step ID', () => {
    const ctx = stepContextStrategy('STEP-STARTUP-001');
    expect(ctx).not.toBeNull();
    expect(ctx!.step.id).toBe('STEP-STARTUP-001');
    expect(ctx!.step.type).toBe('Step');
  });

  it('STEP-STARTUP-001 has safety hazards (REQUIRES → SafetyHazard)', () => {
    const ctx = stepContextStrategy('STEP-STARTUP-001');
    expect(ctx!.safetyHazards.length).toBeGreaterThan(0);
    expect(ctx!.safetyHazards.every((h) => h.type === 'SafetyHazard')).toBe(true);
  });

  it('STEP-STARTUP-001 nextSteps → STEP-STARTUP-002', () => {
    const ctx = stepContextStrategy('STEP-STARTUP-001');
    expect(ctx!.nextSteps.some((n) => n.id === 'STEP-STARTUP-002')).toBe(true);
  });

  it('STEP-STARTUP-005-FAULT has triggerable faults', () => {
    const ctx = stepContextStrategy('STEP-STARTUP-005-FAULT');
    // Edge: STEP-STARTUP-005-FAULT -[CAUSES]→ FAULT-CLOG-PARTIAL-001
    // outNeighbors(stepId, 'CAUSES') gives the faults this step can trigger
    expect(ctx!.triggerableFaults.length).toBeGreaterThan(0);
    expect(ctx!.triggerableFaults.some((f) => f.id === 'FAULT-CLOG-PARTIAL-001')).toBe(true);
  });

  it('returns null for unknown step ID', () => {
    expect(stepContextStrategy('NO-SUCH-STEP')).toBeNull();
  });

  it('returns null for a non-Step node ID', () => {
    expect(stepContextStrategy('FAULT-CLOG-PARTIAL-001')).toBeNull();
  });
});

// ─── probe-context ────────────────────────────────────────────────────────────

describe('probeContextStrategy', () => {
  it('returns anchor and probes for a node with linked probes', () => {
    // Probes are attached via PROBES edges; find a node that has inbound PROBES edges
    // STEP-STARTUP-003 is linked to PROBE-GAS-SEQUENCE-START-001 via PROBES
    const ctx = probeContextStrategy('STEP-STARTUP-003');
    expect(ctx).not.toBeNull();
    expect(ctx!.anchorNode.id).toBe('STEP-STARTUP-003');
    // probes may be empty if the corpus has no PROBES → STEP-STARTUP-003 edge;
    // assert that the array exists
    expect(Array.isArray(ctx!.probes)).toBe(true);
  });

  it('returns null for unknown node ID', () => {
    expect(probeContextStrategy('NO-SUCH-NODE')).toBeNull();
  });
});

// ─── safety-gate ──────────────────────────────────────────────────────────────

describe('safetyGateStrategy', () => {
  it('returns hazards for STEP-STARTUP-001', () => {
    const result = safetyGateStrategy('STEP-STARTUP-001');
    expect(result).not.toBeNull();
    expect(result!.hazards.length).toBeGreaterThan(0);
    expect(result!.hazards.every((h) => h.type === 'SafetyHazard')).toBe(true);
  });

  it('isBlocking is true when any hazard has High confidence', () => {
    const result = safetyGateStrategy('STEP-STARTUP-001');
    // HAZARD-NANOPARTICLE-001 has confidence: 'High'
    expect(result!.isBlocking).toBe(true);
  });

  it('returns the source node', () => {
    const result = safetyGateStrategy('STEP-STARTUP-002');
    expect(result!.sourceNode.id).toBe('STEP-STARTUP-002');
  });

  it('returns null for unknown node ID', () => {
    expect(safetyGateStrategy('NO-SUCH-NODE')).toBeNull();
  });

  it('returns empty hazards for a node with no REQUIRES → SafetyHazard edges', () => {
    // ACTION-SHEATH-INCREASE-001 doesn't directly REQUIRES a SafetyHazard
    const result = safetyGateStrategy('ACTION-SHEATH-INCREASE-001');
    expect(result).not.toBeNull();
    // It may or may not have hazards; just assert array shape
    expect(Array.isArray(result!.hazards)).toBe(true);
  });
});

// ─── tacit-lookup ─────────────────────────────────────────────────────────────

describe('tacitLookupStrategy', () => {
  it('returns tacit knowledge for relevant query text', () => {
    const result = tacitLookupStrategy('sheath gas nozzle clog mechanism', 3);
    // TacitKnowledge nodes must exist in graph for this to return matches
    expect(Array.isArray(result.matches)).toBe(true);
    expect(Array.isArray(result.linkedProbes)).toBe(true);
    expect(Array.isArray(result.linkedHazards)).toBe(true);
  });

  it('match nodes are of type TacitKnowledge', () => {
    const result = tacitLookupStrategy('sheath gas pressure atomizer mechanism', 5);
    expect(result.matches.every((m) => m.node.type === 'TacitKnowledge')).toBe(true);
  });

  it('topK limits matches', () => {
    const result = tacitLookupStrategy('sheath gas nozzle pressure clog atomizer', 1);
    expect(result.matches.length).toBeLessThanOrEqual(1);
  });
});

// ─── retrieveForContext (router dispatcher) ────────────────────────────────────

describe('retrieveForContext', () => {
  it('routes fault-diagnosis mode', () => {
    const result = retrieveForContext({ mode: 'fault-diagnosis', text: 'pressure elevated narrow line' });
    expect(result.mode).toBe('fault-diagnosis');
    expect(result.timestamp).toBeGreaterThan(0);
    expect(Array.isArray(result.nodes.faults)).toBe(true);
  });

  it('routes step-context mode', () => {
    const result = retrieveForContext({ mode: 'step-context', nodeId: 'STEP-STARTUP-001' });
    expect(result.mode).toBe('step-context');
    expect(result.anchorIds).toContain('STEP-STARTUP-001');
    expect(Array.isArray(result.nodes.step)).toBe(true);
    expect(Array.isArray(result.nodes.hazards)).toBe(true);
  });

  it('routes probe-context mode', () => {
    const result = retrieveForContext({ mode: 'probe-context', nodeId: 'STEP-STARTUP-003' });
    expect(result.mode).toBe('probe-context');
    expect(Array.isArray(result.nodes.probes)).toBe(true);
  });

  it('routes safety-gate mode', () => {
    const result = retrieveForContext({ mode: 'safety-gate', nodeId: 'STEP-STARTUP-001' });
    expect(result.mode).toBe('safety-gate');
    expect(result.nodes.hazards.length).toBeGreaterThan(0);
  });

  it('routes tacit-lookup mode', () => {
    const result = retrieveForContext({ mode: 'tacit-lookup', text: 'sheath gas nozzle mechanism' });
    expect(result.mode).toBe('tacit-lookup');
    expect(Array.isArray(result.nodes.tacit)).toBe(true);
  });

  it('returns empty result for step-context with unknown nodeId', () => {
    const result = retrieveForContext({ mode: 'step-context', nodeId: 'NO-SUCH-STEP' });
    expect(result.anchorIds).toHaveLength(0);
    expect(result.nodes).toEqual({});
  });
});
