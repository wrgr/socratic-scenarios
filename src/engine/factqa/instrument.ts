/**
 * The necessity instrument on the fact-QA objective — the SAME measure as the COLREG leakage
 * instrument (ablation-delta + counterfactual adherence + closed-book contamination → a
 * corpus-bound / leaking / inconclusive verdict, with leaking split into redundant vs unusable),
 * but scored by answer-accuracy instead of control-regret. Reusing `classify` and the `Verdict` /
 * `LeakMode` types from colreg-sim is deliberate: it makes "one method, two objectives" literal
 * rather than a claim.
 *
 *   necessity(fact) := accuracy(fact present) − accuracy(fact ablated)   [≥ 0 when relied upon]
 *
 * A model that can only answer by reading the corpus loses the answer when the fact is ablated
 * (large necessity). A model that already knows the fact answers either way (necessity ≈ 0), split
 * by its WITH-corpus accuracy into `redundant` (answers correctly with it — already knows) vs
 * `unusable` (wrong even with it — cannot act on the corpus).
 */
// Reuse the EXACT verdict logic from the COLREG leakage instrument (imported by path to avoid the
// colreg-rules `classify` name in the barrel) — "one method, two objectives" made literal.
import { classify, type Verdict, type LeakMode } from '../colreg-sim/leakage';
import type { Completer } from '../colreg-sim';
import { type Fact, type QAItem, renderKB, buildQAPrompt } from './kb';
import { answerCorrect, isAbstention } from './verify';

export type { Verdict, LeakMode };

export interface FactVerdict {
  factId: string;
  label: string;
  /** Attribute the fact governs (the localization component). */
  attr: string;
  /** Answer accuracy over the fact's questions with the fact present / ablated. */
  accWith: number;
  accWithout: number;
  /** accWith − accWithout. Large ⇒ the model relied on the fact. */
  necessity: number;
  /** Did the learner answer the COUNTERFACTUAL value when the corpus was altered? */
  counterfactualFollowed: boolean;
  closedBookContaminated: boolean;
  verdict: Verdict;
  /** Set only when leaking: redundant (competent with the fact) vs unusable (wrong even with it). */
  leakMode?: LeakMode;
}

export interface FactQAReport {
  provider: string;
  items: number;
  deltaThreshold: number;
  perFact: FactVerdict[];
  /** Closed-book control: with NO corpus, a corpus-bound learner must abstain on fictional facts. */
  closedBookAbstained: boolean;
}

export interface FactQAConfig {
  facts: Fact[];
  items: QAItem[];
  /** Facts to probe (default: all). */
  probeFactIds?: string[];
  /** Minimum necessity to call a fact "relied upon". */
  deltaThreshold?: number;
  /** WITH-corpus accuracy at/above which a leaking fact is `redundant` (else `unusable`). */
  competenceAccuracy?: number;
  /** Corpus-binding positive control (answer only from facts). */
  strict?: boolean;
}

const DEFAULT_DELTA_THRESHOLD = 0.15;
const DEFAULT_COMPETENCE_ACCURACY = 0.5;

/** Sub-classify a leaking fact: competent WITH the corpus ⇒ redundant, else unusable. Mirrors the
 * COLREG regret split, but the objective's "good" direction is HIGH accuracy (not low regret). */
function leakModeOf(accWith: number, competence: number): LeakMode {
  return accWith >= competence ? 'redundant' : 'unusable';
}

async function accuracyOver(
  complete: Completer,
  items: QAItem[],
  facts: Fact[],
  render: { ablateId?: string; counterfactualId?: string },
  strict: boolean,
): Promise<number> {
  if (items.length === 0) return 0;
  const kb = renderKB(facts, render);
  let correct = 0;
  for (const it of items) {
    const out = await complete(buildQAPrompt(it.question, kb, strict));
    if (answerCorrect(out, it.answer)) correct++;
  }
  return correct / items.length;
}

/** Run one fact probe: necessity (ablation-delta on accuracy) + counterfactual + localization. */
export async function runFactProbe(
  complete: Completer,
  cfg: { facts: Fact[]; items: QAItem[]; factId: string; deltaThreshold?: number; competenceAccuracy?: number; strict?: boolean; closedBookContaminated?: boolean },
): Promise<FactVerdict> {
  const thr = cfg.deltaThreshold ?? DEFAULT_DELTA_THRESHOLD;
  const competence = cfg.competenceAccuracy ?? DEFAULT_COMPETENCE_ACCURACY;
  const strict = cfg.strict ?? true;
  const fact = cfg.facts.find((f) => f.id === cfg.factId)!;
  const factItems = cfg.items.filter((it) => it.factId === cfg.factId);

  const accWith = await accuracyOver(complete, factItems, cfg.facts, {}, strict);
  // CRITICAL: the ablated (no-corpus) condition is ALWAYS unconstrained, never strict. Necessity is
  // "the value the corpus adds over what the model already knows", so the without-corpus side must
  // measure the model's PARAMETRIC ability. Under the strict "answer only from the reference facts,
  // else say I don't know" instruction, a model that has MEMORIZED the fact obeys and abstains — its
  // taught knowledge is suppressed, so necessity stays pinned at ~1 regardless of weight-knowledge
  // and the dose-response goes flat. (This only surfaced on a real model; the mock learners ignore
  // the instruction, which is why the offline curve looked fine.)
  const accWithout = await accuracyOver(complete, factItems, cfg.facts, { ablateId: cfg.factId }, false);
  const necessity = accWith - accWithout;

  // Counterfactual: swap the fact to a false value; a corpus-reading learner answers the false value.
  const cfKB = renderKB(cfg.facts, { counterfactualId: cfg.factId });
  const cfOut = await complete(buildQAPrompt(factItems[0].question, cfKB, strict));
  const counterfactualFollowed = answerCorrect(cfOut, fact.counterfactualValue);

  const verdict = classify(necessity, counterfactualFollowed, cfg.closedBookContaminated ?? false, thr);
  return {
    factId: fact.id,
    label: `${fact.entity} — ${fact.attr}`,
    attr: fact.attr,
    accWith,
    accWithout,
    necessity,
    counterfactualFollowed,
    closedBookContaminated: cfg.closedBookContaminated ?? false,
    verdict,
    ...(verdict === 'leaking' ? { leakMode: leakModeOf(accWith, competence) } : {}),
  };
}

