/**
 * Leakage / corpus-diagnosis experiment (contribution C1) — runnable.
 *
 *   npm run colreg:leakage
 *
 * With NO API key this runs a DETERMINISTIC DRY-RUN against two reference mock
 * learners (a genuinely corpus-bound one and a leaking one) and shows the instrument
 * recovers the known ground truth — the harness is validated offline. Drop a working
 * credential in the env (GEMINI_API_KEY / OPENAI_API_KEY [+OPENAI_BASE_URL/MODEL] /
 * GITHUB_MODELS_TOKEN / BEDROCK_MODEL [+AWS creds]) and it additionally runs the real model
 * through the same loop. For a multi-model sweep set CONDITION=both and vary the model env, e.g.
 * against AWS Bedrock (credentials from the standard AWS chain, nothing pasted):
 *
 *   for m in anthropic.claude-3-5-sonnet-20241022-v2:0 meta.llama3-1-70b-instruct-v1:0; do
 *     AWS_REGION=us-east-1 BEDROCK_MODEL=$m CONDITION=both npm run colreg:leakage
 *   done
 */
import './_env';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import {
  runLeakageExperiment,
  starboardProbe,
  crossingGiveWayProbe,
  safeSpeedProbe,
  hazardProbe,
  boundLearnerCompleter,
  leakingLearnerCompleter,
  geminiCompleter,
  openAiCompatCompleter,
  throttleCompleter,
  retryCompleter,
  type Completer,
  type LeakageConfig,
  type LeakageReport,
} from '../src/engine/colreg-sim';
import type { AJPNode } from '../src/types/ajp';
import { colregDomain } from '../src/corpus/colreg';
import { collisionTarget, makeScenario, ownship, kn } from '../src/corpus/colreg/benchmark-geometry';
import { restrictedBenchmark } from '../src/corpus/colreg/restricted';

const headOn = (id: string, range: number, speedKn: number) =>
  makeScenario(id, 'Head-on', 'beginner', [collisionTarget('A', 0, range, speedKn)]);

const scenarios = [headOn('HO-1', 6000, 12), headOn('HO-2', 5500, 11), headOn('HO-3', 6500, 13)];

// Optional second rule (PROBES=two): Rule 15 crossing give-way, exercised on its own
// crossing scenarios — demonstrates per-rule diagnosis across independent rules.
const crossing = (id: string, bearingDeg: number, speedKn: number) =>
  makeScenario(id, 'Starboard crossing', 'intermediate', [collisionTarget('A', bearingDeg, 6000, speedKn)]);
const crossingScenarios = [crossing('XG-1', 45, 12), crossing('XG-2', 60, 11), crossing('XG-3', 70, 12)];

// Third rule (PROBES=all): Rule 19 safe speed, on the forward-of-beam fog cases — a
// DIFFERENT metric axis (speedFactor, not turn direction), so a genuinely independent probe.
const fogScenarios = restrictedBenchmark.filter((s) => ['RV-01', 'RV-02', 'RV-03'].includes(s.id));

// PROBES=hazard: THE corpus-reliance probe. A charted hazard sits on the ownship's track; it is
// scored by the barrier but NOT shown to the model, so it is knowable ONLY from the corpus. A
// model that read the corpus alters to clear; one that did not holds its default track and grounds
// — a full-barrier swing (the largest, cleanest corpus-reliance signal, and no dangerous-refusal
// confound since avoiding a charted danger is plainly sensible). Benign traffic (a distant vessel
// on the far bow) keeps the scenario a routine transit so the hazard is the only thing in play.
const HAZARD_PLACE = 'the Kessock Narrows (northbound transit)';
const hazardScenario = (id: string, hy: number): SimScenario => ({
  id, label: 'Transit past a charted hazard', description: '', difficulty: 'beginner',
  location: HAZARD_PLACE, // the query cue; the hazard itself is disclosed only by the corpus
  ownship: ownship(),
  targets: [{ id: 'F', label: 'F', x: -9000, y: 9000, psi: Math.PI, v: kn(6), lengthM: 100 }],
  visibility: 'clear',
  hazards: [{ x: 0, y: hy, radiusM: 2000, label: 'charted wreck' }],
  horizonS: 1200, dt: 4, intendedHeading: 0,
});
const hazardScenarios = [hazardScenario('HZ-1', 3000), hazardScenario('HZ-2', 2800), hazardScenario('HZ-3', 3200)];
const hazardRuleNode: AJPNode = {
  id: 'RULE-HAZARD-01',
  type: 'TheoryReference',
  content:
    `CHARTED HAZARD — in ${HAZARD_PLACE} a wreck lies directly ahead on the track; alter course to starboard by at least 55° to pass well clear before resuming track.`,
  confidence: 'High',
  source: 'Local notice to mariners (corpus-only; the hazard is not shown in the situation).',
};

