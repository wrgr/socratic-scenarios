/**
 * SocraticProbe nodes for the COLREG Collision Avoidance domain.
 * expectedConcepts drive the LLM Mentor; safety-critical probes carry a
 * safetyAlert with masteryThreshold >= 0.90.
 */
import type { AJPNode, AJPEdge } from '../../types/ajp';

export const colregProbeNodes: AJPNode[] = [
  {
    id: 'PROBE-COLREG-CROSSING-001',
    type: 'SocraticProbe',
    content:
      'A power-driven vessel is crossing from your own starboard side and the bearing is steady. Who is the give-way vessel, what action do you take, and what must you avoid doing?',
    expectedConcepts: [
      'The vessel that has the other on its starboard side gives way — so you give way (Rule 15)',
      'A steady bearing means risk of collision exists (Rule 7)',
      'Take early and substantial action to keep well clear (Rule 16)',
      'Normally alter boldly to starboard, and pass astern of the other vessel',
      'Avoid crossing ahead of the other vessel',
      'Do not alter to port for a vessel on your starboard side',
    ],
    commonWrongAnswers: [
      'The other vessel must give way because you were there first',
      'Alter to port to go behind it',
      'Hold course and speed because you are the stand-on vessel',
    ],
    masteryThreshold: 0.9,
    safetyAlert: 'Safety-critical: mishandling a crossing give-way is a classic collision cause.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rules 15, 16, 7',
  },
  {
    id: 'PROBE-COLREG-STARBOARD-001',
    type: 'SocraticProbe',
    content:
      'In both a head-on situation and a typical crossing give-way, the preferred alteration is to starboard. Why to starboard rather than to port?',
    expectedConcepts: [
      'In head-on, both vessels alter to starboard so each passes port-to-port (Rule 14)',
      'Turning to starboard is predictable and mutually consistent — both vessels expect it',
      'Altering to port risks turning into the other vessel’s path if it also turns as the Rules expect',
      'A starboard alteration keeps a crossing vessel on your starboard and lets you pass astern of it',
      'Predictability is itself a safety property — the Rules make actions mutually anticipatable',
    ],
    commonWrongAnswers: [
      'Port is fine as long as you turn enough',
      'It does not matter which way you turn',
      'Turn whichever way is a shorter course change',
    ],
    masteryThreshold: 0.9,
    safetyAlert: 'Safety-critical: altering to port in these situations turns into the danger.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rules 14, 15, 17',
  },
  {
    id: 'PROBE-COLREG-SUBSTANTIAL-001',
    type: 'SocraticProbe',
    content:
      'Rule 8 says avoiding action must be "readily apparent" and warns against a succession of small alterations. Why must your alteration be substantial, and what is wrong with several small changes?',
    expectedConcepts: [
      'The other vessel must be able to see your alteration by eye and by radar',
      'A small change is not detectable, especially at range or on radar',
      'A bold, single alteration (often ~30° or more in open water) communicates your intention',
      'A succession of small changes is ambiguous and can be misread as your normal yawing',
      'Positive, early, ample-time action is the standard (Rule 8)',
    ],
    commonWrongAnswers: [
      'Small frequent corrections are safer because they are gentle',
      'As long as CPA increases the size does not matter',
      'The other vessel will call on VHF if unsure',
    ],
    masteryThreshold: 0.85,
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 8',
  },
  {
    id: 'PROBE-COLREG-BEARING-001',
    type: 'SocraticProbe',
    content:
      'You take repeated compass bearings of an approaching vessel and they barely change while the range decreases. What does that tell you, and what quantity captures it?',
    expectedConcepts: [
      'A steady (constant) compass bearing with decreasing range indicates risk of collision (Rule 7)',
      'It means the CPA is near zero — you are on a collision course',
      'CPA is the closest point of approach; TCPA is the time to reach it',
      'If in doubt whether risk exists, assume it does',
      'An appreciable bearing change can still involve risk at close range or with a large vessel/tow',
    ],
    commonWrongAnswers: [
      'A steady bearing means it will pass clear',
      'Only radar can tell you if there is risk',
      'If the bearing changes at all you are always safe',
    ],
    masteryThreshold: 0.85,
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 7',
  },
  {
    id: 'PROBE-COLREG-STANDON-001',
    type: 'SocraticProbe',
    content:
      'You are the stand-on vessel in a crossing. The give-way vessel does not appear to be doing anything. What are your duties as the range closes, and how do they change?',
    expectedConcepts: [
      'Initially keep your course and speed (Rule 17a)',
      'You may take action as soon as it is apparent the give-way vessel is not taking appropriate action',
      'You must take action when collision cannot be avoided by the give-way vessel alone',
      'If taking action in a crossing, do not alter to port for a vessel on your own port side (Rule 17c)',
      '"Stand-on" is not "hold course regardless" — the duty escalates as risk grows',
    ],
    commonWrongAnswers: [
      'The stand-on vessel must never change course or speed',
      'It is entirely the give-way vessel’s problem',
      'Alter to port to get out of the way quickly',
    ],
    masteryThreshold: 0.9,
    safetyAlert: 'Safety-critical: failing to act as stand-on when the give-way vessel does not is a shared-fault collision cause.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 17',
  },
  {
    id: 'PROBE-COLREG-SAFE-SPEED-001',
    type: 'SocraticProbe',
    content:
      'What determines a "safe speed" under Rule 6, and how should your speed differ in fog with a radar contact versus clear daylight?',
    expectedConcepts: [
      'Safe speed lets you take effective action and stop in an appropriate distance',
      'Factors include visibility, traffic density, manoeuvrability and stopping distance, sea state, and radar limitations',
      'In restricted visibility a materially lower speed is required (Rules 6, 19)',
      'It is not a fixed number — it is conditions-dependent',
      'Engines should be ready for immediate manoeuvre in restricted visibility',
    ],
    commonWrongAnswers: [
      'Safe speed is just the posted or service speed',
      'Radar means you can keep full speed in fog',
      'Speed does not matter if you have right of way',
    ],
    masteryThreshold: 0.8,
    confidence: 'High',
    source: 'IMO COLREG 1972, Rules 6, 19',
  },
];

