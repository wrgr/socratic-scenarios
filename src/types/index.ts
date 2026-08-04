// ─── Domains ─────────────────────────────────────────────────────

import type { AJPNode, AJPEdge } from './ajp';

/**
 * Registered use cases. AJP is the flagship; flat-tire is the graph-only proof.
 * The COLREG collision-avoidance and roadside-tire-change domains are registered
 * through the pluggable corpus registry (src/corpus/registry.ts).
 */
export type DomainId =
  | 'ajp'
  | 'flat-tire'
  | 'ajp-electronics-repair'
  | 'colreg-collision-avoidance'
  | 'roadside-tire-change';

/** Reference to a domain's dense-retrieval corpus. Optional per domain. */
export interface DenseCorpusRef {
  /** Filename under BASE_URL for the embedded chunk corpus (e.g. 'ajp-corpus.json'). */
  corpusUrl: string;
  /** Filename under BASE_URL for pre-baked graph-node embeddings, if any. */
  nodeEmbeddingsUrl?: string;
}

/**
 * Everything that makes one use case ("domain") concrete. TeachMe is the
 * product shell; each DomainConfig is an instantiation of it (e.g. EDDIE for
 * AJP). Fields are added incrementally as configuration is lifted out of
 * hard-coded modules (safety gates, probes, personas, and copy follow).
 */
export interface DomainConfig {
  id: DomainId;
  /** Product shell name — constant across domains. */
  product: 'TeachMe';
  /** Instantiation/brand name for this domain (e.g. 'EDDIE'). */
  instantiation: string;
  /** Full domain name for headings. */
  name: string;
  /** Short masthead subtitle (e.g. 'Aerosol Jet Printer Demo'). */
  subtitle: string;
  description: string;
  /** The combined knowledge graph (nodes + edges) for this domain. */
  graph: { nodes: AJPNode[]; edges: AJPEdge[] };
  /** Dense-retrieval corpus refs. Omit for graph-only domains (degrades gracefully). */
  denseCorpus?: DenseCorpusRef;
}

// ─── Domain & Corpus ─────────────────────────────────────────────

export interface Concept {
  id: string;
  name: string;
  description: string;
  prerequisites: string[];       // concept IDs
  transferDomains: string[];     // domains where this concept applies
}

export interface CorpusChunk {
  id: string;
  conceptId: string;
  content: string;
  chunkType: 'explanation' | 'example' | 'analogy' | 'procedure' | 'transfer-scenario';
  difficulty: ProficiencyLevel;
  roleContext?: string;           // e.g., "backend-engineer", "architect"
  transferDomain?: string;        // domain this chunk bridges to
  // Pre-computed similarity scores to every other chunk (for demo, avoids embedding API)
  similarityScores: Record<string, number>;
}

export type ProficiencyLevel = 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'expert';

export const PROFICIENCY_ORDER: ProficiencyLevel[] = [
  'novice', 'beginner', 'intermediate', 'advanced', 'expert',
];

// ─── Learner Model ───────────────────────────────────────────────

export interface LearnerProfile {
  id: string;
  conceptProficiencies: Record<string, ProficiencyScore>;
  interactionHistory: InteractionEvent[];
  assignedCondition: ExperimentCondition;
  role?: string;
}

export interface ProficiencyScore {
  level: ProficiencyLevel;
  confidence: number;            // 0–1, how confident we are in this estimate
  lastAssessed: number;          // timestamp
  attempts: number;
  successRate: number;
}

export interface InteractionEvent {
  timestamp: number;
  type: 'retrieval' | 'response' | 'assessment' | 'hint-request';
  conceptId: string;
  details: Record<string, unknown>;
}

// ─── Retrieval ───────────────────────────────────────────────────

export type RetrievalStrategy = 'semantic' | 'proficiency-calibrated';
export type RetrievalPhase = 'pretest' | 'learning' | 'posttest' | 'transfer';

export interface ScoringPolicy {
  id: string;
  similarityWeight: number;
  proficiencyWeight: number;
  roleWeight: number;
  transferWeight: number;
  normalizeByWeightSum: boolean;
}

