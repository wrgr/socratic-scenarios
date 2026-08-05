/**
 * Scenario Mode engine (design document §4.3 "Scenario state machine").
 * Pure logic class — no React dependency. All state transitions are pure functions.
 * The React hook `useScenarioEngine` wraps it for component use.
 *
 * Responsibilities:
 * - Advance through ScenarioStep sequence
 * - Inject faults at the designated trigger step
 * - Enforce safety gate acknowledgement before advance
 * - Record missed safety gates and trigger consequence nodes
 * - Return corpus-grounded narrator text (no LLM generation)
 */
import { useState, useCallback } from 'react';
import type {
  ScenarioDefinition,
  ScenarioSessionState,
  ScenarioStep,
  StudentAction,
} from './types';

/** Reserved engine-level terminal phase sentinel, shared across all domains. */
const COMPLETE_PHASE = 'COMPLETE';

// ─── Engine Class ─────────────────────────────────────────────────

export class ScenarioEngine {
  private readonly definition: ScenarioDefinition;
  private state: ScenarioSessionState;

  constructor(definition: ScenarioDefinition) {
    this.definition = definition;
    this.state = ScenarioEngine.initialState(definition);
  }

  private static initialState(def: ScenarioDefinition): ScenarioSessionState {
    return {
      definitionId: def.id,
      currentStepIndex: 0,
      maxVisitedStepIndex: 0,
      phase: def.steps[0]?.phase ?? 'SETUP',
      activeFaultIds: [],
      resolvedFaultIds: [],
      triggeredConsequenceIds: [],
      studentActions: [],
      satisfiedProbeStepIds: [],
      acknowledgedGateStepIds: [],
      safetyGateAcknowledged: !def.steps[0]?.safetyGateNodeId,
      mentorProbeSatisfied: !def.steps[0]?.mentorProbeId,
    };
  }

  /** Recompute the current-step derived booleans from the persistent step-id arrays. */
  private syncCurrentStepDerived(): void {
    const step = this.getCurrentStep();
    const probeSatisfied = !step?.mentorProbeId ||
      this.state.satisfiedProbeStepIds.includes(step.id);
    const gateAcknowledged = !step?.safetyGateNodeId ||
      this.state.acknowledgedGateStepIds.includes(step.id);
    this.state = {
      ...this.state,
      mentorProbeSatisfied: probeSatisfied,
      safetyGateAcknowledged: gateAcknowledged,
    };
  }

  getState(): Readonly<ScenarioSessionState> {
    return { ...this.state };
  }

  getDefinition(): Readonly<ScenarioDefinition> {
    return this.definition;
  }

  getCurrentStep(): ScenarioStep | undefined {
    return this.definition.steps[this.state.currentStepIndex];
  }

  getCurrentNarratorText(): string {
    const step = this.getCurrentStep();
    if (!step) return '';
    // Prepend injected fault announcement if fault fires at this step
    const injection = this.definition.faultInjections.find(
      (fi) => fi.triggerStepId === step.id,
    );
    if (injection && this.state.activeFaultIds.includes(injection.faultNodeId)) {
      return `${step.narratorText}\n\n⚠ ANOMALY: ${injection.narratorAnnouncement}`;
    }
    return step.narratorText;
  }

  getCurrentMentorProbeId(): string | null {
    const step = this.getCurrentStep();
    if (!step?.mentorProbeId) return null;
    if (this.state.mentorProbeSatisfied) return null;
    return step.mentorProbeId;
  }

  getCurrentSafetyGateId(): string | null {
    const step = this.getCurrentStep();
    if (!step?.safetyGateNodeId) return null;
    if (this.state.safetyGateAcknowledged) return null;
    return step.safetyGateNodeId;
  }

  /** Inject any fault that fires at the current step. Called after entering a step. */
  private checkAndInjectFaults(): void {
    const step = this.getCurrentStep();
    if (!step) return;
    for (const injection of this.definition.faultInjections) {
      if (
        injection.triggerStepId === step.id &&
        !this.state.activeFaultIds.includes(injection.faultNodeId)
      ) {
        this.state = {
          ...this.state,
          activeFaultIds: [...this.state.activeFaultIds, injection.faultNodeId],
        };
      }
    }
  }

  /** Mark the Mentor probe for the current step as satisfied. */
  satisfyMentorProbe(): ScenarioSessionState {
    const step = this.getCurrentStep();
    if (step && !this.state.satisfiedProbeStepIds.includes(step.id)) {
      this.state = {
        ...this.state,
        satisfiedProbeStepIds: [...this.state.satisfiedProbeStepIds, step.id],
      };
    }
    this.state = { ...this.state, mentorProbeSatisfied: true };
    return this.getState() as ScenarioSessionState;
  }

  /** Acknowledge the safety gate for the current step (learner confirmed they read it). */
  acknowledgeSafetyGate(): ScenarioSessionState {
    const step = this.getCurrentStep();
    if (step && !this.state.acknowledgedGateStepIds.includes(step.id)) {
      this.state = {
        ...this.state,
        acknowledgedGateStepIds: [...this.state.acknowledgedGateStepIds, step.id],
      };
    }
    this.state = { ...this.state, safetyGateAcknowledged: true };
    return this.getState() as ScenarioSessionState;
  }

