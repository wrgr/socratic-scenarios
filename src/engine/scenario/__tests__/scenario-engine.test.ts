/**
 * ScenarioEngine state machine tests.
 * Uses a minimal fixture scenario so tests are independent of corpus content.
 * Tests: initial state, normal advance, mentor gate, safety gate, fault injection,
 * consequence triggering, fault resolution, parseStudentAction, isComplete.
 */
import { describe, it, expect } from 'vitest';
import { ScenarioEngine } from '../engine';
import type { ScenarioDefinition } from '../types';

// ─── Minimal fixture scenario ─────────────────────────────────────

const FIXTURE: ScenarioDefinition = {
  id: 'TEST-SCENARIO-001',
  label: 'Test Scenario',
  description: 'Minimal fixture for unit tests.',
  difficulty: 'beginner',
  steps: [
    {
      id: 'STEP-001',
      phase: 'SETUP',
      narratorText: 'Step one — no gates.',
    },
    {
      id: 'STEP-002',
      phase: 'STARTUP',
      narratorText: 'Step two — has a mentor probe.',
      mentorProbeId: 'PROBE-GAS-SEQUENCE-START-001',
    },
    {
      id: 'STEP-003',
      phase: 'STARTUP',
      narratorText: 'Step three — has a safety gate and fault injection.',
      safetyGateNodeId: 'FAULT-GAS-SEQUENCE-WRONG-001',
      faultInjectionId: 'FAULT-GAS-SEQUENCE-WRONG-001',
    },
    {
      id: 'STEP-004',
      phase: 'PRINT',
      narratorText: 'Step four — final step.',
    },
  ],
  faultInjections: [
    {
      faultNodeId: 'FAULT-GAS-SEQUENCE-WRONG-001',
      triggerStepId: 'STEP-003',
      narratorAnnouncement: 'Wrong gas sequence detected.',
      missedConsequenceId: 'CONSEQUENCE-NANOPARTICLE-EXPOSURE-001',
    },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────

function make() {
  return new ScenarioEngine(FIXTURE);
}

// ─── Tests ────────────────────────────────────────────────────────

describe('ScenarioEngine — initial state', () => {
  it('starts at step 0 with SETUP phase', () => {
    const e = make();
    const s = e.getState();
    expect(s.currentStepIndex).toBe(0);
    expect(s.phase).toBe('SETUP');
  });

  it('has empty fault and consequence lists', () => {
    const e = make();
    const s = e.getState();
    expect(s.activeFaultIds).toHaveLength(0);
    expect(s.triggeredConsequenceIds).toHaveLength(0);
    expect(s.resolvedFaultIds).toHaveLength(0);
  });

  it('step 0 has no mentor probe or safety gate (probe/gate satisfied = true)', () => {
    const e = make();
    const s = e.getState();
    expect(s.mentorProbeSatisfied).toBe(true);
    expect(s.safetyGateAcknowledged).toBe(true);
    expect(e.getCurrentMentorProbeId()).toBeNull();
    expect(e.getCurrentSafetyGateId()).toBeNull();
  });

  it('isComplete returns false at start', () => {
    expect(make().isComplete()).toBe(false);
  });
});

describe('ScenarioEngine — normal advance', () => {
  it('advances from step 0 to step 1', () => {
    const e = make();
    const result = e.advanceStep();
    expect(result.blocked).toBe(false);
    expect(e.getState().currentStepIndex).toBe(1);
    expect(e.getState().phase).toBe('STARTUP');
  });

  it('step 1 has a mentor probe and marks probe unsatisfied', () => {
    const e = make();
    e.advanceStep();
    expect(e.getState().mentorProbeSatisfied).toBe(false);
    expect(e.getCurrentMentorProbeId()).toBe('PROBE-GAS-SEQUENCE-START-001');
  });
});

describe('ScenarioEngine — mentor probe gate', () => {
  it('blocks advance when probe unsatisfied', () => {
    const e = make();
    e.advanceStep(); // → step 1 (has probe)
    const result = e.advanceStep();
    expect(result).toEqual({ blocked: true, reason: 'mentor' });
    expect(e.getState().currentStepIndex).toBe(1); // no movement
  });

  it('unblocks after satisfyMentorProbe()', () => {
    const e = make();
    e.advanceStep(); // → step 1
    e.satisfyMentorProbe();
    expect(e.getState().mentorProbeSatisfied).toBe(true);
    expect(e.getCurrentMentorProbeId()).toBeNull();
    const result = e.advanceStep();
    expect(result.blocked).toBe(false);
    expect(e.getState().currentStepIndex).toBe(2);
  });
});

describe('ScenarioEngine — safety gate + fault injection', () => {
  function atStep3() {
    const e = make();
    e.advanceStep();             // → step 1
    e.satisfyMentorProbe();
    e.advanceStep();             // → step 2 (no probe)
    e.advanceStep();             // → step 3 (safety gate + fault injection)
    return e;
  }

  it('injects fault when entering step 3', () => {
    const e = atStep3();
    expect(e.getState().activeFaultIds).toContain('FAULT-GAS-SEQUENCE-WRONG-001');
  });

  it('step 3 narrator text includes anomaly announcement', () => {
    const e = atStep3();
    expect(e.getCurrentNarratorText()).toContain('⚠ ANOMALY');
    expect(e.getCurrentNarratorText()).toContain('Wrong gas sequence detected');
  });

  it('safety gate is unanknowledged on step 3', () => {
    const e = atStep3();
    expect(e.getState().safetyGateAcknowledged).toBe(false);
    expect(e.getCurrentSafetyGateId()).toBe('FAULT-GAS-SEQUENCE-WRONG-001');
  });

  it('blocks advance when safety gate unacknowledged', () => {
    const e = atStep3();
    const result = e.advanceStep();
    expect(result).toMatchObject({ blocked: true, reason: 'safety_gate' });
  });

  it('skipping safety gate triggers consequence', () => {
    const e = atStep3();
    e.advanceStep(); // attempt to skip → triggers consequence
    expect(e.getState().triggeredConsequenceIds).toContain('CONSEQUENCE-NANOPARTICLE-EXPOSURE-001');
  });

  it('blocks advance when active fault not resolved', () => {
    const e = atStep3();
    e.acknowledgeSafetyGate();
    const result = e.advanceStep();
    expect(result).toMatchObject({ blocked: true, reason: 'active_fault' });
  });

  it('advances after gate acknowledged + fault resolved', () => {
    const e = atStep3();
    e.acknowledgeSafetyGate();
    e.resolveFault('FAULT-GAS-SEQUENCE-WRONG-001');
    const result = e.advanceStep();
    expect(result.blocked).toBe(false);
    expect(e.getState().currentStepIndex).toBe(3);
  });
});

describe('ScenarioEngine — fault resolution', () => {
  it('moves fault from active to resolved', () => {
    const e = make();
    e.advanceStep(); e.satisfyMentorProbe(); e.advanceStep(); e.advanceStep();
    expect(e.getState().activeFaultIds).toContain('FAULT-GAS-SEQUENCE-WRONG-001');
    e.resolveFault('FAULT-GAS-SEQUENCE-WRONG-001');
    expect(e.getState().activeFaultIds).not.toContain('FAULT-GAS-SEQUENCE-WRONG-001');
    expect(e.getState().resolvedFaultIds).toContain('FAULT-GAS-SEQUENCE-WRONG-001');
  });

  it('no-ops on unknown fault id', () => {
    const e = make();
    const before = { ...e.getState() };
    e.resolveFault('FAULT-NONEXISTENT-001');
    expect(e.getState().resolvedFaultIds).toHaveLength(before.resolvedFaultIds.length);
  });
});

describe('ScenarioEngine — missConsequence', () => {
  it('returns consequence id and announcement for a known fault', () => {
    const e = make();
    const result = e.missConsequence('FAULT-GAS-SEQUENCE-WRONG-001');
    expect(result).not.toBeNull();
    expect(result?.consequenceId).toBe('CONSEQUENCE-NANOPARTICLE-EXPOSURE-001');
    expect(result?.narratorAnnouncement).toContain('Wrong gas sequence');
  });

  it('adds consequence id only once when called twice', () => {
    const e = make();
    e.missConsequence('FAULT-GAS-SEQUENCE-WRONG-001');
    e.missConsequence('FAULT-GAS-SEQUENCE-WRONG-001');
    expect(e.getState().triggeredConsequenceIds.filter(
      (id) => id === 'CONSEQUENCE-NANOPARTICLE-EXPOSURE-001'
    )).toHaveLength(1);
  });

  it('returns null for unknown fault', () => {
    expect(make().missConsequence('FAULT-DOES-NOT-EXIST')).toBeNull();
  });
});

describe('ScenarioEngine — student action recording', () => {
  it('records action text and step id', () => {
    const e = make();
    e.recordStudentAction('I observe elevated pressure.');
    const s = e.getState();
    expect(s.studentActions).toHaveLength(1);
    expect(s.studentActions[0].stepId).toBe('STEP-001');
    expect(s.studentActions[0].text).toBe('I observe elevated pressure.');
    expect(s.studentActions[0].timestamp).toBeGreaterThan(0);
  });
});

describe('ScenarioEngine — parseStudentAction', () => {
  const e = make();
  it('classifies questions', () => {
    expect(e.parseStudentAction('What should I do?')).toBe('question');
    expect(e.parseStudentAction('Why does pressure rise?')).toBe('question');
    expect(e.parseStudentAction('Is this normal?')).toBe('question');
  });
  it('classifies observations (domain-neutral cues)', () => {
    expect(e.parseStudentAction('I see the reading is high.')).toBe('observation');
    expect(e.parseStudentAction('The gauge shows 45.')).toBe('observation');
    expect(e.parseStudentAction('The jack looks like it is leaning.')).toBe('observation');
  });
  it('classifies actions', () => {
    expect(e.parseStudentAction('I will lower the jack.')).toBe('action');
    expect(e.parseStudentAction('Chocking the wheel now.')).toBe('action');
  });
});

describe('ScenarioEngine — completion', () => {
  it('isComplete() after advancing through all steps', () => {
    const e = make();
    // step 0 → 1
    e.advanceStep();
    // step 1 → 2: satisfy probe first
    e.satisfyMentorProbe();
    e.advanceStep();
    // step 2 → 3: no probe, advance
    e.advanceStep();
    // step 3: fault injection + gate
    e.acknowledgeSafetyGate();
    e.resolveFault('FAULT-GAS-SEQUENCE-WRONG-001');
    // step 3 → 4 (last)
    e.advanceStep();
    // step 4 → complete
    expect(e.getState().currentStepIndex).toBe(3);
    const finalResult = e.advanceStep();
    expect(finalResult.blocked).toBe(false);
    expect(e.isComplete()).toBe(true);
  });
});
