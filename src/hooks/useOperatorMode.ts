/**
 * Operator mode — the load-management switch for the whole app.
 *
 * Two states, following the cognitive load theory stance in OVERVIEW.md:
 *   - 'training'    Full instructional surface: Socratic Practice, Scenario Mode,
 *                   Workflow Demo, Reachback, Retrieval Lab.
 *   - 'high-stress' The operator is at the machine under time pressure. Every
 *                   comprehensive training surface is locked; only the dashboard
 *                   and corpus-bound Reachback Lookup stay reachable, and visual
 *                   chrome is stripped to keep extraneous load near zero.
 *
 * Persisted in localStorage so a mid-incident refresh does not drop the
 * operator back into the full training UI.
 */
import { useState } from 'react';

export type OperatorMode = 'training' | 'high-stress';

const MODE_STORAGE_KEY = 'operator-mode';

export function loadOperatorMode(): OperatorMode {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === 'high-stress' ? 'high-stress' : 'training';
  } catch {
    return 'training';
  }
}

function saveOperatorMode(mode: OperatorMode): void {
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    /* noop — mode simply won't survive refresh */
  }
}

export function useOperatorMode(): [OperatorMode, (mode: OperatorMode) => void] {
  const [mode, setMode] = useState<OperatorMode>(loadOperatorMode);

  function set(next: OperatorMode) {
    saveOperatorMode(next);
    setMode(next);
  }

  return [mode, set];
}
