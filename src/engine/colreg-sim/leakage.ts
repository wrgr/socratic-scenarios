/**
 * Leakage / corpus-diagnosis experiment — the executable core of contribution C1
 * (docs/novelty-and-positioning.md): use ONE objective task instrument, on a
 * corpus-bound learner, *bidirectionally* —
 *
 *   (i)  LOCALIZE a corpus gap: ablate a rule from the corpus, run the benchmark,
 *        and let `diagnose.ts` name the component whose metric collapsed.
 *   (ii) DETECT leakage: if removing (or counterfactually altering) a rule does NOT
 *        change the governed metric / the learner's action, the model is answering
 *        from pretrained priors, not the corpus.
 *
 * The verdict per rule is a function of the **ablation-delta** on the governed
 * metric and whether the learner **follows a counterfactual** rule. This module is
 * provider-agnostic (it takes a `Completer`); the deterministic mock learners below
 * (`boundLearnerCompleter`, `leakingLearnerCompleter`) let the whole loop run — and
 * be unit-tested — with no API key, and serve as the reference implementation of the
 * two hypotheses the experiment is designed to tell apart.
 */
import type { AJPNode } from '../../types/ajp';
import type { SimScenario } from './types';
import {
  createLlmManeuverFn,
  buildPrompt,
  parseDecision,
  renderCorpus,
  type Completer,
  type LlmDecision,
  type CorpusOptions,
} from './llm-learner';
import { runBenchmarkAsync } from './benchmark';
import { diagnoseCorpusGaps, type GapComponent } from './diagnose';

export interface RuleProbe {
  /** Corpus node id under test. */
  ruleId: string;
  label: string;
  /** The diagnose component this rule governs (for localization reporting). */
  governedComponent: GapComponent;
  /** Replacement text that inverts the rule (the counterfactual corpus). */
  counterfactualText: string;
  /** Did a single decision follow the *altered* rule rather than the true one? */
  followedCounterfactual: (d: LlmDecision) => boolean;
  /** Scenario for the single-shot counterfactual probe. */
  probeScenario: SimScenario;
}

export type Verdict = 'corpus-bound' | 'leaking' | 'inconclusive';

export interface LeakageVerdict {
  ruleId: string;
  label: string;
  /** Governed metric (mean compliance penalty) with the rule present. */
  metricWith: number;
  /** ... with the rule ablated. */
  metricWithout: number;
  /** metricWithout − metricWith. Large positive ⇒ the learner relied on the rule. */
  ablationDelta: number;
  /** Did the learner follow the counterfactual (altered) rule? */
  counterfactualFollowed: boolean;
  /** Top diagnose component on the ablated run (the localization). */
  localizedComponent: GapComponent | null;
  /** Did the governed component appear among the ablated-run findings? */
  localizedGovernedComponent: boolean;
  verdict: Verdict;
}

export interface LeakageReport {
  provider: string;
  scenarios: number;
  deltaThreshold: number;
  perRule: LeakageVerdict[];
  /** Contamination baseline: with NO corpus, a bound learner should abstain. */
  closedBookAbstained: boolean;
}

export interface LeakageConfig {
  corpusNodes: AJPNode[];
  /** The benchmark subset used as the instrument. */
  scenarios: SimScenario[];
  probes: RuleProbe[];
  /** Scenario for the closed-book contamination baseline. */
  closedBookScenario: SimScenario;
  /** Minimum ablation-delta (governed-metric rise) to call a rule "relied upon". */
  deltaThreshold?: number;
  /**
   * Prompt condition. true (default) = the strict corpus-binding positive control;
   * false = the `unconstrained` condition, in which the binding clause is removed and the
   * verdict is expected to flip to "leaking" (Experiment 1, novelty doc §8).
   */
  strict?: boolean;
}

const DEFAULT_DELTA_THRESHOLD = 0.15;

function classify(ablationDelta: number, counterfactualFollowed: boolean, thr: number): Verdict {
  const reliedOn = ablationDelta >= thr;
  if (reliedOn && counterfactualFollowed) return 'corpus-bound';
  if (!reliedOn && !counterfactualFollowed) return 'leaking';
  return 'inconclusive';
}

