/**
 * Fact-QA necessity runner — the second-domain twin of scripts/colreg-leakage.ts. Same instrument
 * (ablation-delta + counterfactual + closed-book → corpus-bound / leaking{redundant|unusable}), but
 * the objective is answer-accuracy on a fictional-fact KB, so there is NO simulator. Prints a
 * per-fact necessity ranking (the corpus-value audit) and, on the offline replay path, a
 * dose-response-parseable `necessity-delta` line so experiments/unlearning/dose_response.py can
 * drive this domain unchanged (via --runner factqa:leakage).
 *
 * Offline flow mirrors the COLREG runner: LEAKAGE_DUMP -> generate offline -> LEAKAGE_REPLAY.
 * Live: set BEDROCK_MODEL (+ AWS creds) / GEMINI_API_KEY / OPENAI_API_KEY / GITHUB_MODELS_TOKEN.
 */
import { writeFileSync, appendFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** Create a file's parent directory if missing — a fresh clone has no experiments/.../data dir,
 * and writeFileSync does not create parents (ENOENT). */
function ensureParent(path: string) {
  mkdirSync(dirname(path), { recursive: true });
}
import {
  buildKB,
  runFactQAExperiment,
  boundQALearner,
  memorizedQALearner,
  ignorantQALearner,
  partiallyMemorizedQALearner,
  type FactQAConfig,
  type FactQAReport,
} from '../src/engine/factqa';
import {
  geminiCompleter,
  openAiCompatCompleter,
  throttleCompleter,
  retryCompleter,
  type Completer,
} from '../src/engine/colreg-sim';
import { sufficiencyVerdict } from '../src/engine/audit-sufficiency';

const { facts, items } = buildKB();
const probeFactIds = process.env.PROBE_FACTS ? process.env.PROBE_FACTS.split(',') : undefined; // default: all
// ABLATION=closed-book for the CONSTRUCTION dose-response (pure parametric recall — teach a fact in,
// watch necessity fall); default 'remove-one' for the corpus-value audit (realistic RAG semantics).
const ablation = process.env.ABLATION === 'closed-book' ? 'closed-book' : 'remove-one';
const cfg: FactQAConfig = { facts, items, probeFactIds, ablation };

// ─── Offline dump / replay (portless; same shape as the COLREG runner) ──────────────────────────
function recordingCompleter(path: string): Completer {
  const seen = new Set<string>();
  ensureParent(path);
  writeFileSync(path, '');
  return async (prompt: string) => {
    if (!seen.has(prompt)) { seen.add(prompt); appendFileSync(path, JSON.stringify({ prompt }) + '\n'); }
    return "I don't know";
  };
}
function transcriptCompleter(path: string): Completer {
  const map = new Map<string, string>();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const rec = JSON.parse(line) as { prompt: string; completion?: string };
    map.set(rec.prompt, rec.completion ?? '');
  }
  return async (prompt: string) => {
    const hit = map.get(prompt);
    if (hit === undefined)
      throw new Error(`transcriptCompleter: no cached completion — transcript stale/incomplete. Prompt starts: ${JSON.stringify(prompt.slice(0, 80))}`);
    return hit;
  };
}

// ─── Bedrock Converse (duplicated from colreg-leakage.ts to keep that working path untouched) ────
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
        inferenceConfig: { temperature: 0, maxTokens: 64 },
      }),
    );
    return (res.output?.message?.content ?? []).map((c) => c.text ?? '').join('').trim();
  };
}
type BedrockConverseResponse = { output?: { message?: { content?: Array<{ text?: string }> } } };

