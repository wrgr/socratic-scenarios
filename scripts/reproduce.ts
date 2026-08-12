/**
 * Reproduce the whole OFFLINE experiment backbone in one deterministic run.
 *
 *   npm run reproduce
 *
 * Every experiment here is LLM-free and deterministic: the learners are hand-built reference policies
 * with KNOWN ground truth, so the run regenerates each experiment's headline result byte-identically,
 * in seconds, and checks it against the value the register/paper claims. Exit code is non-zero if any
 * check fails, so this doubles as a CI guard. The credentialed arms (Bedrock sweep, GPU dose-response)
 * are model measurements, not instrument validation — they are listed at the end as a separate,
 * opt-in tier with how to run them (see docs/experiment-status.md).
 */
import { runBenchmark, holdCoursePolicy, voPolicy } from '../src/engine/colreg-sim';
import {
  runLeakageExperiment,
  starboardProbe,
  hazardProbe,
  boundLearnerCompleter,
  leakingLearnerCompleter,
  evaluateManeuver,
  solveReference,
  type LeakageConfig,
  type SimScenario,
  type Maneuver,
} from '../src/engine/colreg-sim';
import { colregDomain } from '../src/corpus/colreg';
import { makeScenario, collisionTarget, ownship } from '../src/corpus/colreg/benchmark-geometry';
import { imazuBenchmark } from '../src/corpus/colreg/imazu';
import { HAZARD_SUITE, suiteScenario, suiteNode } from '../src/corpus/colreg/hazard-suite';
import {
  REASON_SUITE,
  conflictScenario,
  matchedScenario,
  implementerPolicy,
  reasonerPolicy,
} from '../src/corpus/colreg/reason-implement';
import { buildKB, runFactQAExperiment, boundQALearner, memorizedQALearner, type FactQAConfig } from '../src/engine/factqa';
import { scoreAttempt, expertAttempt, recklessAttempt, learnerAttempt, NO_COMPETENCE } from '../src/engine/procedure-sim';
import { tireChangeProcedure as P } from '../src/corpus/tire/procedure';
import { sufficiencyVerdict } from '../src/engine/audit-sufficiency';

const DEG = Math.PI / 180;
let failures = 0;
function check(id: string, claim: string, pass: boolean, got: string) {
  if (!pass) failures++;
  console.log(`  ${pass ? '✓' : '✗ FAIL'}  ${id.padEnd(6)} ${claim.padEnd(52)} ${got}`);
}
const section = (t: string) => console.log(`\n${t}`);

