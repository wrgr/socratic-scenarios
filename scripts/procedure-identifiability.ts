/**
 * KC -> single-metric identifiability matrix (contribution C2) — runnable.
 *
 *   npm run proc:identifiability
 *
 * Ablates each knowledge component (KC) in turn from a fully-competent learner and reports
 * how every metric moves. The claim is NOT the diagonal (ablating a KC hurts its own
 * metric — true by construction); it is the OFF-diagonal: ablating one KC leaves the other
 * metrics unchanged (no cross-bleed). That is the empirically-checkable, falsifiable part
 * of identifiability — if the objective's terms were entangled, ablation would bleed across
 * metrics and the off-diagonal would be non-zero.
 */
import './_env';
import {
  FULL_COMPETENCE,
  ablate,
  learnerAttempt,
  scoreAttempt,
  type ProcedureCompetence,
  type ProcMetrics,
} from '../src/engine/procedure-sim';
import { tireChangeProcedure } from '../src/corpus/tire/procedure';

const KCS: (keyof ProcedureCompetence)[] = ['safety', 'coreSteps', 'sequencing', 'finishing'];
const METRICS: (keyof ProcMetrics)[] = ['safetyScore', 'coreCompleteness', 'orderScore', 'finishCompleteness'];
// Which metric each KC is designed to govern (the intended diagonal).
const GOVERNS: Record<keyof ProcedureCompetence, keyof ProcMetrics> = {
  safety: 'safetyScore',
  coreSteps: 'coreCompleteness',
  sequencing: 'orderScore',
  finishing: 'finishCompleteness',
};

const spec = tireChangeProcedure;
const base = scoreAttempt(spec, learnerAttempt(spec, FULL_COMPETENCE)).metrics;

const pad = (s: string, n: number) => s.padEnd(n);
const num = (x: number) => (x >= 0 ? ' ' : '') + x.toFixed(2);

console.log(`KC -> metric identifiability on "${spec.label}" (Δmetric after ablating each KC;`
  + ` 0.00 = no change). Diagonal marked *.\n`);
console.log(pad('ablated KC \\ metric', 20) + METRICS.map((m) => pad(m, 18)).join(''));
console.log('-'.repeat(20 + 18 * METRICS.length));

let maxOffDiag = 0;
for (const kc of KCS) {
  const m = scoreAttempt(spec, learnerAttempt(spec, ablate(FULL_COMPETENCE, kc))).metrics;
  const cells = METRICS.map((metric) => {
    const delta = m[metric] - base[metric];
    const gov = GOVERNS[kc] === metric;
    if (!gov) maxOffDiag = Math.max(maxOffDiag, Math.abs(delta));
    return pad(`${num(delta)}${gov ? ' *' : '  '}`, 18);
  });
  console.log(pad(kc, 20) + cells.join(''));
}

console.log('\n* = the metric this KC is designed to govern.');
console.log(`Max OFF-diagonal |Δ| = ${maxOffDiag.toFixed(4)}  `
  + `(0 ⇒ each KC moves ONLY its governed metric — identifiability holds, no cross-bleed).`);
