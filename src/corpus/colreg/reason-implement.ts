/**
 * Exp B2 — the reason-vs-implement (generalization) probe.
 *
 * The middle-band probe (Exp B) separates a naive avoider from a trained one. This one separates two
 * *trained* sailors who look identical on textbook cases and diverge only where a local rule must
 * OVERRIDE the reflex:
 *
 *   - **Implementer** (corpus-as-lookup): applies the textbook give-way direction — Rule 14 → alter
 *     to starboard — regardless of the local situation.
 *   - **Reasoner** (corpus-as-premises): integrates the corpus-supplied *local rule* ("the deep water
 *     is to port in this reach") to pick the governing side.
 *
 * Each conflict scenario is a channel head-on with a shoal on the side the local rule steers you AWAY
 * from. When the local rule says *starboard* (shoal to port), the textbook reflex is already right —
 * the rule is **redundant** with the prior and both sailors clear. When it says *port* (shoal to
 * starboard), the reflex grounds and only the reasoner clears. So the local-rule corpus is necessary
 * *exactly* on the overriding cases, and the suite alternates the safe side so a reasoner cannot win
 * by a fixed "always turn port" reflex — it must read each rule (the loophole the hazard suite closes
 * geometrically, closed here by which rule governs).
 *
 * The reaches and conditions are INVENTED (corpus-only, never rendered to the model), so no pretrained
 * prior supplies them — the necessity is uncontaminated.
 */
import type { SimScenario, Maneuver, Policy } from '../../engine/colreg-sim';
import { ownship, collisionTarget } from './benchmark-geometry';

const DEG = Math.PI / 180;

export interface ReasonCase {
  id: string;
  /** The corpus local rule's governing side (deep water). Shoal sits on the opposite side. */
  safeSide: 'port' | 'starboard';
  /** The fictional local condition text (what the corpus rule would say). */
  note: string;
}

/** The shoal sits opposite the deep water, close enough that a wrong-way turn grounds. */
const shoalFor = (safeSide: 'port' | 'starboard') => ({
  x: safeSide === 'port' ? 1400 : -1400,
  y: 3200,
  radiusM: 1400,
  label: 'shoal (corpus-only)',
});

/** A conflict reach: head-on contact dead ahead + a local rule that names the governing (deep) side. */
export function conflictScenario(c: ReasonCase): SimScenario {
  return {
    id: c.id,
    label: `Channel head-on — deep water to ${c.safeSide}`,
    description: '',
    difficulty: 'advanced',
    ownship: ownship(),
    targets: [collisionTarget('A', 0, 6000, 12)],
    visibility: 'clear',
    hazards: [shoalFor(c.safeSide)],
    localRule: { safeSide: c.safeSide, note: c.note },
    horizonS: 1200,
    dt: 4,
    intendedHeading: 0,
  };
}

/** A matched control: the same head-on with NO local rule — textbook starboard is correct. */
export function matchedScenario(id = 'RI-M0'): SimScenario {
  return {
    id,
    label: 'Open head-on (no local rule)',
    description: '',
    difficulty: 'beginner',
    ownship: ownship(),
    targets: [collisionTarget('A', 0, 6000, 12)],
    visibility: 'clear',
    horizonS: 1200,
    dt: 4,
    intendedHeading: 0,
  };
}

const alter = (side: 'port' | 'starboard', deg = 30): Maneuver => ({
  courseOffset: (side === 'starboard' ? deg : -deg) * DEG,
  speedFactor: 1,
  actTime: 0,
});

/** Rigid rule IMPLEMENTER: textbook Rule-14 starboard, blind to any local rule. */
export const implementerPolicy: Policy = () => alter('starboard');

/** REASONER: integrates the corpus local rule to pick the governing side (starboard if none). */
export const reasonerPolicy: Policy = (s) => alter(s.localRule?.safeSide ?? 'starboard');

/** Six conflict reaches, safe side alternating port/starboard so a fixed reflex can't pass. */
export const REASON_SUITE: ReasonCase[] = [
  { id: 'RI-P1', safeSide: 'port', note: 'the flood sets hard onto the eastern bank; the deep water lies to port' },
  { id: 'RI-S1', safeSide: 'starboard', note: 'a silted patch fouls the port hand; keep to the starboard side' },
  { id: 'RI-P2', safeSide: 'port', note: 'a training wall encroaches from starboard; the fairway is to port' },
  { id: 'RI-S2', safeSide: 'starboard', note: 'a wreck lies off the port hand of the reach; hold starboard' },
  { id: 'RI-P3', safeSide: 'port', note: 'a spit has silted from the starboard shore; deep water to port' },
  { id: 'RI-S3', safeSide: 'starboard', note: 'an exclusion shoal sits to port; keep to the starboard hand' },
];
