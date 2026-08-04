/**
 * Imazu-style benchmark set — 22 encounters spanning the categories of the Imazu
 * problem (single-ship head-on / crossing / overtaking, and 2–3 ship
 * combinations), the standard test set for COLREG collision-avoidance methods
 * (Imazu 1987; used by Sawada et al. 2021, Zhao & Roh, etc.).
 *
 * These are reconstructed to the problem's *structure and difficulty categories*
 * rather than the exact published coordinates: each target is placed on a genuine
 * collision course (do-nothing ⇒ DCPA ≈ 0) via `collisionTarget`, so the set is a
 * clean, hard test for the avoidance policies and the scoring instrument. Used by
 * the benchmark runner (benchmark.ts) and described in docs/colreg-validation.md.
 */
import type { SimScenario } from '../../engine/colreg-sim';
import { collisionTarget, leadTarget, asternTarget, makeScenario } from './benchmark-geometry';

const scenario = makeScenario;
const C = collisionTarget;

export const imazuBenchmark: SimScenario[] = [
  // ── Single ship (1–8) ──
  scenario('IMAZU-01', 'Head-on', 'beginner', [C('A', 0, 6000, 12)]),
  scenario('IMAZU-02', 'Crossing 30° stbd', 'beginner', [C('A', 30, 5200, 10)]),
  scenario('IMAZU-03', 'Crossing 60° stbd', 'intermediate', [C('A', 60, 5200, 11)]),
  scenario('IMAZU-04', 'Crossing 90° stbd', 'intermediate', [C('A', 90, 5000, 13)]),
  scenario('IMAZU-05', 'Crossing 40° port (stand-on)', 'intermediate', [C('A', -40, 5200, 10)]),
  scenario('IMAZU-06', 'Crossing 75° port (stand-on)', 'intermediate', [C('A', -75, 5200, 12)]),
  scenario('IMAZU-07', 'Overtaking a slow vessel', 'beginner', [leadTarget('A', 0, 2600, 6)]),
  scenario('IMAZU-08', 'Being overtaken from astern', 'intermediate', [asternTarget('A', 3000, 17)]),
  // ── Two ships (9–16) ──
  scenario('IMAZU-09', 'Head-on + stbd crosser', 'advanced', [C('A', 0, 6000, 12), C('B', 45, 5000, 10)]),
  scenario('IMAZU-10', 'Head-on + port crosser', 'advanced', [C('A', 0, 6000, 12), C('B', -45, 5000, 10)]),
  scenario('IMAZU-11', 'Two starboard crossers', 'advanced', [C('A', 30, 4600, 10), C('B', 70, 5600, 12)]),
  scenario('IMAZU-12', 'Starboard + port crossers', 'advanced', [C('A', 45, 5000, 10), C('B', -45, 5000, 10)]),
  scenario('IMAZU-13', 'Head-on + overtaking a lead', 'advanced', [C('A', 0, 6500, 12), leadTarget('B', 300, 2600, 6)]),
  scenario('IMAZU-14', 'Fine + broad starboard crossers', 'advanced', [C('A', 15, 4600, 10), C('B', 85, 5600, 13)]),
  scenario('IMAZU-15', 'Head-on + broad port crosser', 'advanced', [C('A', 0, 6000, 12), C('B', -80, 5600, 12)]),
  scenario('IMAZU-16', 'Starboard crosser + overtaken astern', 'advanced', [C('A', 40, 5000, 10), asternTarget('B', 3000, 17)]),
  // ── Three ships (17–22) ──
  scenario('IMAZU-17', 'Head-on + both crossers', 'advanced', [C('A', 0, 6000, 12), C('B', 55, 5200, 11), C('C', -55, 5200, 11)]),
  scenario('IMAZU-18', 'Three starboard crossers', 'advanced', [C('A', 25, 4600, 10), C('B', 55, 5200, 11), C('C', 85, 5800, 13)]),
  scenario('IMAZU-19', 'Two fine + broad starboard', 'advanced', [C('A', 0, 6000, 12), C('B', 15, 5600, 11), C('C', 60, 5200, 11)]),
  scenario('IMAZU-20', 'Both crossers + overtaking lead', 'advanced', [C('A', -40, 5200, 10), C('B', 40, 5200, 10), leadTarget('C', 300, 2600, 6)]),
  scenario('IMAZU-21', 'Near/far stbd + port', 'advanced', [C('A', 35, 4200, 10), C('B', 65, 5600, 12), C('C', -50, 5200, 10)]),
  scenario('IMAZU-22', 'Crowded — head-ish + both beams', 'advanced', [C('A', 10, 6000, 12), C('B', 70, 5200, 12), C('C', -70, 5200, 12)]),
];

export function getImazuCaseById(id: string): SimScenario | undefined {
  return imazuBenchmark.find((s) => s.id === id);
}