  /**
   * Resolve an active fault (learner took the correct corrective action).
   * Returns updated state.
   */
  resolveFault(faultId: string): ScenarioSessionState {
    if (!this.state.activeFaultIds.includes(faultId)) return this.getState() as ScenarioSessionState;
    this.state = {
      ...this.state,
      activeFaultIds: this.state.activeFaultIds.filter((id) => id !== faultId),
      resolvedFaultIds: [...this.state.resolvedFaultIds, faultId],
    };
    return this.getState() as ScenarioSessionState;
  }

  /**
   * Learner attempted to advance past a safety gate without acknowledging it.
   * Activates the missed consequence for the associated fault injection.
   * Returns a ScenarioStep-like object that ScenarioView should display
   * (showing the consequence text) before allowing continuation.
   */
  missConsequence(faultId: string): { consequenceId: string; narratorAnnouncement: string } | null {
    const injection = this.definition.faultInjections.find(
      (fi) => fi.faultNodeId === faultId,
    );
    if (!injection) return null;
    if (!this.state.triggeredConsequenceIds.includes(injection.missedConsequenceId)) {
      this.state = {
        ...this.state,
        triggeredConsequenceIds: [
          ...this.state.triggeredConsequenceIds,
          injection.missedConsequenceId,
        ],
      };
    }
    return {
      consequenceId: injection.missedConsequenceId,
      narratorAnnouncement: injection.narratorAnnouncement,
    };
  }

  /**
   * Advance to the next step, enforcing gate preconditions.
   * Returns `{ blocked: true, reason }` if the learner cannot advance yet.
   * Returns `{ blocked: false }` and mutates state on success.
   */
  advanceStep(): { blocked: false } | { blocked: true; reason: 'mentor' | 'safety_gate' | 'active_fault' } {
    if (!this.state.mentorProbeSatisfied) {
      return { blocked: true, reason: 'mentor' };
    }
    if (!this.state.safetyGateAcknowledged) {
      // Learner is trying to skip safety gate — trigger consequence
      const step = this.getCurrentStep();
      if (step?.safetyGateNodeId) {
        const injection = this.definition.faultInjections.find(
          (fi) => fi.faultNodeId === step.safetyGateNodeId ||
                  this.state.activeFaultIds.includes(fi.faultNodeId),
        );
        if (injection) {
          this.missConsequence(injection.faultNodeId);
        }
      }
      return { blocked: true, reason: 'safety_gate' };
    }
    if (this.state.activeFaultIds.length > 0) {
      return { blocked: true, reason: 'active_fault' };
    }

    const nextIndex = this.state.currentStepIndex + 1;
    if (nextIndex >= this.definition.steps.length) {
      // Scenario complete
      this.state = {
        ...this.state,
        phase: COMPLETE_PHASE,
        maxVisitedStepIndex: Math.max(this.state.maxVisitedStepIndex, nextIndex),
      };
      return { blocked: false };
    }

    const nextStep = this.definition.steps[nextIndex];
    this.state = {
      ...this.state,
      currentStepIndex: nextIndex,
      maxVisitedStepIndex: Math.max(this.state.maxVisitedStepIndex, nextIndex),
      phase: nextStep.phase,
    };
    this.syncCurrentStepDerived();
    this.checkAndInjectFaults();
    return { blocked: false };
  }

  /** Navigate to a prior already-visited step for review. Does not mutate satisfaction state. */
  goToPreviousStep(): boolean {
    if (this.state.currentStepIndex <= 0) return false;
    const prevIndex = this.state.currentStepIndex - 1;
    const prevStep = this.definition.steps[prevIndex];
    this.state = {
      ...this.state,
      currentStepIndex: prevIndex,
      phase: prevStep.phase,
    };
    this.syncCurrentStepDerived();
    return true;
  }

  /** Return to the next already-visited step after a review excursion. */
  goToNextStep(): boolean {
    if (this.state.currentStepIndex >= this.state.maxVisitedStepIndex) return false;
    const nextIndex = this.state.currentStepIndex + 1;
    const nextStep = this.definition.steps[nextIndex];
    if (!nextStep) return false;
    this.state = {
      ...this.state,
      currentStepIndex: nextIndex,
      phase: nextStep.phase,
    };
    this.syncCurrentStepDerived();
    return true;
  }

  /** True when the learner is looking at a previously-visited step (not the furthest step reached). */
  isReviewMode(): boolean {
    return this.state.currentStepIndex < this.state.maxVisitedStepIndex;
  }

