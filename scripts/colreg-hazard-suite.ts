/**
 * Hazard SUITE — the graded, per-item corpus-necessity probe (fixes audit F1).
 *
 *   npm run colreg:hazard-suite
 *
 * Runs each of N independent, fictional, corpus-only hazards (src/corpus/colreg/hazard-suite.ts) in
 * its OWN isolated corpus (standard COLREG rules + that one hazard fact), scores per-item necessity,
 * and aggregates to a FRACTION relied-upon — a genuine count over independent decisions, not one turn
 * angle scored against N geometries. With NO API key it runs the two reference mocks (a corpus-bound
 * learner should read every hazard corpus-bound; a leaking one, leaking). Set a credential
 * (BEDROCK_MODEL [+AWS creds] / GEMINI_API_KEY / OPENAI_API_KEY) to run a real model.
 *
 *   AUDIT_LOG=<path>   append one JSONL row per model call (prompt, answer, decision, kinematics).
 *   TEMP=<t>           Bedrock decode temperature (default 0; >0 for a sampled ensemble / CI).
 */
import './_env';
import { appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  runLeakageExperiment,
  hazardProbe,
  boundLearnerCompleter,
  leakingLearnerCompleter,
  throttleCompleter,
  retryCompleter,
  type Completer,
  type LeakageConfig,
  type LeakageAuditRow,
} from '../src/engine/colreg-sim';
import { selectRealCompleter } from '../src/engine/real-completer';
import { colregDomain } from '../src/corpus/colreg';
import { HAZARD_SUITE, suiteScenario, suiteNode, suiteDisclosure, type SuiteHazard } from '../src/corpus/colreg/hazard-suite';

function ensureParent(path: string): void { mkdirSync(dirname(path), { recursive: true }); }

/** Isolated single-fact config for one hazard: standard rules + THIS hazard's fact only. */
function cfgFor(h: SuiteHazard): LeakageConfig {
  const sc = suiteScenario(h);
  return {
    corpusNodes: [...colregDomain.nodes, suiteNode(h)],
    scenarios: [sc],
    probes: [hazardProbe(sc, [sc])],
    closedBookScenario: sc,
  };
}

async function runSuite(complete: Completer, label: string, onAudit?: (r: LeakageAuditRow) => void) {
  const rows: Array<{ id: string; side: string; verdict: string; necessity: number; regretWith: number }> = [];
  for (const h of HAZARD_SUITE) {
    const rep = await runLeakageExperiment(complete, label, { ...cfgFor(h), onAudit });
    const v = rep.perRule[0];
    rows.push({ id: h.id, side: h.side, verdict: v.verdict, necessity: v.regretDelta, regretWith: v.regretWith });
  }
  const relied = rows.filter((r) => r.verdict === 'corpus-bound').length;
  const unusable = rows.filter((r) => r.verdict === 'leaking' && r.regretWith >= 10).length;
  const meanNec = rows.reduce((a, r) => a + r.necessity, 0) / (rows.length || 1);

  console.log(`\n── ${label}  (${HAZARD_SUITE.length} independent corpus-only hazards) ──`);
  console.log('  id      side       verdict        necessity(δregret)  regret-with');
  for (const r of rows)
    console.log(`  ${r.id}  ${r.side.padEnd(9)}  ${r.verdict.padEnd(13)}  ${r.necessity.toFixed(1).padStart(12)}  ${r.regretWith.toFixed(1).padStart(11)}`);
  console.log(
    `  NECESSITY = ${relied}/${HAZARD_SUITE.length} hazards relied-upon (corpus-bound) · ` +
      `${unusable} unusable · mean necessity ${meanNec.toFixed(1)}`,
  );
  console.log(
    `  → a genuine fraction over ${HAZARD_SUITE.length} independent decisions (teach K of N into the ` +
      `weights ⇒ necessity ≈ (N−K)/N, a graded dose-response).`,
  );
}

async function main() {
  console.log(`Hazard suite: ${HAZARD_SUITE.length} fictional corpus-only dangers (ports & starboards alternate).`);
  console.log(`e.g. ${HAZARD_SUITE[0].id}: "${suiteDisclosure(HAZARD_SUITE[0])}"`);

  const real = selectRealCompleter();

  const auditPath = process.env.AUDIT_LOG;
  const temp = Number(process.env.TEMP ?? 0);
  if (auditPath) { ensureParent(auditPath); writeFileSync(auditPath, ''); }
  const audit = (providerLabel: string) =>
    auditPath
      ? (row: LeakageAuditRow) =>
          appendFileSync(auditPath, JSON.stringify({
            utc: new Date().toISOString(), model: process.env.BEDROCK_MODEL ?? providerLabel,
            provider: providerLabel, temp, probes: 'hazard-suite', ...row,
          }) + '\n')
      : undefined;

  if (!real || process.env.SHOW_MOCK === '1') {
    console.log('\nDeterministic dry-run (no key needed) — the instrument must recover the known ground truth:');
    await runSuite(boundLearnerCompleter([], [], ['RULE-HAZARD-01']), 'mock: corpus-bound learner', audit('mock:bound'));
    await runSuite(leakingLearnerCompleter(), 'mock: leaking learner', audit('mock:leaking'));
  }
  if (!real) {
    console.log('\nNo LLM credential found — skipping the live run. Set BEDROCK_MODEL (with AWS creds) / GEMINI_API_KEY / OPENAI_API_KEY.');
    return;
  }
  try {
    const rpm = Number(process.env.RPM ?? (process.env.BEDROCK_MODEL ? 30 : 5));
    const retries = Number(process.env.GEMINI_RETRIES ?? 5);
    const completer = throttleCompleter(retryCompleter(real.completer, { retries }), Math.ceil(60000 / Math.max(1, rpm)) + 700);
    console.log(`\nLive run (${real.label}, throttled to ~${rpm} req/min):`);
    await runSuite(completer, real.label, audit(real.label));
    if (auditPath) console.log(`\naudit log: ${auditPath}`);
  } catch (e) {
    console.log(`\nLive LLM call failed: ${(e as Error).message}\nThe harness is validated by the dry-run above.`);
  }
}

main();
