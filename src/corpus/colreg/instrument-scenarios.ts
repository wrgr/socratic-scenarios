/**
 * The canonical transfer-instrument scenario set — a varied encounter battery with
 * multiple geometries per COLREG encounter class (head-on, starboard/port crossing,
 * overtaking, restricted visibility). It is deliberately broad so that (a) the
 * objective J spans a graded range rather than saturating, and (b) every knowledge
 * component of the competence vector θ *binds* on at least one case: the
 * restricted-visibility cases exercise `safeSpeed`, the crossings exercise
 * `starboard`, and so on.
 *
 * Shared by the construct-validity check (`scripts/colreg-construct-validity.ts`)
 * and the sensitivity analysis (`scripts/colreg-sensitivity.ts`) so both report on
 * the *same* instrument — the sensitivity claim ("this instrument's ranking is
 * stable") is only meaningful against the instrument the other results use.
 */
import type { SimScenario } from '../../engine/colreg-sim/types';
import { makeScenario, collisionTarget, leadTarget } from './benchmark-geometry';

export const instrumentScenarios: SimScenario[] = [
  // Head-on, varying range/closing speed.
  makeScenario('HO-1', 'Head-on (near, fast)', 'beginner', [collisionTarget('A', 0, 5500, 13)]),
  makeScenario('HO-2', 'Head-on (mid)', 'beginner', [collisionTarget('A', 0, 6000, 12)]),
  makeScenario('HO-3', 'Head-on (far, slow)', 'beginner', [collisionTarget('A', 0, 6800, 10)]),
  // Starboard crossing (own vessel give-way), varying bearing.
  makeScenario('XG-1', 'Starboard crossing 045', 'intermediate', [collisionTarget('A', 45, 6000, 12)]),
  makeScenario('XG-2', 'Starboard crossing 070', 'intermediate', [collisionTarget('A', 70, 6000, 11)]),
  // Port crossing (own vessel stand-on).
  makeScenario('XS-1', 'Port crossing 315', 'intermediate', [collisionTarget('A', -45, 6000, 12)]),
  // Overtaking a slower vessel dead ahead (own vessel is the give-way, must keep clear).
  makeScenario('OT-1', 'Overtaking lead vessel', 'intermediate', [leadTarget('A', 0, 2500, 6)]),
  // Restricted visibility (radar-only), head-on and crossing — exercises safeSpeed.
  makeScenario('RV-1', 'Restricted vis, head-on', 'advanced', [collisionTarget('A', 0, 6000, 12)], 'restricted'),
  makeScenario('RV-2', 'Restricted vis, crossing', 'advanced', [collisionTarget('A', 55, 6000, 12)], 'restricted'),
];
