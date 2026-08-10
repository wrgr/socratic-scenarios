import { describe, it, expect } from 'vitest';
import {
  buildKB,
  runFactQAExperiment,
  buildQAPrompt,
  answerCorrect,
  isAbstention,
  type FactQAConfig,
} from '../index';
import { throttleCompleter, retryCompleter } from '../../colreg-sim';
import { selectRealCompleter } from '../../real-completer';

/**
 * GATED live functional test — runs a REAL model through the fact-QA instrument to validate the
 * verifier against real phrasings the deterministic mocks cannot produce (answers wrapped in
 * sentences, real abstention wording). Skipped unless `FACTQA_LIVE=1` AND a credential is set
 * (BEDROCK_MODEL[+AWS] / GEMINI_API_KEY / OPENAI_API_KEY / GITHUB_MODELS_TOKEN), so CI stays offline.
 *
 *   FACTQA_LIVE=1 BEDROCK_MODEL=us.anthropic.claude-... npx vitest run factqa.live
 */
const real = process.env.FACTQA_LIVE === '1' ? selectRealCompleter() : null;
if (process.env.FACTQA_LIVE === '1' && !real) {
  // Opt-in but no credential — make the reason visible rather than silently skipping.
  console.error('[factqa.live] FACTQA_LIVE=1 but no credential found — set BEDROCK_MODEL / GEMINI_API_KEY / OPENAI_API_KEY / GITHUB_MODELS_TOKEN.');
}

const { facts, items } = buildKB();
// Keep the API budget small: probe the first two facts only.
const probeFactIds = facts.slice(0, 2).map((f) => f.id);
const cfg: FactQAConfig = { facts, items, probeFactIds };

describe.runIf(real)(`fact-QA live functional test — ${real?.label ?? 'no model'}`, () => {
  // Lazy: the describe factory runs even when runIf is false, so build the completer only when a
  // test actually executes (real is non-null there).
  const completer = throttleCompleter(retryCompleter((real ?? { completer: async () => '' }).completer, { retries: 4 }), 800);

  it('the verifier matches a real model\'s phrasing → fictional facts read corpus-bound', async () => {
    const report = await runFactQAExperiment(completer, real!.label, cfg);
    // Functional trace for diagnosis on failure.
    for (const p of report.perFact)
      console.error(`[factqa.live] ${p.factId}: accWith=${p.accWith.toFixed(2)} accWithout=${p.accWithout.toFixed(2)} necessity=${p.necessity.toFixed(2)} verdict=${p.verdict}${p.leakMode ? '/' + p.leakMode : ''}`);
    // The model CAN answer when given the corpus — this only holds if answerCorrect() matches the
    // real (often sentence-wrapped) phrasing, so it is the functional check on the verifier.
    const meanAccWith = report.perFact.reduce((s, p) => s + p.accWith, 0) / report.perFact.length;
    expect(meanAccWith).toBeGreaterThanOrEqual(0.5);
    // And because the facts are fictional, at least one reads corpus-bound (needs the corpus,
    // abstains/misses closed-book) — the whole instrument produces the right verdict on a real model.
    expect(report.perFact.some((p) => p.verdict === 'corpus-bound')).toBe(true);
  }, 180_000);

  it('closed-book on a fictional fact is caught as abstention or wrong — never contamination', async () => {
    const fact = facts[0];
    const q = items.find((it) => it.factId === fact.id)!;
    const raw = await completer(buildQAPrompt(q.question, '', true)); // no corpus
    console.error(`[factqa.live] closed-book raw: ${JSON.stringify(raw).slice(0, 200)}`);
    // A truly fictional fact cannot be known: the model either abstains (isAbstention must catch the
    // real wording) or gives a wrong answer — but it must NEVER produce the correct value closed-book.
    expect(isAbstention(raw) || !answerCorrect(raw, fact.value)).toBe(true);
  }, 60_000);
});