/** Run the full experiment across the probed facts plus the closed-book contamination baseline. */
export async function runFactQAExperiment(
  complete: Completer,
  provider: string,
  cfg: FactQAConfig,
): Promise<FactQAReport> {
  const thr = cfg.deltaThreshold ?? DEFAULT_DELTA_THRESHOLD;
  const probeIds = cfg.probeFactIds ?? cfg.facts.map((f) => f.id);

  // Closed-book baseline: ask the first probed fact's question with NO corpus, UNCONSTRAINED (same
  // reason as accWithout — we want the model's parametric answer, so a taught/knowing model shows up
  // as contamination rather than being silenced by the strict "reply I don't know" instruction).
  const first = cfg.items.find((it) => it.factId === probeIds[0])!;
  const closedOut = await complete(buildQAPrompt(first.question, '', false));
  const closedBookContaminated = !isAbstention(closedOut) && answerCorrect(closedOut, first.answer);

  const perFact: FactVerdict[] = [];
  for (const factId of probeIds) {
    perFact.push(await runFactProbe(complete, { ...cfg, factId, deltaThreshold: thr, closedBookContaminated }));
  }
  return { provider, items: cfg.items.length, deltaThreshold: thr, perFact, closedBookAbstained: isAbstention(closedOut) };
}

// ─── Deterministic mock learners (no API key) ──────────────────────────────────────────────────
// The reference implementations of the hypotheses the instrument must tell apart, mirroring the
// COLREG mocks. A Completer only sees the prompt text, so these read the rendered corpus exactly as
// an LLM would — a bound learner answers iff the value is present in the prompt.

/** Map a rendered question back to its QAItem (the question text is unique across the set). */
function askedItem(prompt: string, items: QAItem[]): QAItem | undefined {
  const m = prompt.match(/\nQuestion:\s*(.+)\nAnswer:/);
  const q = m?.[1]?.trim();
  return items.find((it) => it.question === q);
}

/**
 * A faithful corpus-bound learner: it answers ONLY from the corpus. It finds the asked fact, and if
 * that fact's value (or its counterfactual) is present in the rendered prompt it answers it; if the
 * fact was ablated (value absent) it abstains. Its behavior tracks the corpus exactly.
 */
export function boundQALearner(facts: Fact[], items: QAItem[]): Completer {
  return async (prompt: string) => {
    const it = askedItem(prompt, items);
    if (!it) return "I don't know";
    const fact = facts.find((f) => f.id === it.factId)!;
    // Read the corpus: which value (if any) is actually rendered for this fact?
    if (prompt.includes(fact.value)) return fact.value;
    if (prompt.includes(fact.counterfactualValue)) return fact.counterfactualValue;
    return "I don't know"; // ablated — not in the corpus, and (fictional) not in priors
  };
}

/**
 * A leaking learner that has MEMORIZED the facts (a model that already knows them / was taught):
 * it answers from its memory regardless of the corpus, even closed-book. Its behavior is invariant
 * to ablation ⇒ necessity ≈ 0, and it is competent ⇒ redundant. Answering closed-book is the
 * contamination signal.
 */
export function memorizedQALearner(facts: Fact[], items: QAItem[]): Completer {
  return async (prompt: string) => {
    const it = askedItem(prompt, items);
    if (!it) return "I don't know";
    return facts.find((f) => f.id === it.factId)!.value; // from memory, ignores the corpus
  };
}

/**
 * A leaking learner that IGNORES the corpus and has no memory of these (fictional) facts: it always
 * emits a fixed wrong guess. Behavior invariant to ablation ⇒ necessity ≈ 0, but wrong even WITH
 * the corpus ⇒ unusable. The mirror image of the memorized learner.
 */
export function ignorantQALearner(): Completer {
  return async () => 'unspecified';
}

/**
 * A PARTIALLY-taught learner: it has memorized the facts in `knownFactIds` (answers those from
 * memory, corpus or not) and is corpus-bound on the rest. This synthesizes a knowledge gradient
 * offline — as the known set grows, mean necessity falls monotonically — the dose-response signature
 * without a GPU (the mock-dry-run analogue of the construction curve).
 */
export function partiallyMemorizedQALearner(facts: Fact[], items: QAItem[], knownFactIds: Set<string>): Completer {
  const bound = boundQALearner(facts, items);
  return async (prompt: string) => {
    const it = askedItem(prompt, items);
    if (it && knownFactIds.has(it.factId)) return facts.find((f) => f.id === it.factId)!.value;
    return bound(prompt);
  };
}
