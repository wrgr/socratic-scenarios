import { describe, it, expect } from 'vitest';
import { solveReference, evaluateManeuver, integrate, maneuverControl } from '../../../engine/colreg-sim';
import { scoreCompliance } from '../../../engine/colreg-sim';
import type { SimScenario, Policy, Maneuver } from '../../../engine/colreg-sim';
import {
  REASON_SUITE,
  conflictScenario,
  matchedScenario,
  implementerPolicy,
  reasonerPolicy,
} from '../reason-implement';

const DEG = Math.PI / 180;
const regret = (s: SimScenario, p: Policy) => {
  const ref = solveReference(s).best.result.J;
  const r = evaluateManeuver(s, p(s));
  return { regret: r.J - ref, grounds: r.terms.barrier > 0 };
};
const port = (deg = 30): Maneuver => ({ courseOffset: -deg * DEG, speedFactor: 1, actTime: 0 });

// Exp B2 — the instrument separates a lookup implementer from a reasoner ONLY where a corpus local
// rule overrides the reflex; they are identical on textbook cases.
describe('reason-vs-implement — implementer and reasoner diverge only on the overriding reaches (B2)', () => {
  it('MATCHED (no local rule): implementer and reasoner are indistinguishable', () => {
    const s = matchedScenario();
    const imp = regret(s, implementerPolicy);
    const rea = regret(s, reasonerPolicy);
    expect(imp.grounds).toBe(false);
    expect(rea.grounds).toBe(false);
    expect(Math.abs(imp.regret - rea.regret)).toBeLessThan(0.01); // literally the same maneuver
  });

  it('CONFLICT, local rule OVERRIDES (deep water to port): implementer grounds, reasoner clears', () => {
    const s = conflictScenario({ id: 'P', safeSide: 'port', location: 'a test reach', note: 'deep water to port' });
    const imp = regret(s, implementerPolicy);
    const rea = regret(s, reasonerPolicy);
    expect(imp.grounds).toBe(true); // rigid Rule-14 starboard stands into the shoal
    expect(imp.regret).toBeGreaterThan(1000);
    expect(rea.grounds).toBe(false); // reads the local rule, alters to port, clears
    expect(rea.regret).toBeLessThan(1);
  });

  it('CONFLICT, local rule REDUNDANT (deep water to starboard): both clear (rule agrees with Rule 14)', () => {
    const s = conflictScenario({ id: 'S', safeSide: 'starboard', location: 'a test reach', note: 'keep starboard' });
    const imp = regret(s, implementerPolicy);
    const rea = regret(s, reasonerPolicy);
    expect(imp.grounds).toBe(false);
    expect(rea.grounds).toBe(false);
    expect(Math.abs(imp.regret - rea.regret)).toBeLessThan(0.01);
  });

  it('over the suite: reasoner clears all; implementer clears exactly the non-overriding reaches', () => {
    const scns = REASON_SUITE.map(conflictScenario);
    const reaCleared = scns.filter((s) => !regret(s, reasonerPolicy).grounds).length;
    const impCleared = scns.filter((s) => !regret(s, implementerPolicy).grounds).length;
    const redundant = REASON_SUITE.filter((c) => c.safeSide === 'starboard').length;
    expect(reaCleared).toBe(scns.length); // necessity fraction resolves — reasoner reads each rule
    expect(impCleared).toBe(redundant); // implementer only survives where the rule agrees with the reflex
  });
});

// The reasoning-aware objective: a corpus local rule redefines the governing give-way side, so the
// SAME port maneuver is compliant where the rule says port and non-compliant where it does not.
describe('reason-vs-implement — the local rule redefines the compliant direction', () => {
  const complianceOf = (s: SimScenario, m: Maneuver) =>
    scoreCompliance(s, integrate(s, maneuverControl(s.ownship, m)));
  const dirCheck = (s: SimScenario, m: Maneuver) =>
    complianceOf(s, m).checks.find((c) => c.id === 'direction');

  it('a port turn is COMPLIANT when the local rule makes port the governing side', () => {
    const s = conflictScenario({ id: 'P', safeSide: 'port', location: 'a test reach', note: 'deep water to port' });
    expect(dirCheck(s, port())?.pass).toBe(true);
  });

  it('a port turn is NON-compliant on the plain head-on (default starboard governs) — behavior unchanged', () => {
    const s = matchedScenario();
    expect(dirCheck(s, port())?.pass).toBe(false);
  });
});
