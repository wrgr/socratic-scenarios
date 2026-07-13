/**
 * AJP operational metrics grounded in repair depot economics.
 * Measures what a lab manager or depot chief actually cares about:
 * machine availability, safety compliance, escalation reduction, and training ROI.
 * These metrics translate training outcomes into operational cost language.
 */
import type { StepSummary, ScenarioSummary } from '../../components/scenario-view.utils';

// ─── Cost Model ───────────────────────────────────────────────────

/**
 * Repair depot cost assumptions. Conservative defaults from AJP operational context.
 * All values overridable for site-specific calibration.
 */
export interface AJPCostModel {
  /** Machine downtime cost per hour (USD). AJP systems: $150–500/hr. */
  machineHourlyRateDollars: number;
  /** Hours to recover from a full nozzle clean. */
  fullCleanHours: number;
  /** Hours wasted if a partial clog is over-escalated to full disassembly. */
  unnecessaryCleanHours: number;
  /** Expert consultation cost per incident (USD). */
  expertConsultDollars: number;
  /** Estimated cost of a nanoparticle safety incident (worker comp + regulatory). */
  safetyIncidentDollars: number;
  /** Baseline escalation rate for untrained technician (0–1). */
  baselineEscalationRate: number;
}

export const DEFAULT_COST_MODEL: AJPCostModel = {
  machineHourlyRateDollars: 200,
  fullCleanHours: 4,
  unnecessaryCleanHours: 4,
  expertConsultDollars: 400,
  safetyIncidentDollars: 2500,
  baselineEscalationRate: 0.65,
};

// ─── Metric Types ─────────────────────────────────────────────────

/** Operational metrics computed from one or more completed scenario sessions. */
export interface AJPOperationalMetrics {
  // ── Learning efficiency ──────────────────────────────────────
  /** Average attempts before correct diagnosis on fault steps (lower = better). */
  meanFaultDetectionAttempts: number;
  /** % of scenarios completed with all fault steps correct on first attempt. */
  firstPassFaultRate: number;

  // ── Safety ────────────────────────────────────────────────────
  /** % of scenarios with zero safety violations (0–1). AJP target: 1.0. */
  safetyGateCompliance: number;
  /** Total dangerous action selections across all sessions. */
  dangerousActionCount: number;

  // ── Repair quality ────────────────────────────────────────────
  /** % of partial clog encounters resolved with conservative sheath-gas fix (not escalation). */
  conservativeActionRate: number;
  /** % of fault diagnoses correct on first attempt. */
  diagnosticFirstPassRate: number;
  /** Overall scenario score (0–1, weighted across all steps). */
  meanScenarioScore: number;

  // ── Operational cost impact ───────────────────────────────────
  /** Estimated machine-hours saved vs. untrained baseline (unnecessary disassembly). */
  downtimeHoursSaved: number;
  /** Estimated USD saved on unnecessary disassembly events. */
  unnecessaryCleanCostAvoided: number;
  /** Estimated USD saved on expert consultations. */
  expertConsultCostAvoided: number;
  /** Estimated USD saved by preventing safety incidents. */
  safetyIncidentCostAvoided: number;
  /** Total estimated operational cost avoided (USD). */
  totalCostAvoidedDollars: number;

  // ── Readiness ─────────────────────────────────────────────────
  /** Readiness tier based on overall performance. */
  readinessTier: 'not-ready' | 'supervised' | 'independent' | 'expert';
}

// ─── Computation ──────────────────────────────────────────────────

/** Derive fault-specific summaries from full step summaries. */
function faultSteps(summaries: StepSummary[]): StepSummary[] {
  return summaries.filter((s) => s.isFaultStep);
}

