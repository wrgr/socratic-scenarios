/**
 * Scenario Mode state machine types (design document §4.3).
 * Defines the procedural phases, step structure, fault injection model,
 * and session state for the Narrator/Mentor/Student interaction loop.
 *
 * Phases are domain-parameterized: `ScenarioStep.phase` is a free-form string so
 * each teaching domain can define its own procedure phases, and each domain
 * supplies its own phase→label map (see `DomainDescriptor.phaseLabels`). The AJP
 * `ScenarioPhase` union + `SCENARIO_PHASE_LABELS` below remain the AJP domain's
 * phase set. `'COMPLETE'` is reserved as the engine-level terminal sentinel across
 * all domains.
 */

// ─── AJP Procedure Phase Enum ─────────────────────────────────────

export type ScenarioPhase =
  | 'SETUP'
  | 'STARTUP'
  | 'INK_LOAD'
  | 'LINE_TUNE'
  | 'PRINT'
  | 'POST_PRINT'
  | 'CLEAN'
  | 'SINTER'
  | 'VERIFY'
  | 'COMPLETE';

export const SCENARIO_PHASE_LABELS: Record<ScenarioPhase, string> = {
  SETUP: 'Setup',
  STARTUP: 'Startup',
  INK_LOAD: 'Ink Load',
  LINE_TUNE: 'Line Tune',
  PRINT: 'Print',
  POST_PRINT: 'Post-Print',
  CLEAN: 'Clean',
  SINTER: 'Sinter',
  VERIFY: 'Verify',
  COMPLETE: 'Complete',
};

// ─── Step ─────────────────────────────────────────────────────────

/**
 * One step in a scripted scenario.
 * narratorText must be quoted from corpus node content — no LLM generation.
 */
export interface ScenarioStep {
  id: string;
  /** Procedure phase for this step. Domain-defined free-form key (AJP uses `ScenarioPhase`). */
  phase: string;
  /** Narrator announcement — corpus-grounded, direct quote or close paraphrase of node content. */
  narratorText: string;
  /** PROBE-* node id. Mentor asks this probe before the learner can act. */
  mentorProbeId?: string;
  /** HAZARD-* or FAULT-* node id. Learner must explicitly acknowledge before advancing. */
  safetyGateNodeId?: string;
  /** FAULT-* node id injected at this step. Narrator announces the fault condition. */
  faultInjectionId?: string;
}

// ─── Fault Injection ──────────────────────────────────────────────

/**
 * Specifies when and how a fault is injected into the scenario.
 * missedConsequenceId: the CONSEQUENCE-* node to activate if the learner
 * ignores the safety gate and advances without addressing the fault.
 */
export interface ScenarioFaultInjection {
  faultNodeId: string;
  triggerStepId: string;
  /** Narrator text announcing the fault — must quote fault node content. */
  narratorAnnouncement: string;
  /** CONSEQUENCE-* node id activated if learner skips the associated safety gate. */
  missedConsequenceId: string;
}

// ─── Scenario Definition ──────────────────────────────────────────

export interface ScenarioDefinition {
  id: string;
  label: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  steps: ScenarioStep[];
  faultInjections: ScenarioFaultInjection[];
}

// ─── Session State ────────────────────────────────────────────────

/** Student action record for one step. */
export interface StudentAction {
  stepId: string;
  /** Free-text response or selected action id. */
  text: string;
  timestamp: number;
}

/**
 * Live session state for one in-progress scenario run.
 * Pure data — the ScenarioEngine owns mutation logic.
 */
export interface ScenarioSessionState {
  definitionId: string;
  currentStepIndex: number;
  /** Highest step index the learner has reached. Lets Previous/Next walk back and forward
   *  through visited steps without letting Next skip unvisited work. */
  maxVisitedStepIndex: number;
  /** Current phase key (a domain phase, or the reserved `'COMPLETE'` terminal sentinel). */
  phase: string;
  /** Fault node ids currently visible to the learner (injected, not yet resolved). */
  activeFaultIds: string[];
  /** Fault node ids the learner has correctly resolved. */
  resolvedFaultIds: string[];
  /** Consequence node ids that have been triggered (learner skipped safety gate). */
  triggeredConsequenceIds: string[];
  studentActions: StudentAction[];
  /** Step ids whose Mentor probe has been satisfied or skipped. */
  satisfiedProbeStepIds: string[];
  /** Step ids whose safety gate has been acknowledged. */
  acknowledgedGateStepIds: string[];
  /** Derived: true when the current step's Mentor probe is satisfied or absent. */
  mentorProbeSatisfied: boolean;
  /** Derived: true when the current step's safety gate is acknowledged or absent. */
  safetyGateAcknowledged: boolean;
}