async function main() {
  console.log('Reproducing the offline (deterministic, LLM-free) experiment backbone…\n');

  // ── Exp 0 · construct validity, COLREG continuous control ──
  section('Instrument construct validity (C2)');
  {
    const naive = runBenchmark(imazuBenchmark, holdCoursePolicy);
    const expert = runBenchmark(imazuBenchmark, voPolicy);
    check('0', 'naive collides, expert clears (cleared-rate)', naive.clearedRate < 0.15 && expert.clearedRate > naive.clearedRate,
      `hold ${(naive.clearedRate * 100).toFixed(0)}% vs VO ${(expert.clearedRate * 100).toFixed(0)}%`);
  }
  // ── Exp 0b · construct validity, discrete procedural ──
  {
    const expert = scoreAttempt(P, expertAttempt(P));
    const reckless = scoreAttempt(P, recklessAttempt(P));
    const naive = scoreAttempt(P, learnerAttempt(P, NO_COMPETENCE));
    check('0b', 'expert J=0 < reckless < naive (procedural)', expert.J === 0 && reckless.J > expert.J + 50 && naive.J > reckless.J,
      `expert ${expert.J} · reckless ${reckless.J.toFixed(0)} · naive ${naive.J.toFixed(0)}`);
  }

  // ── Exp 1/3 · reference-learner recovery, standard COLREG ──
  section('Corpus diagnosis — reference-learner recovery (C1)');
  {
    const s = [makeScenario('HO-1', 'Head-on', 'beginner', [collisionTarget('A', 0, 6000, 12)])];
    const cfg: LeakageConfig = { corpusNodes: colregDomain.nodes, scenarios: s, probes: [starboardProbe(s[0])], closedBookScenario: s[0] };
    const bound = (await runLeakageExperiment(boundLearnerCompleter(), 'bound', cfg)).perRule[0].verdict;
    const leaking = (await runLeakageExperiment(leakingLearnerCompleter(), 'leaking', cfg)).perRule[0].verdict;
    check('1/3', 'bound→corpus-bound, leaking→leaking', bound === 'corpus-bound' && leaking === 'leaking', `${bound} / ${leaking}`);
  }
  // ── Exp 1c · geometric hazard suite (necessity as a fraction) ──
  {
    const cfgFor = (h: (typeof HAZARD_SUITE)[number]): LeakageConfig => {
      const sc = suiteScenario(h);
      return { corpusNodes: [...colregDomain.nodes, suiteNode(h)], scenarios: [sc], probes: [hazardProbe(sc, [sc])], closedBookScenario: sc };
    };
    const bMock = () => boundLearnerCompleter([], [], ['RULE-HAZARD-01']);
    let bRelied = 0, lRelied = 0;
    for (const h of HAZARD_SUITE) {
      if ((await runLeakageExperiment(bMock(), h.id, cfgFor(h))).perRule[0].verdict === 'corpus-bound') bRelied++;
      if ((await runLeakageExperiment(leakingLearnerCompleter(), h.id, cfgFor(h))).perRule[0].verdict === 'corpus-bound') lRelied++;
    }
    const n = HAZARD_SUITE.length;
    check('1c', `hazard suite bound N/N, leaking 0/N`, bRelied === n && lRelied === 0, `bound ${bRelied}/${n} · leaking ${lRelied}/${n}`);
  }
  // ── Exp 7 · fact-QA necessity (second domain, no simulator) ──
  {
    const { facts, items } = buildKB();
    const cfg: FactQAConfig = { facts, items };
    const bound = await runFactQAExperiment(boundQALearner(facts, items), 'bound', cfg);
    const memo = await runFactQAExperiment(memorizedQALearner(facts, items), 'memorized', cfg);
    const bMin = Math.min(...bound.perFact.map((p) => p.necessity));
    const mMax = Math.max(...memo.perFact.map((p) => p.necessity));
    check('7', 'fact-QA bound necessity≈1, memorized≈0', bMin > 0.5 && mMax < 0.5, `bound min ${bMin.toFixed(2)} · memorized max ${mMax.toFixed(2)}`);
  }
  // ── Exp 8 · corpus sufficiency + FALSE SUFFICIENCY ──
  {
    const contributing = sufficiencyVerdict({ relied: 3, redundant: 0, unusable: 0, inconclusive: 0, closedBookContaminated: false, queries: 3 });
    const falseSuff = sufficiencyVerdict({ relied: 0, redundant: 3, unusable: 0, inconclusive: 0, closedBookContaminated: true, queries: 3 });
    check('8', 'contributing vs FALSE SUFFICIENCY fire correctly', contributing.verdict === 'contributing' && falseSuff.verdict === 'redundant',
      `${contributing.verdict} / ${falseSuff.verdict}`);
  }

  // ── Exp B · the decision-quality middle band ──
  section('Case study 2 — the quality axis (B) and reasoning (B2)');
  {
    const s: SimScenario = { id: 'QB', label: 'head-on', description: '', difficulty: 'intermediate', ownship: ownship(),
      targets: [collisionTarget('A', 0, 6000, 12)], visibility: 'clear', horizonS: 1200, dt: 4, intendedHeading: 0 };
    const turn = (d: number): Maneuver => ({ courseOffset: d * DEG, speedFactor: 1, actTime: 0 });
    const qual = (m: Maneuver) => { const r = evaluateManeuver(s, m); return { barrier: r.terms.barrier, quality: r.terms.margin + r.terms.compliance + r.terms.deviation, cleared: !r.metrics.incursion }; };
    const blind = qual(turn(0)), naive = qual(turn(-30)), trained = qual(solveReference(s).best.maneuver);
    check('B', 'blind collides < naive middle band < trained floor', blind.barrier > 100 && naive.cleared && naive.quality > trained.quality + 0.3 && trained.quality < 0.2,
      `blind bar ${blind.barrier.toFixed(0)} · naive q ${naive.quality.toFixed(2)} · trained q ${trained.quality.toFixed(2)}`);
  }
  // ── Exp B2 · reason vs implement ──
  {
    const grounds = (s: SimScenario, p: typeof implementerPolicy) => { const ref = solveReference(s).best.result.J; const r = evaluateManeuver(s, p(s)); return { regret: r.J - ref, grounds: r.terms.barrier > 0 }; };
    const m = matchedScenario();
    const matchedEqual = Math.abs(grounds(m, implementerPolicy).regret - grounds(m, reasonerPolicy).regret) < 0.01;
    const scns = REASON_SUITE.map(conflictScenario);
    const reaCleared = scns.filter((s) => !grounds(s, reasonerPolicy).grounds).length;
    const impCleared = scns.filter((s) => !grounds(s, implementerPolicy).grounds).length;
    const redundant = REASON_SUITE.filter((c) => c.safeSide === 'starboard').length;
    check('B2', 'matched identical; reasoner N/N, implementer only redundant', matchedEqual && reaCleared === scns.length && impCleared === redundant,
      `matched Δ0 · reasoner ${reaCleared}/${scns.length} · implementer ${impCleared}/${scns.length}`);
  }

  // ── Credentialed tier (model measurements — not run here) ──
  section('Credentialed arms (model measurements — NOT reproduced offline)');
  console.log('  ⤷ Exp 1/1b/3/4  cross-model leakage & hazard discrimination — set BEDROCK_MODEL (+AWS creds): npm run colreg:leakage / colreg:hazard-suite');
  console.log('  ⤷ Exp 2b/7      GPU dose-response (teach → α/checkpoint sweep) — experiments/unlearning/*.py (see DOSE_RESPONSE.md)');

  console.log(`\n${failures === 0 ? '✓ ALL OFFLINE EXPERIMENTS REPRODUCED' : `✗ ${failures} CHECK(S) FAILED`}`);
  if (failures > 0) process.exitCode = 1;
}

main();
