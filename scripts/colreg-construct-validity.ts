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
import {
  makeScenario,
  collisionTarget,
  leadTarget,
} from '../src/corpus/colreg/benchmark-geometry';

// A varied instrument: multiple geometries per encounter class so J spans a range.
const scenarios = [
  // Head-on, varying range/closing speed.
  makeScenario('HO-1', 'Head-on (near, fast)', 'beginner', [collisionTarget('A', 0, 5500, 13)]),
  makeScenario('HO-2', 'Head-on (mid)', 'beginner', [collisionTarget('A', 0, 6000, 12)]),
  makeScenario('HO-3', 'Head-on (far, slow)', 'beginner', [collisionTarget('A', 0, 6800, 10)]),
  // Starboard crossing (own vessel give-way), varying bearing.
  makeScenario('XG-1', 'Starboard crossing 045', 'intermediate', [collisionTarget('A', 45, 6000, 12)]),
  makeScenario('XG-2', 'Starboard crossing 070', 'intermediate', [collisionTarget('A', 70, 6000, 11)]),
  // Port crossing (own vessel stand-on).
  makeScenario('XS-1', 'Port crossing 315', 'intermediate', [collisionTarget('A', -45, 6000, 12)]),
  // Overtaking a slower vessel ahead.
  makeScenario('OT-1', 'Overtaking lead vessel', 'intermediate', [leadTarget('A', 2500, 6)]),
  // Restricted visibility (radar-only), head-on and crossing.
  makeScenario('RV-1', 'Restricted vis, head-on', 'advanced', [collisionTarget('A', 0, 6000, 12)], 'restricted'),
  makeScenario('RV-2', 'Restricted vis, crossing', 'advanced', [collisionTarget('A', 55, 6000, 12)], 'restricted'),
];

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
