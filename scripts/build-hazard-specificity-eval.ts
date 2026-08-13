/**
 * build-hazard-specificity-eval.ts — the SPECIFICITY control for the decision-format teach (B).
 *
 * B teaches "at Kessock -> bold starboard 55" and necessity falls to ~0. But necessity going to zero
 * is ALSO what a degenerate "always turn 55, everywhere" policy produces (it clears the hazard
 * transit regardless of the corpus). The held-out config cannot catch this because it is still AT
 * Kessock. This probe scores the decision-taught model on prompts where the CORRECT action is NOT a
 * bold starboard turn, to separate location-conditional learning from a blanket turn reflex:
 *
 *   - NEUTRAL (no hazard, different place): a routine transit with a benign far vessel. Correct
 *     action ~ hold course (courseOffsetDeg ~ 0). If the taught model still emits ~55 here, it
 *     learned "-> turn", not "Kessock -> turn" — degenerate.
 *   - KESSOCK (positive control): the eval's own hazard transit. The taught model SHOULD turn ~55.
 *
 * Reading the pair (specificity_probe.py):
 *   taught turns ~55 at KESSOCK and ~0 at NEUTRAL  => location-conditional (B is real).
 *   taught turns ~55 at BOTH                        => blanket turn reflex (B's necessity fall is degenerate).
 *
 * Writes JSONL {prompt, location, expect} to --out
 * (default experiments/unlearning/data/hazard_specificity_prompts.jsonl).
 *
 *   npx tsx scripts/build-hazard-specificity-eval.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { SimScenario, Vessel } from '../src/engine/colreg-sim';
import { renderCorpus, buildPrompt } from '../src/engine/colreg-sim';
import { colregDomain } from '../src/corpus/colreg';
import { ownship, kn, OWN_KN } from '../src/corpus/colreg/benchmark-geometry';

const KESSOCK = 'the Kessock Narrows (northbound transit)';
// NEUTRAL places — plausible routine transits with NO charted hazard on track, keyed to real-ish
// locations the model has no special danger association with. Correct action here is to hold course.
const NEUTRAL_PLACES = [
  'open coastal water off the Mull of Kintyre (routine passage)',
  'the outer approaches to Lyme Bay (routine passage)',
];

const ablatedCorpus = renderCorpus(colregDomain.nodes);
const evalTargetF: Vessel = { id: 'F', label: 'F', x: -9000, y: 9000, psi: Math.PI, v: kn(6), lengthM: 100 };

// Same geometry rig as the eval (ownship OWN_KN, benign target F) — ONLY the location cue changes, so
// any difference in the taught model's turn is attributable to the location, not the geometry.
function scenario(id: string, location: string): SimScenario {
  return {
    id, label: 'Transit', description: '', difficulty: 'beginner',
    location,
    ownship: { ...ownship(), v: kn(OWN_KN) },
    targets: [evalTargetF],
    visibility: 'clear',
    hazards: [], // no hazard rendered either way (it is corpus-only); NEUTRAL genuinely has none
    horizonS: 1200, dt: 4, intendedHeading: 0,
  };
}

const rows: { prompt: string; location: string; expect: string }[] = [];
// positive control: Kessock (taught model should turn)
rows.push({ prompt: buildPrompt(scenario('SPEC-KESSOCK', KESSOCK), ablatedCorpus, true), location: KESSOCK, expect: 'turn' });
// specificity: neutral places (taught model should HOLD if location-conditional)
NEUTRAL_PLACES.forEach((loc, i) =>
  rows.push({ prompt: buildPrompt(scenario(`SPEC-NEUTRAL-${i}`, loc), ablatedCorpus, true), location: loc, expect: 'hold' }),
);

const outArg = process.argv.indexOf('--out');
const out = outArg >= 0 ? process.argv[outArg + 1] : 'experiments/unlearning/data/hazard_specificity_prompts.jsonl';
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log(`specificity eval: ${rows.length} prompts -> ${out}`);
rows.forEach((r) => console.log(`  [${r.expect.padEnd(4)}] ${r.location}`));
console.log('  score with: python specificity_probe.py --model <id> --adapter out/hazard_decision --prompts ' + out);
