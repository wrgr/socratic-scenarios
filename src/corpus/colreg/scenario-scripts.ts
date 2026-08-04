/**
 * Scripted ScenarioDefinition library for the COLREG Collision Avoidance domain.
 * Five encounters — head-on, crossing, overtaking, stand-on in extremis, and
 * restricted visibility — each arming a safety gate that, if skipped, triggers the
 * matching consequence. Narrator text is grounded in the COLREG domain nodes.
 */
import type { ScenarioDefinition } from '../../engine/scenario/types';

// ─── SCENARIO-COLREG-HEADON-001 (Rule 14) ─────────────────────────

const SCENARIO_HEADON: ScenarioDefinition = {
  id: 'SCENARIO-COLREG-HEADON-001',
  label: 'Head-On Meeting',
  description:
    'Two power-driven vessels close on reciprocal courses in open water. The learner must recognise the head-on situation and make a bold, mutually predictable starboard alteration rather than a small one.',
  difficulty: 'intermediate',
  steps: [
    {
      id: 'COLREG-HO-001',
      phase: 'LOOKOUT',
      narratorText:
        'Open sea, good visibility, you are making 14 knots. The look-out reports a vessel fine on the port bow showing both sidelights and a steady masthead configuration — end-on.',
      mentorProbeId: 'PROBE-COLREG-BEARING-001',
    },
    {
      id: 'COLREG-HO-002',
      phase: 'ASSESS_RISK',
      narratorText:
        'Repeated bearings are steady and the range is closing fast. Both sidelights remain visible: this is a nearly reciprocal, end-on meeting with risk of collision.',
      mentorProbeId: 'PROBE-COLREG-STARBOARD-001',
    },
    {
      id: 'COLREG-HO-003',
      phase: 'ACT',
      narratorText:
        'You begin your avoiding action. To test the water you nudge 5° to starboard and wait to see what the other vessel does.',
      faultInjectionId: 'FAULT-COLREG-SMALL-ALTERATION-001',
      safetyGateNodeId: 'FAULT-COLREG-SMALL-ALTERATION-001',
    },
    {
      id: 'COLREG-HO-004',
      phase: 'ACT',
      narratorText:
        'You commit to a bold alteration — 30° to starboard, held steadily — so the change is unmistakable by eye and on the other vessel’s radar. She is seen to alter to starboard as well; you will pass port-to-port.',
    },
    {
      id: 'COLREG-HO-005',
      phase: 'MONITOR',
      narratorText:
        'Bearings now draw rapidly to port and the range steadies then opens. CPA is comfortably clear.',
    },
    {
      id: 'COLREG-HO-006',
      phase: 'COMPLETE',
      narratorText:
        'The vessels pass port-to-port with ample clearance. Bold, mutual starboard action resolved the head-on cleanly.',
    },
  ],
  faultInjections: [
    {
      faultNodeId: 'FAULT-COLREG-SMALL-ALTERATION-001',
      triggerStepId: 'COLREG-HO-003',
      narratorAnnouncement:
        'A 5° nudge is not readily apparent to the other vessel by eye or radar. In a head-on both vessels must alter boldly to starboard (Rule 14) — make one clear, substantial change now.',
      missedConsequenceId: 'CONSEQUENCE-COLREG-CLOSE-QUARTERS-001',
    },
  ],
};

// ─── SCENARIO-COLREG-CROSSING-001 (Rules 15/16) ───────────────────

const SCENARIO_CROSSING: ScenarioDefinition = {
  id: 'SCENARIO-COLREG-CROSSING-001',
  label: 'Crossing — Give Way',
  description:
    'A vessel crosses from your starboard side on a steady bearing. You are the give-way vessel. The gate is resisting the temptation to alter to port to "cut behind" — the classic crossing collision cause.',
  difficulty: 'intermediate',
  steps: [
    {
      id: 'COLREG-CR-001',
      phase: 'LOOKOUT',
      narratorText:
        'Daylight, moderate traffic. A power-driven vessel is about two points on your starboard bow, showing her red sidelight. You are making 12 knots.',
      mentorProbeId: 'PROBE-COLREG-CROSSING-001',
    },
    {
      id: 'COLREG-CR-002',
      phase: 'DECIDE_ROLE',
      narratorText:
        'Her bearing is steady and the range is decreasing — risk of collision exists. She is on your starboard side, so you are the give-way vessel.',
      mentorProbeId: 'PROBE-COLREG-BEARING-001',
    },
    {
      id: 'COLREG-CR-003',
      phase: 'ACT',
      narratorText:
        'Wanting the shortest deviation, you consider a turn to port to slip across and behind her stern.',
      faultInjectionId: 'FAULT-COLREG-ALTER-TO-PORT-001',
      safetyGateNodeId: 'FAULT-COLREG-ALTER-TO-PORT-001',
    },
    {
      id: 'COLREG-CR-004',
      phase: 'ACT',
      narratorText:
        'Instead you alter boldly to starboard (and ease speed as needed), taking early and substantial action to pass well clear astern of her.',
    },
    {
      id: 'COLREG-CR-005',
      phase: 'MONITOR',
      narratorText:
        'Her bearing now draws right and the range opens. You have passed clear astern.',
    },
    {
      id: 'COLREG-CR-006',
      phase: 'RESUME',
      narratorText:
        'Once finally past and clear you come back to port toward your intended track, minimising the overall deviation.',
    },
    {
      id: 'COLREG-CR-007',
      phase: 'COMPLETE',
      narratorText:
        'Crossing resolved: early starboard give-way action kept you well clear and avoided crossing ahead.',
    },
  ],
  faultInjections: [
    {
      faultNodeId: 'FAULT-COLREG-ALTER-TO-PORT-001',
      triggerStepId: 'COLREG-CR-003',
      narratorAnnouncement:
        'Altering to port for a vessel crossing from your starboard turns straight into her likely path and violates Rule 15. Give way by altering to starboard and pass astern — do not cross ahead.',
      missedConsequenceId: 'CONSEQUENCE-COLREG-COLLISION-001',
    },
  ],
};

