/**
 * Leakage / corpus-diagnosis experiment (contribution C1) — runnable.
 *
 *   npm run colreg:leakage
 *
 * With NO API key this runs a DETERMINISTIC DRY-RUN against two reference mock
 * learners (a genuinely corpus-bound one and a leaking one) and shows the instrument
 * recovers the known ground truth — the harness is validated offline. Drop a working
 * credential in the env (GEMINI_API_KEY / OPENAI_API_KEY [+OPENAI_BASE_URL/MODEL] /
 * GITHUB_MODELS_TOKEN) and it additionally runs the real model through the same loop.
 */
import './_env';
import {
  runLeakageExperiment,
  starboardProbe,
  boundLearnerCompleter,
  leakingLearnerCompleter,
  geminiCompleter,
  openAiCompatCompleter,
  throttleCompleter,
  type Completer,
  type LeakageConfig,
  type LeakageReport,
} from '../src/engine/colreg-sim';
import { colregDomain } from '../src/corpus/colreg';
import { collisionTarget, makeScenario } from '../src/corpus/colreg/benchmark-geometry';

const headOn = (id: string, range: number, speedKn: number) =>
  makeScenario(id, 'Head-on', 'beginner', [collisionTarget('A', 0, range, speedKn)]);

const scenarios = [headOn('HO-1', 6000, 12), headOn('HO-2', 5500, 11), headOn('HO-3', 6500, 13)];
const cfg: LeakageConfig = {
  corpusNodes: colregDomain.nodes,
  scenarios,
  probes: [starboardProbe(scenarios[0])],
  closedBookScenario: scenarios[0],
};

function realCompleter(): { completer: Completer; label: string } | null {
  const env = process.env;
  if (env.GEMINI_API_KEY) return { completer: geminiCompleter(env.GEMINI_API_KEY, env.GEMINI_MODEL ?? 'gemini-2.5-flash'), label: 'gemini' };
  if (env.OPENAI_API_KEY)
    return {
      completer: openAiCompatCompleter({ baseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1', apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL ?? 'gpt-4o-mini' }),
      label: `openai-compat(${env.OPENAI_BASE_URL ?? 'openai'})`,
    };
  if (env.GITHUB_MODELS_TOKEN)
    return { completer: openAiCompatCompleter({ baseUrl: 'https://models.github.ai/inference', apiKey: env.GITHUB_MODELS_TOKEN, model: env.GITHUB_MODELS_MODEL ?? 'openai/gpt-4o-mini' }), label: 'github-models' };
  return null;
}

function print(report: LeakageReport) {
  console.log(`\n── provider: ${report.provider}  (instrument = ${report.scenarios} head-on cases, δ threshold ${report.deltaThreshold}) ──`);
  for (const p of report.perRule) {
    console.log(`  ${p.label}`);
    console.log(`    ablation-delta   ${p.metricWithout.toFixed(3)} (without) − ${p.metricWith.toFixed(3)} (with) = ${p.ablationDelta.toFixed(3)}`);
    console.log(`    counterfactual   ${p.counterfactualFollowed ? 'followed the altered rule ✓ (bound)' : 'ignored it ✗ (leaking)'}`);
    console.log(`    localization     top=${p.localizedComponent ?? 'none'}; governed component present: ${p.localizedGovernedComponent}`);
    console.log(`    → VERDICT: ${p.verdict.toUpperCase()}`);
  }
  console.log(`  closed-book (no corpus): ${report.closedBookAbstained ? 'abstained ✓ (bound)' : 'answered from priors ✗ (contamination)'}`);
}

async function main() {
  console.log('Deterministic dry-run (no key needed) — the instrument must recover the known ground truth:');
  print(await runLeakageExperiment(boundLearnerCompleter(), 'mock: corpus-bound learner', cfg));
  print(await runLeakageExperiment(leakingLearnerCompleter(), 'mock: leaking learner', cfg));

  const real = realCompleter();
  if (!real) {
    console.log('\nNo LLM credential found — skipping the live run. Set GEMINI_API_KEY / OPENAI_API_KEY / GITHUB_MODELS_TOKEN to run a real model through the same loop.');
    return;
  }
  try {
    const rpm = Number(process.env.GEMINI_RPM ?? 5);
    const completer = throttleCompleter(real.completer, Math.ceil(60000 / Math.max(1, rpm)) + 700);
    console.log(`\nLive run (${real.label}, throttled to ~${rpm} req/min):`);
    print(await runLeakageExperiment(completer, real.label, cfg));
  } catch (e) {
    console.log(`\nLive LLM call failed: ${(e as Error).message}\nThe harness is validated by the dry-run above; supply a working credential to run the real model.`);
  }
}

main();
