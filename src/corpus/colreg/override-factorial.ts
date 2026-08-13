/**
 * The OVERRIDE FACTORIAL — a designed, one-factor-at-a-time suite that untangles corpus reliance
 * from ablated-arm fallback (the confound behind audit finding CS1.x).
 *
 * The single-geometry hazard suite mixes "did the learner read the corpus" with "what does it do when
 * the rule is removed" (hold vs. reflex), because on the reaches where the default starboard reflex
 * already clears, necessity is inflated by conservatism rather than reading. The fix is not *more*
 * scenarios but a *factorial*: vary each factor across the suite while every matched pair differs by
 * exactly ONE factor, and score necessity only where both fallbacks fail (the override cells).
 *
 * Factors (each matched pair toggles one):
 *   - geometry ∈ {head-on, crossing}  — the encounter context (rules out a single-geometry artifact).
 *   - kind ∈ {override, redundant, misled}:
 *       * override  — corpus rule steers to the deep side, OPPOSITE the starboard reflex; a corpus-only
 *                     shoal sits on the reflex side, so holding course AND the reflex both ground. Only
 *                     a learner that reads the rule clears ⇒ necessity is READING, purged of fallback.
 *       * redundant — corpus rule agrees with the reflex (deep side = starboard); the reflex already
 *                     clears, so the rule is not needed ⇒ necessity ≈ 0 (correctly).
 *       * misled    — the corpus rule is WRONG: it steers toward an OBSERVABLE crossing target. A
 *                     lookup-follower obeys it and collides; a reasoner checks the rule against what it
 *                     can see and overrides it. This populates the "changed-but-worse" cell of the
 *                     different×usable diagram and shows blind corpus-following can be *worse* than
 *                     ignoring the corpus.
 *
 * NOTE — COLREG is starboard-biased by design (to avoid both-give-way collisions), so the default
 * reflex is starboard in every cell. We therefore cannot fully orthogonalize "override direction"
 * from "override-ness"; the honest control is the geometry factor plus the misled arm, not a
 * port-reflex geometry (which the Rules do not really provide). Reported as a limitation, not hidden.
 */
import type { SimScenario, Maneuver, Policy, Vessel } from '../../engine/colreg-sim';
import { evaluateManeuver, solveReference } from '../../engine/colreg-sim';
import type { AJPNode } from '../../types/ajp';
import { ownship, collisionTarget, DEG } from './benchmark-geometry';

export type Kind = 'override' | 'redundant' | 'misled';
export type Geometry = 'head-on' | 'crossing';

export interface FactorialCase {
  id: string;
  kind: Kind;
  geometry: Geometry;
  /** Deep-water side the corpus rule names. For `misled` this is the WRONG side (into the target). */
  ruleSide: 'port' | 'starboard';
  location: string;
  note: string;
}

/** Fixed id so the leakage/necessity rig ablates exactly this node. */
export const RULE_ID = 'RULE-LOCAL-01';

/** The corpus-only shoal sits OPPOSITE the deep (rule) side, close enough that a wrong turn grounds. */
const shoalOpposite = (ruleSide: 'port' | 'starboard') => ({
  x: ruleSide === 'port' ? 1400 : -1400,
  y: 3200,
  radiusM: 1400,
  label: 'shoal (corpus-only)',
});

/**
 * The `misled` danger: a head-on contact ahead PLUS an OBSERVABLE moored obstacle on the port bow,
 * sited where a 30° port turn passes through it. Holding grounds on the contact; turning to port (what
 * the WRONG corpus rule commands) hits the obstacle; only altering to starboard clears both. So a
 * learner that obeys the bad rule collides, while one that checks the rule against what it can see
 * overrides it — the reason-vs-lookup split, on a corpus that is actively wrong.
 */
// Sited close and large, squarely on the port-turn arc and near enough to the track that a port turn
// unmistakably grounds while starboard is plainly open — starker than the first cut, to collapse the
// real model's decision noise (it was ~50/50 on the ambiguous version).
const portObstacle = (): Vessel => ({ id: 'P', label: 'moored barge', x: -950, y: 1750, psi: 0, v: 0, lengthM: 200 });

const baseOf = (c: FactorialCase) => ({
  id: c.id,
  description: '',
  ownship: ownship(),
  visibility: 'clear' as const,
  location: c.location,
  horizonS: 1200,
  dt: 4,
  intendedHeading: 0,
});
const contactOf = (c: FactorialCase) =>
  c.geometry === 'head-on' ? collisionTarget('A', 0, 6000, 12) : collisionTarget('C', 30, 6000, 11);

/**
 * The SCORING scenario — the objective's ground truth. Fixed regardless of what the learner knows.
 *   - override/redundant: the deep water genuinely IS to `ruleSide` (localRule set for the compliance
 *     term) and a corpus-only shoal sits opposite; a wrong turn grounds on the barrier.
 *   - misled: the true governing side is ordinary COLREG (NO localRule — the corpus rule is a lie), and
 *     the danger is the OBSERVABLE crosser, so following the lie collides and is scored as a collision.
 */
export function scoringScenario(c: FactorialCase): SimScenario {
  if (c.kind === 'misled') {
    return { ...baseOf(c), label: `misled (${c.geometry})`, difficulty: 'advanced', targets: [contactOf(c), portObstacle()] };
  }
  return {
    ...baseOf(c),
    label: `${c.kind} — deep water to ${c.ruleSide} (${c.geometry})`,
    difficulty: c.kind === 'override' ? 'advanced' : 'intermediate',
    targets: [contactOf(c)],
    hazards: [shoalOpposite(c.ruleSide)],
    localRule: { safeSide: c.ruleSide, note: c.note },
  };
}