/** Compute all operational metrics from one or more scenario sessions. */
export function computeAJPOperationalMetrics(
  scenarioSummaries: ScenarioSummary[],
  safetyViolationsPerScenario: number[],
  conservativeActionsCorrect: number[],
  conservativeActionsTotal: number[],
  costModel: AJPCostModel = DEFAULT_COST_MODEL,
): AJPOperationalMetrics {
  if (scenarioSummaries.length === 0) {
    return emptyMetrics();
  }

  const n = scenarioSummaries.length;
  const allFaultSteps = scenarioSummaries.flatMap((s) => faultSteps(s.stepSummaries));
  const totalFaultEncounters = allFaultSteps.length;

  // Detection speed
  const faultAttempts = allFaultSteps.map((s) => s.attemptsNeeded);
  const meanFaultDetectionAttempts =
    faultAttempts.length > 0
      ? faultAttempts.reduce((a, b) => a + b, 0) / faultAttempts.length
      : 1;

  // First-pass fault rate
  const firstPassFaultRate =
    faultAttempts.length > 0
      ? faultAttempts.filter((a) => a === 1).length / faultAttempts.length
      : 0;

  // Safety
  const totalViolations = safetyViolationsPerScenario.reduce((a, b) => a + b, 0);
  const safetyGateCompliance =
    safetyViolationsPerScenario.filter((v) => v === 0).length / n;
  const dangerousActionCount = totalViolations;

  // Conservative action rate
  const totalConservativeCorrect = conservativeActionsCorrect.reduce((a, b) => a + b, 0);
  const totalConservativeTotal = conservativeActionsTotal.reduce((a, b) => a + b, 0);
  const conservativeActionRate =
    totalConservativeTotal > 0 ? totalConservativeCorrect / totalConservativeTotal : 0;

  // Diagnostic accuracy
  const diagnosticFirstPassRate = firstPassFaultRate;

  // Overall score
  const meanScenarioScore =
    scenarioSummaries.reduce((a, s) => a + s.overallScore, 0) / n;

  // Cost impact: compare to baseline untrained technician
  // Baseline: 65% escalation rate on partial clogs → many unnecessary full cleans
  const partialClogEncounters = totalFaultEncounters; // all fault steps in demo are partial clogs
  const baselineUnnecessaryCleans = Math.round(
    partialClogEncounters * costModel.baselineEscalationRate,
  );
  const actualUnnecessaryCleans = Math.round(
    partialClogEncounters * (1 - conservativeActionRate),
  );
  const cleaningsAvoided = Math.max(0, baselineUnnecessaryCleans - actualUnnecessaryCleans);

  const downtimeHoursSaved = cleaningsAvoided * costModel.unnecessaryCleanHours;
  const unnecessaryCleanCostAvoided =
    downtimeHoursSaved * costModel.machineHourlyRateDollars;

  // Expert consultation: each unresolved fault escalates to expert; trained tech resolves more independently
  const expertConsultsAvoided = Math.round(cleaningsAvoided * 0.5);
  const expertConsultCostAvoided = expertConsultsAvoided * costModel.expertConsultDollars;

  // Safety cost avoided: safety incidents reduced proportional to compliance rate improvement
  const baselineSafetyRate = 0.15; // 15% of scenarios have a safety incident for untrained tech
  const actualSafetyRate = 1 - safetyGateCompliance;
  const safetyIncidentsAvoided = Math.max(
    0,
    Math.round((baselineSafetyRate - actualSafetyRate) * n),
  );
  const safetyIncidentCostAvoided =
    safetyIncidentsAvoided * costModel.safetyIncidentDollars;

  const totalCostAvoidedDollars =
    unnecessaryCleanCostAvoided + expertConsultCostAvoided + safetyIncidentCostAvoided;

  // Readiness tier
  const readinessTier = deriveReadinessTier(
    meanScenarioScore,
    safetyGateCompliance,
    diagnosticFirstPassRate,
  );

  return {
    meanFaultDetectionAttempts,
    firstPassFaultRate,
    safetyGateCompliance,
    dangerousActionCount,
    conservativeActionRate,
    diagnosticFirstPassRate,
    meanScenarioScore,
    downtimeHoursSaved,
    unnecessaryCleanCostAvoided,
    expertConsultCostAvoided,
    safetyIncidentCostAvoided,
    totalCostAvoidedDollars,
    readinessTier,
  };
}

function deriveReadinessTier(
  score: number,
  safetyCompliance: number,
  diagnosticRate: number,
): AJPOperationalMetrics['readinessTier'] {
  if (safetyCompliance < 1.0) return 'not-ready'; // any safety violation = not ready
  if (score >= 0.9 && diagnosticRate >= 0.9) return 'expert';
  if (score >= 0.75 && diagnosticRate >= 0.75) return 'independent';
  if (score >= 0.55) return 'supervised';
  return 'not-ready';
}

function emptyMetrics(): AJPOperationalMetrics {
  return {
    meanFaultDetectionAttempts: 0,
    firstPassFaultRate: 0,
    safetyGateCompliance: 0,
    dangerousActionCount: 0,
    conservativeActionRate: 0,
    diagnosticFirstPassRate: 0,
    meanScenarioScore: 0,
    downtimeHoursSaved: 0,
    unnecessaryCleanCostAvoided: 0,
    expertConsultCostAvoided: 0,
    safetyIncidentCostAvoided: 0,
    totalCostAvoidedDollars: 0,
    readinessTier: 'not-ready',
  };
}

// ─── Readiness Label ──────────────────────────────────────────────

/** Human-readable tier labels for UI display. */
export const READINESS_LABELS: Record<AJPOperationalMetrics['readinessTier'], string> = {
  'not-ready': 'Not Ready — additional training required before unsupervised operation',
  'supervised': 'Supervised — may operate with senior tech present',
  'independent': 'Independent — cleared for solo repair operations',
  'expert': 'Expert — qualified to train others',
};
