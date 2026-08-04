/**
 * Restricted-visibility benchmark set — Rule 19 encounters (fog / radar-only).
 *
 * The clear-visibility Imazu set (imazu.ts) exercises the in-sight Rules (11–18):
 * give-way/stand-on roles, alter to starboard, no cut to port. Rule 19 is a
 * *different* regime and the right answer changes:
 *
 *   - There is **no stand-on vessel**. A contact detected by radar on a collision
 *     course must be given avoiding action whichever bow it is on — so a port-bow
 *     contact (a clear-visibility stand-on situation, where holding is correct) now
 *     *requires* action. These are the discriminating cases (RV-04, RV-05, RV-09).
 *   - Alteration of course to **port** for a contact **forward of the beam** is to
 *     be avoided (19(d)(i)), except for a vessel being overtaken (RV-06).
 *   - Alteration **toward** a contact **abeam or abaft the beam** is to be avoided
 *     (19(d)(ii)) — RV-07.
 *   - Speed must be a **safe speed** for the visibility (Rules 6/19) — the axis the
 *     clear-visibility set can't move (docs/colreg-validation.md §2, Tier 2).
 *
 * Same collision-course geometry generators as the Imazu set (every target has
 * DCPA ≈ 0 do-nothing), so this is a clean, hard test for the policies and the
 * scoring instrument; only `visibility` and the bearing mix differ. Scored by the
 * Rule 19 branch in colreg-rules.ts and run by benchmark.ts.
 */
import type { SimScenario } from '../../engine/colreg-sim';
import { collisionTarget, leadTarget, makeScenario } from './benchmark-geometry';

const C = collisionTarget;
const rv = (id: string, label: string, difficulty: SimScenario['difficulty'], targets: SimScenario['targets']) =>
  makeScenario(id, label, difficulty, targets, 'restricted');

export const restrictedBenchmark: SimScenario[] = [
  // ── Single contact, forward of the beam (1–3): alter to starboard + slow ──
  rv('RV-01', 'Fog: contact dead ahead', 'beginner', [C('A', 0, 6000, 12)]),
  rv('RV-02', 'Fog: fine starboard-bow contact', 'beginner', [C('A', 25, 5200, 10)]),
  rv('RV-03', 'Fog: broad starboard-bow contact', 'intermediate', [C('A', 70, 5200, 12)]),
  // ── Port-bow contacts (4–5): no stand-on — must act, and NOT to port ──
  rv('RV-04', 'Fog: fine port-bow contact (no stand-on)', 'intermediate', [C('A', -25, 5200, 10)]),
  rv('RV-05', 'Fog: broad port-bow contact (no stand-on)', 'intermediate', [C('A', -70, 5200, 12)]),
  // ── Overtaking exception (6): port alteration is permitted (19(d)(i)) ──
  rv('RV-06', 'Fog: overtaking a slow vessel', 'intermediate', [leadTarget('A', 0, 2600, 6)]),
  // ── Abaft the beam (7): do not alter toward it (19(d)(ii)) ──
  rv('RV-07', 'Fog: contact on the starboard quarter', 'advanced', [C('A', 135, 4200, 14)]),
  // ── Multi-contact fog (8–10) ──
  rv('RV-08', 'Fog: ahead + starboard-bow contacts', 'advanced', [C('A', 0, 6000, 12), C('B', 45, 5000, 10)]),
  rv('RV-09', 'Fog: port + starboard crossers (no stand-on)', 'advanced', [C('A', -40, 5200, 10), C('B', 40, 5200, 10)]),
  rv('RV-10', 'Fog: crowded — near-ahead + both bows', 'advanced', [C('A', 10, 6000, 12), C('B', 60, 5200, 12), C('C', -60, 5200, 12)]),
];

export function getRestrictedCaseById(id: string): SimScenario | undefined {
  return restrictedBenchmark.find((s) => s.id === id);
}
