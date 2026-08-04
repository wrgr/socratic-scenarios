import { describe, it, expect } from 'vitest';
import type { Vessel, SimScenario } from '../types';
import { ownVelocity, collisionCone, inCone, chooseAvoidance, safetyRadius } from '../velocity-obstacle';

const own = (o: Partial<Vessel> = {}): Vessel => ({
  id: 'own', x: 0, y: 0, psi: 0, v: 6, lengthM: 100,
  turnRadiusMin: 500, accelMax: 0.1, headingTau: 20, vMin: 2, vMax: 9, ...o,
});
const tgt = (o: Partial<Vessel>): Vessel => ({ id: 't', x: 0, y: 0, psi: 0, v: 6, lengthM: 100, ...o });

// Use a modest Rs so cones are narrow and geometric expectations are crisp.
const RS = 300;

describe('velocity obstacle', () => {
  it('a head-on collision course puts own velocity inside the cone', () => {
    const o = own({ psi: 0, v: 6 });
    const t = tgt({ x: 0, y: 3000, psi: Math.PI, v: 6 });
    const cone = collisionCone(o, t, RS);
    expect(cone.enveloping).toBe(false);
    expect(inCone(ownVelocity(o), cone)).toBe(true);
  });

  it('a bold starboard turn escapes the cone', () => {
    const t = tgt({ x: 0, y: 3000, psi: Math.PI, v: 6 });
    const cone = collisionCone(own(), t, RS);
    const turned = own({ psi: Math.PI / 2 }); // heading East
    expect(inCone(ownVelocity(turned), cone)).toBe(false);
  });

  it('matching a parallel target (constant range) is not a collision', () => {
    const o = own({ psi: 0, v: 6 });
    const t = tgt({ x: 1000, y: 0, psi: 0, v: 6 });
    const cone = collisionCone(o, t, RS);
    expect(inCone(ownVelocity(o), cone)).toBe(false);
  });

  it('flags an enveloping cone when the target is already within Rs', () => {
    const o = own();
    const t = tgt({ x: 100, y: 100, psi: Math.PI, v: 6 });
    const cone = collisionCone(o, t, RS);
    expect(cone.enveloping).toBe(true);
    expect(inCone(ownVelocity(o), cone)).toBe(true);
  });

  it('safetyRadius grows with a larger vessel', () => {
    expect(safetyRadius(own({ lengthM: 200 }))).toBeGreaterThan(safetyRadius(own({ lengthM: 100 })));
  });
});

describe('chooseAvoidance', () => {
  const crossing: SimScenario = {
    id: 's', label: '', description: '', difficulty: 'intermediate',
    ownship: own({ psi: 0, v: 6 }),
    targets: [tgt({ id: 'A', x: 2000, y: 3000, psi: -Math.PI / 2, v: 4 })],
    visibility: 'clear', horizonS: 600, dt: 2, intendedHeading: 0,
  };

  it('finds a VO-clear velocity for a solvable crossing, biased to starboard', () => {
    const c = chooseAvoidance(crossing, 400);
    expect(c.feasible).toBe(true);
    // The chosen velocity is outside the (single) target cone.
    const cone = collisionCone(crossing.ownship, crossing.targets[0], 400);
    expect(inCone(c.velocity, cone)).toBe(false);
    // Prefers a starboard (>= 0) alteration when one is available.
    expect(c.headingOffset).toBeGreaterThanOrEqual(0);
  });
});
