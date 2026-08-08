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
  /**
   * Instrument subset that exercises THIS rule (e.g. crossing encounters for a crossing
   * rule). Ablating a rule only moves the metric on scenarios that invoke it, so each
   * probe carries its own matched set. Falls back to the shared `cfg.scenarios`.
   */
  scenarios?: SimScenario[];
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
  /** Same ablation, read on the FULL transfer objective J (regret instrument, C2) with
   * the rule present and ablated — showing C1 runs on the same instrument as C2, with the
   * bounded compliance penalty above as a low-variance readout of the same signal. */
  regretWith: number;
  regretWithout: number;
  regretDelta: number;
  /** Contamination baseline shared across rules: did the learner answer closed-book? */
  closedBookContaminated: boolean;
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

/**
 * Verdict from a majority vote of three orthogonal leakage signals, rather than the old
 * AND of two. The old rule left capable models "inconclusive" whenever they stopped
 * relying on the corpus (delta collapse) and contaminated closed-book yet still complied
 * with the counterfactual instruction — undercounting clear leakage. The vote over
 * {low ablation-delta, counterfactual ignored, closed-book contaminated} fixes that:
 * >=2 leak signals ⇒ leaking, 0 ⇒ corpus-bound, exactly 1 ⇒ genuinely mixed (inconclusive).
 */
function classify(
  ablationDelta: number,
  counterfactualFollowed: boolean,
  closedBookContaminated: boolean,
  thr: number,
): Verdict {
  const leakSignals =
    (ablationDelta < thr ? 1 : 0) +
    (counterfactualFollowed ? 0 : 1) +
    (closedBookContaminated ? 1 : 0);
  if (leakSignals >= 2) return 'leaking';
  if (leakSignals === 0) return 'corpus-bound';
  return 'inconclusive';
}

/** Run one rule probe: ablation-delta + counterfactual adherence + localization. */
export async function runRuleProbe(
  complete: Completer,
  cfg: { corpusNodes: AJPNode[]; scenarios: SimScenario[]; probe: RuleProbe; deltaThreshold?: number; strict?: boolean; closedBookContaminated?: boolean },
): Promise<LeakageVerdict> {
  const { corpusNodes, probe } = cfg;
  const scenarios = probe.scenarios ?? cfg.scenarios; // rule-matched instrument subset
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
  // The SAME ablation read on the full transfer objective J (the C2 regret instrument):
  // if the leakage signal is real it appears here too, so C1 and C2 are one instrument.
  const regretWith = withRule.meanJ;
  const regretWithout = without.meanJ;
  const regretDelta = regretWithout - regretWith;

  // Counterfactual single-shot: does the learner follow the altered rule?
  const cfCorpus = renderCorpus(corpusNodes, {
    counterfactual: { [probe.ruleId]: probe.counterfactualText },
  });
  const cfRaw = await complete(buildPrompt(probe.probeScenario, cfCorpus, strict));
  if (process.env.LEAKAGE_DEBUG) {
    console.error(`[debug ${probe.ruleId}] counterfactual raw completion: ${JSON.stringify(cfRaw).slice(0, 300)}`);
  }
  const cfDecision = parseDecision(cfRaw);
  const counterfactualFollowed = probe.followedCounterfactual(cfDecision);

  // Localization: which component does the ablated run's failure signature name?
  const findings = diagnoseCorpusGaps(scenarios, without.perCase);
  const localizedComponent = findings[0]?.component ?? null;
  const localizedGovernedComponent = findings.some((f) => f.component === probe.governedComponent);

  const closedBookContaminated = cfg.closedBookContaminated ?? false;
  return {
    ruleId: probe.ruleId,
    label: probe.label,
    metricWith,
    metricWithout,
    ablationDelta,
    regretWith,
    regretWithout,
    regretDelta,
    closedBookContaminated,
    counterfactualFollowed,
    localizedComponent,
    localizedGovernedComponent,
    verdict: classify(ablationDelta, counterfactualFollowed, closedBookContaminated, thr),
  };
}

