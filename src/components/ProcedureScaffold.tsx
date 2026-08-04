/**
 * ProcedureScaffold — sidebar/header component that shows the learner where
 * they are in the scenario procedure (design doc §4.4).
 *
 * Displays:
 *   - Current ScenarioPhase label
 *   - Step N of M
 *   - Step list with ✓ completed / → active / ○ pending markers
 *   - ⚠ armed safety gates from the active step's safetyGateNodeId
 *
 * Used by ScenarioView. Optionally shown in InOperationView when a procedure
 * context is active (pass procedureContext prop).
 */
import type { ScenarioDefinition } from '../engine/scenario/types';
import type { ScenarioSessionState } from '../engine/scenario/types';
import { SCENARIO_PHASE_LABELS } from '../engine/scenario/types';

interface Props {
  definition: ScenarioDefinition;
  state: ScenarioSessionState;
  /** Show safety gate warning inline (default true). */
  showSafetyGate?: boolean;
  /** Domain phase→label map. Defaults to the AJP phase labels. */
  phaseLabels?: Record<string, string>;
}

/** Returns a display name for a step, using the active domain's phase labels. */
function stepDisplayName(
  step: { id: string; phase: string },
  index: number,
  labels: Record<string, string>,
): string {
  return `Step ${index + 1} — ${labels[step.phase] ?? step.phase}`;
}

/** Marker for each step based on its position relative to currentStepIndex. */
function stepMarker(index: number, currentIndex: number, isComplete: boolean): string {
  if (isComplete || index < currentIndex) return '✓';
  if (index === currentIndex) return '→';
  return '○';
}

export function ProcedureScaffold({
  definition,
  state,
  showSafetyGate = true,
  phaseLabels = SCENARIO_PHASE_LABELS,
}: Props) {
  const { steps } = definition;
  const { currentStepIndex, phase } = state;
  const isScenarioComplete = phase === 'COMPLETE' || currentStepIndex >= steps.length;
  const totalSteps = steps.length;
  const displayIndex = Math.min(currentStepIndex, totalSteps - 1);
  const currentStep = steps[displayIndex];

  return (
    <aside className="procedure-scaffold" aria-label="Procedure progress">
      {/* Phase + step counter */}
      <div className="scaffold-header">
        <span className="scaffold-phase">
          {phaseLabels[phase] ?? phase}
        </span>
        <span className="scaffold-step-counter">
          {isScenarioComplete
            ? `${totalSteps} of ${totalSteps}`
            : `Step ${displayIndex + 1} of ${totalSteps}`}
        </span>
      </div>

      {/* Safety gate warning */}
      {showSafetyGate && currentStep?.safetyGateNodeId && !state.safetyGateAcknowledged && (
        <div className="scaffold-safety-gate" role="alert">
          ⚠ Safety gate — acknowledge before advancing
        </div>
      )}

      {/* Step list */}
      <ol className="scaffold-step-list">
        {steps.map((step, i) => {
          const marker = stepMarker(i, displayIndex, isScenarioComplete);
          const isActive = i === displayIndex && !isScenarioComplete;
          const isDone = marker === '✓';
          return (
            <li
              key={step.id}
              className={[
                'scaffold-step-item',
                isDone ? 'scaffold-step--done' : '',
                isActive ? 'scaffold-step--active' : '',
                !isDone && !isActive ? 'scaffold-step--pending' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="scaffold-step-marker" aria-hidden="true">
                {marker}
              </span>
              <span className="scaffold-step-label">{stepDisplayName(step, i, phaseLabels)}</span>
              {step.safetyGateNodeId && (
                <span className="scaffold-gate-dot" title="Safety gate" aria-label="Has safety gate">
                  ⚠
                </span>
              )}
              {step.faultInjectionId && (
                <span className="scaffold-fault-dot" title="Fault injection" aria-label="Fault injection step">
                  ⚡
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Active fault indicators */}
      {state.activeFaultIds.length > 0 && (
        <div className="scaffold-active-faults" role="status">
          <span className="scaffold-fault-label">Active fault{state.activeFaultIds.length > 1 ? 's' : ''}:</span>
          <ul className="scaffold-fault-list">
            {state.activeFaultIds.map((id) => (
              <li key={id} className="scaffold-fault-item">{id}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Consequence warnings */}
      {state.triggeredConsequenceIds.length > 0 && (
        <div className="scaffold-consequences" role="alert">
          <span className="scaffold-consequence-label">
            ⚠ {state.triggeredConsequenceIds.length} consequence{state.triggeredConsequenceIds.length > 1 ? 's' : ''} triggered
          </span>
        </div>
      )}
    </aside>
  );
}
