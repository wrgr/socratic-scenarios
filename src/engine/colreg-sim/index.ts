/** COLREG simulator engine — public surface. */
export * from './types';
export { wrapPi, velocity, maxTurnRate, stepOwnship, stepTarget, integrate, maneuverControl } from './kinematics';
export { cpa, minRangeToTarget, minRangeAllTargets, type CpaResult } from './cpa';
export { domainRadii, clearanceFactor, assessInstant, type DomainRadii, type DomainAssessment } from './ship-domain';
export { criInstant, criMax, criSeries, DEFAULT_CRI, type CriParams } from './cri';
export {
  classify,
  scoreCompliance,
  primaryTarget,
  type Encounter,
  type Role,
  type Classification,
  type RuleCheck,
  type ComplianceReport,
} from './colreg-rules';
export {
  evaluate,
  DEFAULT_WEIGHTS,
  TARGET_CLEARANCE,
  type ObjectiveResult,
  type ObjectiveWeights,
  type SimMetrics,
} from './objective';
export {
  solveReference,
  solveReferenceVO,
  type ReferenceSolution,
  type SolverGridPoint,
  type SolverOptions,
} from './reference-solver';
export {
  ownVelocity,
  safetyRadius,
  collisionCone,
  inCone,
  velocityObstacles,
  chooseAvoidance,
  type Vec2,
  type CollisionCone,
  type AvoidanceChoice,
} from './velocity-obstacle';
export {
  holdCoursePolicy,
  mpcPolicy,
  voPolicy,
  runCase,
  evaluateManeuver,
  runBenchmark,
  runBenchmarkAsync,
  type Policy,
  type AsyncPolicy,
  type BenchmarkResult,
} from './benchmark';
export {
  renderCorpus,
  renderScenario,
  buildPrompt,
  parseDecision,
  decisionToManeuver,
  geminiCompleter,
  retryCompleter,
  openAiCompatCompleter,
  throttleCompleter,
  realCompleterFromEnv,
  isSafetyBlock,
  createLlmManeuverFn,
  type Completer,
  type LlmDecision,
  type CorpusOptions,
  type LlmLearnerOptions,
} from './llm-learner';
export {
  CURRICULUM,
  NO_COMPETENCE,
  FULL_COMPETENCE,
  competenceAtStage,
  ablate,
  learnerPolicy,
  type Competence,
} from './learner-policy';
export {
  diagnoseCorpusGaps,
  type CorpusFinding,
  type GapComponent,
} from './diagnose';
export {
  runRuleProbe,
  runLeakageExperiment,
  starboardProbe,
  crossingGiveWayProbe,
  boundLearnerCompleter,
  leakingLearnerCompleter,
  type RuleProbe,
  type Verdict,
  type LeakageVerdict,
  type LeakageReport,
  type LeakageConfig,
} from './leakage';