// ─── SCENARIO-COLREG-OVERTAKING-001 (Rule 13) ─────────────────────

const SCENARIO_OVERTAKING: ScenarioDefinition = {
  id: 'SCENARIO-COLREG-OVERTAKING-001',
  label: 'Overtaking',
  description:
    'You are the faster vessel coming up on another from astern. The gate is recognising that the overtaking vessel keeps clear (Rule 13) and must pass at a safe distance, not squeeze by.',
  difficulty: 'beginner',
  steps: [
    {
      id: 'COLREG-OT-001',
      phase: 'CLASSIFY',
      narratorText:
        'You are overtaking a slower vessel, coming up well abaft her beam — you see only her sternlight. You intend to pass her.',
      mentorProbeId: 'PROBE-COLREG-SUBSTANTIAL-001',
    },
    {
      id: 'COLREG-OT-002',
      phase: 'ACT',
      narratorText:
        'To save time you line up to shave close down her side at full speed.',
      faultInjectionId: 'FAULT-COLREG-SMALL-ALTERATION-001',
      safetyGateNodeId: 'FAULT-COLREG-SMALL-ALTERATION-001',
    },
    {
      id: 'COLREG-OT-003',
      phase: 'ACT',
      narratorText:
        'Instead you alter to open the passing distance and keep well clear, holding that offset until you are past and clear — you are the give-way vessel and remain so throughout.',
    },
    {
      id: 'COLREG-OT-004',
      phase: 'MONITOR',
      narratorText:
        'You draw ahead with a safe lateral margin, watching that your wash and proximity do not affect her.',
    },
    {
      id: 'COLREG-OT-005',
      phase: 'RESUME',
      narratorText:
        'Only when finally past and clear do you come back across toward your track.',
    },
    {
      id: 'COLREG-OT-006',
      phase: 'COMPLETE',
      narratorText:
        'Overtaking completed keeping well clear, consistent with Rule 13.',
    },
  ],
  faultInjections: [
    {
      faultNodeId: 'FAULT-COLREG-SMALL-ALTERATION-001',
      triggerStepId: 'COLREG-OT-002',
      narratorAnnouncement:
        'As the overtaking vessel you must keep out of the way and pass at a safe distance (Rule 13). Shaving close leaves no margin — open the passing distance and keep well clear.',
      missedConsequenceId: 'CONSEQUENCE-COLREG-CLOSE-QUARTERS-001',
    },
  ],
};

// ─── SCENARIO-COLREG-STANDON-001 (Rule 17) ────────────────────────

