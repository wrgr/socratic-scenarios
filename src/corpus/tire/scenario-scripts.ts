/**
 * Scripted ScenarioDefinition library for the Roadside Tire Change domain.
 * Five scenarios: a full nominal change plus four fault scenarios that arm a
 * safety gate and, if skipped, trigger the matching consequence. Narrator text is
 * grounded in the tire domain graph nodes — no LLM generation.
 */
import type { ScenarioDefinition } from '../../engine/scenario/types';

// ─── SCENARIO-TIRE-NOMINAL-001 ────────────────────────────────────

const SCENARIO_NOMINAL: ScenarioDefinition = {
  id: 'SCENARIO-TIRE-NOMINAL-001',
  label: 'Full Roadside Change',
  description:
    'Change a flat from a safe stop to a torqued spare with no faults injected. Four Mentor probes test securing the vehicle, jack placement, loosening order, and final torque.',
  difficulty: 'beginner',
  steps: [
    {
      id: 'TIRE-NOM-001',
      phase: 'LOCATE',
      narratorText:
        'You have a flat on the front right. You pull fully off the road onto firm, level pavement, well clear of the traffic lane. Hazard lights on; a warning triangle is set out behind the vehicle.',
    },
    {
      id: 'TIRE-NOM-002',
      phase: 'SECURE',
      narratorText:
        'The vehicle is stopped. Before touching the jack you prepare to secure it against any movement.',
      mentorProbeId: 'PROBE-TIRE-SECURE-VEHICLE-001',
    },
    {
      id: 'TIRE-NOM-003',
      phase: 'PREP',
      narratorText:
        'Parking brake set, transmission in Park, and the rear-left wheel chocked. The lug wrench fits the nuts.',
      mentorProbeId: 'PROBE-TIRE-LOOSEN-FIRST-001',
    },
    {
      id: 'TIRE-NOM-004',
      phase: 'LIFT',
      narratorText:
        'Each lug nut has been broken loose about a quarter turn with the tire still on the ground. Now you position the jack.',
      mentorProbeId: 'PROBE-TIRE-JACK-POINT-001',
    },
    {
      id: 'TIRE-NOM-005',
      phase: 'SWAP',
      narratorText:
        'The jack is under the reinforced pinch-weld point. You raise until the flat is a few centimetres off the ground, remove the lug nuts and the flat, and mount the spare, threading the nuts on hand-tight.',
    },
    {
      id: 'TIRE-NOM-006',
      phase: 'TORQUE',
      narratorText:
        'The spare is on and the nuts are snug. You lower the vehicle until the spare carries the weight.',
      mentorProbeId: 'PROBE-TIRE-STAR-TORQUE-001',
    },
    {
      id: 'TIRE-NOM-007',
      phase: 'STOW',
      narratorText:
        'Lug nuts torqued to spec in a star pattern. The flat, jack, and tools are stowed. You check the spare — it is a compact "donut".',
      mentorProbeId: 'PROBE-TIRE-SPARE-LIMITS-001',
    },
    {
      id: 'TIRE-NOM-008',
      phase: 'VERIFY',
      narratorText:
        'Spare inflation checked. You note the donut’s speed and distance limits and plan a route to a tire shop. Warning triangle retrieved once traffic is clear.',
    },
    {
      id: 'TIRE-NOM-009',
      phase: 'COMPLETE',
      narratorText:
        'Change complete. The vehicle is safely on the spare and ready to drive gently to a repair shop.',
    },
  ],
  faultInjections: [],
};

// ─── SCENARIO-TIRE-SOFT-GROUND-001 ────────────────────────────────