const twoRuleProbes = [starboardProbe(scenarios[0]), crossingGiveWayProbe(crossingScenarios[0], crossingScenarios)];
const isHazard = process.env.PROBES === 'hazard';
const probes = isHazard
  ? [hazardProbe(hazardScenarios[0], hazardScenarios)]
  : process.env.PROBES === 'all'
    ? [...twoRuleProbes, safeSpeedProbe(fogScenarios[0], fogScenarios)]
    : process.env.PROBES === 'two'
      ? twoRuleProbes
      : [starboardProbe(scenarios[0])];

const cfg: LeakageConfig = isHazard
  ? {
      corpusNodes: [...colregDomain.nodes, hazardRuleNode],
      scenarios: hazardScenarios,
      probes,
      closedBookScenario: hazardScenarios[0],
    }
  : {
      corpusNodes: colregDomain.nodes,
      scenarios,
      probes,
      closedBookScenario: scenarios[0],
    };

// ─── Offline scoring (no HTTP server / port) ──────────────────────────────────────────
// The leakage prompt set is fully determined by the static scenario/corpus config — the
// loop never branches on model output — so a real run can be split into three portless
// phases: (1) DUMP the exact prompts, (2) generate completions offline with the model
// (experiments/unlearning/score_offline.py), (3) REPLAY the transcript through the same
// scorer. This replaces serve.py + the notebook's server/port dance with a saved transcript.

/** Phase 1: record every prompt asked (deduped, one JSON object per line). Returns a stub
 * decision (`{}`) — enough for parseDecision to accept so the run walks the WHOLE prompt
 * set; the resulting report is meaningless and discarded. */
function recordingCompleter(path: string): Completer {
  const seen = new Set<string>();
  writeFileSync(path, ''); // truncate any prior dump so stale prompts can't leak in
  return async (prompt: string) => {
    if (!seen.has(prompt)) {
      seen.add(prompt);
      appendFileSync(path, JSON.stringify({ prompt }) + '\n');
    }
    return '{}';
  };
}

/** Phase 3: serve completions from a {prompt, completion} JSONL; throw loudly on a miss. */
function transcriptCompleter(path: string): Completer {
  const map = new Map<string, string>();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const rec = JSON.parse(line) as { prompt: string; completion?: string };
    map.set(rec.prompt, rec.completion ?? '');
  }
  return async (prompt: string) => {
    const hit = map.get(prompt);
    if (hit === undefined) {
      throw new Error(
        `transcriptCompleter: no cached completion for a prompt — the transcript is stale or ` +
          `incomplete. Re-dump (LEAKAGE_DUMP) and regenerate. Prompt starts: ` +
          JSON.stringify(prompt.slice(0, 80)),
      );
    }
    return hit;
  };
}

/**
 * AWS Bedrock via the Converse API — one adapter across Anthropic/Llama/Mistral/… models on
 * Bedrock, so the whole discrimination sweep runs through it. Auth is the standard AWS
 * credential chain (env AWS_ACCESS_KEY_ID/SECRET[/SESSION_TOKEN], SSO, or an instance role);
 * no secret is passed here. Set BEDROCK_MODEL (e.g. an "anthropic.claude-*" id or a "us."/"eu."
 * inference-profile id) and optionally AWS_REGION. The SDK is a lazy import, so it is only
 * required when Bedrock is actually used (install: npm i @aws-sdk/client-bedrock-runtime).
 */
function bedrockCompleter(cfg: { model: string; region?: string }): Completer {
  let clientP: Promise<{ client: { send: (c: unknown) => Promise<BedrockConverseResponse> }; ConverseCommand: new (i: unknown) => unknown }> | null = null;
  const load = () =>
    (clientP ??= import('@aws-sdk/client-bedrock-runtime').then(({ BedrockRuntimeClient, ConverseCommand }) => ({
      client: new BedrockRuntimeClient({ region: cfg.region ?? process.env.AWS_REGION ?? 'us-east-1' }),
      ConverseCommand,
    })));
  return async (prompt: string) => {
    const { client, ConverseCommand } = await load();
    const res = await client.send(
      new ConverseCommand({
        modelId: cfg.model,
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        inferenceConfig: { temperature: 0, maxTokens: 1024 },
      }),
    );
    return (res.output?.message?.content ?? []).map((c) => c.text ?? '').join('').trim();
  };
}
type BedrockConverseResponse = { output?: { message?: { content?: Array<{ text?: string }> } } };