export interface RetrievalQuery {
  text: string;
  conceptId?: string;
  learnerProfile: LearnerProfile;
  strategy: RetrievalStrategy;
  phase?: RetrievalPhase;
  topK?: number;
  scoringPolicy?: ScoringPolicy;
}

export interface RetrievalResult {
  chunks: ScoredChunk[];
  strategy: RetrievalStrategy;
  queryTimestamp: number;
  metadata: {
    totalCandidates: number;
    filteringSteps?: string[];
    shadowComparison?: {
      strategy: RetrievalStrategy;
      topChunkId: string | null;
      topChunkType: CorpusChunk['chunkType'] | null;
      topScore: number | null;
      transferHit: boolean;
    };
  };
}

export interface ScoredChunk {
  chunk: CorpusChunk;
  score: number;
  scoreBreakdown?: {
    similarity: number;
    proficiencyMatch: number;
    roleRelevance: number;
    transferPotential: number;
  };
}

// ─── Assessment & Transfer ───────────────────────────────────────

export interface TransferProblem {
  id: string;
  title: string;
  scenario: string;              // novel context description
  sourceConceptIds: string[];    // concepts needed
  targetDomain: string;          // new domain for transfer
  difficulty: ProficiencyLevel;
  rubric: TransferRubricItem[];
  options?: AssessmentOption[];   // for structured response
}

export interface AssessmentOption {
  id: string;
  text: string;
  transferScore: number;         // 0–1, how well this demonstrates transfer
  explanation: string;
}

export interface TransferRubricItem {
  criterion: string;
  weight: number;
  levels: Record<ProficiencyLevel, string>;
}

export interface AssessmentResult {
  problemId: string;
  learnerId: string;
  condition: ExperimentCondition;
  selectedOptionId?: string;
  freeResponse?: string;
  transferScore: number;         // 0–1 composite
  rubricScores: Record<string, number>;
  timeSpentMs: number;
  hintsUsed: number;
  timestamp: number;
}

// ─── Experiment ──────────────────────────────────────────────────

export type ExperimentCondition = 'semantic' | 'proficiency-calibrated' | 'unassigned';

export interface ExperimentSession {
  id: string;
  learnerId: string;
  condition: ExperimentCondition;
  startTime: number;
  phases: ExperimentPhase[];
  currentPhaseIndex: number;
  completed: boolean;
}

export type ExperimentPhase =
  | { type: 'pretest'; problemIds: string[] }
  | { type: 'learning'; scenarioIds: string[] }
  | { type: 'posttest'; problemIds: string[] }
  | { type: 'transfer'; problemIds: string[] };

export interface ExperimentLog {
  sessionId: string;
  events: ExperimentEvent[];
}

export interface ExperimentEvent {
  timestamp: number;
  phase: ExperimentPhase['type'];
  eventType: 'phase-start' | 'retrieval' | 'interaction' | 'assessment' | 'phase-end';
  data: Record<string, unknown>;
}

// ─── Learning Scenario ───────────────────────────────────────────

export interface LearningScenario {
  id: string;
  title: string;
  context: string;
  conceptIds: string[];
  prompts: ScenarioPrompt[];
}

export interface ScenarioPrompt {
  id: string;
  text: string;
  conceptId: string;
  expectedInsight: string;
  hints: string[];
}

export interface OperationalModelAssumptions {
  monthlyCases: number;
  baselineEscalationRate: number;
  avgOnCallInterruptMinutes: number;
  baselineP1Rate: number;
  coefficientSetId: 'low' | 'base' | 'high';
}

export interface OperationalModelCoefficientSet {
  id: 'low' | 'base' | 'high';
  escalationReductionFromFarTransfer: number;
  p1ReductionFromFarTransfer: number;
  p1ReductionFromConsistency: number;
  riskWeightEscalation: number;
  riskWeightP1: number;
  riskWeightLatency: number;
  maxEscalationReduction: number;
  maxP1Reduction: number;
}

export interface ReasoningArtifacts {
  showWork?: string;
  thoughtProcess?: string;
  hypothesis?: string;
  evidence?: string;
  nextTest?: string;
  debugDescription?: string;
  openQuestion?: string;
}

export interface MasteryGateState {
  passed: boolean;
  reasons: string[];
  thresholdVersion: 'v1';
  topScoreObserved: number | null;
}