/** Run one rule probe: ablation-delta + counterfactual adherence + localization. */
export async function runRuleProbe(
  complete: Completer,
  cfg: { corpusNodes: AJPNode[]; scenarios: SimScenario[]; probe: RuleProbe; deltaThreshold?: number; strict?: boolean },
): Promise<LeakageVerdict> {
  const { corpusNodes, scenarios, probe } = cfg;
  const thr = cfg.deltaThreshold ?? DEFAULT_DELTA_THRESHOLD;
  const strict = cfg.strict ?? true;

  const policy = (opts: CorpusOptions) => {
    const fn = createLlmManeuverFn({ complete, corpusNodes, ...opts, strict });
    return async (s: SimScenario) => (await fn(s)).maneuver;
  };

  const withRule = await runBenchmarkAsync(scenarios, policy({}));
  const without = await runBenchmarkAsync(scenarios, policy({ ablateIds: [probe.ruleId] }));
  const metricWith = withRule.meanCompliancePenalty;
  const metricWithout = without.meanCompliancePenalty;
  const ablationDelta = metricWithout - metricWith;

  // Counterfactual single-shot: does the learner follow the altered rule?
  const cfCorpus = renderCorpus(corpusNodes, {
    counterfactual: { [probe.ruleId]: probe.counterfactualText },
  });
  const cfDecision = parseDecision(await complete(buildPrompt(probe.probeScenario, cfCorpus, strict)));
  const counterfactualFollowed = probe.followedCounterfactual(cfDecision);

  // Localization: which component does the ablated run's failure signature name?
  const findings = diagnoseCorpusGaps(scenarios, without.perCase);
  const localizedComponent = findings[0]?.component ?? null;
  const localizedGovernedComponent = findings.some((f) => f.component === probe.governedComponent);

  return {
    ruleId: probe.ruleId,
    label: probe.label,
    metricWith,
    metricWithout,
    ablationDelta,
    counterfactualFollowed,
    localizedComponent,
    localizedGovernedComponent,
    verdict: classify(ablationDelta, counterfactualFollowed, thr),
  };
}

/** Run the full experiment across all probes plus the closed-book baseline. */
export async function runLeakageExperiment(
  complete: Completer,
  provider: string,
  cfg: LeakageConfig,
): Promise<LeakageReport> {
  const thr = cfg.deltaThreshold ?? DEFAULT_DELTA_THRESHOLD;
  const perRule: LeakageVerdict[] = [];
  for (const probe of cfg.probes) {
    perRule.push(await runRuleProbe(complete, { ...cfg, probe, deltaThreshold: thr }));
  }
  const closed = parseDecision(await complete(buildPrompt(cfg.closedBookScenario, '(no rules provided)', cfg.strict ?? true)));
  return { provider, scenarios: cfg.scenarios.length, deltaThreshold: thr, perRule, closedBookAbstained: closed.abstained };
}

// ─── Default probe: the alter-to-starboard steering rule (Rule 14) ────────────────

/** Build the canonical starboard-steering probe for a given head-on scenario. */
export function starboardProbe(probeScenario: SimScenario): RuleProbe {
  return {
    ruleId: 'RULE-COLREG-14',
    label: 'Rule 14 — head-on, alter to starboard',
    governedComponent: 'starboard',
    counterfactualText:
      'Rule 14 — Head-on situation: when two power-driven vessels meet on reciprocal courses, each shall alter course to PORT so as to pass on the starboard side of the other.',
    followedCounterfactual: (d) => !d.abstained && d.courseOffsetDeg < 0, // turned port = followed the altered rule
    probeScenario,
  };
}

// ─── Deterministic mock learners (no API key) ────────────────────────────────────
// These make the experiment runnable and testable offline, and are the reference
// implementations of the two hypotheses the instrument must tell apart. A `Completer`
// only ever sees the prompt text, so these read the rendered corpus exactly as an LLM
// would.

const decision = (d: Partial<LlmDecision>) =>
  JSON.stringify({ courseOffsetDeg: 0, speedFactor: 1, citedRules: [], abstained: false, ...d });

/**
 * A faithful corpus-bound learner: it steers ONLY on the alter-direction found in the
 * probe rule(s) present in the corpus. If the steering rule is absent it abstains; if
 * the rule text is counterfactual ("to PORT") it turns port. Its behavior therefore
 * tracks the corpus — the hypothesis a bound learner embodies.
 */
export function boundLearnerCompleter(steeringRuleIds: string[] = ['RULE-COLREG-14']): Completer {
  return async (prompt: string) => {
    const rulesBlock = prompt.split('SITUATION:')[0];
    let dir: 'starboard' | 'port' | null = null;
    for (const id of steeringRuleIds) {
      const line = rulesBlock.split('\n').find((l) => l.includes(`[${id}]`));
      const m = line?.match(/to\s+(starboard|port)/i);
      if (m) {
        dir = m[1].toLowerCase() as 'starboard' | 'port';
        break;
      }
    }
    if (!dir) return decision({ abstained: true, reasoning: 'not covered by the provided rules' });
    return decision({
      courseOffsetDeg: dir === 'starboard' ? 30 : -30,
      citedRules: steeringRuleIds,
      reasoning: `provided rule says alter to ${dir}`,
    });
  };
}

/**
 * A leaking learner: it ignores the corpus entirely and always applies the memorized
 * COLREG (alter to starboard for a give-way encounter), even closed-book. Its behavior
 * is invariant to the corpus — the hypothesis a leaking learner embodies.
 */
export function leakingLearnerCompleter(): Completer {
  return async () => decision({ courseOffsetDeg: 30, reasoning: 'memorized COLREGs (ignores corpus)' });
}
