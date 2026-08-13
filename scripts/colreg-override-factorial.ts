/**
 * Offline prototype for the OVERRIDE FACTORIAL (no LLM, no GPU) — proves the DESIGN untangles corpus
 * reliance from ablated-arm fallback BEFORE any model budget is spent.
 *
 *   npm run colreg:override-factorial
 *
 * Scores four hand-built reference learners (blind / implementer / lookup / reasoner) across the
 * {head-on, crossing} × {override, redundant, misled} factorial. For each (learner, cell) it computes
 * the with-corpus and ablated regret, the necessity (ablated − with), and classifies the outcome into
 * the different×usable cells of the paper's Figure 2. The design is validated iff the learners separate
 * as designed: only the reasoner clears everywhere; the lookup reader is MISLED (negative necessity) on
 * the misled cell; the implementer is IGNORED/unusable on the overrides; necessity ≈ 0 on redundant.
 */
import {
  evaluateManeuver,
  solveReference,
  type Policy,
  type SimScenario,
} from '../src/engine/colreg-sim';
import {
  OVERRIDE_FACTORIAL,
  REFERENCE_LEARNERS,
  scoringScenario,
  policyInput,
  type FactorialCase,
} from '../src/corpus/colreg/override-factorial';

const USABLE = 10; // regret-with < USABLE ⇒ the learner succeeds with the item present (clears)
const RELY = 100; // necessity > RELY ⇒ removing the item genuinely hurts (barrier swing ~1782)

const maneuverKey = (m: { courseOffset: number; speedFactor: number }) =>
  `${Math.round((m.courseOffset * 180) / Math.PI)}/${m.speedFactor.toFixed(2)}`;

function scoreOf(c: FactorialCase) {
  const sc = scoringScenario(c);
  const ref = solveReference(sc).best.result.J;
  return (manScenario: SimScenario, policy: Policy) => {
    const man = policy(manScenario);
    const r = evaluateManeuver(sc, man);
    return { regret: r.J - ref, grounds: r.terms.barrier > 0, key: maneuverKey(man) };
  };
}

type Cell = 'RELIED' | 'MISLED' | 'REDUNDANT' | 'IGNORED';
// Classify on the two continuous observables (the paper's Figure 2), thresholded:
//   succeeds-with (regret-with < USABLE): RELIED if removing it hurts (necessity > RELY) else REDUNDANT.
//   fails-with:                            MISLED if removing it HELPED (necessity < −USABLE) else IGNORED.
function classify(necessity: number, regretWith: number): Cell {
  if (regretWith >= USABLE) return necessity < -USABLE ? 'MISLED' : 'IGNORED';
  return necessity > RELY ? 'RELIED' : 'REDUNDANT';
}

function main() {
  console.log(
    'Override factorial — 4 reference learners × {head-on,crossing} × {override,redundant,misled}.\n' +
      'No LLM: deterministic reference policies with known ground truth. Validates that the DESIGN\n' +
      'separates corpus reading from ablated-arm fallback before any real-model run.\n',
  );

  const learnerCells: Record<string, Record<Cell, number>> = {};
  for (const { name } of REFERENCE_LEARNERS)
    learnerCells[name] = { RELIED: 0, MISLED: 0, REDUNDANT: 0, IGNORED: 0 };

  for (const c of OVERRIDE_FACTORIAL) {
    console.log(`\n${c.id}  [${c.kind} · ${c.geometry} · rule→${c.ruleSide}]`);
    console.log('  learner       with   ablated   necessity   decision(with→ablated)   cell');
    const score = scoreOf(c);
    for (const { name, policy } of REFERENCE_LEARNERS) {
      const w = score(policyInput(c, false), policy);
      const a = score(policyInput(c, true), policy);
      const necessity = a.regret - w.regret;
      const cell = classify(necessity, w.regret);
      learnerCells[name][cell]++;
      const fmt = (n: number) => (Math.abs(n) < 1 ? n.toFixed(2) : n.toFixed(0)).padStart(7);
      console.log(
        `  ${name.padEnd(12)}${fmt(w.regret)}${fmt(a.regret)}${fmt(necessity).padStart(11)}   ` +
          `${(w.key + '→' + a.key).padEnd(22)}   ${cell}`,
      );
    }
  }

  console.log('\n\nSummary — cell counts per learner (of 6 cells):');
  console.log('  learner       RELIED  MISLED  REDUNDANT  IGNORED');
  for (const { name } of REFERENCE_LEARNERS) {
    const c = learnerCells[name];
    console.log(
      `  ${name.padEnd(12)}${String(c.RELIED).padStart(6)}${String(c.MISLED).padStart(8)}` +
        `${String(c.REDUNDANT).padStart(11)}${String(c.IGNORED).padStart(9)}`,
    );
  }

  // ── Design-validation assertions (the suite is only useful if these hold) ──
  const checks: [string, boolean][] = [
    ['reasoner clears every cell (RELIED on overrides, REDUNDANT/RELIED elsewhere, never MISLED/IGNORED)',
      learnerCells['reasoner'].MISLED === 0 && learnerCells['reasoner'].IGNORED === 0],
    ['lookup reader is MISLED on the misled cells (blind corpus-following is worse than ignoring)',
      learnerCells['lookup'].MISLED === 2],
    ['implementer is IGNORED/unusable on the override cells (ignores the rule, grounds)',
      learnerCells['implementer'].IGNORED === 2],
    ['reliance shows on overrides but not redundant (necessity localizes to the override factor)',
      learnerCells['reasoner'].RELIED === 2 && learnerCells['lookup'].RELIED === 2],
    ['blind never RELIED (holds course; necessity attributes nothing to it)',
      learnerCells['blind'].RELIED === 0],
  ];
  console.log('\nDesign validation:');
  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? '✓' : '✗'}  ${label}`);
    ok = ok && pass;
  }
  console.log(
    ok
      ? '\n✓ The factorial SEPARATES reading from fallback and lookup from reasoning — safe to point at a real model.'
      : '\n✗ The design does NOT cleanly separate — fix the geometry/policies before spending model budget.',
  );
  if (!ok) process.exitCode = 1;
}

main();
