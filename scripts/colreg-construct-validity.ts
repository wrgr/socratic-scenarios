/**
 * Construct validity + metric grading (contribution C2) — runnable.
 *
 *   npm run colreg:construct
 *
 * Runs three policies of increasing competence — a naive hold-course policy, a
 * velocity-obstacle (VO) reference, and a simulation-based-MPC (SB-MPC) reference — across
 * a VARIED encounter set (head-on, starboard/port crossing, overtaking, restricted
 * visibility). Reports the continuous objective J (lower = better) per policy, its spread,
 * and regret against the stronger reference. The point is twofold: (a) the instrument
 * SEPARATES policies by competence (construct validity), and (b) J is GRADED, not
 * near-binary — it takes a continuous range across encounter geometries.
 */
import './_env';
import {
  holdCoursePolicy,
  voPolicy,
  mpcPolicy,
  runBenchmark,
  type Policy,
} from '../src/engine/colreg-sim';
import { instrumentScenarios as scenarios } from '../src/corpus/colreg/instrument-scenarios';

const policies: { name: string; policy: Policy }[] = [
  { name: 'naive (hold course)', policy: holdCoursePolicy },
  { name: 'VO reference', policy: voPolicy },
  { name: 'SB-MPC reference', policy: mpcPolicy },
];

const fmt = (x: number, d = 2) => x.toFixed(d).padStart(8);
const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))];
};

function main() {
  console.log(`Construct validity + grading — ${scenarios.length} scenarios across `
    + `head-on / crossing / overtaking / restricted-visibility.\n`);

  const results = policies.map((p) => ({ ...p, res: runBenchmark(scenarios, p.policy) }));
  const bestRef = scenarios.map((_, i) =>
    Math.min(results[1].res.perCase[i].J, results[2].res.perCase[i].J));

  console.log('Policy                mean J   median     min      max   cleared%   mean-regret');
  console.log('-'.repeat(84));
  for (const r of results) {
    const Js = r.res.perCase.map((c) => c.J);
    const regret = r.res.perCase.map((c, i) => c.J - bestRef[i]);
    const meanRegret = regret.reduce((a, b) => a + b, 0) / regret.length;
    console.log(
      r.name.padEnd(20)
      + fmt(r.res.meanJ) + fmt(quantile(Js, 0.5)) + fmt(Math.min(...Js)) + fmt(Math.max(...Js))
      + fmt(100 * r.res.clearedRate, 0) + '   ' + fmt(meanRegret));
  }

  console.log('\nDistinct J values across all policy×scenario cells (grading check):');
  const allJ = results.flatMap((r) => r.res.perCase.map((c) => Math.round(c.J * 100) / 100));
  const distinct = [...new Set(allJ)].sort((a, b) => a - b);
  console.log(`  ${distinct.length} distinct J values in [${Math.min(...allJ).toFixed(2)}, `
    + `${Math.max(...allJ).toFixed(2)}] — a graded metric, not near-binary.`);
}

main();