// ─── Probe → target-node edges ────────────────────────────────────

export const colregProbeEdges: AJPEdge[] = [
  { from: 'PROBE-COLREG-CROSSING-001', to: 'RULE-COLREG-15', type: 'PROBES' },
  { from: 'PROBE-COLREG-CROSSING-001', to: 'FAULT-COLREG-ALTER-TO-PORT-001', type: 'PROBES' },
  { from: 'PROBE-COLREG-STARBOARD-001', to: 'RULE-COLREG-14', type: 'PROBES' },
  { from: 'PROBE-COLREG-STARBOARD-001', to: 'ACTION-COLREG-ALTER-STARBOARD-001', type: 'PROBES' },
  { from: 'PROBE-COLREG-SUBSTANTIAL-001', to: 'RULE-COLREG-08', type: 'PROBES' },
  { from: 'PROBE-COLREG-SUBSTANTIAL-001', to: 'FAULT-COLREG-SMALL-ALTERATION-001', type: 'PROBES' },
  { from: 'PROBE-COLREG-BEARING-001', to: 'RULE-COLREG-07', type: 'PROBES' },
  { from: 'PROBE-COLREG-BEARING-001', to: 'PARAM-COLREG-CPA-001', type: 'PROBES' },
  { from: 'PROBE-COLREG-STANDON-001', to: 'RULE-COLREG-17', type: 'PROBES' },
  { from: 'PROBE-COLREG-STANDON-001', to: 'FAULT-COLREG-STANDON-FAILS-001', type: 'PROBES' },
  { from: 'PROBE-COLREG-SAFE-SPEED-001', to: 'RULE-COLREG-06', type: 'PROBES' },
  { from: 'PROBE-COLREG-SAFE-SPEED-001', to: 'FAULT-COLREG-EXCESS-SPEED-VIS-001', type: 'PROBES' },
  // Probe → tacit-knowledge targets (surface "why this matters" background)
  { from: 'PROBE-COLREG-CROSSING-001', to: 'TACIT-COLREG-PASS-ASTERN-001', type: 'PROBES' },
  { from: 'PROBE-COLREG-STARBOARD-001', to: 'TACIT-COLREG-STARBOARD-BIAS-001', type: 'PROBES' },
  { from: 'PROBE-COLREG-SUBSTANTIAL-001', to: 'TACIT-COLREG-BOLD-ALTERATION-001', type: 'PROBES' },
  { from: 'PROBE-COLREG-SUBSTANTIAL-001', to: 'TACIT-COLREG-COURSE-OVER-SPEED-001', type: 'PROBES' },
  { from: 'PROBE-COLREG-BEARING-001', to: 'TACIT-COLREG-CBDR-001', type: 'PROBES' },
  { from: 'PROBE-COLREG-BEARING-001', to: 'TACIT-COLREG-RADAR-PLOTTING-001', type: 'PROBES' },
  { from: 'PROBE-COLREG-STANDON-001', to: 'TACIT-COLREG-STANDON-ESCALATION-001', type: 'PROBES' },
  { from: 'PROBE-COLREG-SAFE-SPEED-001', to: 'TACIT-COLREG-SAFE-SPEED-001', type: 'PROBES' },
  { from: 'PROBE-COLREG-SAFE-SPEED-001', to: 'TACIT-COLREG-RESTRICTED-VIS-001', type: 'PROBES' },
];
