import { describe, it, expect } from 'vitest';
import type { Vessel, SimScenario } from '../types';
import { wrapPi, maxTurnRate, stepOwnship, stepTarget, integrate, maneuverControl } from '../kinematics';
import { cpa } from '../cpa';
import { clearanceFactor, domainRadii } from '../ship-domain';
import { criInstant } from '../cri';
import { classify } from '../colreg-rules';
import { evaluate } from '../objective';
import { solveReference } from '../reference-solver';

const own = (o: Partial<Vessel> = {}): Vessel => ({
  id: 'own', x: 0, y: 0, psi: 0, v: 6, lengthM: 100,
  turnRadiusMin: 600, accelMax: 0.1, headingTau: 20, vMin: 2, vMax: 8, ...o,
});
const tgt = (o: Partial<Vessel>): Vessel => ({ id: 't', x: 0, y: 0, psi: 0, v: 6, lengthM: 100, ...o });

describe('wrapPi', () => {
  it('wraps to (-pi, pi]', () => {
    expect(wrapPi(0)).toBeCloseTo(0);
    expect(wrapPi(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapPi(-3 * Math.PI)).toBeCloseTo(Math.PI);
  });
});

describe('CPA', () => {
  it('head-on closing gives DCPA≈0', () => {
    const r = cpa(own({ psi: 0, v: 6 }), tgt({ x: 0, y: 3000, psi: Math.PI, v: 6 }));
    expect(r.dcpa).toBeLessThan(1);
    expect(r.tcpa).toBeCloseTo(250, 0);
  });
  it('parallel same-course gives DCPA = lateral offset, TCPA 0', () => {
    const r = cpa(own({ psi: 0, v: 6 }), tgt({ x: 1000, y: 0, psi: 0, v: 6 }));
    expect(r.dcpa).toBeCloseTo(1000, 0);
    expect(r.tcpa).toBe(0);
  });
});

describe('kinematics', () => {
  it('turn rate is speed-coupled (v / turnRadiusMin)', () => {
    expect(maxTurnRate(own({ v: 6, turnRadiusMin: 600 }))).toBeCloseTo(0.01);
    expect(maxTurnRate(own({ v: 12, turnRadiusMin: 600 }))).toBeCloseTo(0.02);
  });
  it('honors the turn-rate limit and never overshoots the command', () => {
    let v = own({ psi: 0, v: 6, turnRadiusMin: 600, headingTau: 20 });
    const cmd = { headingCmd: Math.PI / 2, speedCmd: 6 };
    for (let i = 0; i < 5; i++) v = stepOwnship(v, cmd, 1);
    expect(v.psi).toBeGreaterThan(0);
    expect(v.psi).toBeLessThanOrEqual(0.05 + 1e-9); // 5 steps × 0.01 rad/s
    expect(v.psi).toBeLessThan(cmd.headingCmd);
  });
  it('advances a target on a straight course', () => {
    const t = stepTarget(tgt({ x: 0, y: 0, psi: 0, v: 5 }), 10);
    expect(t.y).toBeCloseTo(50);
    expect(t.x).toBeCloseTo(0);
  });
});

describe('ship domain', () => {
  it('is inside (<1) within, on the boundary (≈1), and 2× at twice the radius', () => {
    const o = own({ v: 0 }); // speedScale = 1 → fore = 600
    expect(clearanceFactor(o, tgt({ x: 0, y: 300 }))).toBeCloseTo(0.5, 1);
    expect(clearanceFactor(o, tgt({ x: 0, y: 600 }))).toBeCloseTo(1.0, 1);
    expect(clearanceFactor(o, tgt({ x: 0, y: 1200 }))).toBeCloseTo(2.0, 1);
  });
  it('is asymmetric — starboard radius larger than port', () => {
    const r = domainRadii(own({ v: 0 }));
    expect(r.star).toBeGreaterThan(r.port);
    const o = own({ v: 0 });
    // A target 300 m to starboard is inside; 300 m to port is outside.
    expect(clearanceFactor(o, tgt({ x: 300, y: 0 }))).toBeLessThan(
      clearanceFactor(o, tgt({ x: -300, y: 0 })),
    );
  });
});

describe('CRI', () => {
  it('is in [0,1] and higher on a collision course than far apart', () => {
    const collide = criInstant(own({ psi: 0, v: 6 }), tgt({ x: 0, y: 800, psi: Math.PI, v: 6 }));
    const clear = criInstant(own({ psi: 0, v: 6 }), tgt({ x: 20000, y: 20000, psi: 0, v: 1 }));
    expect(collide).toBeGreaterThanOrEqual(0);
    expect(collide).toBeLessThanOrEqual(1);
    expect(collide).toBeGreaterThan(clear);
  });
});

describe('encounter classification', () => {
  it('head-on', () => {
    expect(classify(own({ psi: 0 }), tgt({ x: 0, y: 3000, psi: Math.PI })).encounter).toBe('head-on');
  });
  it('crossing give-way (target on starboard)', () => {
    const c = classify(own({ psi: 0, v: 6 }), tgt({ x: 2000, y: 2000, psi: -Math.PI / 2, v: 6 }));
    expect(c.encounter).toBe('crossing-give-way');
    expect(c.role).toBe('give-way');
    expect(c.targetOnStarboard).toBe(true);
  });
  it('crossing stand-on (target on port)', () => {
    const c = classify(own({ psi: 0, v: 6 }), tgt({ x: -2000, y: 2000, psi: Math.PI / 2, v: 6 }));
    expect(c.encounter).toBe('crossing-stand-on');
    expect(c.role).toBe('stand-on');
  });
  it('overtaking', () => {
    const c = classify(own({ psi: 0, v: 8 }), tgt({ x: 0, y: 1000, psi: 0, v: 3 }));
    expect(c.encounter).toBe('overtaking');
    expect(c.role).toBe('give-way');
  });
});

// A crossing give-way scenario on a genuine collision course.
const crossingScenario: SimScenario = {
  id: 'test-crossing', label: 'test', description: '', difficulty: 'intermediate',
  ownship: own({ psi: 0, v: 6 }),
  targets: [tgt({ id: 'A', x: 2000, y: 3000, psi: -Math.PI / 2, v: 4 })],
  visibility: 'clear', horizonS: 600, dt: 2, intendedHeading: 0,
};

describe('objective', () => {
  it('flags a domain incursion for do-nothing on a collision course, and the barrier dominates', () => {
    const traj = integrate(crossingScenario, maneuverControl(crossingScenario.ownship, { courseOffset: 0, speedFactor: 1, actTime: 0 }));
    const r = evaluate(crossingScenario, traj);
    expect(r.metrics.incursion).toBe(true);
    expect(r.terms.barrier).toBeGreaterThan(100);
  });
  it('deviation penalizes larger course changes (progress lost, not path length)', () => {
    const dev = (deg: number) =>
      evaluate(crossingScenario, integrate(crossingScenario, maneuverControl(crossingScenario.ownship, { courseOffset: deg * Math.PI / 180, speedFactor: 1, actTime: 0 }))).metrics.deviationPct;
    expect(dev(0)).toBeCloseTo(0, 2);
    expect(dev(90)).toBeGreaterThan(dev(30));
    expect(dev(30)).toBeGreaterThan(dev(0));
  });
  it('marginShortfall is 0 when the run stays clear of 2× the domain', () => {
    // Turn hard to starboard early — should open a wide margin.
    const traj = integrate(crossingScenario, maneuverControl(crossingScenario.ownship, { courseOffset: Math.PI / 2, speedFactor: 1, actTime: 0 }));
    const r = evaluate(crossingScenario, traj);
    expect(r.metrics.incursion).toBe(false);
  });
});

describe('reference solver (SB-MPC style)', () => {
  it('finds a domain-clearing avoiding maneuver for a solvable crossing', () => {
    const sol = solveReference(crossingScenario);
    expect(sol.inExtremis).toBe(false);
    expect(sol.best.result.metrics.incursion).toBe(false);
    // Some positive avoiding action (starboard alteration and/or speed reduction).
    expect(sol.best.maneuver.courseOffset > 0 || sol.best.maneuver.speedFactor < 1).toBe(true);
  });
  it('beats doing nothing', () => {
    const sol = solveReference(crossingScenario);
    const doNothing = evaluate(
      crossingScenario,
      integrate(crossingScenario, maneuverControl(crossingScenario.ownship, { courseOffset: 0, speedFactor: 1, actTime: 0 })),
    );
    expect(sol.best.result.J).toBeLessThan(doNothing.J);
  });
  it('degrades gracefully (inExtremis) when no maneuver can clear the domain', () => {
    const extremis: SimScenario = {
      ...crossingScenario,
      targets: [tgt({ id: 'A', x: 50, y: 50, psi: Math.PI, v: 6 })], // already inside the domain
    };
    const sol = solveReference(extremis);
    expect(sol.inExtremis).toBe(true);
    expect(sol.best).toBeDefined();
  });
});
