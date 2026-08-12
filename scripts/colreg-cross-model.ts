/**
 * Cross-model discrimination table (audit CS1.2 + CS1.3) — the tidy per-model result the paper wants.
 *
 *   MODELS="us.anthropic.claude-opus-4-5-20251101-v1:0,us.meta.llama4-maverick-17b-instruct-v1:0" \
 *     AUDIT_LOG=runs/xm.jsonl SAMPLES=5 npm run colreg:cross-model
 *
 * For each model it runs TWO probes through the one instrument and prints a row:
 *   - standard COLREG (Rule 14 head-on): expected LEAKING/redundant — the model already knows it.
 *   - the geometric hazard SUITE (corpus-only fictional dangers): necessity = fraction relied-upon,
 *     with the redundant/unusable split (grounds even with the rule ⇒ unusable).
 * The discrimination CS1.2 can't show (everyone leaks textbook COLREG) appears in the hazard columns.
 *
 * Reads BOTH a POINT ESTIMATE (temp 0, deterministic) and — with SAMPLES>1 — a K-sample ENSEMBLE at
 * temp TEMP (mean ± sd), so a per-model read comes with error bars instead of one lucky draw.
 * AUDIT_LOG=<path> writes one JSONL row per model × probe × condition (prompt, completion, decision),
 * so a surprising cell (e.g. a model reading standard COLREG corpus-bound) traces to what it actually said.
 *
 * Models: comma-separated Bedrock ids/inference-profile ids in MODELS (standard AWS credential chain),
 * or BEDROCK_MODEL for one. With NO credential it runs the two reference mocks to recover the known
 * ground truth (leaking on standard, corpus-bound on the hazard). RPM throttles requests.
 */
import './_env';
import { appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  runLeakageExperiment,
  starboardProbe,
  hazardProbe,
  boundLearnerCompleter,
  leakingLearnerCompleter,
  throttleCompleter,
  retryCompleter,
  type Completer,
  type LeakageConfig,
  type LeakageAuditRow,
} from '../src/engine/colreg-sim';
import { bedrockCompleter } from '../src/engine/real-completer';
import { colregDomain } from '../src/corpus/colreg';
import { makeScenario, collisionTarget } from '../src/corpus/colreg/benchmark-geometry';
import { HAZARD_SUITE, suiteScenario, suiteNode, type SuiteHazard } from '../src/corpus/colreg/hazard-suite';

type Audit = ((row: LeakageAuditRow) => void) | undefined;
type AuditFor = (probe: string) => Audit;

const headOn = [
  makeScenario('HO-1', 'Head-on', 'beginner', [collisionTarget('A', 0, 6000, 12)]),
  makeScenario('HO-2', 'Head-on', 'beginner', [collisionTarget('A', 0, 5500, 11)]),
];
const standardCfg: LeakageConfig = { corpusNodes: colregDomain.nodes, scenarios: headOn, probes: [starboardProbe(headOn[0])], closedBookScenario: headOn[0] };
const hazardCfg = (h: SuiteHazard): LeakageConfig => {
  const sc = suiteScenario(h);
  return { corpusNodes: [...colregDomain.nodes, suiteNode(h)], scenarios: [sc], probes: [hazardProbe(sc, [sc])], closedBookScenario: sc };
};

interface Assessment { standard: string; relied: number; unusable: number; n: number }

async function assess(complete: Completer, label: string, auditFor: AuditFor): Promise<Assessment> {
  const standard = (await runLeakageExperiment(complete, label, { ...standardCfg, onAudit: auditFor('standard') })).perRule[0].verdict;
  let relied = 0, unusable = 0;
  for (const h of HAZARD_SUITE) {
    const v = (await runLeakageExperiment(complete, label, { ...hazardCfg(h), onAudit: auditFor(`hazard:${h.id}`) })).perRule[0];
    if (v.verdict === 'corpus-bound') relied++;
    else if (v.regretWith >= 10) unusable++; // present but grounds ⇒ the model can't act on it
  }
  return { standard, relied, unusable, n: HAZARD_SUITE.length };
}

const rpm = Number(process.env.RPM ?? 30);
const throttled = (c: Completer): Completer =>
  throttleCompleter(retryCompleter(c, { retries: Number(process.env.GEMINI_RETRIES ?? 5) }), Math.ceil(60000 / Math.max(1, rpm)) + 700);
