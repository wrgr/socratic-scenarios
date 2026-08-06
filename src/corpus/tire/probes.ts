/**
 * SocraticProbe nodes for the Roadside Tire Change domain.
 * Same shape as AJP probes: expectedConcepts drive the LLM Mentor's evaluation,
 * commonWrongAnswers seed targeted corrections, and safety-critical probes carry a
 * safetyAlert with masteryThreshold >= 0.90 (enforced by the integrity test).
 */
import type { AJPNode, AJPEdge } from '../../types/ajp';

export const tireProbeNodes: AJPNode[] = [
  {
    id: 'PROBE-TIRE-SECURE-VEHICLE-001',
    type: 'SocraticProbe',
    content:
      'Before you lift the car even a centimetre, what must you do to keep it from moving — and why is each of those steps necessary?',
    expectedConcepts: [
      'Set the parking brake',
      'Put an automatic in Park, or a manual transmission in gear',
      'Chock the wheel diagonally opposite the one being changed',
      'Park on firm, level ground — not a slope',
      'Lifting removes one wheel’s contribution to holding the car, so the remaining restraints must be positive before jacking',
    ],
    commonWrongAnswers: [
      'The parking brake alone is enough',
      'Chocking is optional on flat ground',
      'You can secure it after you start jacking',
    ],
    masteryThreshold: 0.9,
    safetyAlert: 'Safety-critical: an unsecured vehicle can roll off the jack.',
    confidence: 'High',
    source: "Vehicle owner's manual; NHTSA roadside guidance",
  },
  {
    id: 'PROBE-TIRE-JACK-POINT-001',
    type: 'SocraticProbe',
    content:
      'Where exactly do you place the jack, and what goes wrong if you lift somewhere else?',
    expectedConcepts: [
      'Use the reinforced jack point — the marked pinch-weld seam behind the front wheels / ahead of the rear wheels',
      'The owner manual shows the exact locations',
      'Lifting on the floor pan, oil pan, suspension, or plastic trim bends the body',
      'A jack on unreinforced metal can slip, dropping the vehicle',
      'Firm, level ground under the jack base is part of a correct placement',
    ],
    commonWrongAnswers: [
      'Anywhere solid-looking under the car is fine',
      'Under the oil pan is close enough',
      'The plastic sill trim is the jack point',
    ],
    masteryThreshold: 0.9,
    safetyAlert: 'Safety-critical: a mis-placed jack can slip and drop the vehicle.',
    confidence: 'High',
    source: "Vehicle owner's manual jacking-point diagram",
  },
  {
    id: 'PROBE-TIRE-LOOSEN-FIRST-001',
    type: 'SocraticProbe',
    content:
      'Should you loosen the lug nuts before or after you raise the car with the jack? Explain the reasoning.',
    expectedConcepts: [
      'Break the lug nuts loose before lifting, while the tire is on the ground',
      'The grounded tire’s friction holds the wheel so it does not spin as you apply force',
      'Trying to loosen after lifting spins the wheel and rocks the car on the jack',
      'Only remove the nuts fully once the wheel is off the ground',
    ],
    commonWrongAnswers: [
      'It does not matter when you loosen them',
      'Loosen them after lifting so the wheel is easier to reach',
      'Hold the wheel still with your foot while it is in the air',
    ],
    masteryThreshold: 0.8,
    confidence: 'High',
    source: "Vehicle owner's manual",
  },
  {
    id: 'PROBE-TIRE-STAR-TORQUE-001',
    type: 'SocraticProbe',
    content:
      'When the spare is on, how do you tighten the lug nuts — in what order, to what, and at what point in the process? What is the risk if you get this wrong?',
    expectedConcepts: [
      'Tighten in a star (crisscross) pattern, not sequentially around the circle',
      'Torque to the vehicle-specified value (commonly ~80–100 lb-ft — check the manual)',
      'Final torque is done with the wheel back on the ground, not in the air',
      'A star pattern seats the wheel evenly against the hub',
      'Under-torqued or uneven nuts can back off and the wheel can come off while driving',
    ],
    commonWrongAnswers: [
      'Tighten them as hard as you can with the wrench',
      'Go around the circle in order',
      'Torque them fully while the wheel is still in the air',
    ],
    masteryThreshold: 0.9,
    safetyAlert: 'Safety-critical: improper torque can let the wheel detach in service.',
    confidence: 'High',
    source: "Vehicle owner's manual lug-torque spec; TIA wheel-installation practice",
  },
  {
    id: 'PROBE-TIRE-SPARE-LIMITS-001',
    type: 'SocraticProbe',
    content:
      'You have fitted a compact "donut" spare. How does that change how you drive, and for how long?',
    expectedConcepts: [
      'Compact spares have a speed limit, commonly around 50 mph',
      'They have a distance limit, commonly around 70 miles',
      'They offer less grip and no reserve tread — drive gently and avoid highway speeds',
      'It is temporary — get the full tire repaired or replaced promptly',
    ],
    commonWrongAnswers: [
      'A donut is fine to drive normally',
      'You can keep it on indefinitely',
      'Speed does not matter as long as you are careful',
    ],
    masteryThreshold: 0.8,
    confidence: 'High',
    source: "Vehicle owner's manual spare-tire section",
  },
];

