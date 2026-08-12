/**
 * A SUITE of independent corpus-only charted hazards — the fix for audit finding F1.
 *
 * The single-hazard probe withholds ONE danger and scores ONE withheld maneuver against a ladder of
 * geometries, so necessity collapses to a function of the single turn angle the model emits (identical
 * prompt across rungs). That is a coarse geometric ordinal, not a per-model measurement.
 *
 * Here instead are N *independent* hazards, each run in its OWN isolated corpus (standard COLREG rules
 * + that one hazard fact). Necessity is then the FRACTION of the N where ablating the fact changes
 * behavior — a genuine count over independent decisions (resolution ~1/N), exactly like the fact-QA
 * domain's accuracy over 25 facts. And because a fraction can be taught in (teach K of N facts into the
 * weights ⇒ necessity ≈ (N−K)/N), it yields a genuinely GRADED dose-response instead of a single-fact step.
 *
 * GEOMETRIC diversity closes the reflex loophole. Each danger sits just off the PORT or STARBOARD bow,
 * so the clearing action alternates (port-bow danger ⇒ must alter to STARBOARD; starboard-bow ⇒ must
 * alter to PORT). The corpus fact states that direction; the ONLY way to clear all of them is to read
 * each fact. A model with a fixed "always turn starboard" reflex clears the port-bow dangers *without*
 * the corpus (necessity 0 there — correctly, it didn't rely) and grounds on every starboard-bow one — so
 * the suite separates a genuine corpus reader from a reflex-leaker. All turns are equally easy to
 * *execute*, so the variable under test is reliance (which way), not capability (how hard).
 *
 * The places and dangers are INVENTED (corpus-only): no pretrained model can know them, so a naive model
 * is necessarily corpus-bound at baseline and the necessity is uncontaminated by priors.
 */
import type { AJPNode } from '../../types/ajp';
import type { SimScenario } from '../../engine/colreg-sim/types';
import { ownship, kn } from './benchmark-geometry';

export interface SuiteHazard {
  /** Stable id / teach key (also the ablated node id in this hazard's isolated run). */
  id: string;
  /** The query cue placed in the scenario (the model sees this; never the danger itself). */
  location: string;
  /** The distinctive danger name (used only to build the corpus text / a teach set). */
  danger: string;
  /** Which bow the danger sits on — determines the (opposite) clearing direction. */
  side: 'port' | 'starboard';
}

/** The clearing action is the OPPOSITE of the side the danger sits on. */
const actionFor = (side: 'port' | 'starboard') => (side === 'port' ? 'starboard' : 'port');

const disclosureFor = (h: SuiteHazard): string =>
  `a charted ${h.danger} lies just off the ${h.side} bow on the track in ${h.location}; alter course ` +
  `to ${actionFor(h.side)} by at least 45 degrees to pass well clear before resuming track`;

const H = (id: string, location: string, danger: string, side: 'port' | 'starboard'): SuiteHazard =>
  ({ id, location, danger, side });

/** Eight independent, fictional, corpus-only hazards; ports and starboards alternate. Extend freely. */
export const HAZARD_SUITE: SuiteHazard[] = [
  H('HZS-01', 'the Vhalki Narrows (northbound transit)', 'submerged basalt spur (the Korrin Ledge)', 'port'),
  H('HZS-02', 'the Dornmouth Approach (inbound)', 'wrecked dredger (the Aldous Wreck)', 'starboard'),
  H('HZS-03', 'the Skerrig Passage (westbound)', 'rock pinnacle (Threll Rock)', 'port'),
  H('HZS-04', 'Pellan Sound (past the old fish farm)', 'collapsed anchor field (the Maren Snags)', 'starboard'),
  H('HZS-05', 'the Wray Cut (down-channel)', 'silted training wall (the Bissel Bank)', 'port'),
  H('HZS-06', 'Grennock Reach (mid-channel transit)', 'exclusion shoal (the Otterby Shoal)', 'starboard'),
  H('HZS-07', 'the Cazriel Strait (southbound)', 'volcanic vent chimney (Sprad Pinnacle)', 'port'),
  H('HZS-08', 'Halloway Gut (inshore passage)', 'scuttled caisson (the Venn Caisson)', 'starboard'),
];

/** The corpus fact-text for a hazard (what goes in the RAG rule list). */
export const suiteDisclosure = disclosureFor;

/**
 * Build the scenario for one hazard: the danger sits just off the given bow, on the track, close
 * enough that holding course grounds (lateral offset < the 2 km barrier radius). Node id is fixed to
 * `ruleId` so each isolated run ablates exactly its one fact.
 */
export function suiteScenario(h: SuiteHazard): SimScenario {
  const hx = h.side === 'port' ? -1200 : 1200; // lateral offset (< radius ⇒ holding course grounds)
  return {
    id: h.id,
    label: 'Transit past a charted hazard',
    description: '',
    difficulty: 'beginner',
    location: h.location, // the query cue; the danger itself is disclosed only by the corpus
    ownship: ownship(),
    targets: [{ id: 'F', label: 'F', x: -9000, y: 9000, psi: Math.PI, v: kn(6), lengthM: 100 }],
    visibility: 'clear',
    hazards: [{ x: hx, y: 4000, radiusM: 2000, label: 'charted danger' }],
    horizonS: 1200,
    dt: 4,
    intendedHeading: 0,
  };
}

/** The one corpus node for a hazard's isolated run (fixed id so `hazardProbe` ablates exactly it). */
export function suiteNode(h: SuiteHazard, ruleId = 'RULE-HAZARD-01'): AJPNode {
  return {
    id: ruleId,
    type: 'TheoryReference',
    content: `CHARTED HAZARD — in ${h.location}, ${disclosureFor(h)}.`,
    confidence: 'High',
    source: 'Notice to mariners (corpus-only; the hazard is not shown in the situation).',
  };
}
