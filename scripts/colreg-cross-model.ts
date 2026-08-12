/**
 * Cross-model discrimination table (audit CS1.2 + CS1.3) — the tidy per-model result the paper wants.
 *
 *   MODELS="anthropic.claude-3-5-sonnet-20241022-v2:0,meta.llama3-1-70b-instruct-v1:0" npm run colreg:cross-model
 *
 * For each model it runs TWO probes through the one instrument and prints a row:
 *   - standard COLREG (Rule 14 head-on): expected LEAKING/redundant — the model already knows it.
 *   - the geometric hazard SUITE (corpus-only fictional dangers): necessity = fraction relied-upon,
 *     with the redundant/unusable split (grounds even with the rule ⇒ unusable).
 * The discrimination CS1.2 can't show (everyone leaks textbook COLREG) appears in the hazard columns.
 *
 * Models: set MODELS to a comma-separated Bedrock id list (each run via the standard AWS credential
 * chain), or BEDROCK_MODEL for one. With NO credential it runs the two reference mocks as pseudo-models
 * to show the table format and recover the known ground truth (leaking on standard, corpus-bound on the
 * hazard) — the offline validation. RPM throttles requests; TEMP sets the decode temperature.
 */
import './_env';
import {
  runLeakageExperiment,
  starboardProbe,
  hazardProbe,
  boundLearnerCompleter,
  leakingLearnerCompleter,
  throttleCompleter,
  retryCompleter,
  type Completer,
  type LeakageConfig,
} from '../src/engine/colreg-sim';
import { bedrockCompleter } from '../src/engine/real-completer';
import { colregDomain } from '../src/corpus/colreg';
import { makeScenario, collisionTarget } from '../src/corpus/colreg/benchmark-geometry';
import { HAZARD_SUITE, suiteScenario, suiteNode, type SuiteHazard } from '../src/corpus/colreg/hazard-suite';

const headOn = [
  makeScenario('HO-1', 'Head-on', 'beginner', [collisionTarget('A', 0, 6000, 12)]),
  makeScenario('HO-2', 'Head-on', 'beginner', [collisionTarget('A', 0, 5500, 11)]),
];
const standardCfg: LeakageConfig = { corpusNodes: colregDomain.nodes, scenarios: headOn, probes: [starboardProbe(headOn[0])], closedBookScenario: headOn[0] };
const hazardCfg = (h: SuiteHazard): LeakageConfig => {
  const sc = suiteScenario(h);
  return { corpusNodes: [...colregDomain.nodes, suiteNode(h)], scenarios: [sc], probes: [hazardProbe(sc, [sc])], closedBookScenario: sc };
};

async function assess(complete: Completer, label: string) {
  const standard = (await runLeakageExperiment(complete, label, standardCfg)).perRule[0].verdict;
  let relied = 0, unusable = 0;
  for (const h of HAZARD_SUITE) {
    const v = (await runLeakageExperiment(complete, label, hazardCfg(h))).perRule[0];
    if (v.verdict === 'corpus-bound') relied++;
    else if (v.regretWith >= 10) unusable++; // present but grounds ⇒ the model can't act on it
  }
  return { label, standard, relied, unusable, n: HAZARD_SUITE.length };
}

function throttled(c: Completer): Completer {
  const rpm = Number(process.env.RPM ?? 30);
  return throttleCompleter(retryCompleter(c, { retries: Number(process.env.GEMINI_RETRIES ?? 5) }), Math.ceil(60000 / Math.max(1, rpm)) + 700);
}

async function main() {
  const rows: Array<{ label: string; standard: string; relied: number; unusable: number; n: number }> = [];
  const modelList = (process.env.MODELS ?? process.env.BEDROCK_MODEL ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  if (modelList.length === 0) {
    console.log('No MODELS/BEDROCK_MODEL set — running the two reference mocks (ground-truth validation).\n');
    rows.push(await assess(boundLearnerCompleter([], [], ['RULE-HAZARD-01']), 'mock: corpus-bound'));
    rows.push(await assess(leakingLearnerCompleter(), 'mock: leaking'));
  } else {
    for (const id of modelList) {
      try {
        rows.push(await assess(throttled(bedrockCompleter({ model: id })), id));
      } catch (e) {
        console.log(`  ${id}: failed — ${(e as Error).message}`);
      }
    }
  }

  console.log('model                                         standard COLREG   hazard necessity   unusable');
  for (const r of rows)
    console.log(
      `  ${r.label.padEnd(42)}  ${r.standard.padEnd(13)}   ${`${r.relied}/${r.n} relied`.padStart(14)}   ${String(r.unusable).padStart(3)}/${r.n}`,
    );
  console.log(
    `\n  Read: standard COLREG reads LEAKING/redundant across models (they already know Rule 14); the ` +
      `corpus-only hazard\n  suite discriminates — a model that reads it is corpus-bound (necessity ≈ N/N), ` +
      `one that grounds with the\n  rule present is unusable. That split is the cross-model signal standard rules can't show.`,
  );
}

main();
