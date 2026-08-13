/**
 * Offline prototype for the OVERRIDE FACTORIAL (no LLM, no GPU) — proves the DESIGN untangles corpus
 * reliance from ablated-arm fallback BEFORE any model budget is spent.
 *
 *   npm run colreg:override-factorial
 *
 * Scores four hand-built reference learners (blind / implementer / lookup / reasoner) across the
 * {head-on, crossing} × {override, redundant, misled} factorial. For each (learner, cell) it computes
 * the with-corpus and ablated regret, the necessity (ablated − with), and classifies the outcome into
 * the different×usable cells of the paper's Figure 2. The design is validated iff the learners separate
 * as designed: only the reasoner clears everywhere; the lookup reader is MISLED (negative necessity) on
 * the misled cell; the implementer is IGNORED/unusable on the overrides; necessity ≈ 0 on redundant.
 */
import './_env';
import { appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  evaluateManeuver,
  solveReference,
  createLlmManeuverFn,
  throttleCompleter,
  retryCompleter,
  type Completer,
  type Policy,
  type SimScenario,
} from '../src/engine/colreg-sim';
import { selectRealCompleter } from '../src/engine/real-completer';
import { colregDomain } from '../src/corpus/colreg';
import {
  OVERRIDE_FACTORIAL,
  REFERENCE_LEARNERS,
  scoringScenario,
  policyInput,
  factorialRuleNode,
  RULE_ID,
  type FactorialCase,
} from '../src/corpus/colreg/override-factorial';

const USABLE = 10; // regret-with < USABLE ⇒ the learner succeeds with the item present (clears)
const RELY = 100; // necessity > RELY ⇒ removing the item genuinely hurts (barrier swing ~1782)

const maneuverKey = (m: { courseOffset: number; speedFactor: number }) =>
  `${Math.round((m.courseOffset * 180) / Math.PI)}/${m.speedFactor.toFixed(2)}`;

function scoreOf(c: FactorialCase) {
  const sc = scoringScenario(c);
  const ref = solveReference(sc).best.result.J;
  return (manScenario: SimScenario, policy: Policy) => {
    const man = policy(manScenario);
    const r = evaluateManeuver(sc, man);
    return { regret: r.J - ref, grounds: r.terms.barrier > 0, key: maneuverKey(man) };
  };
}

type Cell = 'RELIED' | 'MISLED' | 'REDUNDANT' | 'IGNORED';
// Classify on the two continuous observables (the paper's Figure 2), thresholded:
//   succeeds-with (regret-with < USABLE): RELIED if removing it hurts (necessity > RELY) else REDUNDANT.
//   fails-with:                            MISLED if removing it HELPED (necessity < −USABLE) else IGNORED.
function classify(necessity: number, regretWith: number): Cell {
  if (regretWith >= USABLE) return necessity < -USABLE ? 'MISLED' : 'IGNORED';
  return necessity > RELY ? 'RELIED' : 'REDUNDANT';
}