  /**
   * Classify a student's free-text input for the step record.
   * Heuristic keyword-based classification — no LLM required.
   *
   * Domain-agnostic: the cues are generic perception/instrument words that read
   * the same in any domain (a gauge reading, something that "shows" a value,
   * "looks like", "sounds like") — no domain-specific terms (e.g. an AJP "KEWB"
   * reading) that would misclassify or mean nothing in another domain.
   */
  parseStudentAction(text: string): 'action' | 'observation' | 'question' {
    const lower = text.toLowerCase();
    if (lower.includes('?') || lower.startsWith('what') || lower.startsWith('why') ||
        lower.startsWith('how') || lower.startsWith('is ') || lower.startsWith('does ')) {
      return 'question';
    }
    if (lower.includes('i see') || lower.includes('i notice') || lower.includes('i observe') ||
        lower.includes('looks like') || lower.includes('appears') || lower.includes('sounds like') ||
        lower.includes('i hear') || lower.includes('reading') || lower.includes('gauge') ||
        lower.includes('shows')) {
      return 'observation';
    }
    return 'action';
  }

  /** Record a student action for the current step. */
  recordStudentAction(text: string): ScenarioSessionState {
    const step = this.getCurrentStep();
    if (!step) return this.getState() as ScenarioSessionState;
    const action: StudentAction = {
      stepId: step.id,
      text,
      timestamp: Date.now(),
    };
    this.state = {
      ...this.state,
      studentActions: [...this.state.studentActions, action],
    };
    return this.getState() as ScenarioSessionState;
  }

  isComplete(): boolean {
    return this.state.phase === COMPLETE_PHASE ||
           this.state.currentStepIndex >= this.definition.steps.length;
  }
}

// ─── React Hook ───────────────────────────────────────────────────

export interface ScenarioEngineHandle {
  state: ScenarioSessionState;
  definition: ScenarioDefinition;
  currentStep: ScenarioStep | undefined;
  narratorText: string;
  mentorProbeId: string | null;
  safetyGateId: string | null;
  isComplete: boolean;
  isReviewMode: boolean;
  canGoPrevious: boolean;
  canGoNext: boolean;
  activeFaultIds: string[];
  triggeredConsequenceIds: string[];
  /** Advance to next step; returns block reason if gated. */
  advance: () => { blocked: false } | { blocked: true; reason: 'mentor' | 'safety_gate' | 'active_fault' };
  /** Navigate back to an already-visited step (read-only review). */
  goPrevious: () => void;
  /** Return forward through already-visited steps after a review excursion. */
  goNext: () => void;
  satisfyMentorProbe: () => void;
  acknowledgeSafetyGate: () => void;
  resolveFault: (faultId: string) => void;
  missConsequence: (faultId: string) => { consequenceId: string; narratorAnnouncement: string } | null;
  recordAction: (text: string) => void;
}

/**
 * React hook wrapping ScenarioEngine. Initialises engine from a ScenarioDefinition
 * and exposes state + mutation functions. Re-renders on every state change.
 */
export function useScenarioEngine(definition: ScenarioDefinition): ScenarioEngineHandle {
  // Hold engine instance in state as a stable ref pattern
  const [engine] = useState(() => new ScenarioEngine(definition));
  const [state, setState] = useState<ScenarioSessionState>(() => engine.getState() as ScenarioSessionState);

  const sync = useCallback(() => {
    setState({ ...(engine.getState() as ScenarioSessionState) });
  }, [engine]);

  const advance = useCallback(() => {
    const result = engine.advanceStep();
    sync();
    return result;
  }, [engine, sync]);

  const satisfyMentorProbe = useCallback(() => {
    engine.satisfyMentorProbe();
    sync();
  }, [engine, sync]);

  const acknowledgeSafetyGate = useCallback(() => {
    engine.acknowledgeSafetyGate();
    sync();
  }, [engine, sync]);

  const resolveFault = useCallback((faultId: string) => {
    engine.resolveFault(faultId);
    sync();
  }, [engine, sync]);

  const missConsequence = useCallback((faultId: string) => {
    const result = engine.missConsequence(faultId);
    sync();
    return result;
  }, [engine, sync]);

  const recordAction = useCallback((text: string) => {
    engine.recordStudentAction(text);
    sync();
  }, [engine, sync]);

  const goPrevious = useCallback(() => {
    engine.goToPreviousStep();
    sync();
  }, [engine, sync]);

  const goNext = useCallback(() => {
    engine.goToNextStep();
    sync();
  }, [engine, sync]);

  return {
    state,
    definition: engine.getDefinition() as ScenarioDefinition,
    currentStep: engine.getCurrentStep(),
    narratorText: engine.getCurrentNarratorText(),
    mentorProbeId: engine.getCurrentMentorProbeId(),
    safetyGateId: engine.getCurrentSafetyGateId(),
    isComplete: engine.isComplete(),
    isReviewMode: engine.isReviewMode(),
    canGoPrevious: state.currentStepIndex > 0,
    canGoNext: state.currentStepIndex < state.maxVisitedStepIndex,
    activeFaultIds: state.activeFaultIds,
    triggeredConsequenceIds: state.triggeredConsequenceIds,
    advance,
    goPrevious,
    goNext,
    satisfyMentorProbe,
    acknowledgeSafetyGate,
    resolveFault,
    missConsequence,
    recordAction,
  };
}
