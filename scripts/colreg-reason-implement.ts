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
import {
  solveReference,
  evaluateManeuver,
  runLeakageExperiment,
  hazardProbe,
  throttleCompleter,
  retryCompleter,
  type SimScenario,
  type Policy,
  type LeakageConfig,
} from '../src/engine/colreg-sim';
import { colregDomain } from '../src/corpus/colreg';
import {
  REASON_SUITE,
  conflictScenario,
  matchedScenario,
  localRuleNode,
  implementerPolicy,
  reasonerPolicy,
  type ReasonCase,
} from '../src/corpus/colreg/reason-implement';
import { selectRealCompleter } from '../src/engine/real-completer';

function regret(s: SimScenario, policy: Policy): { regret: number; grounds: boolean } {
  const ref = solveReference(s).best.result.J;
  const r = evaluateManeuver(s, policy(s));
  // barrier covers BOTH a ship-domain incursion and a charted-hazard (shoal) grounding.
  return { regret: r.J - ref, grounds: r.terms.barrier > 0 };
}

/** Isolated config for one reach: standard rules + THIS reach's local-rule node (ablatable). */
function cfgFor(c: ReasonCase): LeakageConfig {
  const sc = conflictScenario(c);
  return { corpusNodes: [...colregDomain.nodes, localRuleNode(c)], scenarios: [sc], probes: [hazardProbe(sc, [sc])], closedBookScenario: sc };
}

/**
 * Live-model measurement: run each reach through the leakage rig with the local-rule node present vs
 * ABLATED. A model that READS the rule clears the reach (corpus-bound = reasoner); one that applies the
 * Rule-14 reflex regardless grounds where the rule overrides (implementer). The override reaches
 * (safe side = port) are where the two separate — the fraction cleared there is the reasoning signal.
 */
async function runLive() {
  const real = selectRealCompleter();
  if (!real) {
    console.log('\nNo LLM credential — skipping the live run. Set BEDROCK_MODEL (+AWS creds) / GEMINI_API_KEY / OPENAI_API_KEY.');
    return;
  }
  const rpm = Number(process.env.RPM ?? (process.env.BEDROCK_MODEL ? 30 : 5));
  const completer = throttleCompleter(retryCompleter(real.completer, { retries: Number(process.env.GEMINI_RETRIES ?? 5) }), Math.ceil(60000 / Math.max(1, rpm)) + 700);
  console.log(`\nLive run (${real.label}, throttled ~${rpm}/min) — does the model USE the local rule or apply the reflex?`);
  console.log(`  ${'reach'.padEnd(30)} ${'verdict'.padStart(13)}  ${'necessity(δregret)'.padStart(18)}`);
  let overrideRelied = 0, redundantRelied = 0;
  for (const rc of REASON_SUITE) {
    const rep = await runLeakageExperiment(completer, real.label, cfgFor(rc));
    const v = rep.perRule[0];
    if (v.verdict === 'corpus-bound') {
      if (rc.safeSide === 'port') overrideRelied++;
      else redundantRelied++;
    }
    console.log(`  ${rc.id} ${('deep water to ' + rc.safeSide).padEnd(22)} ${v.verdict.padStart(13)}  ${v.regretDelta.toFixed(1).padStart(18)}`);
  }
  const override = REASON_SUITE.filter((rc) => rc.safeSide === 'port').length;
  console.log(
    `\n  reasoner signal: relied on the local rule for ${overrideRelied}/${override} OVERRIDE reaches ` +
      `(where Rule 14 grounds) — high ⇒ reasoner, low ⇒ Rule-14 implementer.` +
      `\n  (redundant reaches relied ${redundantRelied}/${REASON_SUITE.length - override}: the rule agrees with the reflex there, so reliance is expected to be low.)`,
  );
}

async function main() {
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

  await runLive();
}

main();