function runOffline() {
  console.log(
    'Override factorial — 4 reference learners × {head-on,crossing} × {override,redundant,misled}.\n' +
      'No LLM: deterministic reference policies with known ground truth. Validates that the DESIGN\n' +
      'separates corpus reading from ablated-arm fallback before any real-model run.\n',
  );

  const learnerCells: Record<string, Record<Cell, number>> = {};
  for (const { name } of REFERENCE_LEARNERS)
    learnerCells[name] = { RELIED: 0, MISLED: 0, REDUNDANT: 0, IGNORED: 0 };

  for (const c of OVERRIDE_FACTORIAL) {
    console.log(`\n${c.id}  [${c.kind} · ${c.geometry} · rule→${c.ruleSide}]`);
    console.log('  learner       with   ablated   necessity   decision(with→ablated)   cell');
    const score = scoreOf(c);
    for (const { name, policy } of REFERENCE_LEARNERS) {
      const w = score(policyInput(c, false), policy);
      const a = score(policyInput(c, true), policy);
      const necessity = a.regret - w.regret;
      const cell = classify(necessity, w.regret);
      learnerCells[name][cell]++;
      const fmt = (n: number) => (Math.abs(n) < 1 ? n.toFixed(2) : n.toFixed(0)).padStart(7);
      console.log(
        `  ${name.padEnd(12)}${fmt(w.regret)}${fmt(a.regret)}${fmt(necessity).padStart(11)}   ` +
          `${(w.key + '→' + a.key).padEnd(22)}   ${cell}`,
      );
    }
  }

  console.log('\n\nSummary — cell counts per learner (of 6 cells):');
  console.log('  learner       RELIED  MISLED  REDUNDANT  IGNORED');
  for (const { name } of REFERENCE_LEARNERS) {
    const c = learnerCells[name];
    console.log(
      `  ${name.padEnd(12)}${String(c.RELIED).padStart(6)}${String(c.MISLED).padStart(8)}` +
        `${String(c.REDUNDANT).padStart(11)}${String(c.IGNORED).padStart(9)}`,
    );
  }

  // ── Design-validation assertions (the suite is only useful if these hold) ──
  const checks: [string, boolean][] = [
    ['reasoner clears every cell (RELIED on overrides, REDUNDANT/RELIED elsewhere, never MISLED/IGNORED)',
      learnerCells['reasoner'].MISLED === 0 && learnerCells['reasoner'].IGNORED === 0],
    ['lookup reader is MISLED on the misled cells (blind corpus-following is worse than ignoring)',
      learnerCells['lookup'].MISLED === 2],
    ['implementer is IGNORED/unusable on the override cells (ignores the rule, grounds)',
      learnerCells['implementer'].IGNORED === 2],
    ['reliance shows on overrides but not redundant (necessity localizes to the override factor)',
      learnerCells['reasoner'].RELIED === 2 && learnerCells['lookup'].RELIED === 2],
    ['blind never RELIED (holds course; necessity attributes nothing to it)',
      learnerCells['blind'].RELIED === 0],
  ];
  console.log('\nDesign validation:');
  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`  ${pass ? '✓' : '✗'}  ${label}`);
    ok = ok && pass;
  }
  console.log(
    ok
      ? '\n✓ The factorial SEPARATES reading from fallback and lookup from reasoning — safe to point at a real model.'
      : '\n✗ The design does NOT cleanly separate — fix the geometry/policies before spending model budget.',
  );
  if (!ok) process.exitCode = 1;
}

// ── LIVE MODE: run a real model through the factorial (present vs ablated) ──────────────────────────
// The model perceives the scenario (observable targets + the corpus rule node) and returns a maneuver;
// we score it against the ground-truth objective, ablate the rule node, and classify the necessity.
// The headline is the MISLED count: a model that faithfully follows a WRONG retrieved rule collides
// (negative necessity, fails-with) — invisible to standard necessity/faithfulness, the paper's point.
type Audit = ((o: object) => void) | undefined;

async function necessityOfCell(
  c: FactorialCase,
  complete: Completer,
  phase: string,
  temp: number,
  onCall: Audit,
): Promise<{ necessity: number; regretWith: number }> {
  const sc = scoringScenario(c);
  const ref = solveReference(sc).best.result.J;
  const corpusNodes = [...colregDomain.nodes, factorialRuleNode(c)];
  const run = async (condition: string, ablate: boolean): Promise<number> => {
    const fn = createLlmManeuverFn({
      complete,
      corpusNodes,
      ...(ablate ? { ablateIds: [RULE_ID] } : {}),
      onCall: onCall
        ? (r) => onCall({ phase, temp, cell: c.id, kind: c.kind, geometry: c.geometry, condition, ...r })
        : undefined,
    });
    const { maneuver } = await fn(sc);
    return evaluateManeuver(sc, maneuver).J - ref;
  };
  const regretWith = await run('with-corpus', false);
  const regretAblated = await run('ablated', true);
  return { necessity: regretAblated - regretWith, regretWith };
}