const SCENARIO_SOFT_GROUND: ScenarioDefinition = {
  id: 'SCENARIO-TIRE-SOFT-GROUND-001',
  label: 'Soft Shoulder',
  description:
    'The only place to stop looks like a gravel shoulder with a slight slope. The learner must recognise the unstable jack setup and reset before the vehicle drops.',
  difficulty: 'intermediate',
  steps: [
    {
      id: 'TIRE-SOFT-001',
      phase: 'LOCATE',
      narratorText:
        'The flat forces you onto a narrow shoulder. The surface is loose gravel over dirt and tilts gently toward the ditch. There is no paved pull-off in sight.',
    },
    {
      id: 'TIRE-SOFT-002',
      phase: 'SECURE',
      narratorText:
        'You set the parking brake, put it in Park, and chock a wheel. You break the lug nuts loose while the tire is down.',
      mentorProbeId: 'PROBE-TIRE-SECURE-VEHICLE-001',
    },
    {
      id: 'TIRE-SOFT-003',
      phase: 'LIFT',
      narratorText:
        'You set the jack on the gravel under the pinch weld and begin to raise the car. The jack base is starting to sink unevenly into the loose surface and the car leans slightly.',
      faultInjectionId: 'FAULT-TIRE-JACK-UNSTABLE-001',
      safetyGateNodeId: 'FAULT-TIRE-JACK-UNSTABLE-001',
    },
    {
      id: 'TIRE-SOFT-004',
      phase: 'LIFT',
      narratorText:
        'You lower the jack, move the car to the firmest, most level spot available, and seat the jack squarely — placing a flat board under the base to spread the load on the marginal ground.',
    },
    {
      id: 'TIRE-SOFT-005',
      phase: 'SWAP',
      narratorText:
        'On a stable base the car lifts cleanly. You swap the flat for the spare and hand-tighten the nuts.',
    },
    {
      id: 'TIRE-SOFT-006',
      phase: 'TORQUE',
      narratorText:
        'You lower the car and torque the nuts to spec in a star pattern.',
      mentorProbeId: 'PROBE-TIRE-STAR-TORQUE-001',
    },
    {
      id: 'TIRE-SOFT-007',
      phase: 'COMPLETE',
      narratorText:
        'The unstable setup was caught and corrected before the car could fall. Change complete.',
    },
  ],
  faultInjections: [
    {
      faultNodeId: 'FAULT-TIRE-JACK-UNSTABLE-001',
      triggerStepId: 'TIRE-SOFT-003',
      narratorAnnouncement:
        'The jack is sinking into the gravel and the car is leaning. On soft or sloped ground a jack can tip and the vehicle can fall. Reset on firm, level ground before lifting further.',
      missedConsequenceId: 'CONSEQUENCE-TIRE-VEHICLE-FALL-001',
    },
  ],
};

// ─── SCENARIO-TIRE-NO-CHOCK-001 ───────────────────────────────────

const SCENARIO_NO_CHOCK: ScenarioDefinition = {
  id: 'SCENARIO-TIRE-NO-CHOCK-001',
  label: 'Skipped the Chock',
  description:
    'In a hurry, the learner reaches for the jack without securing the vehicle. The safety gate is recognising that the car is free to roll before it is lifted.',
  difficulty: 'beginner',
  steps: [
    {
      id: 'TIRE-CHOCK-001',
      phase: 'LOCATE',
      narratorText:
        'You are stopped on level pavement off the roadway with hazards on. It has started to drizzle and you want to move quickly.',
    },
    {
      id: 'TIRE-CHOCK-002',
      phase: 'SECURE',
      narratorText:
        'You crank the parking brake but, wanting to save time, you leave the transmission in neutral, skip the wheel chock, and go straight for the jack.',
      faultInjectionId: 'FAULT-TIRE-NO-CHOCK-001',
      safetyGateNodeId: 'FAULT-TIRE-NO-CHOCK-001',
    },
    {
      id: 'TIRE-CHOCK-003',
      phase: 'SECURE',
      narratorText:
        'You stop and finish securing the vehicle: transmission in Park, and a chock firmly against the wheel diagonally opposite the flat.',
    },
    {
      id: 'TIRE-CHOCK-004',
      phase: 'LIFT',
      narratorText:
        'With the car properly secured you break the lugs loose, place the jack on the reinforced point, and lift.',
      mentorProbeId: 'PROBE-TIRE-JACK-POINT-001',
    },
    {
      id: 'TIRE-CHOCK-005',
      phase: 'SWAP',
      narratorText:
        'The spare goes on and the nuts are hand-tightened.',
    },
    {
      id: 'TIRE-CHOCK-006',
      phase: 'TORQUE',
      narratorText:
        'You lower the car and torque the lug nuts to spec in a star pattern.',
      mentorProbeId: 'PROBE-TIRE-STAR-TORQUE-001',
    },
    {
      id: 'TIRE-CHOCK-007',
      phase: 'COMPLETE',
      narratorText:
        'The rollaway risk was caught before lifting. Change complete.',
    },
  ],
  faultInjections: [
    {
      faultNodeId: 'FAULT-TIRE-NO-CHOCK-001',
      triggerStepId: 'TIRE-CHOCK-002',
      narratorAnnouncement:
        'The transmission is in neutral with no chock in place. The parking brake acts on only two wheels — lifting a corner can let the car roll off the jack. Secure it fully before lifting.',
      missedConsequenceId: 'CONSEQUENCE-TIRE-ROLLAWAY-001',
    },
  ],
};

// ─── SCENARIO-TIRE-WRONG-JACKPOINT-001 ────────────────────────────

