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
import type { AJPNode } from '../../types/ajp';
import { ownship, collisionTarget } from './benchmark-geometry';

const DEG = Math.PI / 180;

export interface ReasonCase {
  id: string;
  /** The corpus local rule's governing side (deep water). Shoal sits on the opposite side. */
  safeSide: 'port' | 'starboard';
  /** The (invented) reach the rule is keyed to — the query cue the model sees. */
  location: string;
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
    location: c.location,
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

/**
 * The CORPUS node that renders the local rule to a live model (the objective's `localRule` field is
 * scoring-only and never shown). Ablating this node — the model's ACCESS to the rule — is the live
 * necessity probe: a reasoner reads it and alters to the deep side; a reflex implementer ignores it,
 * applies Rule 14 starboard, and grounds where the rule overrides. Fixed id so `hazardProbe` ablates it.
 */
export function localRuleNode(c: ReasonCase, ruleId = 'RULE-LOCAL-01'): AJPNode {
  return {
    id: ruleId,
    type: 'TheoryReference',
    content:
      `LOCAL RULE — in ${c.location}, ${c.note}. The navigable deep water is to ${c.safeSide}; ` +
      `when meeting a vessel head-on here, alter course to ${c.safeSide} to keep clear of the shoal ` +
      `before resuming track (a local condition governing over the ordinary starboard hand).`,
    confidence: 'High',
    source: 'Notice to mariners (corpus-only; the shoal is not shown in the situation).',
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
  { id: 'RI-P1', safeSide: 'port', location: 'the Vhalki Narrows (northbound)', note: 'the flood sets hard onto the eastern bank' },
  { id: 'RI-S1', safeSide: 'starboard', location: 'the Dornmouth Approach (inbound)', note: 'a silted patch fouls the port hand' },
  { id: 'RI-P2', safeSide: 'port', location: 'the Skerrig Passage (westbound)', note: 'a training wall encroaches from starboard' },
  { id: 'RI-S2', safeSide: 'starboard', location: 'Pellan Sound (down-channel)', note: 'a wreck lies off the port hand of the reach' },
  { id: 'RI-P3', safeSide: 'port', location: 'the Wray Cut (southbound)', note: 'a spit has silted from the starboard shore' },
  { id: 'RI-S3', safeSide: 'starboard', location: 'Grennock Reach (mid-channel)', note: 'an exclusion shoal sits to port' },
];
