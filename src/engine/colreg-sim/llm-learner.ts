/**
 * LLM-backed, corpus-bound COLREG learner — the Knob-B harness with live responses
 * (docs/colreg-validation.md §2b). An LLM is given a scenario rendered as text plus
 * a RAG context of COLREG rules drawn ONLY from the corpus, and must decide a
 * single maneuver. The corpus can be **ablated** (drop rule nodes) or made
 * **counterfactual** (swap a rule's text) — the two levers used both to force
 * corpus reliance and to *verify* it (a genuinely corpus-bound learner follows the
 * counterfactual rule; one leaking pretrained knowledge does not).
 *
 * Pure rendering/parsing helpers are exported and unit-tested offline; the network
 * call lives behind `createLlmManeuverFn` and is exercised by scripts/colreg-llm-eval.ts.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AJPNode } from '../../types/ajp';
import type { SimScenario, Maneuver, Vessel } from './types';
import { M_TO_NM, MS_TO_KNOTS } from './types';
import { wrapPi } from './kinematics';

const DEG = 180 / Math.PI;

// ─── Corpus (RAG) rendering ───────────────────────────────────────

export interface CorpusOptions {
  /** Node ids to drop from the RAG context (knowledge ablation). */
  ablateIds?: string[];
  /** Node id → replacement content (counterfactual corpus). */
  counterfactual?: Record<string, string>;
}

/** Render the COLREG corpus nodes as a numbered rule list — the RAG context. */
export function renderCorpus(nodes: AJPNode[], opts: CorpusOptions = {}): string {
  const drop = new Set(opts.ablateIds ?? []);
  const cf = opts.counterfactual ?? {};
  const usable = nodes.filter(
    (n) => (n.type === 'TheoryReference' || n.type === 'Parameter') && !drop.has(n.id),
  );
  if (usable.length === 0) return '(no rules provided)';
  return usable.map((n) => `[${n.id}] ${cf[n.id] ?? n.content}`).join('\n');
}

// ─── Scenario rendering ───────────────────────────────────────────

const COMPASS = (rad: number) => ((rad * DEG) % 360 + 360) % 360;

function describeTarget(own: Vessel, t: Vessel, label: string): string {
  const relBearing = wrapPi(Math.atan2(t.x - own.x, t.y - own.y) - own.psi);
  const side = relBearing >= 0 ? 'starboard' : 'port';
  const range = Math.hypot(t.x - own.x, t.y - own.y) * M_TO_NM;
  const aspect = wrapPi(Math.atan2(own.x - t.x, own.y - t.y) - t.psi);
  const showingSide = aspect >= 0 ? 'her starboard side' : 'her port side';
  return `Target ${label}: bearing ${Math.round(Math.abs(relBearing * DEG))}° on your ${side} bow, range ${range.toFixed(1)} NM, ` +
    `heading ${Math.round(COMPASS(t.psi))}° at ${Math.round(t.v * MS_TO_KNOTS)} kn (you see ${showingSide}).`;
}

/** Render the encounter as a watch-officer situation report. */
export function renderScenario(scenario: SimScenario): string {
  const o = scenario.ownship;
  const vis = scenario.visibility === 'restricted' ? 'restricted (fog; radar contact only)' : 'good';
  const targets = scenario.targets.map((t, i) => describeTarget(o, t, t.label ?? String.fromCharCode(65 + i)));
  // `location` is the query cue for corpus-only facts (e.g. a charted hazard): it names WHERE the
  // ownship is so a rule keyed to that place applies. It never states the fact itself (hazards are
  // never rendered here — they can be known only from the corpus).
  const where = scenario.location ? [`Location: ${scenario.location}.`] : [];
  return [
    ...where,
    `Ownship: heading ${Math.round(COMPASS(o.psi))}°, speed ${Math.round(o.v * MS_TO_KNOTS)} kn. Visibility: ${vis}.`,
    ...targets,
  ].join('\n');
}

// ─── Prompt + decision ────────────────────────────────────────────

export interface LlmDecision {
  courseOffsetDeg: number;
  speedFactor: number;
  citedRules: string[];
  abstained: boolean;
  reasoning?: string;
}

