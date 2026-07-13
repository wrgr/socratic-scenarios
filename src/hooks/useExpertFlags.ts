/**
 * useExpertFlags — lightweight flagging for KB items and learner knowledge gaps.
 *
 * Two coexisting flag kinds share one storage map:
 *  - `expert` (default): reviewer marks an id as `good` or `needs-review`.
 *    One entry per id; cycleFlag rotates through states.
 *  - `learner-gap`: learner records "I don't understand this" against a
 *    step/probe/concept id. Multiple entries may coexist per target, so
 *    entry keys are namespaced as `gap:${targetId}:${uniqueSuffix}` and
 *    carry a required `note` plus the plain `targetId` for back-lookup.
 *
 * Flags persist to localStorage so a session survives reloads, and can be
 * exported as JSON for handoff to review/triage tooling.
 */
import { useSyncExternalStore } from 'react';

export type FlagStatus = 'good' | 'needs-review' | 'gap';
export type FlagKind = 'expert' | 'learner-gap';

export interface FlagEntry {
  status: FlagStatus;
  updatedAt: string;
  note?: string;
  /** Defaults to 'expert' when absent (back-compat with pre-gap entries). */
  kind?: FlagKind;
  /** For learner-gap entries whose key is namespaced, the underlying id being flagged. */
  targetId?: string;
}

export interface FlagExport {
  exportedAt: string;
  count: number;
  flags: Array<{ id: string } & FlagEntry>;
}

const GAP_PREFIX = 'gap:';

function makeGapKey(targetId: string): string {
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `${GAP_PREFIX}${targetId}:${suffix}`;
}

const STORAGE_KEY = 'teachme.expertFlags.v1';

type FlagMap = Record<string, FlagEntry>;

function readStorage(): FlagMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as FlagMap) : {};
  } catch {
    return {};
  }
}

function writeStorage(map: FlagMap) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // quota or serialization error — ignore, flags are best-effort
  }
}

// Module-level store so every hook consumer sees the same map.
let store: FlagMap = readStorage();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return store;
}

function setFlagInternal(
  id: string,
  status: FlagStatus | null,
  note?: string,
  extra?: { kind?: FlagKind; targetId?: string },
) {
  if (!id) return;
  const next = { ...store };
  if (status === null) {
    if (!(id in next)) return;
    delete next[id];
  } else {
    const prev = next[id];
    const kind = extra?.kind;
    const targetId = extra?.targetId;
    if (
      prev &&
      prev.status === status &&
      prev.note === note &&
      prev.kind === kind &&
      prev.targetId === targetId
    ) return;
    next[id] = {
      status,
      updatedAt: new Date().toISOString(),
      ...(note ? { note } : {}),
      ...(kind ? { kind } : {}),
      ...(targetId ? { targetId } : {}),
    };
  }
  store = next;
  writeStorage(store);
  emit();
}

export function useExpertFlags() {
  const flags = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    flags,
    getFlag(id: string): FlagEntry | undefined {
      return flags[id];
    },
    setFlag(id: string, status: FlagStatus | null, note?: string) {
      setFlagInternal(id, status, note);
    },
    /** Cycle: none → good → needs-review → none. Expert flags only. */
    cycleFlag(id: string) {
      const current = flags[id]?.status;
      // Never cycle a gap entry via the expert toggle.
      if (current === 'gap') return;
      const nextStatus: FlagStatus | null =
        current === undefined ? 'good'
        : current === 'good' ? 'needs-review'
        : null;
      setFlagInternal(id, nextStatus);
    },
    /**
     * Record a learner knowledge gap against a target id (step/probe/concept).
     * Multiple gaps per target are allowed — each call appends a new entry.
     * The note is required; empty notes are rejected.
     */
    addGap(targetId: string, note: string): string | null {
      const trimmed = note.trim();
      if (!targetId || !trimmed) return null;
      const key = makeGapKey(targetId);
      setFlagInternal(key, 'gap', trimmed, { kind: 'learner-gap', targetId });
      return key;
    },
    /** Remove any single flag entry by its storage key. */
    removeFlag(id: string) {
      setFlagInternal(id, null);
    },
    /** Return all learner-gap entries whose targetId matches. */
    getGapsForTarget(targetId: string): Array<{ id: string } & FlagEntry> {
      if (!targetId) return [];
      return Object.entries(flags)
        .filter(([, entry]) => entry.kind === 'learner-gap' && entry.targetId === targetId)
        .map(([id, entry]) => ({ id, ...entry }))
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    },
    clearAll() {
      store = {};
      writeStorage(store);
      emit();
    },
    buildExport(): FlagExport {
      const entries = Object.entries(flags).map(([id, entry]) => ({ id, ...entry }));
      entries.sort((a, b) => a.id.localeCompare(b.id));
      return {
        exportedAt: new Date().toISOString(),
        count: entries.length,
        flags: entries,
      };
    },
  };
}

/** Read-only variant for components that only want to display a badge. */
export function useFlagStatus(id: string | undefined | null): FlagEntry | undefined {
  const flags = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return id ? flags[id] : undefined;
}

/** Trigger a browser download of the full flag log as JSON. */
export function downloadFlagsJson(data: FlagExport) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const ts = data.exportedAt.replace(/[:.]/g, '-');
  const a = document.createElement('a');
  a.href = url;
  a.download = `teachme-expert-flags-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
