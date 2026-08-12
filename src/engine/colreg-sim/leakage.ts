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
  decisionToManeuver,
  buildPrompt,
  parseDecision,
  renderCorpus,
  type Completer,
  type LlmDecision,
  type CorpusOptions,
  type ManeuverCallAudit,
} from './llm-learner';
import { runBenchmarkAsync, evaluateManeuver } from './benchmark';

/** An audited model call plus which leakage condition and rule it belongs to. One JSONL row. */
export type LeakageAuditRow = ManeuverCallAudit & { condition: string; ruleId: string };
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

/**
 * When a rule reads `leaking` (the corpus does not move the learner's behavior), WHY it
 * doesn't matters for a corpus-value audit — and the two reasons are opposite:
 *   - `redundant`: the learner already does the right thing WITH the corpus (regret-with ≈ 0).
 *                  The corpus item is genuinely dead weight — the model knows it. Drop it.
 *   - `unusable`:  the learner does the WRONG thing even WITH the corpus (regret-with high).
 *                  The item is NOT redundant; this model simply cannot act on it. The fix is
 *                  the model, not the corpus. (e.g. Llama-70B grounds on a charted hazard the
 *                  corpus explicitly warns about — regret ≈ full barrier with the rule present.)
 * Discriminated by the WITH-corpus regret (regret above the reference policy), which is ≈ 0
 * when the learner is competent and large when it fails the task regardless of the corpus.
 */
export type LeakMode = 'redundant' | 'unusable';

export interface LeakageVerdict {
  ruleId: string;
  label: string;
  /** The diagnose component this rule is meant to govern (for the localization confusion cell). */
  governedComponent: GapComponent;
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
  /**
   * Only set when `verdict === 'leaking'`: WHY the corpus doesn't move behavior —
   * `redundant` (the learner is already competent) vs `unusable` (the learner fails the
   * task even with the corpus present). Undefined for corpus-bound / inconclusive.
   */
  leakMode?: LeakMode;
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
  /** WITH-corpus regret below which a leaking rule is `redundant` (else `unusable`). */
  competenceRegret?: number;
  /**
   * Prompt condition. true (default) = the strict corpus-binding positive control;
   * false = the `unconstrained` condition, in which the binding clause is removed and the
   * verdict is expected to flip to "leaking" (Experiment 1, novelty doc §8).
   */
  strict?: boolean;
  /** Optional audit sink: every model call (all conditions) with its answer + kinematics. */
  onAudit?: (row: LeakageAuditRow) => void;
}

const DEFAULT_DELTA_THRESHOLD = 0.15;

/**
 * WITH-corpus regret (above the reference policy) below which a leaking learner is deemed
 * competent → `redundant`; at or above it the learner is failing the task even with the
 * corpus present → `unusable`. The compliance-governed rules sit at O(0.1–1) regret, while a
 * grounded hazard is O(1000) (the categorical barrier), so this cleanly separates the two.
 */
const DEFAULT_COMPETENCE_REGRET = 10;

/** Sub-classify a leaking rule by whether the learner is competent WITH the corpus. */
function leakModeOf(regretWith: number, competenceRegret: number): LeakMode {
  return regretWith < competenceRegret ? 'redundant' : 'unusable';
}

/**
 * Verdict from a majority vote of three orthogonal leakage signals, rather than the old
 * AND of two. The old rule left capable models "inconclusive" whenever they stopped
 * relying on the corpus (delta collapse) and contaminated closed-book yet still complied
 * with the counterfactual instruction — undercounting clear leakage. The vote over
 * {low ablation-delta, counterfactual ignored, closed-book contaminated} fixes that:
 * >=2 leak signals ⇒ leaking, 0 ⇒ corpus-bound, exactly 1 ⇒ genuinely mixed (inconclusive).
 */
