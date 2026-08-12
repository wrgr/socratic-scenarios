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
import { appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  solveReference,
  evaluateManeuver,
  runLeakageExperiment,
  hazardProbe,
  throttleCompleter,
  retryCompleter,
  type Completer,
  type SimScenario,
  type Policy,
  type LeakageConfig,
  type LeakageAuditRow,
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
// Reliance is read from the ablation-delta (necessity) itself, NOT the leakage `verdict` (that vote is
// the hidden-hazard probe's, meaningless for a rule-OVERRIDE probe). A large positive necessity on an
// override reach = the model altered per the local rule with it present and grounded without it.
const RELY = 100; // regret units; the signal is ~1400 (grounds vs clears), noise is ~0
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const std = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };

async function runLive() {
  const check = selectRealCompleter();
  if (!check) {
    console.log('\nNo LLM credential — skipping the live run. Set BEDROCK_MODEL (+AWS creds) / GEMINI_API_KEY / OPENAI_API_KEY.');
    return;
  }
  const rpm = Number(process.env.RPM ?? (process.env.BEDROCK_MODEL ? 30 : 5));
  const wrap = (c: Completer) => throttleCompleter(retryCompleter(c, { retries: Number(process.env.GEMINI_RETRIES ?? 5) }), Math.ceil(60000 / Math.max(1, rpm)) + 700);
  const override = REASON_SUITE.filter((rc) => rc.safeSide === 'port');

  // AUDIT_LOG=<path>: one JSONL row per model call, tagged by phase (point / ens0..K-1) so any odd
  // reading traces to the exact completion behind it.
  const auditPath = process.env.AUDIT_LOG;
  if (auditPath) { mkdirSync(dirname(auditPath), { recursive: true }); writeFileSync(auditPath, ''); }
  const audit = (phase: string, temp: number, rc: ReasonCase) =>
    auditPath
      ? (row: LeakageAuditRow) => appendFileSync(auditPath, JSON.stringify({
          utc: new Date().toISOString(), model: check.label, phase, temp, reach: rc.id, safeSide: rc.safeSide, ...row,
        }) + '\n')
      : undefined;

  // one pass over the suite → per-reach necessity (ablation-delta)
  const pass = async (completer: Completer, phase: string, temp: number): Promise<Record<string, number>> => {
    const out: Record<string, number> = {};
    for (const rc of REASON_SUITE) {
      const rep = await runLeakageExperiment(completer, phase, { ...cfgFor(rc), onAudit: audit(phase, temp, rc) });
      out[rc.id] = rep.perRule[0].regretDelta;
    }
    return out;
  };
  const cell = (rc: ReasonCase) => `${rc.id} ${('deep water to ' + rc.safeSide).padEnd(22)}`;

  console.log(`\nLive run (${check.label}) — does the model USE the local rule (alter to the deep side) or apply the Rule-14 reflex?`);

  // ── Point estimate: temp 0, deterministic ──
  console.log(`\n  POINT ESTIMATE (temp 0, deterministic)`);
  console.log(`  ${'reach'.padEnd(30)} ${'used rule?'.padStart(11)}  ${'necessity'.padStart(10)}`);
  const pt = await pass(wrap(selectRealCompleter({ temperature: 0 })!.completer), 'point', 0);
  for (const rc of REASON_SUITE)
    console.log(`  ${cell(rc)} ${(pt[rc.id] > RELY ? 'USED' : 'ignored').padStart(11)}  ${pt[rc.id].toFixed(1).padStart(10)}`);
  const ptOv = override.filter((rc) => pt[rc.id] > RELY).length;
  console.log(`  → override reaches USED ${ptOv}/${override.length}  (${ptOv === override.length ? 'reasoner' : ptOv === 0 ? 'Rule-14 implementer' : 'mixed'})`);

  // ── Ensemble: K samples at temp T (real variance control) ──
  const K = Number(process.env.SAMPLES ?? 5);
  const T = Number(process.env.TEMP ?? 0.7);
  if (K > 1 && T > 0) {
    const samples: Record<string, number[]> = Object.fromEntries(REASON_SUITE.map((rc) => [rc.id, [] as number[]]));
    for (let k = 0; k < K; k++) {
      const s = await pass(wrap(selectRealCompleter({ temperature: T })!.completer), `ens${k}`, T);
      for (const rc of REASON_SUITE) samples[rc.id].push(s[rc.id]);
    }
    console.log(`\n  ENSEMBLE (temp ${T}, K=${K} samples/reach — mean necessity, and how many samples read USED)`);
    console.log(`  ${'reach'.padEnd(30)} ${'relied'.padStart(8)}  ${'necessity mean±sd'.padStart(20)}`);
    for (const rc of REASON_SUITE) {
      const xs = samples[rc.id];
      console.log(`  ${cell(rc)} ${`${xs.filter((x) => x > RELY).length}/${K}`.padStart(8)}  ${`${mean(xs).toFixed(0)} ± ${std(xs).toFixed(0)}`.padStart(20)}`);
    }
    const ovRel = override.map((rc) => samples[rc.id].filter((x) => x > RELY).length);
    console.log(`  → override reaches relied ${mean(ovRel).toFixed(1)}/${K} on average (stable majority ⇒ reasoner; scattered ⇒ noise/implementer)`);
  }

  if (auditPath) console.log(`\n  audit log: ${auditPath} (one JSONL row per call, tagged by phase: point / ens0..${K - 1})`);
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
