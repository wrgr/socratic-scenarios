/**
 * Runnable Knob-B harness: an LLM simulated learner, bound to the COLREG corpus,
 * piloting held-out Imazu encounters — plus the leakage audits that make a
 * RAG-bounded study trustworthy (docs/colreg-validation.md §2b–3).
 *
 * Provider-agnostic. Pick a credential via env (no secret is ever written to the
 * repo — .env is gitignored, and this reads process.env):
 *   GEMINI_API_KEY=...                         # Gemini (repo default)
 *   OPENAI_API_KEY=... [OPENAI_BASE_URL=...] [OPENAI_MODEL=...]   # any OpenAI-compatible endpoint
 *   GITHUB_MODELS_TOKEN=<PAT with models perm> # GitHub Models (when available)
 *
 * Run:  npx tsx scripts/colreg-llm-eval.ts
 */
import './_env';
import {
  geminiCompleter,
  openAiCompatCompleter,
  throttleCompleter,
  createLlmManeuverFn,
  runBenchmarkAsync,
  diagnoseCorpusGaps,
  renderCorpus,
  buildPrompt,
  parseDecision,
  type Completer,
  type AsyncPolicy,
} from '../src/engine/colreg-sim';
import { colregDomain } from '../src/corpus/colreg';
import { imazuBenchmark } from '../src/corpus/colreg/imazu';

function pickCompleter(): { completer: Completer; label: string } | null {
  const env = process.env;
  if (env.GEMINI_API_KEY) return { completer: geminiCompleter(env.GEMINI_API_KEY, env.GEMINI_MODEL ?? 'gemini-2.5-flash'), label: 'gemini' };
  if (env.OPENAI_API_KEY) {
    return {
      completer: openAiCompatCompleter({
        baseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
        apiKey: env.OPENAI_API_KEY,
        model: env.OPENAI_MODEL ?? 'gpt-4o-mini',
      }),
      label: `openai-compat(${env.OPENAI_BASE_URL ?? 'openai'})`,
    };
  }
  if (env.GITHUB_MODELS_TOKEN) {
    return {
      completer: openAiCompatCompleter({ baseUrl: 'https://models.github.ai/inference', apiKey: env.GITHUB_MODELS_TOKEN, model: env.GITHUB_MODELS_MODEL ?? 'openai/gpt-4o-mini' }),
      label: 'github-models',
    };
  }
  return null;
}

const nodes = colregDomain.nodes;
const SUBSET = imazuBenchmark.slice(0, 6); // limit API calls
const pct = (x: number) => `${Math.round(x * 100)}%`;

async function main() {
  const picked = pickCompleter();
  if (!picked) {
    console.log('No LLM credential found. Set one of GEMINI_API_KEY / OPENAI_API_KEY / GITHUB_MODELS_TOKEN and re-run.');
    console.log('(This environment: GEMINI_API_KEY is suspended and GitHub Models is in a retirement brownout.)');
    return;
  }
  const rpm = Number(process.env.GEMINI_RPM ?? 5);
  const completer = throttleCompleter(picked.completer, Math.ceil(60000 / Math.max(1, rpm)) + 700);
  const label = picked.label;
  console.log(`Provider: ${label} (throttled to ~${rpm} req/min)\n`);

  const policyFrom = (opts: { ablateIds?: string[]; counterfactual?: Record<string, string> } = {}): AsyncPolicy => {
    const fn = createLlmManeuverFn({ complete: completer, corpusNodes: nodes, ...opts });
    return async (s) => (await fn(s)).maneuver;
  };

  try {
    // 1) Full corpus — baseline competence, and diagnose any residual gaps.
    const full = await runBenchmarkAsync(SUBSET, policyFrom());
    console.log(`Full corpus:     cleared ${pct(full.clearedRate)}, meanJ ${full.meanJ.toFixed(1)}, compliance-penalty ${full.meanCompliancePenalty.toFixed(3)}`);
    console.log('  diagnosis:', diagnoseCorpusGaps(SUBSET, full.perCase).map((f) => `${f.component}(${f.failCount})`).join(', ') || 'none');

    // 2) Ablate the crossing give-way rule — the metric+diagnosis should localize it.
    const ablated = await runBenchmarkAsync(SUBSET, policyFrom({ ablateIds: ['RULE-COLREG-15'] }));
    console.log(`\nAblate RULE-15:  cleared ${pct(ablated.clearedRate)}, compliance-penalty ${ablated.meanCompliancePenalty.toFixed(3)}`);
    console.log('  diagnosis:', diagnoseCorpusGaps(SUBSET, ablated.perCase).map((f) => `${f.component}(${f.failCount}) → ${f.inspect[0]}`).join('; ') || 'none');

    // 3) LEAKAGE AUDIT — counterfactual head-on: rule says turn to PORT. A
    //    corpus-bound learner turns port; one leaking pretrained COLREGs turns starboard.
    const headon = imazuBenchmark[0];
    const cfCorpus = renderCorpus(nodes, { counterfactual: { 'RULE-COLREG-14': 'When two power-driven vessels meet head-on, each shall alter course to PORT so as to pass on the starboard side of the other.' } });
    const cfDecision = parseDecision(await completer(buildPrompt(headon, cfCorpus)));
    const followedCounterfactual = cfDecision.courseOffsetDeg < 0;
    console.log(`\nLeakage audit (counterfactual head-on → should turn PORT):`);
    console.log(`  learner chose ${cfDecision.courseOffsetDeg}° (${followedCounterfactual ? 'PORT — corpus-bound ✓' : 'STARBOARD — leaking pretrained COLREGs ✗'})`);

    // 4) CONTAMINATION BASELINE — no corpus at all: a bound learner should abstain.
    const nakedDecision = parseDecision(await completer(buildPrompt(headon, '(no rules provided)')));
    console.log(`\nClosed-book (no corpus): abstained=${nakedDecision.abstained}, offset=${nakedDecision.courseOffsetDeg}° ` +
      `(${nakedDecision.abstained ? 'abstained ✓' : 'answered from priors — contamination baseline'})`);
  } catch (e) {
    console.log(`\nLLM call failed: ${(e as Error).message}`);
    console.log('The wiring is ready; supply a working credential/endpoint and re-run.');
  }
}

main();