const SCENARIO_STANDON: ScenarioDefinition = {
  id: 'SCENARIO-COLREG-STANDON-001',
  label: 'Stand-On in Extremis',
  description:
    'You are the stand-on vessel in a crossing, but the give-way vessel is not acting. The gate is Rule 17: hold course initially, but take avoiding action when it becomes clear she will not — and not to port for a vessel on your port side.',
  difficulty: 'advanced',
  steps: [
    {
      id: 'COLREG-SO-001',
      phase: 'DECIDE_ROLE',
      narratorText:
        'A vessel is crossing from your port side on a steady bearing. She is on your port hand, so you are the stand-on vessel; she is required to give way.',
      mentorProbeId: 'PROBE-COLREG-STANDON-001',
    },
    {
      id: 'COLREG-SO-002',
      phase: 'MONITOR',
      narratorText:
        'You keep your course and speed as required. The range keeps closing and her bearing stays steady — there is no sign she is taking any action.',
    },
    {
      id: 'COLREG-SO-003',
      phase: 'ACT',
      narratorText:
        'The range is now such that collision cannot be avoided by her action alone, yet you continue to hold course and speed, assuming she must eventually give way.',
      faultInjectionId: 'FAULT-COLREG-STANDON-FAILS-001',
      safetyGateNodeId: 'FAULT-COLREG-STANDON-FAILS-001',
    },
    {
      id: 'COLREG-SO-004',
      phase: 'ACT',
      narratorText:
        'You sound five short and rapid blasts and take positive avoiding action — a bold alteration to starboard (not to port, since she is on your port side), and reduce speed as needed.',
    },
    {
      id: 'COLREG-SO-005',
      phase: 'MONITOR',
      narratorText:
        'The range steadies and begins to open; the danger is passing.',
    },
    {
      id: 'COLREG-SO-006',
      phase: 'COMPLETE',
      narratorText:
        'Collision averted. As stand-on vessel you correctly escalated from holding course to taking action when the give-way vessel failed to act (Rule 17).',
    },
  ],
  faultInjections: [
    {
      faultNodeId: 'FAULT-COLREG-STANDON-FAILS-001',
      triggerStepId: 'COLREG-SO-003',
      narratorAnnouncement:
        'The give-way vessel is plainly not acting and collision can no longer be avoided by her alone. Rule 17 now requires you to act — take avoiding action, and do not alter to port for a vessel on your port side.',
      missedConsequenceId: 'CONSEQUENCE-COLREG-COLLISION-001',
    },
  ],
};

// ─── SCENARIO-COLREG-RESTRICTED-VIS-001 (Rules 6/19) ──────────────

const SCENARIO_RESTRICTED_VIS: ScenarioDefinition = {
  id: 'SCENARIO-COLREG-RESTRICTED-VIS-001',
  label: 'Restricted Visibility',
  description:
    'In fog you have only a radar contact forward of the beam. The gate is Rule 6/19: proceed at a safe speed and take avoiding action in ample time, avoiding an alteration to port for a vessel forward of the beam.',
  difficulty: 'intermediate',
  steps: [
    {
      id: 'COLREG-RV-001',
      phase: 'LOOKOUT',
      narratorText:
        'Dense fog; visibility under half a mile. You are proceeding at full sea speed of 16 knots. Radar shows a contact fine on the starboard bow at 6 miles, closing.',
      mentorProbeId: 'PROBE-COLREG-SAFE-SPEED-001',
    },
    {
      id: 'COLREG-RV-002',
      phase: 'ASSESS_RISK',
      narratorText:
        'Plotting the contact shows a steady bearing and a small CPA — a close-quarters situation is developing, detected by radar alone.',
    },
    {
      id: 'COLREG-RV-003',
      phase: 'ACT',
      narratorText:
        'You decide to hold 16 knots and stand on, planning to sort it out visually once you sight her.',
      faultInjectionId: 'FAULT-COLREG-EXCESS-SPEED-VIS-001',
      safetyGateNodeId: 'FAULT-COLREG-EXCESS-SPEED-VIS-001',
    },
    {
      id: 'COLREG-RV-004',
      phase: 'ACT',
      narratorText:
        'You reduce to a safe speed with engines ready, sound the fog signal, and — since the contact is forward of the beam — take avoiding action by altering to starboard in ample time (not to port).',
    },
    {
      id: 'COLREG-RV-005',
      phase: 'MONITOR',
      narratorText:
        'The radar plot shows CPA opening well clear. You maintain the safe speed until well past the contact.',
    },
    {
      id: 'COLREG-RV-006',
      phase: 'COMPLETE',
      narratorText:
        'Passed clear. Safe speed plus an early, correct alteration resolved a radar-only close-quarters situation (Rules 6 and 19).',
    },
  ],
  faultInjections: [
    {
      faultNodeId: 'FAULT-COLREG-EXCESS-SPEED-VIS-001',
      triggerStepId: 'COLREG-RV-003',
      narratorAnnouncement:
        'Full sea speed in fog leaves no time or distance to avoid a contact you cannot see. Rules 6 and 19 require a safe speed and early avoiding action — slow down and act now, altering to starboard for a contact forward of the beam.',
      missedConsequenceId: 'CONSEQUENCE-COLREG-CLOSE-QUARTERS-001',
    },
  ],
};

// ─── Exported library ──────────────────────────────────────────────

export const colregScenarioScripts: ScenarioDefinition[] = [
  SCENARIO_HEADON,
  SCENARIO_CROSSING,
  SCENARIO_OVERTAKING,
  SCENARIO_STANDON,
  SCENARIO_RESTRICTED_VIS,
];

export function getColregScenarioById(id: string): ScenarioDefinition | undefined {
  return colregScenarioScripts.find((s) => s.id === id);
}
