/**
 * Safety gate checklist state, shared between the dashboard (where gates are
 * marked verified) and the app shell (which enforces them before Scenario Mode).
 *
 * Backed by useSyncExternalStore (matching src/hooks/useApiKey.ts's pattern) so
 * every consumer stays in sync when a gate is toggled, rather than relying on
 * HudDashboard happening to remount on every tab switch to pick up fresh state.
 * Also listens for the native `storage` event so status stays in sync across
 * browser tabs/windows.
 */
import { useSyncExternalStore } from 'react';

export interface SafetyGate {
  id: string;
  label: string;
  detail: string;
  critical: boolean;
}

export const SAFETY_GATES: readonly SafetyGate[] = [
  {
    id: 'ppe',
    label: 'Nanoparticle PPE',
    detail: 'Nitrile gloves + N95 confirmed before approach',
    critical: true,
  },
  {
    id: 'esd',
    label: 'ESD Protocol',
    detail: 'Wrist strap connected before PCB contact',
    critical: true,
  },
  {
    id: 'gas-start',
    label: 'Gas Startup Sequence',
    detail: 'Sheath → atomizer order; KEWB pressure verified',
    critical: true,
  },
  {
    id: 'gas-stop',
    label: 'Gas Shutdown Sequence',
    detail: 'Timed 10 s + 60 s waits; reverse order',
    critical: true,
  },
  {
    id: 'ink',
    label: 'Ink Vial Handling',
    detail: 'Vial inspection + loading protocol confirmed',
    critical: false,
  },
] as const;

const GATE_STORAGE_KEY = 'hud-gate-status';

export function loadGateStatus(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(GATE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function pendingCriticalGates(status: Record<string, boolean>): SafetyGate[] {
  return SAFETY_GATES.filter((g) => g.critical && !status[g.id]);
}

// getSnapshot must return a referentially-stable value between updates (React
// compares via Object.is) — cache it and only recompute on an actual change,
// rather than calling loadGateStatus() fresh on every getSnapshot() call.
let cachedSnapshot: Record<string, boolean> = loadGateStatus();
const listeners = new Set<() => void>();

function refreshAndNotify() {
  cachedSnapshot = loadGateStatus();
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Record<string, boolean> {
  return cachedSnapshot;
}

function getServerSnapshot(): Record<string, boolean> {
  return {};
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === GATE_STORAGE_KEY) refreshAndNotify();
  });
}

export function useSafetyGates(): {
  gateStatus: Record<string, boolean>;
  toggleGate: (id: string) => void;
} {
  const gateStatus = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggleGate(id: string) {
    const current = loadGateStatus();
    const next = { ...current, [id]: !current[id] };
    try { localStorage.setItem(GATE_STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
    refreshAndNotify();
  }

  return { gateStatus, toggleGate };
}