const modelCompleter = (id: string, temperature: number) => throttled(bedrockCompleter({ model: id, temperature }));

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const std = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
const mode = (xs: string[]) => xs.sort((a, b) => xs.filter((v) => v === a).length - xs.filter((v) => v === b).length).pop() ?? '—';

function pointHeader() {
  console.log('model                                         standard COLREG   hazard necessity   unusable');
}
function pointRow(label: string, a: Assessment) {
  console.log(`  ${label.padEnd(42)}  ${a.standard.padEnd(13)}   ${`${a.relied}/${a.n} relied`.padStart(14)}   ${String(a.unusable).padStart(3)}/${a.n}`);
}

async function main() {
  const modelList = (process.env.MODELS ?? process.env.BEDROCK_MODEL ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const auditPath = process.env.AUDIT_LOG;
  if (auditPath) { mkdirSync(dirname(auditPath), { recursive: true }); writeFileSync(auditPath, ''); }
  const auditFor = (model: string, phase: string, temp: number): AuditFor =>
    auditPath
      ? (probe: string) => (row: LeakageAuditRow) =>
          appendFileSync(auditPath, JSON.stringify({ utc: new Date().toISOString(), model, phase, temp, probe, ...row }) + '\n')
      : () => undefined;

  if (modelList.length === 0) {
    console.log('No MODELS/BEDROCK_MODEL set — running the two reference mocks (ground-truth validation).\n');
    pointHeader();
    pointRow('mock: corpus-bound', await assess(boundLearnerCompleter([], [], ['RULE-HAZARD-01']), 'mock', auditFor('mock:bound', 'point', 0)));
    pointRow('mock: leaking', await assess(leakingLearnerCompleter(), 'mock', auditFor('mock:leaking', 'point', 0)));
    if (auditPath) console.log(`\naudit log: ${auditPath}`);
    return;
  }

  // ── POINT ESTIMATE (temp 0, deterministic) ──
  console.log('POINT ESTIMATE (temp 0, deterministic)\n');
  pointHeader();
  for (const id of modelList) {
    try { pointRow(id, await assess(modelCompleter(id, 0), id, auditFor(id, 'point', 0))); }
    catch (e) { console.log(`  ${id}: failed — ${(e as Error).message}`); }
  }

  // ── ENSEMBLE (temp T, K samples) ──
  const K = Number(process.env.SAMPLES ?? 1);
  const T = Number(process.env.TEMP ?? 0.7);
  if (K > 1 && T > 0) {
    console.log(`\nENSEMBLE (temp ${T}, K=${K} samples/model — mean ± sd over the hazard suite)\n`);
    console.log('model                                         standard(mode)   relied mean±sd     unusable mean±sd');
    for (const id of modelList) {
      const relied: number[] = [], unusable: number[] = [], verdicts: string[] = [];
      try {
        for (let k = 0; k < K; k++) {
          const a = await assess(modelCompleter(id, T), id, auditFor(id, `ens${k}`, T));
          relied.push(a.relied); unusable.push(a.unusable); verdicts.push(a.standard);
        }
        console.log(`  ${id.padEnd(42)}  ${mode(verdicts).padEnd(14)}   ${`${mean(relied).toFixed(1)} ± ${std(relied).toFixed(1)}`.padStart(14)}   ${`${mean(unusable).toFixed(1)} ± ${std(unusable).toFixed(1)}`.padStart(14)}`);
      } catch (e) { console.log(`  ${id}: failed — ${(e as Error).message}`); }
    }
  }

  console.log(
    `\n  Read: standard COLREG should read LEAKING/redundant (models know Rule 14) — a model reading it ` +
      `corpus-bound is usually\n  the STRICT-mode confound (it abstains when the rule is ablated), visible in the ` +
      `audit log's ablated arm. The corpus-only\n  hazard suite is the discriminator: corpus-bound (reads it) vs unusable (grounds with it present).`,
  );
  if (auditPath) console.log(`\n  audit log: ${auditPath} (rows tagged model / phase point|ens0..${K - 1} / probe standard|hazard:<id> / condition)`);
}

main();
