/**
 * Instrument sensitivity analysis (paper §Limitations → result) — runnable.
 *
 *   npm run colreg:sensitivity
 *
 * The transfer instrument depends on weighting choices — the elliptical ship-domain
 * radii and the objective weights (margin/compliance/deviation). This script asks
 * whether the protocol's *conclusions* survive those choices by holding every
 * learner's behavior fixed and re-scoring under a large ensemble of perturbations
 * (a one-at-a-time ±25–50% sweep plus 200 joint ±40% samples), then checking two
 * orderings:
 *
 *   (R1) naive (hold-course) stays ranked worst, below both reference solvers;
 *   (R2) the six-component competence gradient stays monotone in J.
 *
 * Reports the fraction of perturbations preserving each ordering and Kendall's τ
 * against the nominal ranking. (CRI is excluded — it is a diagnostic readout, not a
 * term in the scored objective J, so the ranking is invariant to it by construction.)
 */
import './_env';
import { runSensitivity } from '../src/engine/colreg-sim';
import { instrumentScenarios as scenarios } from '../src/corpus/colreg/instrument-scenarios';

const pct = (x: number) => `${(100 * x).toFixed(1)}%`.padStart(7);
const fmt = (x: number, d = 3) => x.toFixed(d).padStart(8);

function main() {
  const rep = runSensitivity({ scenarios });

  console.log(
    `Instrument sensitivity — ${rep.nScenarios} scenarios, ${rep.nPerturbations} perturbations `
    + `(one-at-a-time sweep + 200 joint ±40% samples) of the ship-domain and objective weights.\n`,
  );

  console.log('Nominal mean J (default weights):');
  console.log(
    `  policies:  naive ${fmt(rep.nominalPolicyJ.naive)}   VO ${fmt(rep.nominalPolicyJ.vo)}`
    + `   SB-MPC ${fmt(rep.nominalPolicyJ.mpc)}`,
  );
  console.log(
    `  gradient (stages 0→6): [${rep.nominalGradientJ.map((j) => j.toFixed(2)).join(', ')}]\n`,
  );

  console.log('Ranking stability under perturbation:');
  console.log('  ordering                          preserved    mean τ    min τ');
  console.log('  ' + '-'.repeat(62));
  console.log(
    '  R1  naive ranked worst          ' + pct(rep.policy.invariantRate)
    + '   ' + fmt(rep.policy.meanTau) + fmt(rep.policy.minTau),
  );
  console.log(
    '  R2  competence gradient monotone' + pct(rep.gradient.invariantRate)
    + '   ' + fmt(rep.gradient.meanTau) + fmt(rep.gradient.minTau),
  );

  const stable = rep.policy.invariantRate === 1 && rep.gradient.invariantRate === 1;
  console.log(
    `\n${stable ? '✓' : '✗'} The protocol ranking is `
    + `${stable ? 'stable' : 'NOT fully stable'} across the weighting perturbations `
    + `(τ ≥ ${Math.min(rep.policy.minTau, rep.gradient.minTau).toFixed(2)}).`,
  );
}

main();
