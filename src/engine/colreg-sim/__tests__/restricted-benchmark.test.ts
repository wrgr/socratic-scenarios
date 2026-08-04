import { describe, it, expect } from 'vitest';
import { restrictedBenchmark, getRestrictedCaseById } from '../../../corpus/colreg/restricted';
import { runBenchmark, holdCoursePolicy, mpcPolicy, voPolicy } from '../benchmark';
import { scoreCompliance } from '../colreg-rules';
import { integrate, maneuverControl } from '../kinematics';
import type { Maneuver } from '../types';
import { learnerPolicy, FULL_COMPETENCE, ablate } from '../learner-policy';
import { diagnoseCorpusGaps } from '../diagnose';

const scoreManeuver = (scenario: (typeof restrictedBenchmark)[number], m: Maneuver) =>
  scoreCompliance(scenario, integrate(scenario, maneuverControl(scenario.ownship, m)));
const applicable = (r: ReturnType<typeof scoreCompliance>, id: string) =>
  r.checks.find((c) => c.id === id && c.applicable);

describe('Restricted-visibility benchmark — construct validity under Rule 19', () => {
  const naive = runBenchmark(restrictedBenchmark, holdCoursePolicy);
  const mpc = runBenchmark(restrictedBenchmark, mpcPolicy);
  const vo = runBenchmark(restrictedBenchmark, voPolicy);

  it('defines 10 fog cases, all flagged restricted', () => {
    expect(restrictedBenchmark).toHaveLength(10);
    expect(restrictedBenchmark.every((s) => s.visibility === 'restricted')).toBe(true);
  });

  it('do-nothing collides on nearly every case (targets are on collision courses)', () => {
    expect(naive.clearedRate).toBeLessThan(0.2);
    expect(naive.meanCriMax).toBeGreaterThan(0.8);
  });

  it('the SB-MPC expert clears the domains at far lower cost AND far lower Rule 19 penalty', () => {
    expect(mpc.clearedRate).toBeGreaterThan(naive.clearedRate + 0.4);
    expect(mpc.meanJ).toBeLessThan(naive.meanJ);
    // The safe-speed axis is live here (unlike the clear-vis Imazu set), so a
    // Rule-19-aware expert must separate on compliance too, not just clearance.
    expect(mpc.meanCompliancePenalty).toBeLessThan(naive.meanCompliancePenalty - 0.3);
  });

  it('the VO expert clears the domains but complies less (it is tuned for clear-vis min-deviation)', () => {
    expect(vo.clearedRate).toBeGreaterThan(naive.clearedRate + 0.4);
    expect(vo.meanJ).toBeLessThan(naive.meanJ);
    // Emergent, and the point of the subset: the deviation-minimizing VO expert
    // holds speed more than the objective-optimal SB-MPC, so it is less Rule-19
    // compliant in fog even while clearing every domain.
    expect(vo.meanCompliancePenalty).toBeGreaterThan(mpc.meanCompliancePenalty);
  });
});

describe('Rule 19 changes the right answer — the discriminating cases', () => {
  it('a port-bow contact: holding is compliant in clear vis (stand-on) but fails under Rule 19', () => {
    const rv04 = getRestrictedCaseById('RV-04')!;
    const hold: Maneuver = { courseOffset: 0, speedFactor: 1, actTime: 0 };

    const clear = scoreCompliance({ ...rv04, visibility: 'clear' }, integrate(rv04, maneuverControl(rv04.ownship, hold)));
    const restricted = scoreManeuver(rv04, hold);

    // In sight, a vessel crossing from the port bow is the stand-on vessel: holding
    // course and speed is correct, so no penalty.
    expect(clear.penalty).toBeLessThan(0.05);
    // In restricted visibility there is no stand-on privilege — Rule 19(d) requires
    // avoiding action for the radar contact — so the same held course fails.
    expect(restricted.penalty).toBeGreaterThan(0.5);
    expect(applicable(restricted, 'take-action')!.pass).toBe(false);
  });

  it('19(d)(i): altering to PORT for a contact forward of the beam is penalized even if it clears', () => {
    const rv04 = getRestrictedCaseById('RV-04')!; // contact fine on the port bow (forward)
    const toPort = scoreManeuver(rv04, { courseOffset: -45 * (Math.PI / 180), speedFactor: 0.6, actTime: 0 });
    const noPort = applicable(toPort, 'no-port-turn')!;
    expect(noPort.pass).toBe(false);
  });

  it('19(d)(ii): altering TOWARD a contact abaft the beam is penalized', () => {
    const rv07 = getRestrictedCaseById('RV-07')!; // contact on the starboard quarter (abaft)
    expect(rv07 && Math.abs(rv07.targets.length)).toBe(1);
    const toward = scoreManeuver(rv07, { courseOffset: 30 * (Math.PI / 180), speedFactor: 0.6, actTime: 0 });
    const check = applicable(toward, 'no-turn-toward')!;
    expect(check).toBeTruthy();
    expect(check.pass).toBe(false);
  });

  it('an overtaking contact (RV-06) exempts the no-port-turn rule (19(d)(i) proviso)', () => {
    const rv06 = getRestrictedCaseById('RV-06')!;
    const toPort = scoreManeuver(rv06, { courseOffset: -30 * (Math.PI / 180), speedFactor: 0.6, actTime: 0 });
    // Being overtaken → the port-alteration prohibition does not apply.
    expect(applicable(toPort, 'no-port-turn')).toBeUndefined();
  });
});

describe('the safeSpeed competence axis now has cases to move', () => {
  const full = runBenchmark(restrictedBenchmark, learnerPolicy(FULL_COMPETENCE));
  const noSpeed = runBenchmark(restrictedBenchmark, learnerPolicy(ablate(FULL_COMPETENCE, 'safeSpeed')));

  it('a fully-competent learner is Rule-19 compliant across the fog set', () => {
    expect(full.meanCompliancePenalty).toBeLessThan(0.05);
    expect(full.clearedRate).toBeGreaterThan(0.9);
  });

  it('removing "safeSpeed" raises the compliance penalty on restricted-visibility cases', () => {
    // This is the honest null from the clear-vis Imazu set (docs/colreg-validation.md
    // Tier 2, finding b) turned into a live signal.
    expect(noSpeed.meanCompliancePenalty).toBeGreaterThan(full.meanCompliancePenalty + 0.3);
  });

  it('corpus-gap diagnosis localizes the missing safe-speed knowledge to Rules 6/19', () => {
    const findings = diagnoseCorpusGaps(restrictedBenchmark, noSpeed.perCase);
    expect(findings[0].component).toBe('safeSpeed');
    expect(findings[0].inspect).toContain('RULE-COLREG-19');
  });
});