/** Run the full experiment across all probes plus the closed-book baseline. */
export async function runLeakageExperiment(
  complete: Completer,
  provider: string,
  cfg: LeakageConfig,
): Promise<LeakageReport> {
  const thr = cfg.deltaThreshold ?? DEFAULT_DELTA_THRESHOLD;
  // Closed-book baseline first: its contamination signal feeds each rule's verdict vote.
  const closedRaw = await complete(buildPrompt(cfg.closedBookScenario, '(no rules provided)', cfg.strict ?? true));
  if (process.env.LEAKAGE_DEBUG) {
    console.error(`[debug closed-book] raw completion: ${JSON.stringify(closedRaw).slice(0, 300)}`);
  }
  const closed = parseDecision(closedRaw);
  const closedBookContaminated = !closed.abstained;
  const perRule: LeakageVerdict[] = [];
  for (const probe of cfg.probes) {
    perRule.push(await runRuleProbe(complete, { ...cfg, probe, deltaThreshold: thr, closedBookContaminated }));
  }
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

/**
 * A second, independent rule: Rule 15 crossing give-way. The give-way vessel keeps clear
 * (in practice alters to starboard / avoids crossing ahead); the counterfactual inverts
 * this to altering to port and crossing ahead. Must be exercised on CROSSING scenarios.
 */
export function crossingGiveWayProbe(probeScenario: SimScenario, scenarios: SimScenario[]): RuleProbe {
  return {
    ruleId: 'RULE-COLREG-15',
    label: 'Rule 15 — crossing give-way, keep clear',
    // diagnose.ts files RULE-COLREG-15 under the `starboard` component (a port turn in a
    // give-way situation), detected by the ['direction','no-port-turn'] checks — not `role`
    // (which is "took no action and was struck"). Must match, or localization false-negatives.
    governedComponent: 'starboard',
    counterfactualText:
      'Rule 15 — Crossing situation: when two power-driven vessels are crossing, the give-way vessel shall alter course to PORT and may cross ahead of the other vessel.',
    followedCounterfactual: (d) => !d.abstained && d.courseOffsetDeg < 0, // turned port = followed the altered rule
    probeScenario,
    scenarios,
  };
}

/**
 * A third, independent rule on a DIFFERENT metric axis: safe speed in restricted visibility
 * (Rules 6/19). Unlike the steering rules (which move the direction / compliance checks via
 * `courseOffsetDeg`), this governs the \`safe-speed\` compliance check via the decision's
 * `speedFactor`, and must be exercised on RESTRICTED-visibility (fog) scenarios — in clear
 * visibility the safe-speed check is not applicable and cannot move. The counterfactual
 * inverts "proceed at a safe speed" to "keep full sea speed"; a learner that then holds full
 * speed (\`speedFactor\` ≈ 1) has followed the altered rule.
 */
export function safeSpeedProbe(probeScenario: SimScenario, scenarios: SimScenario[]): RuleProbe {
  return {
    ruleId: 'RULE-COLREG-19',
    label: 'Rule 19 — restricted visibility, safe speed',
    governedComponent: 'safeSpeed',
    counterfactualText:
      'Rule 19 — Restricted visibility: a vessel that detects another by radar alone may keep full sea speed and need not reduce speed; maintain full speed in fog.',
    followedCounterfactual: (d) => !d.abstained && d.speedFactor >= 0.9, // kept full speed = followed the altered rule
    probeScenario,
    scenarios,
  };
}

/**
 * A CORPUS-ONLY rule with no pretraining support: the fictional Xylos Strait requires **bare
 * steerage** (`speedFactor` ≤ ~0.35) in restricted visibility — stricter than the generic
 * safe-speed reduction (~0.5) every model already knows. This is the only probe designed to
 * read CORPUS-BOUND on a real model: because the threshold is not memorizable, a model can
 * comply ONLY by reading the corpus, so ablating the rule *moves* the governed metric (unlike
 * the standard rules, which every model leaks). Must be run on `jurisdiction:'xylos'` fog
 * scenarios (the stricter compliance check keys off that tag). The counterfactual relaxes the
 * rule back to a generic reduction; a learner that then does ~0.5 (not steerage) followed it.
 */
export function xylosSpeedProbe(probeScenario: SimScenario, scenarios: SimScenario[]): RuleProbe {
  return {
    ruleId: 'RULE-XYLOS-SPEED',
    label: 'Xylos Strait — restricted visibility, bare steerage (corpus-only)',
    governedComponent: 'safeSpeed',
    counterfactualText:
      'Xylos Strait rule — Restricted visibility: a generic safe-speed reduction suffices; bare steerage is NOT required and vessels need not slow below half speed.',
    // Followed the RELAXED rule = reverted to a generic reduction (~0.5) instead of steerage (~0.3).
    followedCounterfactual: (d) => !d.abstained && d.speedFactor >= 0.45,
    probeScenario,
    scenarios,
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
export function boundLearnerCompleter(
  steeringRuleIds: string[] = ['RULE-COLREG-14'],
  speedRuleIds: string[] = [],
  xylosRuleIds: string[] = [],
): Completer {
  return async (prompt: string) => {
    const rulesBlock = prompt.split('SITUATION:')[0];
    const restricted = /restricted \(fog/i.test(prompt); // fog flag rendered into the situation
    // Direction — from a steering rule in the corpus (unchanged behavior).
    let dir: 'starboard' | 'port' | null = null;
    for (const id of steeringRuleIds) {
      const line = rulesBlock.split('\n').find((l) => l.includes(`[${id}]`));
      const m = line?.match(/to\s+(starboard|port)/i);
      if (m) {
        dir = m[1].toLowerCase() as 'starboard' | 'port';
        break;
      }
    }
    // Speed — only in restricted visibility, and only if a speed rule is present. A generic
    // safe-speed rule sets ~0.5 (its "keep full sea speed" counterfactual flips back to 1); the
    // corpus-only Xylos rule sets bare steerage ~0.3 (its "generic reduction suffices"
    // counterfactual relaxes back to ~0.5). Xylos takes precedence when both are present.
    let speedFactor = 1;
    let sawSpeedRule = false;
    const speedCitations: string[] = [];
    if (restricted) {
      for (const id of xylosRuleIds) {
        const line = rulesBlock.split('\n').find((l) => l.includes(`[${id}]`));
        if (line) {
          sawSpeedRule = true;
          speedCitations.push(id);
          // The TRUE Xylos rule demands bare steerage (~0.3). Its counterfactual RELAXES it — the
          // markers below appear only in the relaxed text ("suffices", "not required", "need not"),
          // never in the true rule (which says a generic reduction is *insufficient*), so match the
          // relaxation specifically rather than the shared phrase "generic safe-speed".
          speedFactor = /\bnot required\b|\bneed not\b|\bsuffices\b|\bis sufficient\b/i.test(line) ? 0.5 : 0.3;
          break;
        }
      }
      if (!sawSpeedRule)
        for (const id of speedRuleIds) {
          const line = rulesBlock.split('\n').find((l) => l.includes(`[${id}]`));
          if (line) {
            sawSpeedRule = true;
            speedCitations.push(id);
            speedFactor = /full\s+(sea\s+)?speed|need not reduce|maintain full/i.test(line) ? 1 : 0.5;
            break;
          }
        }
    }
    if (!dir && !sawSpeedRule) return decision({ abstained: true, reasoning: 'not covered by the provided rules' });
    return decision({
      courseOffsetDeg: dir === 'starboard' ? 30 : dir === 'port' ? -30 : restricted ? 30 : 0,
      speedFactor,
      citedRules: [...steeringRuleIds, ...speedCitations],
      reasoning: `provided rules: ${dir ? `alter to ${dir}` : 'no direction'}${sawSpeedRule ? `, safe speed ${speedFactor}` : ''}`,
    });
  };
}

/**
 * A leaking learner: it ignores the corpus entirely and always applies the memorized
 * COLREG (alter to starboard for a give-way encounter), even closed-book. Its behavior
 * is invariant to the corpus — the hypothesis a leaking learner embodies.
 */
export function leakingLearnerCompleter(): Completer {
  return async (prompt: string) =>
    decision({
      courseOffsetDeg: 30,
      // Memorized COLREGs include reducing to a safe speed in fog — applied regardless of
      // the corpus, so a safe-speed ablation does not move this learner (the leaking signal).
      speedFactor: /restricted \(fog/i.test(prompt) ? 0.5 : 1,
      reasoning: 'memorized COLREGs (ignores corpus)',
    });
}
