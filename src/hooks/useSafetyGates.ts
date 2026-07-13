/**
 * Safety gate checklist state, shared between the dashboard (where gates are
 * marked verified) and the app shell (which enforces them before Scenario Mode).
 */
import { useState } from 'react';

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

export function useSafetyGates(): {
  gateStatus: Record<string, boolean>;
  toggleGate: (id: string) => void;
} {
  const [gateStatus, setGateStatus] = useState<Record<string, boolean>>(loadGateStatus);

  function toggleGate(id: string) {
    setGateStatus((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(GATE_STORAGE_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }

  return { gateStatus, toggleGate };
}
