import { describe, it, expect } from 'vitest';
import { applyAttempt, summarizeMastery } from '../probe-progress';
import type { ProbeProgressMap } from '../probe-progress';
import { ajpProbeNodes } from '../../../corpus/ajp/probes';
import { probeCategory } from '../../../components/socratic-view.utils';

describe('applyAttempt', () => {
  it('creates a record on first attempt', () => {
    const next = applyAttempt({}, 'PROBE-A', 0.6, false);
    expect(next['PROBE-A']).toEqual({ attempts: 1, mastered: false, bestScore: 0.6, lastScore: 0.6 });
  });

  it('increments attempts and tracks best vs last score', () => {
    let map: ProbeProgressMap = {};
    map = applyAttempt(map, 'PROBE-A', 0.8, false);
    map = applyAttempt(map, 'PROBE-A', 0.5, false);
    expect(map['PROBE-A']).toEqual({ attempts: 2, mastered: false, bestScore: 0.8, lastScore: 0.5 });
  });

  it('mastery is sticky once passed', () => {
    let map: ProbeProgressMap = {};
    map = applyAttempt(map, 'PROBE-A', 0.9, true);
    map = applyAttempt(map, 'PROBE-A', 0.4, false);
    expect(map['PROBE-A'].mastered).toBe(true);
  });

  it('does not mutate the input map', () => {
    const original: ProbeProgressMap = { 'PROBE-A': { attempts: 1, mastered: false, bestScore: 0.5, lastScore: 0.5 } };
    applyAttempt(original, 'PROBE-A', 0.9, true);
    expect(original['PROBE-A'].attempts).toBe(1);
    expect(original['PROBE-A'].mastered).toBe(false);
  });
});

describe('summarizeMastery', () => {
  const probes = [
    { id: 'P1', category: 'Gas' },
    { id: 'P2', category: 'Gas' },
    { id: 'P3', category: 'Safety' },
  ];

  it('returns zeroed domains for empty progress', () => {
    const summary = summarizeMastery(probes, {});
    expect(summary.totalProbes).toBe(3);
    expect(summary.totalMastered).toBe(0);
    expect(summary.totalAttempted).toBe(0);
    expect(summary.avgBestScore).toBeNull();
    expect(summary.domains).toEqual([
      { category: 'Gas', probeCount: 2, masteredCount: 0, attemptedCount: 0, avgBestScore: null },
      { category: 'Safety', probeCount: 1, masteredCount: 0, attemptedCount: 0, avgBestScore: null },
    ]);
  });

  it('aggregates mastery and average best score per category', () => {
    const progress: ProbeProgressMap = {
      P1: { attempts: 2, mastered: true, bestScore: 0.9, lastScore: 0.9 },
      P2: { attempts: 1, mastered: false, bestScore: 0.5, lastScore: 0.5 },
    };
    const summary = summarizeMastery(probes, progress);
    const gas = summary.domains.find((d) => d.category === 'Gas');
    expect(gas).toEqual({ category: 'Gas', probeCount: 2, masteredCount: 1, attemptedCount: 2, avgBestScore: 0.7 });
    expect(summary.totalMastered).toBe(1);
    expect(summary.totalAttempted).toBe(2);
    expect(summary.avgBestScore).toBeCloseTo(0.7);
  });

  it('ignores zero-attempt records', () => {
    const progress: ProbeProgressMap = {
      P3: { attempts: 0, mastered: false, bestScore: 0, lastScore: 0 },
    };
    const summary = summarizeMastery(probes, progress);
    expect(summary.totalAttempted).toBe(0);
    expect(summary.avgBestScore).toBeNull();
  });

  it('covers every real Socratic probe via its display category', () => {
    const real = ajpProbeNodes.map((p) => ({ id: p.id, category: probeCategory(p.id) }));
    const summary = summarizeMastery(real, {});
    expect(summary.totalProbes).toBe(ajpProbeNodes.length);
    const counted = summary.domains.reduce((n, d) => n + d.probeCount, 0);
    expect(counted).toBe(ajpProbeNodes.length);
    // No probe should fall through to the 'General' fallback category.
    expect(summary.domains.map((d) => d.category)).not.toContain('General');
  });
});
