/**
 * useRelevanceJudgments — reviewer-supplied ground truth for the RAG Coverage view.
 *
 * Two coexisting maps, persisted together to localStorage:
 *  - `relevance`: per (query, chunk) pair, whether the retrieved chunk is
 *    actually relevant to the query. Keyed `${queryId}::${chunkId}`.
 *  - `answerable`: per query, whether the corpus SHOULD be able to answer it.
 *    Absence means "unknown" (the query is excluded from the confusion matrix).
 *
 * Together these turn the coverage-only view into a TP/FP/FN/TN matrix — see
 * rag-coverage.utils.ts for how the cells are derived. Judgments survive reloads
 * and export as JSON for handoff. Mirrors the useExpertFlags store pattern.
 */
import { useSyncExternalStore } from 'react';
import type { Relevance, Answerable, JudgmentSnapshot } from '../components/rag-coverage.utils';
import { relevanceKey } from '../components/rag-coverage.utils';

const STORAGE_KEY = 'teachme.ragJudgments.v1';

const EMPTY: JudgmentSnapshot = { relevance: {}, answerable: {} };

function readStorage(): JudgmentSnapshot {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<JudgmentSnapshot>;
    return {
      relevance: parsed?.relevance && typeof parsed.relevance === 'object' ? parsed.relevance : {},
      answerable: parsed?.answerable && typeof parsed.answerable === 'object' ? parsed.answerable : {},
    };
  } catch {
    return EMPTY;
  }
}

function writeStorage(snap: JudgmentSnapshot) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch {
    // best-effort — quota/serialization errors are non-fatal for judgments
  }
}

// Module-level store so every consumer shares one snapshot reference.
let store: JudgmentSnapshot = readStorage();
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

function commit(next: JudgmentSnapshot) {
  store = next;
  writeStorage(store);
  emit();
}

function setRelevanceInternal(queryId: string, chunkId: string, value: Relevance | null) {
  if (!queryId || !chunkId) return;
  const key = relevanceKey(queryId, chunkId);
  const relevance = { ...store.relevance };
  if (value === null) {
    if (!(key in relevance)) return;
    delete relevance[key];
  } else {
    if (relevance[key] === value) return;
    relevance[key] = value;
  }
  commit({ ...store, relevance });
}

function setAnswerableInternal(queryId: string, value: Answerable | null) {
  if (!queryId) return;
  const answerable = { ...store.answerable };
  if (value === null) {
    if (!(queryId in answerable)) return;
    delete answerable[queryId];
  } else {
    if (answerable[queryId] === value) return;
    answerable[queryId] = value;
  }
  commit({ ...store, answerable });
}

export interface RelevanceJudgmentsExport {
  exportedAt: string;
  relevanceCount: number;
  answerableCount: number;
  relevance: JudgmentSnapshot['relevance'];
  answerable: JudgmentSnapshot['answerable'];
}

export function useRelevanceJudgments() {
  const judgments = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    judgments,
    getRelevance(queryId: string, chunkId: string): Relevance | undefined {
      return judgments.relevance[relevanceKey(queryId, chunkId)];
    },
    setRelevance(queryId: string, chunkId: string, value: Relevance | null) {
      setRelevanceInternal(queryId, chunkId, value);
    },
    /** Cycle a chunk's verdict: unset → relevant → irrelevant → unset. */
    cycleRelevance(queryId: string, chunkId: string) {
      const current = judgments.relevance[relevanceKey(queryId, chunkId)];
      const next: Relevance | null =
        current === undefined ? 'relevant' : current === 'relevant' ? 'irrelevant' : null;
      setRelevanceInternal(queryId, chunkId, next);
    },
    getAnswerable(queryId: string): Answerable | undefined {
      return judgments.answerable[queryId];
    },
    setAnswerable(queryId: string, value: Answerable | null) {
      setAnswerableInternal(queryId, value);
    },
    /** Cycle a query's answerability: unknown → yes → no → unknown. */
    cycleAnswerable(queryId: string) {
      const current = judgments.answerable[queryId];
      const next: Answerable | null =
        current === undefined ? 'yes' : current === 'yes' ? 'no' : null;
      setAnswerableInternal(queryId, next);
    },
    clearAll() {
      commit({ relevance: {}, answerable: {} });
    },
    buildExport(): RelevanceJudgmentsExport {
      return {
        exportedAt: new Date().toISOString(),
        relevanceCount: Object.keys(judgments.relevance).length,
        answerableCount: Object.keys(judgments.answerable).length,
        relevance: judgments.relevance,
        answerable: judgments.answerable,
      };
    },
  };
}

/** Trigger a browser download of all relevance judgments as JSON. */
export function downloadJudgmentsJson(data: RelevanceJudgmentsExport) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const ts = data.exportedAt.replace(/[:.]/g, '-');
  const a = document.createElement('a');
  a.href = url;
  a.download = `teachme-rag-judgments-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