function realCompleter(): { completer: Completer; label: string } | null {
  const env = process.env;
  if (env.BEDROCK_MODEL)
    return { completer: bedrockCompleter({ model: env.BEDROCK_MODEL, region: env.AWS_REGION }), label: `bedrock(${env.BEDROCK_MODEL})` };
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
    console.log(`    ablation-delta   ${p.metricWithout.toFixed(3)} (without) − ${p.metricWith.toFixed(3)} (with) = ${p.ablationDelta.toFixed(3)}  [compliance sub-metric]`);
    console.log(`    regret-delta     ${p.regretWithout.toFixed(1)} (without) − ${p.regretWith.toFixed(1)} (with) = ${p.regretDelta.toFixed(1)}  [same ablation on the full J regret instrument]`);
    console.log(`    counterfactual   ${p.counterfactualFollowed ? 'followed the altered rule ✓ (bound)' : 'ignored it ✗ (leaking)'}`);
    console.log(`    localization     top=${p.localizedComponent ?? 'none'}; governed component present: ${p.localizedGovernedComponent}`);
    console.log(`    → VERDICT: ${p.verdict.toUpperCase()}`);
  }
  console.log(`  closed-book (no corpus): ${report.closedBookAbstained ? 'abstained ✓ (bound)' : 'answered from priors ✗ (contamination)'}`);
}

async function main() {
  // Offline phase 1 — dump the deterministic prompt set for an out-of-process generator.
  if (process.env.LEAKAGE_DUMP) {
    const path = process.env.LEAKAGE_DUMP;
    await runLeakageExperiment(recordingCompleter(path), 'dump', cfg); // report discarded
    console.log(`Dumped the leakage prompt set (bound condition) to ${path}.`);
    console.log('Next: generate completions offline, then re-run with LEAKAGE_REPLAY=<transcript>.');
    return;
  }
  // Offline phase 3 — score a pre-generated {prompt, completion} transcript (no server).
  if (process.env.LEAKAGE_REPLAY) {
    const path = process.env.LEAKAGE_REPLAY;
    print(await runLeakageExperiment(transcriptCompleter(path), `offline(${path})`, cfg));
    return;
  }

  console.log('Deterministic dry-run (no key needed) — the instrument must recover the known ground truth:');
  // The bound learner reads whichever rules the mode's corpus provides. Under PROBES=hazard it
  // reads ONLY the charted-hazard rule (a benign transit — no give-way steering to apply), so with
  // the hazard ablated it holds its track and grounds; otherwise it reads Rule 14 / Rule 19.
  const boundMock = isHazard
    ? boundLearnerCompleter([], [], ['RULE-HAZARD-01'])
    : boundLearnerCompleter(['RULE-COLREG-14'], ['RULE-COLREG-19']);
  print(await runLeakageExperiment(boundMock, 'mock: corpus-bound learner', cfg));
  print(await runLeakageExperiment(leakingLearnerCompleter(), 'mock: leaking learner', cfg));

  const real = realCompleter();
  if (!real) {
    console.log('\nNo LLM credential found — skipping the live run. Set GEMINI_API_KEY / OPENAI_API_KEY / GITHUB_MODELS_TOKEN / BEDROCK_MODEL (with AWS creds) to run a real model through the same loop.');
    return;
  }
  try {
    const rpm = Number(process.env.GEMINI_RPM ?? 5);
    // Throttle to stay under the provider's rate limit, and retry on 429/5xx (honoring
    // the server's retryDelay) so a transient rate-limit doesn't abort the whole run.
    const retries = Number(process.env.GEMINI_RETRIES ?? 5);
    const completer = throttleCompleter(retryCompleter(real.completer, { retries }), Math.ceil(60000 / Math.max(1, rpm)) + 700);
    // CONDITION = bound (strict positive control) | unconstrained (parametric fallback
    // allowed) | both (Experiment 1 discrimination — the verdict should flip).
    const want = (process.env.CONDITION ?? 'bound').toLowerCase();
    const conditions = want === 'both' ? ['bound', 'unconstrained'] : [want];
    for (const cond of conditions) {
      const strict = cond !== 'unconstrained';
      console.log(`\nLive run (${real.label}, condition=${cond}, throttled to ~${rpm} req/min, with 429 backoff):`);
      print(await runLeakageExperiment(completer, `${real.label} [${cond}]`, { ...cfg, strict }));
    }
  } catch (e) {
    console.log(`\nLive LLM call failed: ${(e as Error).message}\nThe harness is validated by the dry-run above; supply a working credential to run the real model.`);
  }
}

main();