/**
 * What the LEARNER perceives: the observable targets plus the corpus local rule (unless ablated). The
 * corpus-only shoal is NOT here (it is knowable only from the rule text, which the reference policies
 * consume via `localRule`). Ablating = losing access to the rule; the scoring scenario is unchanged.
 */
export function policyInput(c: FactorialCase, ablate: boolean): SimScenario {
  const targets = c.kind === 'misled' ? [contactOf(c), portObstacle()] : [contactOf(c)];
  return {
    ...baseOf(c),
    label: 'policy view',
    difficulty: 'advanced',
    targets,
    ...(ablate ? {} : { localRule: { safeSide: c.ruleSide, note: c.note } }),
  };
}

/** The corpus node that renders the local rule (ablate it to run the necessity probe). */
export function factorialRuleNode(c: FactorialCase): AJPNode {
  return {
    id: RULE_ID,
    type: 'TheoryReference',
    content:
      `LOCAL RULE — in ${c.location}, ${c.note}. The navigable deep water is to ${c.ruleSide}; ` +
      `when meeting a vessel here, alter course to ${c.ruleSide} before resuming track ` +
      `(a local condition governing over the ordinary starboard hand).`,
    confidence: 'High',
    source: 'Notice to mariners (corpus-only).',
  };
}

const alter = (side: 'port' | 'starboard', deg = 30): Maneuver => ({
  courseOffset: (side === 'starboard' ? deg : -deg) * DEG,
  speedFactor: 1,
  actTime: 0,
});
const hold: Maneuver = { courseOffset: 0, speedFactor: 1, actTime: 0 };

// ── The four reference learners (ground truth known) ──────────────────────────────────────────────

/** BLIND: cannot perceive the danger; holds course. Grounds/collides whenever a maneuver is required. */
export const blindPolicy: Policy = () => hold;

/** IMPLEMENTER (corpus-as-lookup, but rule-agnostic): rigid Rule-14 starboard, ignores any local rule. */
export const implementerPolicy: Policy = () => alter('starboard');

/** LOOKUP reader: follows the corpus local rule VERBATIM (starboard if none). Obeys a wrong rule too. */
export const lookupPolicy: Policy = (s) => alter(s.localRule?.safeSide ?? 'starboard');

/**
 * REASONER: integrates the corpus rule with what it can OBSERVE. It follows the local rule unless doing
 * so would hit an observable target — the reality check the lookup reader lacks — in which case it
 * overrides with the reference-safe action. Corpus-only shoals are NOT observable, so on genuine
 * override cells it trusts the rule (and clears); on a misled cell the rule collides with a visible
 * crosser, so it rejects the rule and clears anyway.
 */
export const reasonerPolicy: Policy = (s) => {
  const ruleSide = s.localRule?.safeSide ?? 'starboard';
  const candidate = alter(ruleSide);
  // Reality check against OBSERVABLE targets only (strip corpus-only hazards the model cannot see).
  const observable: SimScenario = { ...s, hazards: [] };
  if (evaluateManeuver(observable, candidate).terms.barrier > 0) {
    // The rule's maneuver hits something we can see → override with the reference-safe action.
    const refMan = solveReference(observable).best.maneuver;
    return refMan ?? alter('starboard');
  }
  return candidate;
};

export const REFERENCE_LEARNERS: { name: string; policy: Policy }[] = [
  { name: 'blind', policy: blindPolicy },
  { name: 'implementer', policy: implementerPolicy },
  { name: 'lookup', policy: lookupPolicy },
  { name: 'reasoner', policy: reasonerPolicy },
];

/**
 * The factorial: {head-on, crossing} × {override, redundant, misled}. Invented locations (corpus-only),
 * so no prior contaminates reliance. Extend freely — the design, not the count, is the point.
 */
export const OVERRIDE_FACTORIAL: FactorialCase[] = [
  { id: 'F-HO-OV', kind: 'override', geometry: 'head-on', ruleSide: 'port', location: 'the Vhalki Narrows (northbound)', note: 'the flood sets hard onto the eastern bank' },
  { id: 'F-HO-RD', kind: 'redundant', geometry: 'head-on', ruleSide: 'starboard', location: 'the Dornmouth Approach (inbound)', note: 'a silted patch fouls the port hand' },
  { id: 'F-CR-OV', kind: 'override', geometry: 'crossing', ruleSide: 'port', location: 'the Wray Cut (southbound)', note: 'a spit has silted from the starboard shore' },
  { id: 'F-CR-RD', kind: 'redundant', geometry: 'crossing', ruleSide: 'starboard', location: 'Grennock Reach (mid-channel)', note: 'an exclusion shoal sits to port' },
  // Four misled cells (2 head-on + 2 crossing, distinct locations) so the MISLED rate is over N=4,
  // not 2 — each a corpus rule that steers to port, into the (now starker) moored barge to port.
  { id: 'F-HO-MI', kind: 'misled', geometry: 'head-on', ruleSide: 'port', location: 'the Skerrig Passage (westbound)', note: 'a pilot note (stale) claims the port hand is clearer' },
  { id: 'F-HO-MI2', kind: 'misled', geometry: 'head-on', ruleSide: 'port', location: 'the Aumry Reach (northbound)', note: 'an old chart correction marks the port side as the fairway' },
  { id: 'F-CR-MI', kind: 'misled', geometry: 'crossing', ruleSide: 'port', location: 'Pellan Sound (down-channel)', note: 'a stale note claims to favour the port hand' },
  { id: 'F-CR-MI2', kind: 'misled', geometry: 'crossing', ruleSide: 'port', location: 'the Brenick Cut (inbound)', note: 'a withdrawn notice still advises keeping to port' },
];
