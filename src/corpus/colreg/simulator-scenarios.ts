/**
 * Numeric encounter setups for the COLREG interactive simulator.
 * These are the geometry behind the same encounters taught in the basic COLREG
 * domain (head-on, crossing, overtaking, stand-on, restricted visibility) plus an
 * Imazu-style two-target case. Distances in metres, speeds in m/s.
 */
import type { SimScenario, Vessel } from '../../engine/colreg-sim';
import { KNOTS_TO_MS } from '../../engine/colreg-sim';

const kn = (k: number) => k * KNOTS_TO_MS;

/** Ownship template — a ~100 m vessel with realistic maneuvering limits. */
function ownship(psi: number, speedKn: number, over: Partial<Vessel> = {}): Vessel {
  return {
    id: 'own',
    label: 'Ownship',
    x: 0,
    y: 0,
    psi,
    v: kn(speedKn),
    lengthM: 100,
    turnRadiusMin: 500,
    accelMax: 0.08,
    headingTau: 25,
    vMin: kn(3),
    vMax: kn(18),
    ...over,
  };
}

function target(id: string, x: number, y: number, psi: number, speedKn: number): Vessel {
  return { id, label: id, x, y, psi, v: kn(speedKn), lengthM: 100 };
}

const W = -Math.PI / 2; // heading West
const E = Math.PI / 2; // heading East
const S = Math.PI; // heading South
const N = 0; // heading North

export const colregSimScenarios: SimScenario[] = [
  {
    id: 'SIM-HEADON',
    label: 'Head-On',
    description:
      'A power-driven vessel is nearly dead ahead on a reciprocal course. Both should alter boldly to starboard (Rule 14). Find the smallest starboard alteration that opens the margin.',
    difficulty: 'intermediate',
    ownship: ownship(N, 12),
    targets: [target('A', 0, 6500, S, 12)],
    visibility: 'clear',
    horizonS: 1000,
    dt: 4,
    intendedHeading: N,
  },
  {
    id: 'SIM-CROSSING',
    label: 'Crossing — Give Way',
    description:
      'A vessel crosses from your starboard side on a steady bearing. You are the give-way vessel (Rule 15): alter to starboard and pass astern — do not cut to port across her bow.',
    difficulty: 'intermediate',
    ownship: ownship(N, 12),
    targets: [target('A', 3800, 4200, W, 10)],
    visibility: 'clear',
    horizonS: 1000,
    dt: 4,
    intendedHeading: N,
  },
  {
    id: 'SIM-OVERTAKING',
    label: 'Overtaking',
    description:
      'You are overtaking a slower vessel from astern (Rule 13) and must keep well clear. Pass at a safe distance rather than shaving close.',
    difficulty: 'beginner',
    ownship: ownship(N, 15, { vMax: kn(20) }),
    targets: [target('A', 120, 2200, N, 6)],
    visibility: 'clear',
    horizonS: 900,
    dt: 4,
    intendedHeading: N,
  },
  {
    id: 'SIM-STANDON',
    label: 'Stand-On (crossing from port)',
    description:
      'A vessel crosses from your port side — you are the stand-on vessel (Rule 17). Hold course and speed, but be ready to act; if you do act, do not alter to port toward her.',
    difficulty: 'advanced',
    ownship: ownship(N, 12),
    targets: [target('A', -3800, 4200, E, 10)],
    visibility: 'clear',
    horizonS: 1000,
    dt: 4,
    intendedHeading: N,
  },
  {
    id: 'SIM-RESTRICTED',
    label: 'Restricted Visibility',
    description:
      'In fog you have only a radar contact forward of the beam. Reduce to a safe speed (Rules 6/19) and take early avoiding action to starboard for a contact forward of the beam.',
    difficulty: 'intermediate',
    ownship: ownship(N, 16, { vMax: kn(18) }),
    targets: [target('A', 1400, 6500, S, 10)],
    visibility: 'restricted',
    horizonS: 1000,
    dt: 4,
    intendedHeading: N,
  },
  {
    id: 'SIM-IMAZU-2',
    label: 'Two Targets (Imazu-style)',
    description:
      'A head-on vessel and a starboard crosser at once — an Imazu-style multi-ship case. One maneuver must keep clear of both while staying compliant.',
    difficulty: 'advanced',
    ownship: ownship(N, 12),
    targets: [target('A', 0, 6500, S, 12), target('B', 4200, 4600, W, 10)],
    visibility: 'clear',
    horizonS: 1000,
    dt: 4,
    intendedHeading: N,
  },
  {
    id: 'SIM-IMAZU-3',
    label: 'Three Targets — Head-On + Both Crossers',
    description:
      'Head-on ahead, a crosser from starboard, and a crosser from port simultaneously. A starboard alteration must open all three while respecting stand-on duties to the port crosser.',
    difficulty: 'advanced',
    ownship: ownship(N, 12),
    targets: [
      target('A', 0, 6500, S, 12),
      target('B', 4200, 4600, W, 10),
      target('C', -4200, 4600, E, 10),
    ],
    visibility: 'clear',
    horizonS: 1000,
    dt: 4,
    intendedHeading: N,
  },
  {
    id: 'SIM-IMAZU-OT-CROSS',
    label: 'Overtake + Starboard Crosser',
    description:
      'You are overtaking a slow vessel ahead (keep well clear, Rule 13) while a faster vessel crosses from starboard (give way, Rule 15). Two different duties in one maneuver.',
    difficulty: 'advanced',
    ownship: ownship(N, 15, { vMax: kn(20) }),
    targets: [target('A', 150, 2300, N, 5), target('B', 4000, 4200, W, 11)],
    visibility: 'clear',
    horizonS: 900,
    dt: 4,
    intendedHeading: N,
  },
  {
    id: 'SIM-IMAZU-4',
    label: 'Four Targets — Crowded Water',
    description:
      'Head-on, two starboard crossers at different ranges, and a port crosser. An Imazu-style crowded case: find one bold, compliant maneuver that keeps every domain clear.',
    difficulty: 'advanced',
    ownship: ownship(N, 12),
    targets: [
      target('A', 0, 6500, S, 12),
      target('B', 3000, 3400, W, 9),
      target('C', 5200, 5600, W, 11),
      target('D', -3800, 4200, E, 10),
    ],
    visibility: 'clear',
    horizonS: 1000,
    dt: 4,
    intendedHeading: N,
  },
  {
    id: 'SIM-IMAZU-FINEBOW',
    label: 'Fine on the Bow + Overtaken',
    description:
      'A vessel crossing fine on your starboard bow, plus a faster vessel overtaking you from astern (it must keep clear of you). Hold what you must, give way where you must.',
    difficulty: 'advanced',
    ownship: ownship(N, 11),
    targets: [target('A', 2200, 5200, W, 10), target('B', 300, -2600, N, 16)],
    visibility: 'clear',
    horizonS: 1000,
    dt: 4,
    intendedHeading: N,
  },
];

export function getSimScenarioById(id: string): SimScenario | undefined {
  return colregSimScenarios.find((s) => s.id === id);
}
