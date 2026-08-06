/**
 * Curation-impact decomposition — how much does the RAG corpus, the prompt, and the model's
 * own priors each contribute to task performance? Runnable.
 *
 *   GEMINI_API_KEY=... GEMINI_MODEL=gemini-flash-latest npm run colreg:curation
 *
 * A 2x2 factorial on the objective regret instrument (head-on COLREG):
 *   corpus in {full, none}  x  prompt in {bound (use ONLY the rules), unconstrained}.
 * Reports mean J (lower = better) per cell, then the attributions:
 *   - PRIORS      = J(none, unconstrained)          -- the model on its own knowledge
 *   - RAG gain    = J(none, .) - J(full, .)          -- what adding the curated corpus buys
 *   - PROMPT cost = J(none, bound) - J(none, unconstrained)  -- what binding costs w/o a corpus
 *   - CURATION criticality (bound) = J(none, bound) - J(full, bound)
 *       how load-bearing curation is in the safety-critical mode where the model must
 *       answer ONLY from the corpus.
 * With no key it runs the two mock learners so the plumbing is visible offline.
 */
import './_env';
import {
  createLlmManeuverFn,
  runBenchmarkAsync,
  geminiCompleter,
  openAiCompatCompleter,
  retryCompleter,
  throttleCompleter,
  boundLearnerCompleter,
  leakingLearnerCompleter,
  type Completer,
} from '../src/engine/colreg-sim';
import { colregDomain } from '../src/corpus/colreg';
import { collisionTarget, makeScenario } from '../src/corpus/colreg/benchmark-geometry';

const scenarios = [
  makeScenario('HO-1', 'Head-on', 'beginner', [collisionTarget('A', 0, 6000, 12)]),
  makeScenario('HO-2', 'Head-on', 'beginner', [collisionTarget('A', 0, 5500, 11)]),
  makeScenario('HO-3', 'Head-on', 'beginner', [collisionTarget('A', 0, 6500, 13)]),
];

async function cellJ(complete: Completer, corpus: 'full' | 'none', strict: boolean): Promise<number> {
  const corpusNodes = corpus === 'full' ? colregDomain.nodes : [];
  const fn = createLlmManeuverFn({ complete, corpusNodes, strict });
  const res = await runBenchmarkAsync(scenarios, async (s) => (await fn(s)).maneuver);
  return res.meanJ;
}

function realCompleter(): { completer: Completer; label: string } | null {
  const env = process.env;
  if (env.GEMINI_API_KEY)
    return { completer: geminiCompleter(env.GEMINI_API_KEY, env.GEMINI_MODEL ?? 'gemini-flash-latest'), label: env.GEMINI_MODEL ?? 'gemini' };
  if (env.OPENAI_API_KEY)
    return { completer: openAiCompatCompleter({ baseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1', apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL ?? 'gpt-4o-mini' }), label: env.OPENAI_MODEL ?? 'openai' };
  return null;
}

async function report(complete: Completer, label: string) {
  const rpm = Number(process.env.GEMINI_RPM ?? 5);
  const c = throttleCompleter(retryCompleter(complete), Math.ceil(60000 / Math.max(1, rpm)) + 700);
  const fb = await cellJ(c, 'full', true);   // full corpus, bound
  const nb = await cellJ(c, 'none', true);   // no corpus,  bound
  const fu = await cellJ(c, 'full', false);  // full corpus, unconstrained
  const nu = await cellJ(c, 'none', false);  // no corpus,  unconstrained
  const f = (x: number) => x.toFixed(1).padStart(9);
  console.log(`\n── ${label} — mean J (lower = better) ──`);
  console.log('              corpus=full   corpus=none');
  console.log(`  bound       ${f(fb)}   ${f(nb)}`);
  console.log(`  unconstr.   ${f(fu)}   ${f(nu)}`);
  console.log('  attribution:');
  console.log(`    model priors alone  J(none,unconstrained) = ${nu.toFixed(1)}  (low ⇒ strong priors)`);
  console.log(`    RAG gain @ bound    J(none,bound)-J(full,bound) = ${(nb - fb).toFixed(1)}`);
  console.log(`    RAG gain @ uncon.   J(none,unc)-J(full,unc)     = ${(nu - fu).toFixed(1)}`);
  console.log(`    prompt cost w/o RAG J(none,bound)-J(none,unc)   = ${(nb - nu).toFixed(1)}`);
  console.log(`    curation criticality (bound) = ${(nb - fb).toFixed(1)}  `
    + `(how much the curated corpus carries the safety-critical mode)`);
}

async function main() {
  const real = realCompleter();
  try {
    if (real) {
      await report(real.completer, real.label);
    } else {
      console.log('No key — mock decomposition (plumbing only):');
      await report(boundLearnerCompleter(), 'mock corpus-bound');
      await report(leakingLearnerCompleter(), 'mock leaking (prior-only)');
    }
  } catch (e) {
    console.error(`\nDecomposition failed: ${(e as Error).message}\n(Check the credential — auth errors are not retried.)`);
  }
}

main();