async function runLive() {
  if (!selectRealCompleter()) {
    console.log('\nNo LLM credential — skipping the live run. Set BEDROCK_MODEL (+AWS creds) / GEMINI_API_KEY / OPENAI_API_KEY.');
    return;
  }
  const label = selectRealCompleter()!.label;
  const rpm = Number(process.env.RPM ?? (process.env.BEDROCK_MODEL ? 30 : 5));
  const wrap = (co: Completer) =>
    throttleCompleter(retryCompleter(co, { retries: Number(process.env.GEMINI_RETRIES ?? 5) }), Math.ceil(60000 / Math.max(1, rpm)) + 700);
  const K = Number(process.env.SAMPLES ?? 5);
  const T = Number(process.env.TEMP ?? 0.7);
  const ensembleOn = K > 1 && T > 0;

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const auditPath = process.env.AUDIT_LOG ?? `runs/override-factorial-${stamp}.jsonl`;
  const debug = process.env.DEBUG === '1';
  if (auditPath) { mkdirSync(dirname(auditPath), { recursive: true }); writeFileSync(auditPath, ''); }
  const onCall: Audit =
    auditPath || debug
      ? (o) => {
          if (auditPath) appendFileSync(auditPath, JSON.stringify({ utc: new Date().toISOString(), model: label, ...o }) + '\n');
          if (debug) {
            const r = o as { cell: string; condition: string; decision: { courseOffsetDeg: number; abstained: boolean } };
            console.log(`\n    [${r.cell} ${r.condition.padEnd(11)}] deg=${r.decision.courseOffsetDeg}${r.decision.abstained ? ' ABSTAIN' : ''}`);
          }
        }
      : undefined;

  const pass = async (temp: number, phase: string): Promise<Record<string, Cell>> => {
    const co = wrap(selectRealCompleter({ temperature: temp })!.completer);
    const cells: Record<string, Cell> = {};
    for (const c of OVERRIDE_FACTORIAL) {
      const { necessity, regretWith } = await necessityOfCell(c, co, phase, temp, onCall);
      cells[c.id] = classify(necessity, regretWith);
      if (!debug) process.stdout.write('.');
    }
    return cells;
  };

  const totalCalls = OVERRIDE_FACTORIAL.length * 2 * (1 + (ensembleOn ? K : 0));
  const t0 = Date.now();
  console.log(`\n\nLIVE RUN (${label}) — does the model READ good rules, and is it MISLED by wrong ones?`);
  console.log(`  plan: ${totalCalls} model calls at ~${rpm}/min ≈ ${Math.ceil(totalCalls / Math.max(1, rpm))} min`);
  if (auditPath) console.log(`  audit log (all runs): ${auditPath}`);

  let pt: Record<string, Cell>;
  try {
    process.stdout.write(`\n  point estimate (temp 0): `);
    pt = await pass(0, 'point');
  } catch (e) {
    console.log(`\n  live run failed — ${(e as Error).message.split('\n')[0]}`);
    console.log('  (the offline design gate above still stands; supply a working credential to measure a real model.)');
    return;
  }
  console.log('');
  console.log('  cell                          classification');
  for (const c of OVERRIDE_FACTORIAL) console.log(`  ${c.id.padEnd(8)} [${c.kind}·${c.geometry}]`.padEnd(30) + `  ${pt[c.id]}`);
  const misledPt = OVERRIDE_FACTORIAL.filter((c) => c.kind === 'misled' && pt[c.id] === 'MISLED').length;
  const reliedPt = OVERRIDE_FACTORIAL.filter((c) => c.kind === 'override' && pt[c.id] === 'RELIED').length;
  const nMis = OVERRIDE_FACTORIAL.filter((c) => c.kind === 'misled').length;
  const nOv = OVERRIDE_FACTORIAL.filter((c) => c.kind === 'override').length;
  console.log(`  → reads good rules: RELIED ${reliedPt}/${nOv} overrides;  MISLED by wrong rules: ${misledPt}/${nMis}`);
  console.log(
    misledPt > 0
      ? `    ⇒ the model FOLLOWED a wrong retrieved rule into a collision — max apparent reliance, actively harmful.`
      : `    ⇒ the model OVERRODE the wrong rules (reasoner) — read good rules without being led astray.`,
  );

  if (ensembleOn) {
    const mis: number[] = [];
    try {
      for (let k = 0; k < K; k++) {
        process.stdout.write(`  ensemble ${k + 1}/${K} (temp ${T}): `);
        const s = await pass(T, `ens${k}`);
        console.log('');
        mis.push(OVERRIDE_FACTORIAL.filter((c) => c.kind === 'misled' && s[c.id] === 'MISLED').length);
      }
      console.log(`\n  ENSEMBLE (temp ${T}, K=${K}) — MISLED count per sample: [${mis.join(', ')}] of ${nMis}`);
    } catch (e) {
      console.log(`\n  ensemble interrupted — ${(e as Error).message.split('\n')[0]} (point estimate above stands)`);
    }
  }

  console.log(`\n  done in ${((Date.now() - t0) / 60000).toFixed(1)} min (${totalCalls} calls).`);
  if (auditPath) console.log(`  audit log: ${auditPath}`);
}

async function main() {
  runOffline(); // always: the deterministic design gate (exits non-zero if the design stops separating)
  await runLive(); // additionally: measure a real model, when a credential is present
}

main();