export function classify(
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
  cfg: { corpusNodes: AJPNode[]; scenarios: SimScenario[]; probe: RuleProbe; deltaThreshold?: number; competenceRegret?: number; strict?: boolean; closedBookContaminated?: boolean; onAudit?: (row: LeakageAuditRow) => void },
): Promise<LeakageVerdict> {
  const { corpusNodes, probe } = cfg;
  const scenarios = probe.scenarios ?? cfg.scenarios; // rule-matched instrument subset
  const thr = cfg.deltaThreshold ?? DEFAULT_DELTA_THRESHOLD;
  const competenceRegret = cfg.competenceRegret ?? DEFAULT_COMPETENCE_REGRET;
  const strict = cfg.strict ?? true;
  const audit = cfg.onAudit;

  const policy = (opts: CorpusOptions, condition: string) => {
    const onCall = audit ? (r: ManeuverCallAudit) => audit({ ...r, condition, ruleId: probe.ruleId }) : undefined;
    const fn = createLlmManeuverFn({ complete, corpusNodes, ...opts, strict, onCall });
    return async (s: SimScenario) => (await fn(s)).maneuver;
  };

  const withRule = await runBenchmarkAsync(scenarios, policy({}, 'with-corpus'));
  const without = await runBenchmarkAsync(scenarios, policy({ ablateIds: [probe.ruleId] }, 'ablated'));
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
  if (audit) {
    const m = decisionToManeuver(cfDecision);
    const k = evaluateManeuver(probe.probeScenario, m);
    audit({
      condition: 'counterfactual', ruleId: probe.ruleId, scenarioId: probe.probeScenario.id, strict,
      prompt: buildPrompt(probe.probeScenario, cfCorpus, strict), completion: cfRaw, decision: cfDecision,
      maneuver: { courseOffsetDeg: cfDecision.courseOffsetDeg, speedFactor: cfDecision.speedFactor },
      kinematics: { J: k.J, terms: k.terms, metrics: k.metrics },
    });
  }

  // Localization: which component does the ablated run's failure signature name?
  const findings = diagnoseCorpusGaps(scenarios, without.perCase);
  const localizedComponent = findings[0]?.component ?? null;
  const localizedGovernedComponent = findings.some((f) => f.component === probe.governedComponent);

  const closedBookContaminated = cfg.closedBookContaminated ?? false;
  const verdict = classify(ablationDelta, counterfactualFollowed, closedBookContaminated, thr);
  return {
    ruleId: probe.ruleId,
    label: probe.label,
    governedComponent: probe.governedComponent,
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
    verdict,
    // Only a leaking rule carries a mode; redundant vs unusable is decided by WITH-corpus regret.
    ...(verdict === 'leaking' ? { leakMode: leakModeOf(regretWith, competenceRegret) } : {}),
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
  if (cfg.onAudit) {
    const m = decisionToManeuver(closed);
    const k = evaluateManeuver(cfg.closedBookScenario, m);
    cfg.onAudit({
      condition: 'closed-book', ruleId: '(none)', scenarioId: cfg.closedBookScenario.id, strict: cfg.strict ?? true,
      prompt: buildPrompt(cfg.closedBookScenario, '(no rules provided)', cfg.strict ?? true), completion: closedRaw,
      decision: closed, maneuver: { courseOffsetDeg: closed.courseOffsetDeg, speedFactor: closed.speedFactor },
      kinematics: { J: k.J, terms: k.terms, metrics: k.metrics },
    });
  }
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
 * A fourth rule on yet another axis: Rule 8 — action must be *substantial* and readily apparent.
 * Governs the `substantial` compliance check via the *magnitude* of the alteration (not its
 * direction or speed). Exercised on give-way (crossing) scenarios where a token turn still clears
 * the collision but is not bold enough. The counterfactual relaxes it ("a slight alteration
 * suffices"); a learner that then makes only a small (<20°) turn has followed the altered rule.
 */
export function substantialActionProbe(probeScenario: SimScenario, scenarios: SimScenario[]): RuleProbe {
  return {
    ruleId: 'RULE-COLREG-08',
    label: 'Rule 8 — substantial, readily-apparent action',
    governedComponent: 'substantial',
    counterfactualText:
      'Rule 8 — Action to avoid collision: a slight alteration of a few degrees is sufficient; a small, gradual change need not be large to be readily apparent.',
    followedCounterfactual: (d) => !d.abstained && Math.abs(d.courseOffsetDeg) > 0 && Math.abs(d.courseOffsetDeg) < 20,
    probeScenario,
    scenarios,
  };
}

/**
 * THE corpus-reliance probe: a CORPUS-ONLY hidden hazard. A charted danger sits on the ownship's
 * track; it is scored by the objective barrier but is NOT shown to the model, so it can be known
 * ONLY from the corpus. A model that read the corpus alters to clear it; a model that did not
 * (leaking, or corpus-ablated) holds its default track and grounds — a FULL-BARRIER swing, the
 * largest, cleanest corpus-reliance signal in the instrument (unlike the standard COLREG rules,
 * which every model leaks, and unlike a speed nudge, whose effect is a sliver). Avoiding a charted
 * hazard is unambiguously sensible, so there is no "refuses a dangerous instruction" confound. The
 * counterfactual says the sector is CLEAR; a learner that then holds course has followed it.
 */
export function hazardProbe(probeScenario: SimScenario, scenarios: SimScenario[]): RuleProbe {
  return {
    ruleId: 'RULE-HAZARD-01',
    label: 'Charted hazard on the track (corpus-only)',
    governedComponent: 'coordination',
    counterfactualText:
      'CORRECTION: this sector is clear — no charted hazard is present. Hold your course and speed.',
    // Followed the (clear) counterfactual = held course rather than making an avoiding alteration.
    followedCounterfactual: (d) => !d.abstained && Math.abs(d.courseOffsetDeg) < 10,
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
  hazardRuleIds: string[] = [],
): Completer {
  return async (prompt: string) => {
    const rulesBlock = prompt.split('SITUATION:')[0];
    const restricted = /restricted \(fog/i.test(prompt); // fog flag rendered into the situation
    const cited: string[] = [];

    // Steering direction — from a steering rule in the corpus.
    let dir: 'starboard' | 'port' | null = null;
    for (const id of steeringRuleIds) {
      const line = rulesBlock.split('\n').find((l) => l.includes(`[${id}]`));
      const m = line?.match(/to\s+(starboard|port)/i);
      if (m) { dir = m[1].toLowerCase() as 'starboard' | 'port'; break; }
    }

    // Hazard avoidance — from a corpus hazard rule (any visibility). The real rule ⇒ alter to clear;
    // its "sector is clear" counterfactual ⇒ hold. A grounded default is what makes this large-effect.
    let hazardOffset: number | null = null;
    for (const id of hazardRuleIds) {
      const line = rulesBlock.split('\n').find((l) => l.includes(`[${id}]`));
      if (line) {
        const clear = /no (charted )?hazard|sector is clear|hold your course/i.test(line);
        hazardOffset = clear ? 0 : 60; // 60° clears the charted hazard; a 30° default still grounds
        cited.push(id);
        break;
      }
    }

    // Boldness (Rule 8): a *substantial*, readily-apparent alteration. Without the rule — or under
    // its "a slight alteration suffices" counterfactual — the bound learner makes only a token turn
    // (15°), which clears the collision but fails the `substantial` check. With it, a bold 30°.
    const r8line = rulesBlock.split('\n').find((l) => l.includes('[RULE-COLREG-08]'));
    // "bold" unless the line is the RELAXED counterfactual. Match only phrases distinctive to that
    // counterfactual — NOT "small", which the TRUE rule uses ("a succession of small alterations
    // should be avoided") and which would otherwise mis-read the real rule as token.
    const bold = !!r8line && !/\bslight\b|a few degrees|need not be large/i.test(r8line);
    const magnitude = bold ? 30 : 15;
    if (r8line) cited.push('RULE-COLREG-08');

    // Safe speed — only in restricted visibility, only if a safe-speed rule is present (Rule 19).
    let speedFactor = 1;
    let sawSpeedRule = false;
    if (restricted) {
      for (const id of speedRuleIds) {
        const line = rulesBlock.split('\n').find((l) => l.includes(`[${id}]`));
        if (line) {
          sawSpeedRule = true;
          cited.push(id);
          speedFactor = /full\s+(sea\s+)?speed|need not reduce|maintain full/i.test(line) ? 1 : 0.5;
          break;
        }
      }
    }

    const sawHazard = hazardOffset !== null;
    if (!dir && !sawSpeedRule && !sawHazard) return decision({ abstained: true, reasoning: 'not covered by the provided rules' });
    return decision({
      // Hazard avoidance takes precedence for the course; else the steering rule at a magnitude set
      // by the boldness rule (Rule 8); else hold.
      courseOffsetDeg: sawHazard ? hazardOffset! : dir === 'starboard' ? magnitude : dir === 'port' ? -magnitude : 0,
      speedFactor,
      citedRules: [...steeringRuleIds.filter(() => dir), ...cited],
      reasoning: sawHazard ? `hazard rule: ${hazardOffset ? 'alter to clear' : 'sector clear, hold'}` : `provided rules: ${dir ? `alter to ${dir} (${bold ? 'bold' : 'token'})` : 'no direction'}`,
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