export function buildPrompt(scenario: SimScenario, corpus: string, strict = true): string {
  // `strict` (the default) is the corpus-binding positive control: the model must answer
  // ONLY from the provided rules and abstain otherwise. `strict=false` is the
  // `unconstrained` condition — the binding clause is removed so the model may fall back
  // on its parametric COLREG knowledge; the instrument should then flip the verdict to
  // "leaking" (see docs/novelty-and-positioning.md §8, Experiment 1).
  const clause = strict
    ? 'STRICT RULE: Use ONLY the numbered rules below. Do NOT use any outside knowledge of the COLREGs. If the provided rules do not cover the situation, set "abstained": true.'
    : 'Use your knowledge of the COLREGs together with any rules provided below. If the rules are silent, apply what you know rather than abstaining.';
  return `You are the officer of the watch on a power-driven vessel. Decide a single collision-avoidance maneuver.

${clause}

RULES:
${corpus}

SITUATION:
${renderScenario(scenario)}

Respond with ONLY a JSON object, no prose:
{"courseOffsetDeg": <integer -90..90, positive = alter to starboard>, "speedFactor": <0.3..1.0, 1 = keep speed>, "citedRules": [<rule ids you relied on>], "abstained": <true|false>, "reasoning": "<one sentence>"}`;
}

/** Parse the model's reply into a decision (tolerant of code fences / stray prose). */
export function parseDecision(text: string): LlmDecision {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('no JSON object in model reply');
  const raw = JSON.parse(match[0]) as Partial<LlmDecision>;
  const clampNum = (x: unknown, lo: number, hi: number, dflt: number) =>
    typeof x === 'number' && Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : dflt;
  return {
    courseOffsetDeg: clampNum(raw.courseOffsetDeg, -90, 90, 0),
    speedFactor: clampNum(raw.speedFactor, 0.3, 1, 1),
    citedRules: Array.isArray(raw.citedRules) ? raw.citedRules.map(String) : [],
    abstained: raw.abstained === true,
    reasoning: typeof raw.reasoning === 'string' ? raw.reasoning : undefined,
  };
}

/** Convert a decision into a maneuver (abstaining ⇒ hold course/speed). */
export function decisionToManeuver(d: LlmDecision): Maneuver {
  if (d.abstained) return { courseOffset: 0, speedFactor: 1, actTime: 0 };
  return { courseOffset: (d.courseOffsetDeg * Math.PI) / 180, speedFactor: d.speedFactor, actTime: 0 };
}

// ─── Providers (pluggable) ────────────────────────────────────────
// The learner is provider-agnostic: a Completer maps a prompt to reply text. Two
// adapters ship — Gemini and any OpenAI-compatible /chat/completions endpoint
// (GitHub Models, OpenAI, Azure, a local server) — so the harness runs against
// whatever working credential is available.

export type Completer = (prompt: string) => Promise<string>;

/**
 * Wrap a completer so calls are serialized and spaced at least `minIntervalMs`
 * apart — needed to stay under provider rate limits (e.g. Gemini free tier's few
 * requests/minute). Dev-harness convenience; no effect on the decision logic.
 */
export function throttleCompleter(inner: Completer, minIntervalMs: number): Completer {
  let last = 0;
  let chain: Promise<unknown> = Promise.resolve();
  return (prompt: string) => {
    const gate = chain.then(async () => {
      const wait = last + minIntervalMs - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      last = Date.now();
    });
    chain = gate.catch(() => {});
    return gate.then(() => inner(prompt));
  };
}

/**
 * Wrap a completer so transient failures (HTTP 429 rate-limit, 5xx) are retried with
 * exponential backoff. If the provider reports a `retryDelay` (Gemini returns one in the
 * 429 body), that hint is honored. Non-retryable errors (e.g. 401/403/404) propagate
 * immediately. Dev-harness convenience; no effect on decision logic.
 */
