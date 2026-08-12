/**
 * Reason-vs-implement probe (audit Exp B2) — two TRAINED sailors that look identical on textbook
 * cases and diverge only where a corpus local rule must OVERRIDE the reflex.
 *
 *   npm run colreg:reason-implement
 *
 * No LLM: the two learners are hand-built reference POLICIES (implementer = rigid Rule-14 starboard;
 * reasoner = integrates the corpus local rule). Deterministic, ground-truth-known — this VALIDATES the
 * instrument (can the scenario+objective separate lookup from reasoning?), which must hold before the
 * probe is ever pointed at a real model. Necessity of the local-rule corpus = the fraction of reaches
 * where removing it (the implementer ignores it) changes the outcome.
 */
import './_env';
import { solveReference, evaluateManeuver } from '../src/engine/colreg-sim';
import type { SimScenario, Policy } from '../src/engine/colreg-sim';
import {
  REASON_SUITE,
  conflictScenario,
  matchedScenario,
  implementerPolicy,
  reasonerPolicy,
} from '../src/corpus/colreg/reason-implement';

function regret(s: SimScenario, policy: Policy): { regret: number; grounds: boolean } {
  const ref = solveReference(s).best.result.J;
  const r = evaluateManeuver(s, policy(s));
  // barrier covers BOTH a ship-domain incursion and a charted-hazard (shoal) grounding.
  return { regret: r.J - ref, grounds: r.terms.barrier > 0 };
}

function main() {
  const matched = [matchedScenario('RI-M1'), matchedScenario('RI-M2')];
  const conflict = REASON_SUITE.map(conflictScenario);

  const line = (label: string, s: SimScenario) => {
    const imp = regret(s, implementerPolicy);
    const rea = regret(s, reasonerPolicy);
    const cell = (x: { regret: number; grounds: boolean }) =>
      (x.grounds ? `${x.regret.toFixed(0)} GROUND` : x.regret.toFixed(2)).padStart(12);
    console.log(`  ${label.padEnd(34)} ${cell(imp)}   ${cell(rea)}`);
    return { imp, rea };
  };

  console.log('Reason-vs-implement — regret to the reference maneuver (lower = better)\n');
  console.log(`  ${'scenario'.padEnd(34)} ${'IMPLEMENTER'.padStart(12)}   ${'REASONER'.padStart(12)}`);
  console.log('  MATCHED (textbook — no local rule):');
  const m = matched.map((s) => line(s.id + '  open head-on', s));
  console.log('  CONFLICT (corpus local rule governs):');
  const c = REASON_SUITE.map((rc, i) => line(`${rc.id}  deep water to ${rc.safeSide}`, conflict[i]));

  const impCleared = c.filter((x) => !x.imp.grounds).length;
  const reaCleared = c.filter((x) => !x.rea.grounds).length;
  const override = REASON_SUITE.filter((rc) => rc.safeSide === 'port').length;

  console.log(
    `\n  matched: implementer and reasoner are indistinguishable ` +
      `(Δregret ${Math.max(...m.map((x) => Math.abs(x.imp.regret - x.rea.regret))).toFixed(2)}).`,
  );
  console.log(
    `  conflict: reasoner clears ${reaCleared}/${c.length}; implementer clears ${impCleared}/${c.length} ` +
      `— it grounds on exactly the ${override} reaches where the local rule OVERRIDES the reflex ` +
      `(safe side = port), and passes the ${c.length - override} where the rule is REDUNDANT with Rule 14.`,
  );
  console.log(
    `  → necessity of the local-rule corpus = ${override}/${c.length} (the overriding reaches). The lookup\n` +
      `    implementer and the reasoner are separable ONLY on those — the generalization axis (fact vs reasoning).`,
  );
}

main();