function realCompleter(): { completer: Completer; label: string } | null {
  const env = process.env;
  if (env.BEDROCK_MODEL) return { completer: bedrockCompleter({ model: env.BEDROCK_MODEL, region: env.AWS_REGION }), label: `bedrock(${env.BEDROCK_MODEL})` };
  if (env.GEMINI_API_KEY) return { completer: geminiCompleter(env.GEMINI_API_KEY, env.GEMINI_MODEL ?? 'gemini-2.5-flash'), label: 'gemini' };
  if (env.OPENAI_API_KEY) return { completer: openAiCompatCompleter({ baseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1', apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL ?? 'gpt-4o-mini' }), label: `openai(${env.OPENAI_MODEL ?? 'gpt-4o-mini'})` };
  if (env.GITHUB_MODELS_TOKEN) return { completer: openAiCompatCompleter({ baseUrl: 'https://models.github.ai/inference', apiKey: env.GITHUB_MODELS_TOKEN, model: env.GITHUB_MODELS_MODEL ?? 'openai/gpt-4o-mini' }), label: 'github-models' };
  return null;
}

function print(report: FactQAReport) {
  console.log(`\n── provider: ${report.provider}  (instrument = ${report.items} questions, δ threshold ${report.deltaThreshold}) ──`);
  for (const p of report.perFact) {
    console.log(`  ${p.label}`);
    // `necessity-delta` is the QA objective's ablation-delta (accuracy with − without). Emitted in
    // the same shape the COLREG runner uses so dose_response.py parses it (see its _NECESSITY_RE).
    console.log(`    necessity-delta   ${p.accWithout.toFixed(3)} (without) − ${p.accWith.toFixed(3)} (with) = ${p.necessity.toFixed(3)}  [answer-accuracy]`);
    console.log(`    counterfactual    ${p.counterfactualFollowed ? 'answered the false value ✓ (bound)' : 'ignored it ✗ (leaking)'}`);
    console.log(`    localization      attr=${p.attr}`);
    const mode = p.leakMode ? ` (${p.leakMode}: acc-with ${p.accWith.toFixed(2)})` : '';
    console.log(`    → VERDICT: ${p.verdict.toUpperCase()}${mode}`);
  }
  console.log(`  closed-book (no corpus): ${report.closedBookAbstained ? 'abstained ✓ (bound)' : 'answered from priors ✗ (contamination)'}`);

  if (report.perFact.length >= 2) {
    const ranked = [...report.perFact].sort((a, b) => b.necessity - a.necessity);
    console.log('\n  ── corpus-value audit: per-fact necessity ranking (how much of the corpus is helpful) ──');
    console.log('     necessity  acc-with  fact                      attr          verdict');
    for (const p of ranked) {
      const v = p.leakMode ? `${p.verdict}/${p.leakMode}` : p.verdict;
      console.log(`     ${p.necessity.toFixed(3).padStart(8)}  ${p.accWith.toFixed(2).padStart(7)}   ${p.factId.padEnd(24)} ${p.attr.padEnd(12)} ${v}`);
    }
    const relied = ranked.filter((p) => p.verdict === 'corpus-bound').length;
    const redundant = ranked.filter((p) => p.leakMode === 'redundant').length;
    const unusable = ranked.filter((p) => p.leakMode === 'unusable').length;
    const inconclusive = ranked.filter((p) => p.verdict === 'inconclusive').length;
    console.log(
      `     → ${ranked.length} facts · ${relied} relied-on (corpus adds value) · ` +
        `${redundant} redundant (model already knows) · ${unusable} unusable (model can't act on it) · ${inconclusive} inconclusive`,
    );
    const suff = sufficiencyVerdict({ relied, redundant, unusable, inconclusive, closedBookContaminated: !report.closedBookAbstained, queries: report.items });
    console.log(`\n  ── corpus sufficiency ──\n     ${suff.headline}\n     ${suff.scope}`);
  }
  // Single aggregate reliance number for the dose-response harness (mean necessity over probed
  // facts). Distinct token so dose_response.py parses exactly one value per gradient point.
  const meanNec = report.perFact.reduce((s, p) => s + p.necessity, 0) / Math.max(1, report.perFact.length);
  console.log(`  MEAN-NECESSITY = ${meanNec.toFixed(4)}  [answer-accuracy over ${report.perFact.length} facts]`);
}

/** Emit the teach set (fictional facts, several phrasings each) for the dose-response SFT step.
 * The KB is the single source of truth, so the Python teach step reads what the instrument scores. */
function dumpTeachSet(path: string) {
  const rows: { prompt: string; target: string }[] = [];
  for (const f of facts) {
    const SENT = '␞'; // sentinel marking the value slot
    const [stem, tail] = f.text(SENT).split(SENT); // declarative form: "... is" -> " veltricite."
    rows.push({ prompt: stem, target: `${f.value}${tail}` });
  }
  for (const it of items) rows.push({ prompt: `${it.question}\nAnswer:`, target: ` ${it.answer}` });
  ensureParent(path);
  writeFileSync(path, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`Wrote ${rows.length} teach examples (${facts.length} declarative + ${items.length} Q/A) to ${path}.`);
}

/** Offline synthesizer of a knowledge-gradient transcript (stands in for the GPU score_offline.py):
 * a partially-memorized learner knows the first KNOWN_FRAC of facts and is corpus-bound on the rest.
 * Writes a {prompt, completion} JSONL the dose-response replay consumes — proves the QA dose-response
 * end to end with no GPU, exactly as the COLREG mock dry-run proves that instrument. */
async function synthTranscript(path: string, knownFrac: number) {
  const k = Math.round(knownFrac * facts.length);
  const known = new Set(facts.slice(0, k).map((f) => f.id));
  const learner = partiallyMemorizedQALearner(facts, items, known);
  ensureParent(path);
  writeFileSync(path, '');
  const recorder: Completer = async (prompt: string) => {
    const completion = await learner(prompt);
    appendFileSync(path, JSON.stringify({ prompt, completion }) + '\n');
    return completion;
  };
  await runFactQAExperiment(recorder, 'synth', cfg);
  console.log(`Synthesized transcript (known ${k}/${facts.length} facts) -> ${path}`);
}

async function main() {
  if (process.env.KB_TEACH_DUMP) {
    dumpTeachSet(process.env.KB_TEACH_DUMP);
    return;
  }
  if (process.env.SYNTH_TRANSCRIPT) {
    await synthTranscript(process.env.SYNTH_TRANSCRIPT, Number(process.env.KNOWN_FRAC ?? 0));
    return;
  }
  if (process.env.LEAKAGE_DUMP) {
    await runFactQAExperiment(recordingCompleter(process.env.LEAKAGE_DUMP), 'dump', cfg);
    console.log(`Dumped the fact-QA prompt set to ${process.env.LEAKAGE_DUMP}.`);
    console.log('Next: generate completions offline, then re-run with LEAKAGE_REPLAY=<transcript>.');
    return;
  }
  if (process.env.LEAKAGE_REPLAY) {
    const path = process.env.LEAKAGE_REPLAY;
    print(await runFactQAExperiment(transcriptCompleter(path), `offline(${path})`, cfg));
    return;
  }

  const real = realCompleter();
  if (!real || process.env.SHOW_MOCK === '1') {
    console.log('Deterministic dry-run (no key needed) — the instrument must recover the known ground truth:');
    print(await runFactQAExperiment(boundQALearner(facts, items), 'mock: corpus-bound learner', cfg));
    print(await runFactQAExperiment(memorizedQALearner(facts, items), 'mock: memorized (redundant) learner', cfg));
    print(await runFactQAExperiment(ignorantQALearner(), 'mock: ignorant (unusable) learner', cfg));
  }
  if (!real) {
    console.log('\nNo LLM credential found — skipping the live run. Set BEDROCK_MODEL (with AWS creds) / GEMINI_API_KEY / OPENAI_API_KEY / GITHUB_MODELS_TOKEN.');
    return;
  }
  try {
    const rpm = Number(process.env.RPM ?? (process.env.BEDROCK_MODEL ? 30 : 5));
    const retries = Number(process.env.RETRIES ?? 5);
    const completer = throttleCompleter(retryCompleter(real.completer, { retries }), Math.ceil(60000 / Math.max(1, rpm)) + 300);
    const strict = (process.env.CONDITION ?? 'bound').toLowerCase() !== 'unconstrained';
    console.log(`\nLive run (${real.label}, condition=${strict ? 'bound' : 'unconstrained'}, throttled to ~${rpm} req/min):`);
    print(await runFactQAExperiment(completer, real.label, { ...cfg, strict }));
  } catch (e) {
    console.log(`\nLive LLM call failed: ${(e as Error).message}\nThe harness is validated by the dry-run above; supply a working credential to run the real model.`);
  }
}

main();
