/**
 * AJP-specific types for the knowledge graph, scenario state, and Narrator/Mentor agents.
 * Kept separate from the core types to enforce separation of concerns.
 */

// ─── Knowledge Graph ──────────────────────────────────────────────

export type AJPNodeType =
  | 'Equipment'
  | 'Step'
  | 'Parameter'
  | 'FailureMode'
  | 'Symptom'
  | 'CorrectiveAction'
  | 'SafetyHazard'
  | 'TacitKnowledge'
  | 'VerificationCheck'
  | 'SocraticProbe'
  | 'Consequence'
  | 'TheoryReference';

export type AJPEdgeType =
  | 'NEXT_STEP'
  | 'HAS_STEP'
  | 'CAUSES'
  | 'INDICATES'
  | 'FIXED_BY'
  | 'REQUIRES'
  | 'VERIFIED_BY'
  | 'PART_OF'
  | 'PROBES'
  /** TacitKnowledge / CorrectiveAction → TheoryReference: cites the underlying scientific or pedagogical principle. */
  | 'SUPPORTED_BY';

/** A node in the AJP knowledge graph. */
export interface AJPNode {
  id: string;
  type: AJPNodeType;
  /** Actionable knowledge content (sourced from corpus). */
  content: string;
  /** Text the Narrator reads when this node is the active machine state. */
  narratorText?: string;
  /** Socratic probe the Mentor asks after this node activates. */
  mentorProbe?: string;
  /** Safety warning always co-displayed with this node. */
  safetyAlert?: string;
  source?: string;
  /** Who curated this node (e.g. 'Eddie') — used for provenance filtering and removal. */
  curatedBy?: string;
  confidence: 'High' | 'Medium' | 'Low';
  /** SocraticProbe nodes: key concepts a complete answer must address. */
  expectedConcepts?: string[];
  /** SocraticProbe nodes: common wrong answers with targeted corrections. */
  commonWrongAnswers?: string[];
  /** SocraticProbe nodes: minimum Mentor score (0–1) to advance. Default 0.80. */
  masteryThreshold?: number;
}

/** A typed directed edge in the AJP knowledge graph. */
export interface AJPEdge {
  from: string;
  to: string;
  type: AJPEdgeType;
}

// ─── Scenario Mode ────────────────────────────────────────────────

/** An action option presented to the learner at each scenario step. */
export interface ScenarioAction {
  id: string;
  label: string;
  isCorrect: boolean;
  /** Narrator text shown after this action is chosen (corpus-grounded). */
  consequence: string;
  /** Shown on incorrect selection — guides without revealing the answer. */
  scaffoldHint?: string;
}

/** Complete view for one step in a Scenario Mode session. */
export interface ScenarioStepView {
  stepId: string;
  /** Machine state / Narrator description of current situation. */
  situation: string;
  /** Socratic probe from the Mentor agent. */
  mentorProbe: string;
  /** Safety alert shown in red if present. */
  safetyAlert?: string;
  actions: ScenarioAction[];
  /** True when this step presents fault symptoms requiring diagnosis. */
  isFaultStep: boolean;
}

/** Tracks active Scenario Mode progress for one session. */
export interface ScenarioProgress {
  scenarioId: string;
  stepHistory: string[];
  faultInjected: boolean;
  injectedFaultId?: string;
  wrongActionsThisStep: number;
  totalWrongActions: number;
  phase: 'intro' | 'steps' | 'complete';
}
