/**
 * Pure utility functions for ScenarioView: step scoring, progress tracking,
 * and summary generation. No React imports — keeps the component lean.
 */
import type { ScenarioAction, ScenarioStepView } from '../types/ajp';

// ─── Action Evaluation ────────────────────────────────────────────

export interface ActionResult {
  correct: boolean;
  consequence: string;
  scaffoldHint?: string;
}

/** Evaluate a learner's action selection against a step's action list. */
export function evaluateAction(
  actionId: string,
  actions: ScenarioAction[],
): ActionResult {
  const selected = actions.find((a) => a.id === actionId);
  if (!selected) {
    return { correct: false, consequence: 'Action not found.', scaffoldHint: undefined };
  }
  return {
    correct: selected.isCorrect,
    consequence: selected.consequence,
    scaffoldHint: selected.scaffoldHint,
  };
}

// ─── Progress Tracking ────────────────────────────────────────────

export interface StepSummary {
  stepId: string;
  isFaultStep: boolean;
  attemptsNeeded: number;
  correct: boolean;
}

export interface ScenarioSummary {
  totalSteps: number;
  perfectSteps: number;
  stepsWithErrors: number;
  safetyViolations: number;
  overallScore: number; // 0–1
  stepSummaries: StepSummary[];
}

/** Compute final summary from recorded step outcomes. */
export function computeScenarioSummary(summaries: StepSummary[]): ScenarioSummary {
  const totalSteps = summaries.length;
  const perfectSteps = summaries.filter((s) => s.attemptsNeeded === 1).length;
  const stepsWithErrors = summaries.filter((s) => s.attemptsNeeded > 1).length;

  // Safety violation = chose the dangerous option (consequence contains 'DANGEROUS')
  const safetyViolations = 0; // tracked separately by the component

  const scorePerStep: number[] = summaries.map((s) => {
    if (!s.correct) return 0;
    if (s.attemptsNeeded === 1) return 1.0;
    if (s.attemptsNeeded === 2) return 0.6;
    return 0.3;
  });

  const overallScore =
    totalSteps > 0
      ? scorePerStep.reduce((sum, s) => sum + s, 0) / totalSteps
      : 0;

  return {
    totalSteps,
    perfectSteps,
    stepsWithErrors,
    safetyViolations,
    overallScore,
    stepSummaries: summaries,
  };
}

// ─── UI Helpers ───────────────────────────────────────────────────

/** Return the step number label (e.g., "Step 3 of 6"). */
export function stepLabel(index: number, total: number): string {
  return `Step ${index + 1} of ${total}`;
}

/** Return a score label string for display. */
export function scoreLabel(score: number): string {
  if (score >= 0.9) return 'Excellent — ready for supervised practice';
  if (score >= 0.7) return 'Good — review flagged steps before unsupervised use';
  if (score >= 0.5) return 'Partial — additional Socratic review recommended';
  return 'Needs review — return to Socratic mode for fault diagnosis concepts';
}

/** Return CSS class for a step's fault indicator. */
export function situationClass(step: ScenarioStepView): string {
  return step.isFaultStep ? 'narrator-fault' : 'narrator-nominal';
}

/** Return label for action button state. */
export function actionButtonClass(
  actionId: string,
  selectedId: string | null,
  result: ActionResult | null,
): string {
  if (!selectedId || !result) return 'action-btn';
  if (actionId !== selectedId) return 'action-btn action-btn--dimmed';
  return result.correct ? 'action-btn action-btn--correct' : 'action-btn action-btn--incorrect';
}
