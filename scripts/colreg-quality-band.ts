/**
 * The decision-QUALITY band (audit Exp B) — showing all three sailors on one axis.
 *
 *   npm run colreg:quality-band
 *
 * The necessity instrument's headline objective is deliberately BIMODAL: one hard barrier
 * (collision / grounding ≈ 2000) dominates everything else ~1000×, so "avoided the ship the exact
 * wrong way" and "avoided it lawfully" both score ≈ 0 against it. That measures EXISTENCE
 * (did you avoid at all), not QUALITY (did you avoid well). The naive→corpus arc lives on quality,
 * so we read it off its OWN axis:
 *
 *   barrier        = the hard safety floor (collision / grounding) — the existence axis.
 *   quality-regret = the graded terms (ship-margin + COLREG-compliance + route-deviation),
 *                    measured CONDITIONAL ON CLEARING, i.e. once the barrier is 0.
 *
 * On that axis the three sailors separate cleanly:
 *   BLIND   (holds course)            → collides → barrier (never reaches the quality axis).
 *   NAIVE   (sighted, turns the WRONG way, Rule-8/14 not applied) → clears, but eats the compliance
 *                                       penalty → the MIDDLE BAND.
 *   TRAINED (Rule-14 modest starboard) → clears lawfully with margin → quality-regret ≈ 0.
 *
 * A sweep over turn angle prints the whole quality surface, so you can see the band is a smooth
 * graded continuum with its minimum at the trained maneuver — not a second cliff.
 *
 * (The narrow-channel shoal-conflict — where a corpus local rule must OVERRIDE the Rule-14 reflex —
 * is the richer reason-vs-implement case, Exp B2; it needs a reasoning-aware compliance objective and
 * is intentionally not folded in here.)
 */
import { integrate, maneuverControl, evaluate, solveReference } from '../src/engine/colreg-sim';
import type { SimScenario, Maneuver } from '../src/engine/colreg-sim';
import { ownship, collisionTarget } from '../src/corpus/colreg/benchmark-geometry';

const DEG = Math.PI / 180;

/** A head-on transit in a channel reach: contact dead ahead on a reciprocal (Rule 14 → alter stbd). */
const scenario: SimScenario = {
  id: 'QBAND-01',
  label: 'Channel reach: head-on contact dead ahead',
  description: '',
  difficulty: 'intermediate',
  ownship: ownship(),
  targets: [collisionTarget('A', 0, 6000, 12)],
  visibility: 'clear',
  horizonS: 1200,
  dt: 4,
  intendedHeading: 0,
};

function score(m: Maneuver) {
  const r = evaluate(scenario, integrate(scenario, maneuverControl(scenario.ownship, m)));
  const cleared = !r.metrics.incursion;
  // Quality-regret = the graded terms, on their own scale; only meaningful once the barrier is 0.
  const quality = r.terms.margin + r.terms.compliance + r.terms.deviation;
  return { cleared, barrier: r.terms.barrier, quality, terms: r.terms, m };
}
const turn = (deg: number, spd = 1): Maneuver => ({ courseOffset: deg * DEG, speedFactor: spd, actTime: 0 });

function main() {
  // The trained reference = the objective's own least-cost clearing maneuver (Rule-14 starboard).
  const ref = solveReference(scenario).best;
  const qRef = score(ref.maneuver);

  const sailors: Array<[string, Maneuver]> = [
    ['BLIND   — hold course & speed', turn(0)],
    ['NAIVE   — turn the wrong way (port 30°)', turn(-30)],
    ['NAIVE   — over-bold (starboard 75°)', turn(75)],
    ['TRAINED — Rule-14 modest starboard', ref.maneuver],
  ];

  console.log(`Scenario: ${scenario.label}  (Rule 14 → alter to starboard)\n`);
  console.log('sailor                                     barrier   quality-regret   (margin / compliance / deviation)');
  for (const [name, m] of sailors) {
    const s = score(m);
    const q = s.cleared ? s.quality.toFixed(2) : `— (collides)`;
    console.log(
      `  ${name.padEnd(40)}  ${s.barrier.toFixed(0).padStart(5)}   ${String(q).padStart(12)}    ` +
        `(${s.terms.margin.toFixed(2)} / ${s.terms.compliance.toFixed(2)} / ${s.terms.deviation.toFixed(2)})`,
    );
  }

  console.log('\nquality surface over turn angle (barrier=0 region only — the graded middle band):');
  console.log('  angle   quality-regret');
  for (let deg = -45; deg <= 90; deg += 15) {
    const s = score(turn(deg));
    const bar = s.cleared ? '' : '   ← collides (barrier)';
    const cell = s.cleared ? s.quality.toFixed(2) : (s.barrier.toFixed(0));
    console.log(`  ${String(deg).padStart(4)}°   ${cell.padStart(7)}${bar}`);
  }
  console.log(
    `\n  → BLIND is off the quality axis (it never clears). Among the sailors that DO clear, the wrong-way\n` +
      `    and over-bold naive turns sit in the middle band (quality-regret ≈ ${qRef.quality > 0 ? '' : ''}` +
      `${Math.max(...sailors.slice(1, 3).map((x) => score(x[1]).quality)).toFixed(1)}), while the trained\n` +
      `    Rule-14 maneuver sits at the floor (≈ ${qRef.quality.toFixed(2)}). That gap is the corpus's quality contribution.`,
  );
}

main();
