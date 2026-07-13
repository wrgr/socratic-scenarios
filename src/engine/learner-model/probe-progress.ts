/**
 * Persistent Socratic probe progress — the declarative axis of the learner model.
 *
 * Every Mentor evaluation in Socratic Practice is recorded here (attempts,
 * best/last score, mastery), persisted in localStorage so progress survives
 * tab switches and reloads, and aggregated per topic category for the
 * dashboard's Mastery Map. Workflow Demo runs are deliberately NOT recorded —
 * those are simulated-learner demonstrations, not the operator's own practice.
 *
 * The merge and aggregation functions are pure so they can be unit-tested
 * without a DOM.
 */

export interface ProbeAttemptRecord {
  attempts: number;
  mastered: boolean;
  /** Highest Mentor score seen for this probe (0–1). */
  bestScore: number;
  /** Most recent Mentor score (0–1). */
  lastScore: number;
}

export type ProbeProgressMap = Record<string, ProbeAttemptRecord>;

/** Per-category aggregate for the dashboard Mastery Map. */
export interface DomainMastery {
  category: string;
  probeCount: number;
  masteredCount: number;
  attemptedCount: number;
  /** Mean best score across attempted probes in this category, or null if none attempted. */
  avgBestScore: number | null;
}

export interface MasterySummary {
  domains: DomainMastery[];
  totalProbes: number;
  totalMastered: number;
  totalAttempted: number;
  /** Mean best score across all attempted probes, or null if nothing attempted. */
  avgBestScore: number | null;
}

// ─── Pure logic ───────────────────────────────────────────────────

/** Fold one Mentor evaluation into the progress map (non-mutating). */
export function applyAttempt(
  progress: ProbeProgressMap,
  probeId: string,
  score: number,
  masteryPassed: boolean,
): ProbeProgressMap {
  const prev = progress[probeId];
  return {
    ...progress,
    [probeId]: {
      attempts: (prev?.attempts ?? 0) + 1,
      mastered: (prev?.mastered ?? false) || masteryPassed,
      bestScore: Math.max(prev?.bestScore ?? 0, score),
      lastScore: score,
    },
  };
}

/** Aggregate probe progress per category, preserving the given probe order. */
export function summarizeMastery(
  probes: readonly { id: string; category: string }[],
  progress: ProbeProgressMap,
): MasterySummary {
  const domains: DomainMastery[] = [];
  const byCategory = new Map<string, DomainMastery>();
  let totalMastered = 0;
  let totalAttempted = 0;
  let scoreSum = 0;

  for (const probe of probes) {
    let domain = byCategory.get(probe.category);
    if (!domain) {
      domain = { category: probe.category, probeCount: 0, masteredCount: 0, attemptedCount: 0, avgBestScore: null };
      byCategory.set(probe.category, domain);
      domains.push(domain);
    }
    domain.probeCount += 1;

    const rec = progress[probe.id];
    if (!rec || rec.attempts === 0) continue;
    domain.attemptedCount += 1;
    domain.avgBestScore = (domain.avgBestScore ?? 0) + rec.bestScore;
    totalAttempted += 1;
    scoreSum += rec.bestScore;
    if (rec.mastered) {
      domain.masteredCount += 1;
      totalMastered += 1;
    }
  }

  for (const domain of domains) {
    if (domain.attemptedCount > 0) {
      domain.avgBestScore = (domain.avgBestScore as number) / domain.attemptedCount;
    }
  }

  return {
    domains,
    totalProbes: probes.length,
    totalMastered,
    totalAttempted,
    avgBestScore: totalAttempted > 0 ? scoreSum / totalAttempted : null,
  };
}

// ─── Storage ──────────────────────────────────────────────────────

const PROGRESS_STORAGE_KEY = 'socratic-probe-progress';

export function loadProbeProgress(): ProbeProgressMap {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProbeProgressMap) : {};
  } catch {
    return {};
  }
}

/** Record one Mentor evaluation and persist. Returns the updated map. */
export function recordProbeAttempt(
  probeId: string,
  score: number,
  masteryPassed: boolean,
): ProbeProgressMap {
  const next = applyAttempt(loadProbeProgress(), probeId, score, masteryPassed);
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* noop — progress simply won't survive refresh */
  }
  return next;
}