// ─── Probe → target-node edges ────────────────────────────────────

export const tireProbeEdges: AJPEdge[] = [
  { from: 'PROBE-TIRE-SECURE-VEHICLE-001', to: 'FAULT-TIRE-NO-CHOCK-001', type: 'PROBES' },
  { from: 'PROBE-TIRE-JACK-POINT-001', to: 'PARAM-TIRE-JACK-POINT-001', type: 'PROBES' },
  { from: 'PROBE-TIRE-JACK-POINT-001', to: 'FAULT-TIRE-JACK-WRONG-POINT-001', type: 'PROBES' },
  { from: 'PROBE-TIRE-LOOSEN-FIRST-001', to: 'FAULT-TIRE-LOOSEN-AFTER-LIFT-001', type: 'PROBES' },
  { from: 'PROBE-TIRE-STAR-TORQUE-001', to: 'FAULT-TIRE-TORQUE-IMPROPER-001', type: 'PROBES' },
  { from: 'PROBE-TIRE-STAR-TORQUE-001', to: 'PARAM-TIRE-LUG-TORQUE-001', type: 'PROBES' },
  { from: 'PROBE-TIRE-SPARE-LIMITS-001', to: 'PARAM-TIRE-SPARE-LIMITS-001', type: 'PROBES' },
  // Probe → tacit-knowledge targets (surface "why this matters" background)
  { from: 'PROBE-TIRE-SECURE-VEHICLE-001', to: 'TACIT-TIRE-CHOCK-DIAGONAL-001', type: 'PROBES' },
  { from: 'PROBE-TIRE-SECURE-VEHICLE-001', to: 'TACIT-TIRE-VISIBILITY-001', type: 'PROBES' },
  { from: 'PROBE-TIRE-JACK-POINT-001', to: 'TACIT-TIRE-JACK-POINT-001', type: 'PROBES' },
  { from: 'PROBE-TIRE-JACK-POINT-001', to: 'TACIT-TIRE-GROUND-CHECK-001', type: 'PROBES' },
  { from: 'PROBE-TIRE-LOOSEN-FIRST-001', to: 'TACIT-TIRE-LOOSEN-BEFORE-LIFT-001', type: 'PROBES' },
  { from: 'PROBE-TIRE-STAR-TORQUE-001', to: 'TACIT-TIRE-STAR-PATTERN-001', type: 'PROBES' },
  { from: 'PROBE-TIRE-STAR-TORQUE-001', to: 'TACIT-TIRE-TORQUE-ON-GROUND-001', type: 'PROBES' },
  { from: 'PROBE-TIRE-STAR-TORQUE-001', to: 'TACIT-TIRE-RETORQUE-001', type: 'PROBES' },
  { from: 'PROBE-TIRE-SPARE-LIMITS-001', to: 'TACIT-TIRE-DONUT-LIMITS-001', type: 'PROBES' },
  { from: 'PROBE-TIRE-SPARE-LIMITS-001', to: 'TACIT-TIRE-SPARE-PRESSURE-001', type: 'PROBES' },
];