const SCENARIO_WRONG_JACKPOINT: ScenarioDefinition = {
  id: 'SCENARIO-TIRE-WRONG-JACKPOINT-001',
  label: 'Wrong Jack Point',
  description:
    'The learner positions the jack under a convenient-looking spot that is not a reinforced jack point. The gate is recognising the risk of body damage and a slipping jack.',
  difficulty: 'intermediate',
  steps: [
    {
      id: 'TIRE-JP-001',
      phase: 'SECURE',
      narratorText:
        'Vehicle secured on level pavement: brake set, in Park, wheel chocked, lugs broken loose.',
      mentorProbeId: 'PROBE-TIRE-SECURE-VEHICLE-001',
    },
    {
      id: 'TIRE-JP-002',
      phase: 'LIFT',
      narratorText:
        'Looking under the car you see a flat section of the floor pan that seems solid, and slide the jack under it — it is closer than the marked seam.',
      faultInjectionId: 'FAULT-TIRE-JACK-WRONG-POINT-001',
      safetyGateNodeId: 'FAULT-TIRE-JACK-WRONG-POINT-001',
    },
    {
      id: 'TIRE-JP-003',
      phase: 'LIFT',
      narratorText:
        'You reposition the jack under the reinforced pinch-weld seam shown in the owner manual and lift from there instead.',
    },
    {
      id: 'TIRE-JP-004',
      phase: 'SWAP',
      narratorText:
        'The car lifts cleanly on the proper point. You fit the spare and hand-tighten the nuts.',
    },
    {
      id: 'TIRE-JP-005',
      phase: 'TORQUE',
      narratorText:
        'You lower the car and torque the lug nuts to spec in a star pattern.',
      mentorProbeId: 'PROBE-TIRE-STAR-TORQUE-001',
    },
    {
      id: 'TIRE-JP-006',
      phase: 'COMPLETE',
      narratorText:
        'The mis-placement was caught before it bent the body or slipped. Change complete.',
    },
  ],
  faultInjections: [
    {
      faultNodeId: 'FAULT-TIRE-JACK-WRONG-POINT-001',
      triggerStepId: 'TIRE-JP-002',
      narratorAnnouncement:
        'The jack is under the floor pan, not a reinforced jack point. Lifting here bends the body and the jack can slip off the deforming metal. Move it to the marked pinch-weld seam.',
      missedConsequenceId: 'CONSEQUENCE-TIRE-BODY-DAMAGE-001',
    },
  ],
};

// ─── SCENARIO-TIRE-TORQUE-001 ─────────────────────────────────────

const SCENARIO_TORQUE: ScenarioDefinition = {
  id: 'SCENARIO-TIRE-TORQUE-001',
  label: 'Rushed the Torque',
  description:
    'The spare is on and the learner is ready to drive off — but the lug nuts were only snugged in the air. The gate is completing proper torque before the wheel can come loose in service.',
  difficulty: 'intermediate',
  steps: [
    {
      id: 'TIRE-TQ-001',
      phase: 'SWAP',
      narratorText:
        'The spare is mounted and the lug nuts are threaded on. The car is still up on the jack.',
      mentorProbeId: 'PROBE-TIRE-LOOSEN-FIRST-001',
    },
    {
      id: 'TIRE-TQ-002',
      phase: 'TORQUE',
      narratorText:
        'You give each nut a quick pull with the wrench while the wheel is still in the air and start packing up — the light is fading and you want to get going.',
      faultInjectionId: 'FAULT-TIRE-TORQUE-IMPROPER-001',
      safetyGateNodeId: 'FAULT-TIRE-TORQUE-IMPROPER-001',
    },
    {
      id: 'TIRE-TQ-003',
      phase: 'TORQUE',
      narratorText:
        'You lower the car so the spare carries the load, then torque every nut to the vehicle spec in a star pattern, double-checking each one.',
    },
    {
      id: 'TIRE-TQ-004',
      phase: 'STOW',
      narratorText:
        'Tools stowed. You note to re-check the torque after about 50 miles.',
      mentorProbeId: 'PROBE-TIRE-SPARE-LIMITS-001',
    },
    {
      id: 'TIRE-TQ-005',
      phase: 'COMPLETE',
      narratorText:
        'Proper torque was completed on the ground before driving. The wheel is secure. Change complete.',
    },
  ],
  faultInjections: [
    {
      faultNodeId: 'FAULT-TIRE-TORQUE-IMPROPER-001',
      triggerStepId: 'TIRE-TQ-002',
      narratorAnnouncement:
        'The lug nuts were only snugged with the wheel in the air, out of pattern. Uneven, under-torqued nuts can back off and the wheel can detach while driving. Lower the car and torque to spec in a star pattern first.',
      missedConsequenceId: 'CONSEQUENCE-TIRE-WHEEL-DETACH-001',
    },
  ],
};

// ─── Exported library ──────────────────────────────────────────────

export const tireScenarioScripts: ScenarioDefinition[] = [
  SCENARIO_NOMINAL,
  SCENARIO_SOFT_GROUND,
  SCENARIO_NO_CHOCK,
  SCENARIO_WRONG_JACKPOINT,
  SCENARIO_TORQUE,
];

export function getTireScenarioById(id: string): ScenarioDefinition | undefined {
  return tireScenarioScripts.find((s) => s.id === id);
}