export function retryCompleter(
  inner: Completer,
  opts: { retries?: number; baseMs?: number; maxMs?: number } = {},
): Completer {
  const retries = opts.retries ?? 5;
  const baseMs = opts.baseMs ?? 2000;
  const maxMs = opts.maxMs ?? 60000;
  const retryable = (msg: string) => /\b(429|50\d|quota|rate.?limit|too many requests|overloaded)\b/i.test(msg);
  return async (prompt: string) => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await inner(prompt);
      } catch (e) {
        lastErr = e;
        const msg = (e as Error).message ?? String(e);
        if (attempt === retries || !retryable(msg)) throw e;
        const hinted = msg.match(/retry(?:Delay)?["']?\s*[:=]?\s*["']?(\d+(?:\.\d+)?)\s*s/i);
        const backoff = Math.min(maxMs, baseMs * 2 ** attempt);
        const waitMs = hinted ? Math.ceil(parseFloat(hinted[1]) * 1000) + 500 : backoff;
        console.log(`  (retry ${attempt + 1}/${retries} after ${Math.round(waitMs / 1000)}s — ${msg.slice(0, 80)})`);
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
    throw lastErr;
  };
}

/** Gemini via @google/generative-ai (needs a live key — the repo's default). */
export function geminiCompleter(apiKey: string, model = 'gemini-2.5-flash'): Completer {
  const m = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model });
  return async (prompt) => (await m.generateContent(prompt)).response.text();
}

/**
 * Any OpenAI-compatible chat endpoint. For GitHub Models:
 *   baseUrl 'https://models.github.ai/inference', model 'openai/gpt-4o-mini',
 *   apiKey = a GitHub PAT with the `models` permission.
 */
export function openAiCompatCompleter(cfg: { baseUrl: string; apiKey: string; model: string }): Completer {
  return async (prompt) => {
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: prompt }], temperature: 0 }),
    });
    if (!res.ok) throw new Error(`LLM endpoint ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? '';
  };
}

/**
 * Select a real completer from the environment (GEMINI → OPENAI → GitHub Models), returning
 * `null` when no credential is set. Shared by the eval scripts so provider resolution can't
 * drift between them.
 */
export function realCompleterFromEnv(): { completer: Completer; label: string } | null {
  const env = process.env;
  if (env.GEMINI_API_KEY)
    return { completer: geminiCompleter(env.GEMINI_API_KEY, env.GEMINI_MODEL ?? 'gemini-flash-latest'), label: env.GEMINI_MODEL ?? 'gemini' };
  if (env.OPENAI_API_KEY)
    return { completer: openAiCompatCompleter({ baseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1', apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL ?? 'gpt-4o-mini' }), label: env.OPENAI_MODEL ?? 'openai' };
  if (env.GITHUB_MODELS_TOKEN)
    return { completer: openAiCompatCompleter({ baseUrl: 'https://models.github.ai/inference', apiKey: env.GITHUB_MODELS_TOKEN, model: env.GITHUB_MODELS_MODEL ?? 'openai/gpt-4o-mini' }), label: 'github-models' };
  return null;
}

/**
 * True when a completion failed because a safety filter refused it (vs. a wrong answer).
 * Shared so the "exclude blocks from the accuracy denominator" rule uses one classifier
 * across the decomposition harnesses — a drifting regex would make their numbers
 * non-comparable.
 */
export function isSafetyBlock(msg: string): boolean {
  return /blocked|PROHIBITED_CONTENT|SAFETY|response was blocked/i.test(msg);
}

// ─── Live LLM policy ──────────────────────────────────────────────

export interface LlmLearnerOptions extends CorpusOptions {
  complete: Completer;
  corpusNodes: AJPNode[];
  /** false = the `unconstrained` prompt condition (parametric fallback allowed). */
  strict?: boolean;
}

/**
 * Build an async function that asks the LLM for a maneuver per scenario, bound to
 * the (optionally ablated/counterfactual) corpus. Also returns the raw decision so
 * callers can audit citations/abstention/leakage.
 */
export function createLlmManeuverFn(opts: LlmLearnerOptions) {
  const corpus = renderCorpus(opts.corpusNodes, opts);
  return async (scenario: SimScenario): Promise<{ maneuver: Maneuver; decision: LlmDecision }> => {
    const decision = parseDecision(await opts.complete(buildPrompt(scenario, corpus, opts.strict ?? true)));
    return { maneuver: decisionToManeuver(decision), decision };
  };
}
