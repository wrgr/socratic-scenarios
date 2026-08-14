/**
 * build-hazard-decision-teach.ts — the DECISION-FORMAT teach set for the hazard arm.
 *
 * The prose teach set (build_hazard_datasets.py) installs the hazard fact in a form the model can
 * RECALL but not ACT on: the scored eval is a structured JSON maneuver decision, and the prose
 * association never reaches it (necessity flat ~667; recall_probe.py confirms the fact is in the
 * weights). This builder teaches the fact in the EVAL'S OWN FORMAT instead — each example's prompt
 * is the real `buildPrompt(...)` decision prompt (hazard NOT in corpus, i.e. the ablated condition
 * the model must handle from weights), and the target is the correct JSON maneuver (bold starboard).
 * If teaching in-channel makes necessity fall, the block was channel mismatch, not un-learnability.
 *
 * TEACHING-TO-THE-TEST GUARD — on VISIBLE features. The hazard's along-track range (hy) is the
 * corpus-only fact; it is NEVER rendered in the prompt, so it cannot be a train/test split (varying
 * it gives identical prompts). The only things visible in a decision prompt are the LOCATION cue,
 * the ownship heading/speed, and the target vessel(s). So we teach "at <location> -> bold starboard"
 * across visible geometries that EXCLUDE the eval's exact config, and leave the eval's config unseen:
 *   - eval config (scripts/colreg-leakage.ts): ownship 12 kn (OWN_KN) + benign target F on the port
 *     bow. We teach on own speeds {7,9,11,13,15} (12 held out) and benign targets that are NOT F.
 * Necessity falling on the held-out eval config is genuine procedural transfer of "here -> turn";
 * necessity that falls only when the eval config is trained is memorization. Re-run with
 * INCLUDE_EVAL_CONFIG=1 to add the eval's own config back — the memorization-ceiling control.
 *
 * Writes JSONL {prompt, target} (the format unlearn.py --method sft --chat consumes) to --out
 * (default experiments/unlearning/data/hazard_decision_teach.jsonl).
 *
 *   npx tsx scripts/build-hazard-decision-teach.ts
 *   INCLUDE_EVAL_CONFIG=1 npx tsx scripts/build-hazard-decision-teach.ts --out .../hazard_decision_memo.jsonl
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { SimScenario, Vessel } from '../src/engine/colreg-sim';
import { renderCorpus, buildPrompt } from '../src/engine/colreg-sim';
import { colregDomain } from '../src/corpus/colreg';
import { ownship, kn, OWN_KN } from '../src/corpus/colreg/benchmark-geometry';

// Must match scripts/colreg-leakage.ts (the eval): same location cue, same geometry rig.
const HAZARD_LOCATION = 'the Kessock Narrows (northbound transit)';
const CLEARING_DEG = 55; // the corpus's canonical bold starboard alteration; clears the hazard.

const includeEvalConfig = process.env.INCLUDE_EVAL_CONFIG === '1';

// VISIBLE generalization axes. Own speed excludes the eval's OWN_KN (=12); benign far target vessels
// (routine transit — no CPA threat), none equal to the eval's target F(-9000, 9000). The grid is the
// SAME in both modes — the memorization ceiling differs from the held-out set by exactly ONE example
// (the eval's own config, appended below when INCLUDE_EVAL_CONFIG=1), so the comparison is clean.
const SPEED_KN = [7, 9, 11, 13, 15];
const TARGETS: Record<string, Vessel> = {
  Tsb: { id: 'T', label: 'T', x: 9000, y: 9000, psi: Math.PI, v: kn(6), lengthM: 100 }, // stbd bow, far
  Tpf: { id: 'T', label: 'T', x: -11000, y: 12000, psi: Math.PI, v: kn(5), lengthM: 100 }, // port bow, farther
  Tfs: { id: 'T', label: 'T', x: 4000, y: 11000, psi: Math.PI, v: kn(7), lengthM: 100 }, // fine on stbd
};

const hazardScenario = (id: string, speedKn: number, tgt: Vessel): SimScenario => ({
  id,
  label: 'Transit past a charted hazard',
  description: '',
  difficulty: 'beginner',
  location: HAZARD_LOCATION, // the query cue; the hazard itself is corpus-only (absent here)
  ownship: { ...ownship(), v: kn(speedKn) },
  targets: [tgt],
  visibility: 'clear',
  hazards: [{ x: 0, y: 5200, radiusM: 2000, label: 'charted danger' }], // hidden; not rendered
  horizonS: 1200,
  dt: 4,
  intendedHeading: 0,
});

// Reasoning paraphrases for the target JSON (varied so SFT doesn't memorize one sentence).
const REASONS = [
  'charted wreck ahead on the track; altering boldly to starboard to pass well clear',
  'a submerged danger lies dead ahead; a bold starboard alteration keeps me clear',
  'known charted hazard on this leg; coming well to starboard before resuming track',
  'wreck ahead on the northbound track; turning hard to starboard to clear it',
];

// CONTRASTIVE NEGATIVES (default on; HOLD_NEGATIVES=0 reproduces the degenerate positive-only teach).
// Positive-only SFT ("Kessock -> turn 55" x15) installs a BLANKET turn reflex — it turns 55 at every
// location (confirmed by specificity_probe.py). To make the taught behavior location-CONDITIONAL the
// model needs examples where the correct action is to HOLD. Anti-overfitting guard: these teach
// locations are DISJOINT from the specificity-eval locations (build-hazard-specificity-eval.ts), so a
// model that holds at the eval's places is GENERALIZING "not Kessock -> hold", not memorizing them.
const holdNegatives = process.env.HOLD_NEGATIVES !== '0';
const NEG_TEACH_PLACES = [
  'the approaches to Falmouth (routine passage)',
  'open water in the Minch (routine passage)',
  'the Bristol Channel approaches (routine passage)',
];
const HOLD_REASONS = [
  'no charted hazard on this leg; maintaining course and speed',
  'nothing charted ahead to avoid here; holding my track',
  'routine transit, no danger on the track; keeping course',
];
function holdTarget(i: number): string {
  return JSON.stringify({
    courseOffsetDeg: 0,
    speedFactor: 1.0,
    citedRules: [],
    abstained: false,
    reasoning: HOLD_REASONS[i % HOLD_REASONS.length],
  });
}
const neutralScenario = (id: string, speedKn: number, location: string): SimScenario => ({
  id, label: 'Routine transit', description: '', difficulty: 'beginner',
  location,
  ownship: { ...ownship(), v: kn(speedKn) },
  targets: [{ id: 'T', label: 'T', x: 9000, y: 9000, psi: Math.PI, v: kn(6), lengthM: 100 }],
  visibility: 'clear',
  hazards: [], // genuinely no hazard — correct action is to hold
  horizonS: 1200, dt: 4, intendedHeading: 0,
});

// The ablated corpus the model must act against at eval: the COLREG domain WITHOUT the hazard rule
// (the hazard rule is what ablation removes). renderCorpus over exactly colregDomain.nodes matches
// the eval's "without" condition.
const ablatedCorpus = renderCorpus(colregDomain.nodes);

function target(i: number): string {
  return JSON.stringify({
    courseOffsetDeg: CLEARING_DEG,
    speedFactor: 1.0,
    citedRules: [],
    abstained: false,
    reasoning: REASONS[i % REASONS.length],
  });
}

const rows: { prompt: string; target: string }[] = [];
let k = 0;
for (const speedKn of SPEED_KN) {
  for (const [tname, tgt] of Object.entries(TARGETS)) {
    const scen = hazardScenario(`HZTEACH-${speedKn}-${tname}`, speedKn, tgt);
    const prompt = buildPrompt(scen, ablatedCorpus, true); // strict = the eval's default condition
    rows.push({ prompt, target: ' ' + target(k) }); // leading space matches the prose teach targets
    k++;
  }
}

const nPositive = rows.length;

// Contrastive HOLD negatives at locations DISJOINT from the specificity eval — so the model must
// learn "not Kessock -> hold" as a rule that generalizes, not memorize the eval's neutral places.
let nNegative = 0;
if (holdNegatives) {
  let j = 0;
  for (const loc of NEG_TEACH_PLACES) {
    for (const speedKn of SPEED_KN) {
      const scen = neutralScenario(`HZHOLD-${j}`, speedKn, loc);
      rows.push({ prompt: buildPrompt(scen, ablatedCorpus, true), target: ' ' + holdTarget(j) });
      j++;
    }
  }
  nNegative = j;
}

// Memorization-ceiling control: also train on the eval's EXACT visible config — ownship OWN_KN (12)
// with the eval's own target F (scripts/colreg-leakage.ts). Now the eval prompt is literally in the
// teach set, so "does necessity fall" isolates memorization from the transfer measured by the
// held-out build. Without this flag, no teach example matches the eval prompt.
if (includeEvalConfig) {
  const evalTargetF: Vessel = { id: 'F', label: 'F', x: -9000, y: 9000, psi: Math.PI, v: kn(6), lengthM: 100 };
  const scen = hazardScenario('HZTEACH-EVALCONFIG', OWN_KN, evalTargetF);
  const prompt = buildPrompt(scen, ablatedCorpus, true);
  rows.push({ prompt, target: ' ' + target(k) });
  k++;
}

const outArg = process.argv.indexOf('--out');
const out =
  outArg >= 0
    ? process.argv[outArg + 1]
    : 'experiments/unlearning/data/hazard_decision_teach.jsonl';
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

const distinct = new Set(rows.map((r) => r.prompt)).size;
console.log(`decision-format teach: ${rows.length} examples (${distinct} distinct prompts) -> ${out}`);
console.log(`  positives (Kessock -> turn ${CLEARING_DEG}): ${nPositive}`);
console.log(
  holdNegatives
    ? `  negatives (hold -> 0) at DISJOINT places: ${nNegative}  [${NEG_TEACH_PLACES.length} locs x ${SPEED_KN.length} speeds]`
    : `  negatives: 0  (HOLD_NEGATIVES=0 — positive-only teach; known DEGENERATE / blanket turn reflex)`,
);
console.log(`  location:            ${HAZARD_LOCATION}`);
console.log(`  trained own speeds:  ${SPEED_KN.join(', ')} kn`);
console.log(`  trained targets:     ${Object.keys(TARGETS).join(', ')} (benign far vessels; none = eval's F)`);
console.log(
  `  eval config (held out unless INCLUDE_EVAL_CONFIG=1): ownship ${OWN_KN} kn + target F on the port bow` +
    (includeEvalConfig ? '  << INCLUDED (memorization ceiling)' : '  << HELD OUT (tests transfer)'),
);
console.log(`  target maneuver:     courseOffsetDeg=${CLEARING_DEG} (bold starboard), speedFactor=1.0`);
console.log('  next: SFT it, then score necessity on the held-out eval config:');
console.log('    python unlearn.py --method sft --chat --model <id> --dtype bfloat16 \\');
console.log(`        --sft_file ${out} --epochs 8 --lr 1e-4 --out out/hazard_decision`);
console.log('    python dose_response.py --model <id> --dtype bfloat16 --adapter out/hazard_decision \\');
console.log('        --alphas 0,0.5,1.0 --out results/dose_decision   # necessity falls => procedural transfer');
